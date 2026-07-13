'use strict';

/**
 * Agent 1B core orchestration — deliberately Express-free so it can be
 * required by __tests__ without pulling in the `express` dependency (mirrors
 * functions/agent1A/orchestrate.js and functions/agent0's pipeline.js split).
 * index.js is the thin Express wrapper around runPostCycle()/runIntelligenceCycle().
 *
 * Real network calls (zoho, workdrive, ayrshare, claude, socialMonitoring,
 * zohoSocial, reconcile, webhook) are all injected via `deps` so this can be
 * exercised with fakes in tests — no network, no deps, no secrets.
 */

const M = require('./manifest');
const criteria = require('./criteria');
const sequencing = require('./sequencing');
const alertsMod = require('./alerts');
const { buildRunSummary } = require('./run-summary');
const { retryFailedWritesOnce } = require('./retry');
const reconcile = require('./reconcile');

const zoho = require('./zoho');
const workdrive = require('./workdrive');
const ayrshare = require('./ayrshare');
const claude = require('./claude');
const socialMonitoring = require('./social-monitoring');
const zohoSocial = require('./zoho-social');
const webhook = require('./webhook');

const DEFAULT_DEPS = { zoho, workdrive, ayrshare, claude, socialMonitoring, zohoSocial, reconcile, webhook };

/** Fires a webhook and never throws — every call site treats delivery as a result, not an exception. */
async function fire(deps, url, payload) {
  return deps.webhook.fireWebhook(url, payload, { deps: { postJson: deps.webhook.postJson } });
}

async function sendOpsAlert(deps, args) {
  return fire(deps, process.env.MAKE_AGENT1B_ALERT_WEBHOOK, alertsMod.buildOpsAlert(args));
}

// ─────────────────────────────────────────────────────────────────────────────
// Post Cycle — design doc §4.1, runs Tuesday/Thursday 10:00 AM CST.
// ─────────────────────────────────────────────────────────────────────────────
async function runPostCycle(deps, today) {
  const runDate = today.toISOString();
  const folder02 = process.env.WORKDRIVE_FOLDER_02_ID;

  // Design doc §9 row 1: "Token refresh fails → Halt run. Send Parmeet alert.
  // Do not proceed with stale credentials." Refreshed up front, once, so a
  // genuine auth failure is never mistaken for "folder empty/unreadable" by
  // the tolerant .catch()s later in this cycle (workdrive/zoho calls below
  // assume this has already succeeded).
  try {
    await Promise.all([deps.workdrive.getWorkdriveToken(), deps.zoho.getCrmToken()]);
  } catch (err) {
    await sendOpsAlert(deps, {
      failureType: 'Token refresh failed', runDate, cycleType: 'post_cycle',
      failedStep: 'Token refresh', errorDetails: err.message,
      recommendedAction: 'Check ZOHO_WORKDRIVE_*/ZOHO_CRM_* credentials. Run halted — no stale-credential calls made.',
    });
    return { statusCode: 502, body: { success: false, cycleType: 'post_cycle', error: `Token refresh failed — run aborted: ${err.message}` } };
  }

  // Step 1: read approved assets, filter to unposted.
  const unposted = folder02 ? await deps.workdrive.listUnpostedAssets(folder02) : [];
  if (!unposted.length) {
    const allFiles = folder02 ? await deps.workdrive.listFolderFiles(folder02).catch(() => []) : [];
    const daysSinceLastPost = workdrive.daysSinceLastPost(allFiles, today);
    const delivery = await fire(deps, process.env.MAKE_LOW_CONTENT_WEBHOOK, alertsMod.buildLowContentAlertPayload({ daysSinceLastPost }));
    return {
      statusCode: 200,
      body: { success: true, cycleType: 'post_cycle', status: 'low_content', daysSinceLastPost, lowContentAlertDelivered: delivery.ok },
    };
  }

  // Step 2: select the oldest unposted asset.
  const asset = unposted[0];

  // Step 3: brand assets — both required, halt on any missing (design doc §9).
  const { assets, missing } = await deps.workdrive.readBrandAssets(process.env.WORKDRIVE_FOLDER_08_ID, M.BRAND_ASSET_FILES);
  if (missing.length) {
    await sendOpsAlert(deps, {
      failureType: 'Brand asset(s) missing', runDate, cycleType: 'post_cycle',
      failedStep: 'Step 3 — read Folder 08 brand assets',
      errorDetails: `Missing: ${missing.join(', ')}`,
      recommendedAction: 'Upload the missing brand asset file(s) to WorkDrive Folder 08. Post cycle halted — no post attempted.',
    });
    return { statusCode: 200, body: { success: false, cycleType: 'post_cycle', status: 'halted_missing_brand_assets', missing } };
  }

  // Step 4: generate captions. Claude API failure and non-JSON output both
  // skip the run without posting (design doc §9 — "Do not post without valid captions").
  let captionResult;
  try {
    captionResult = await deps.claude.generateCaptions(asset.name, assets[M.COPY_RULES_FILE], assets[M.VOICE_GUIDELINES_FILE]);
  } catch (err) {
    await sendOpsAlert(deps, {
      failureType: 'Claude API request failed', runDate, cycleType: 'post_cycle',
      failedStep: 'Step 4 — generate captions', errorDetails: err.message,
      recommendedAction: 'Check ANTHROPIC_API_KEY / Anthropic API status. Post cycle skipped — no post attempted.',
    });
    return { statusCode: 200, body: { success: false, cycleType: 'post_cycle', status: 'skipped_caption_api_failure' } };
  }
  if (!captionResult.ok) {
    await sendOpsAlert(deps, {
      failureType: 'Claude API returned non-JSON captions', runDate, cycleType: 'post_cycle',
      failedStep: 'Step 4 — generate captions', errorDetails: `${captionResult.error}. Raw: ${String(captionResult.raw).slice(0, 300)}`,
      recommendedAction: 'Review the raw Claude response. Post cycle skipped — no post attempted.',
    });
    return { statusCode: 200, body: { success: false, cycleType: 'post_cycle', status: 'skipped_invalid_captions' } };
  }

  // Step 5: post via Ayrshare — single call, all three platforms.
  const { results, allFailed } = await deps.ayrshare.postToAllPlatforms(captionResult.captions, asset.permalink);

  // Step 6: write Social Post Log (one record per platform, success or failed).
  let socialPostLogApi = null;
  let moduleDivergences = [];
  try {
    const resolvedModules = await deps.reconcile.resolveModules();
    socialPostLogApi = resolvedModules.resolved.socialPostLog || null;
    moduleDivergences = resolvedModules.divergences;
  } catch (err) {
    // Module resolution failure degrades the log write, does not block posting (posting already happened).
  }
  let socialPostLogSkipped = false;
  const logErrors = [];
  for (const r of results) {
    if (!socialPostLogApi) { socialPostLogSkipped = true; continue; }
    try {
      await deps.zoho.crmCreateRecord(socialPostLogApi, sequencing.buildSocialPostLogRecord({
        platform: r.platform, postId: r.postId, captionText: captionResult.captions[r.platform],
        assetFilename: asset.name, postedAt: runDate, status: r.ok ? 'success' : 'failed',
      }));
    } catch (err) {
      logErrors.push(`Social Post Log write failed for ${r.platform}: ${err.message}`);
    }
  }
  if (socialPostLogSkipped) {
    await sendOpsAlert(deps, {
      failureType: 'Social Post Log write skipped — module not provisioned', runDate, cycleType: 'post_cycle',
      failedStep: 'Step 6 — write Social Post Log', errorDetails: 'SOCIAL_POST_LOG_MODULE_API_NAME did not resolve live (see manifest.js divergence #7).',
      recommendedAction: 'Create the Social Post Log CRM module, or confirm its api_name, before Week 2. Posts were still published.',
    });
  }

  // Per-platform / all-platform failure alerts (design doc §9 — never blocks other platforms).
  const failedResults = results.filter((r) => !r.ok);
  for (const r of failedResults) {
    await fire(deps, process.env.MAKE_AGENT1B_ALERT_WEBHOOK, alertsMod.buildPostFailureAlert({ runDate, platform: r.platform, errorCode: r.errorCode, assetFilename: asset.name, allPlatformsFailed: allFailed }));
  }

  // Step 7: mark the asset _POSTED — only when at least one platform
  // succeeded, so an all-platform failure leaves the asset available for a
  // manual retry rather than silently consuming it (design doc §9: "Do not
  // retry automatically. Coordinator decides whether to retry manually.").
  let renamed = null;
  if (!allFailed) {
    try {
      renamed = await deps.workdrive.markAssetPosted(asset.id, asset.name);
    } catch (err) {
      await sendOpsAlert(deps, {
        failureType: 'Asset rename to _POSTED failed', runDate, cycleType: 'post_cycle',
        failedStep: 'Step 7 — mark asset posted', errorDetails: err.message,
        recommendedAction: `Manually rename "${asset.name}" in Folder 02 to prevent a duplicate post next cycle.`,
      });
    }
  }

  const postsPublished = results.filter((r) => r.ok).length;
  const postsFailed = results.length - postsPublished;
  const summaryPayload = buildRunSummary({
    triggeredAt: runDate, cycleType: 'post_cycle',
    postsPublished, postsFailed, socialPostLogSkipped,
    errors: logErrors,
    status: allFailed ? 'Failed' : (postsFailed ? 'Partial' : 'Complete'),
  });
  const summaryDelivery = await fire(deps, process.env.MAKE_AGENT1B_RUN_SUMMARY_WEBHOOK, summaryPayload);
  if (!summaryDelivery.ok) {
    await sendOpsAlert(deps, {
      failureType: 'Run Summary Webhook Delivery Failed', runDate, cycleType: 'post_cycle',
      failedStep: 'Scenario 5 — POST run summary', errorDetails: `${summaryDelivery.error} | Full summary: ${JSON.stringify(summaryPayload)}`,
      recommendedAction: 'Check MAKE_AGENT1B_RUN_SUMMARY_WEBHOOK configuration.',
    });
  }

  return {
    statusCode: 200,
    body: {
      success: !allFailed,
      cycleType: 'post_cycle',
      status: allFailed ? 'all_platforms_failed' : 'posted',
      results,
      assetRenamed: !!renamed,
      moduleDivergences,
      summaryWebhookDelivered: summaryDelivery.ok,
      summary: summaryPayload,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Intelligence Cycle — design doc §4.2, runs after Agent 0's weekly complete webhook.
// ─────────────────────────────────────────────────────────────────────────────
async function runIntelligenceCycle(deps, today) {
  const runDate = today.toISOString();
  const errors = [];

  // Design doc §9 row 1: token refresh failure halts the run (see runPostCycle).
  try {
    await Promise.all([deps.workdrive.getWorkdriveToken(), deps.zoho.getCrmToken()]);
  } catch (err) {
    await sendOpsAlert(deps, {
      failureType: 'Token refresh failed', runDate, cycleType: 'intelligence_cycle',
      failedStep: 'Token refresh', errorDetails: err.message,
      recommendedAction: 'Check ZOHO_WORKDRIVE_*/ZOHO_CRM_* credentials. Run halted — no stale-credential calls made.',
    });
    return { statusCode: 502, body: { success: false, cycleType: 'intelligence_cycle', error: `Token refresh failed — run aborted: ${err.message}` } };
  }

  // Pre-flight: resolve modules + confirm fields BEFORE any query/write
  // (mirrors Agent 1A's pattern — never just written and left unused).
  let resolvedModules;
  try {
    resolvedModules = await deps.reconcile.resolveModules();
  } catch (err) {
    return { statusCode: 502, body: { success: false, error: `CRM module resolution failed — run aborted: ${err.message}` } };
  }
  const prospectsApi = resolvedModules.resolved.prospects;
  if (!prospectsApi) {
    return { statusCode: 502, body: { success: false, error: 'Prospects module (Ambassador_Leads) could not be resolved in Zoho — run aborted.' } };
  }
  let fieldsCheck;
  try {
    fieldsCheck = await deps.reconcile.checkProspectFields(prospectsApi);
  } catch (err) {
    return { statusCode: 502, body: { success: false, error: `CRM field verification failed — run aborted: ${err.message}` } };
  }
  if (!fieldsCheck.ok) {
    return {
      statusCode: 502,
      body: {
        success: false, error: 'Prospects module is missing required fields — run aborted.',
        missingExistingFields: fieldsCheck.missingExisting, missingNewFields: fieldsCheck.missingNew,
      },
    };
  }

  // Step 1: gap report → priority communities (degrades to default config + alert if missing).
  const folder07 = process.env.WORKDRIVE_FOLDER_07_ID;
  const gapReport = folder07 ? await deps.workdrive.readMostRecentGapReport(folder07) : null;
  let priorityCommunities;
  if (gapReport) {
    const priorities = criteria.parseGapReportPriorities(gapReport.content);
    priorityCommunities = priorities.length ? priorities.map((p) => p.channel) : M.DEFAULT_COMMUNITIES;
  } else {
    priorityCommunities = M.DEFAULT_COMMUNITIES;
    await sendOpsAlert(deps, {
      failureType: 'Gap report missing', runDate, cycleType: 'intelligence_cycle',
      failedStep: 'Step 1 — read Folder 07 gap report', errorDetails: 'No gap report found in WorkDrive Folder 07.',
      recommendedAction: 'Confirm Agent 0 saved this week\'s gap report before the recruiting webhook fired. Running with the default community config.',
    });
  }

  // Step 2: monitor priority communities (read-only).
  const discovered = [];
  for (const community of priorityCommunities) {
    const candidates = await deps.socialMonitoring.searchCommunity(community);
    for (const c of candidates) discovered.push({ ...c, channelKeyword: community });
  }
  const deduped = criteria.dedupeByProfileUrl(discovered);

  // Step 3: filter existing prospects (dedup + VIP suppression).
  const existingByUrl = new Map();
  if (deduped.length) {
    const urls = deduped.map((d) => d.profileUrl);
    try {
      const existing = await deps.zoho.crmSearch(prospectsApi, criteria.dedupCriteria(urls), ['id', 'Social_Profile_URL', 'VIP_Prospect', 'VIP_Pipeline_Stage', 'Prospect_Declined_Date']);
      for (const rec of existing) existingByUrl.set(rec.Social_Profile_URL, rec);
    } catch (err) {
      errors.push(`Dedup search failed: ${err.message}`);
    }
  }
  const netNew = deduped.filter((d) => !existingByUrl.has(d.profileUrl));
  const vipAccountsSuppressed = deduped.filter((d) => {
    const rec = existingByUrl.get(d.profileUrl);
    return rec && rec.VIP_Prospect;
  }).length;

  // Step 4: write new prospects; failures retry once at the end of the cycle (design doc §9).
  let newProspectsDiscovered = 0;
  const failedWrites = [];
  for (const d of netNew) {
    const record = sequencing.buildProspectRecord({
      name: d.name, socialProfileUrl: d.profileUrl, channelSource: d.channelKeyword,
      roleCategory: criteria.estimateRoleCategory(d.channelKeyword),
    });
    try {
      await deps.zoho.crmCreateRecord(prospectsApi, record);
      newProspectsDiscovered += 1;
    } catch (err) {
      failedWrites.push(record);
    }
  }
  const crmWriteFailures = [];
  if (failedWrites.length) {
    const { recovered, stillFailed } = await retryFailedWritesOnce(failedWrites, (record) => deps.zoho.crmCreateRecord(prospectsApi, record));
    newProspectsDiscovered += recovered.length;
    crmWriteFailures.push(...stillFailed.map((f) => ({ socialProfileUrl: f.item.Social_Profile_URL, reason: f.reason })));
  }

  // Step 5: flag high-engagement educators (Zoho Social — Gracelyn's own posts, past 7 days).
  let highEngagementFlags = 0;
  const highEngagementProspects = []; // design doc §6: "list of names and Social_Profile_URLs flagged for Agent 0 priority scoring on next run" — not just a count.
  const sevenDaysAgo = new Date(today.getTime());
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const engagers = await deps.zohoSocial.fetchRecentEngagers(sevenDaysAgo);
  for (const e of engagers) {
    if (!e.profileUrl) continue;
    let existingRec = existingByUrl.get(e.profileUrl);
    if (!existingRec) {
      try {
        const found = await deps.zoho.crmSearch(prospectsApi, criteria.dedupCriteria([e.profileUrl]), ['id', 'Social_Profile_URL', 'VIP_Prospect', 'VIP_Pipeline_Stage', 'Prospect_Declined_Date']);
        if (found[0]) existingRec = found[0];
      } catch (err) {
        errors.push(`High-engagement lookup failed for ${e.profileUrl}: ${err.message}`);
        continue;
      }
    }
    if (existingRec && existingRec.VIP_Prospect) continue; // never touch VIP records
    // Design doc §5 Stage 5: a declined prospect is suppressed from all monitoring
    // activity for 12 months from Prospect_Declined_Date — checked independently
    // of the VIP_Prospect flag above in case a future process resets it before
    // the suppression window has actually elapsed.
    if (existingRec && (criteria.isStage5Declined(existingRec.VIP_Pipeline_Stage) || criteria.isReapproachSuppressed(existingRec.Prospect_Declined_Date, today))) continue;
    try {
      if (existingRec) {
        await deps.zoho.crmUpdateRecord(prospectsApi, sequencing.buildHighEngagementUpdate(existingRec.id));
      } else {
        await deps.zoho.crmCreateRecord(prospectsApi, {
          ...sequencing.buildProspectRecord({ name: e.name, socialProfileUrl: e.profileUrl, channelSource: 'Gracelyn Engagement', roleCategory: '' }),
          High_Engagement_Flag: true,
        });
        newProspectsDiscovered += 1;
      }
      highEngagementFlags += 1;
      highEngagementProspects.push({ name: e.name, socialProfileUrl: e.profileUrl });
    } catch (err) {
      errors.push(`High-engagement flag failed for ${e.profileUrl}: ${err.message}`);
    }
  }

  // §5 VIP Prospect Pipeline — one query for all VIP records, then the pure
  // criteria.isStageN predicates (unit-tested in isolation) decide the stage,
  // rather than duplicating the stage-name comparison inline here.
  let vipRecords = [];
  try {
    vipRecords = await deps.zoho.crmSearch(
      prospectsApi, '(VIP_Prospect:equals:true)',
      ['id', 'Name', 'Social_Profile_URL', 'VIP_Pipeline_Stage', 'Outreach_Status'],
    );
  } catch (err) {
    errors.push(`VIP pipeline query failed: ${err.message}`);
  }

  // §5.1 Warm Follow monitoring — Stage 1 accounts resolved live from CRM
  // (VIP_Pipeline_Stage authoritative field), Folder 09 briefings read for
  // supplementary context only. See DEPLOY.md: the design doc's literal
  // "check Folder 09 to identify Stage 1 accounts" isn't reliable against
  // Agent 0's actual free-text briefing format, so the CRM field is used as
  // the source of truth instead.
  const stage1Prospects = vipRecords.filter((p) => criteria.isStage1WarmFollow(p.VIP_Pipeline_Stage));
  const folder09 = process.env.WORKDRIVE_FOLDER_09_ID;
  const briefings = folder09 ? await deps.workdrive.readAllBriefings(folder09) : [];

  const keywordsCsv = process.env.MISSION_KEYWORDS;
  let vipWarmFollowAlertsSent = 0;
  for (const p of stage1Prospects) {
    if (!p.Social_Profile_URL) continue;
    let alertsForThisProspect = 0;
    const posts = await deps.socialMonitoring.fetchRecentPostsForProfile(p.Social_Profile_URL);
    for (const post of posts) {
      if (alertsForThisProspect >= M.MAX_WARM_FOLLOW_ALERTS_PER_PROSPECT_PER_RUN) break;
      const matched = criteria.matchedMissionKeywords(post.text, keywordsCsv);
      if (!matched.length) continue;
      const alertPayload = sequencing.buildWarmFollowAlertPayload({
        prospectName: p.Name, postUrl: post.url, matchedKeywords: matched,
        suggestedResponse: `Consider a genuine, specific comment referencing: ${matched.join(', ')}.`,
        prospectRecordId: p.id,
      });
      const delivery = await fire(deps, process.env.MAKE_VIP_WARM_FOLLOW_WEBHOOK, alertPayload);
      if (delivery.ok) {
        vipWarmFollowAlertsSent += 1;
        alertsForThisProspect += 1;
      } else {
        errors.push(`Warm follow alert delivery failed for ${p.Name}: ${delivery.error}`);
      }
    }
  }

  // §5 Stage 4 → Converted (Agent 1B never advances a stage; it only reflects
  // the coordinator's own stage change onto Outreach_Status).
  const stage4Prospects = vipRecords.filter((p) => criteria.isStage4Onboarding(p.VIP_Pipeline_Stage) && p.Outreach_Status !== M.OUTREACH_STATUS_CONVERTED_VALUE);
  for (const p of stage4Prospects) {
    try {
      await deps.zoho.crmUpdateRecord(prospectsApi, sequencing.buildConvertedUpdate(p.id));
    } catch (err) {
      errors.push(`Converted status update failed for ${p.id}: ${err.message}`);
    }
  }

  const summaryPayload = buildRunSummary({
    triggeredAt: runDate, cycleType: 'intelligence_cycle',
    newProspectsDiscovered, highEngagementFlags, highEngagementProspects, vipWarmFollowAlertsSent, vipAccountsSuppressed,
    crmWriteFailures, errors,
    status: errors.length || crmWriteFailures.length ? 'Partial' : 'Complete',
  });
  const summaryDelivery = await fire(deps, process.env.MAKE_AGENT1B_RUN_SUMMARY_WEBHOOK, summaryPayload);
  if (!summaryDelivery.ok) {
    await sendOpsAlert(deps, {
      failureType: 'Run Summary Webhook Delivery Failed', runDate, cycleType: 'intelligence_cycle',
      failedStep: 'Scenario 5 — POST run summary', errorDetails: `${summaryDelivery.error} | Full summary: ${JSON.stringify(summaryPayload)}`,
      recommendedAction: 'Check MAKE_AGENT1B_RUN_SUMMARY_WEBHOOK configuration.',
    });
  }

  return {
    statusCode: 200,
    body: {
      success: true, cycleType: 'intelligence_cycle',
      moduleDivergences: resolvedModules.divergences,
      briefingsRead: briefings.length,
      summaryWebhookDelivered: summaryDelivery.ok,
      summary: summaryPayload,
    },
  };
}

async function runAgent1B(payload, deps = DEFAULT_DEPS, today = new Date()) {
  const mode = sequencing.classifyRunMode(payload);
  if (!mode.ok) return { statusCode: 400, body: { success: false, error: mode.error } };
  if (mode.triggerType === 'post_cycle') return runPostCycle(deps, today);
  return runIntelligenceCycle(deps, today);
}

module.exports = { DEFAULT_DEPS, runAgent1B, runPostCycle, runIntelligenceCycle };
