'use strict';

/**
 * Agent 0 run cycle (design §6, steps 1-13) with the §9 failure handling.
 *
 * Discovery note: Agent 0's tool table routes social listening through Make.com /
 * Ayrshare ("No direct API call from Agent 0 code") and provides no web-search
 * credential. So discovered raw prospects are delivered INTO this function:
 *   - weekly:   `rawProspects` posted by the Make.com social-listening scenario
 *   - on-demand: a single `prospectUrl` (+ any known profile fields)
 * `buildRawProspects` is the seam where a real research provider would plug in.
 *
 * Every external module is injectable via `deps` so the whole cycle runs offline
 * in tests.
 *
 * A raw prospect object:
 *   { socialProfileUrl, firstName, lastName, email, organization, channelSource,
 *     followerCount, profileText, recentContent }
 */

const M = require('./manifest');
const scoring = require('./scoring');
const defaultZoho = require('./zoho');
const defaultWorkdrive = require('./workdrive');
const defaultClaude = require('./claude');
const defaultWebhooks = require('./webhooks');
const defaultAlerts = require('./alerts');

// ─── small date helpers (CST) ─────────────────────────────────────────────────
function dateStr(now) {
  // YYYY-MM-DD in America/Chicago.
  try {
    const p = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(now);
    return p; // en-CA yields YYYY-MM-DD
  } catch {
    return now.toISOString().slice(0, 10);
  }
}
function timeCst(now) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago', hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(now) + ' CST';
  } catch {
    return now.toISOString().slice(11, 16) + ' UTC';
  }
}
function safeName(s) {
  return String(s || 'Unknown').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'Unknown';
}

// ─── discovery seam ───────────────────────────────────────────────────────────
function buildRawProspects({ mode, rawProspects, prospectUrl, prospect }) {
  if (mode === 'ON_DEMAND') {
    if (!prospectUrl && !(prospect && prospect.socialProfileUrl)) {
      throw new Error('On-demand run requires a prospectUrl.');
    }
    const p = prospect || {};
    return [{
      socialProfileUrl: p.socialProfileUrl || prospectUrl,
      firstName: p.firstName || '',
      lastName: p.lastName || '',
      email: p.email || '',
      organization: p.organization || '',
      channelSource: p.channelSource || 'on-demand',
      followerCount: p.followerCount || 0,
      profileText: p.profileText || '',
      recentContent: p.recentContent || '',
    }];
  }
  return Array.isArray(rawProspects) ? rawProspects : [];
}

// Compose the text handed to Claude when a caller did not supply profileText.
function assembleProfileText(p) {
  if (p.profileText && p.profileText.trim()) return p.profileText;
  const name = [p.firstName, p.lastName].filter(Boolean).join(' ').trim();
  return [
    name && `Name: ${name}`,
    p.organization && `Organization: ${p.organization}`,
    p.socialProfileUrl && `Profile: ${p.socialProfileUrl}`,
    (p.followerCount != null) && `Audience size: ${p.followerCount}`,
    p.recentContent && `Recent content: ${p.recentContent}`,
    p.channelSource && `Discovered via: ${p.channelSource}`,
  ].filter(Boolean).join('\n');
}

/**
 * Run the full cycle. Returns a structured summary. Halts (with an alert) on the
 * design's fatal preconditions; individual prospect failures are isolated.
 */
async function runCycle(input = {}) {
  const deps = input.deps || {};
  const zoho = deps.zoho || defaultZoho;
  const workdrive = deps.workdrive || defaultWorkdrive;
  const claude = deps.claude || defaultClaude;
  const webhooks = deps.webhooks || defaultWebhooks;
  const alerts = deps.alerts || defaultAlerts;
  const now = (deps.now && deps.now()) || new Date();

  const mode = (input.mode || M.getEnv('AGENT0_RUN_MODE') || 'WEEKLY').toUpperCase();
  const runType = mode === 'ON_DEMAND' ? 'on-demand' : 'scheduled';
  const today = dateStr(now);

  const summary = {
    mode, runType, date: today,
    processed: 0, duplicatesSkipped: 0, vipCount: 0, standardRouted: 0,
    upserts: { created: 0, updated: 0, failed: 0 },
    gaps: [], briefings: [], errors: [], halted: null,
  };

  const alert = (errorType, detail, action, prospect) => alerts.sendAlert({
    errorType, detail, action, prospect, runType, date: today, timeCst: timeCst(now),
  }, { deps });

  // ── Step 1: token refresh ───────────────────────────────────────────────────
  try {
    zoho.resetToken();
    workdrive.resetToken();
    await zoho.getCrmToken();
    await workdrive.getWorkDriveToken();
  } catch (err) {
    await alert('token refresh failure', err.message, 'Re-check the Zoho CRM and WorkDrive OAuth credentials in Catalyst.');
    summary.halted = `Step 1 token refresh: ${err.message}`;
    return summary;
  }

  // ── Step 2: brand assets ────────────────────────────────────────────────────
  let brand;
  try {
    const folder08 = M.getEnv('WORKDRIVE_FOLDER_08_ID');
    if (!folder08) throw new Error('WORKDRIVE_FOLDER_08_ID is not set');
    brand = await workdrive.readBrandAssets(folder08, M.BRAND_ASSETS);
  } catch (err) {
    await alert('asset missing', err.message, 'Confirm the voice guidelines and mission statement files exist in WorkDrive Folder 08.');
    summary.halted = `Step 2 brand assets: ${err.message}`;
    return summary;
  }

  // ── Step 3: audience config ─────────────────────────────────────────────────
  try {
    const raw = M.getEnv('AGENT0_AUDIENCE_CONFIG');
    if (!raw) throw new Error('AGENT0_AUDIENCE_CONFIG is not set');
    summary.audienceConfig = JSON.parse(raw);
  } catch (err) {
    await alert('config parse error', err.message, 'Fix the AGENT0_AUDIENCE_CONFIG JSON in Catalyst environment variables.');
    summary.halted = `Step 3 audience config: ${err.message}`;
    return summary;
  }

  // ── Step 4: resolve module + verify fields + dedup index ────────────────────
  let moduleApi;
  try {
    const resolved = await zoho.resolveModuleApiName(M.PROSPECTS_MODULE);
    moduleApi = resolved.apiName;
    summary.prospectsModuleApiName = moduleApi;
    if (resolved.divergence) {
      summary.errors.push(`Module name divergence: ${resolved.divergence}`);
      await alert('module name divergence', resolved.divergence,
        'Reconcile PROSPECTS_MODULE_API_NAME with the live Zoho api_name.');
    }
    // Cross-check the fields Agent 0 writes exist (fail loudly, not silently).
    const writeFields = Object.values(M.PROSPECT_FIELDS);
    const { missing } = await zoho.verifyFields(moduleApi, writeFields);
    if (missing.length) {
      summary.errors.push(`Missing Prospects fields in Zoho: ${missing.join(', ')}`);
      await alert('CRM field divergence', `Fields missing on "${moduleApi}": ${missing.join(', ')}`,
        'Create the missing Prospects fields in Zoho (or run Agent 5A) before the next run.');
      summary.missingFields = missing;
    }
  } catch (err) {
    await alert('CRM metadata failure', err.message, 'Confirm the Prospects module exists and PROSPECTS_MODULE_API_NAME is set.');
    summary.halted = `Step 4 module resolution: ${err.message}`;
    return summary;
  }

  // Build the deduplication index keyed on Social_Profile_URL.
  const dedupField = M.PROSPECT_FIELDS.dedupKey;
  let dedupIndex = new Set();
  try {
    const existing = await zoho.fetchAllRecords(moduleApi, { fields: ['id', dedupField] });
    for (const r of existing) {
      const url = r[dedupField];
      if (url) dedupIndex.add(String(url).toLowerCase());
    }
  } catch (err) {
    // Non-fatal: proceed without a dedup index but warn.
    summary.errors.push(`Dedup index build failed: ${err.message}`);
  }

  // ── Step 5: discovery ───────────────────────────────────────────────────────
  let raws;
  try {
    raws = buildRawProspects(input);
  } catch (err) {
    await alert('discovery input error', err.message, 'Provide a prospectUrl (on-demand) or rawProspects (weekly).');
    summary.halted = `Step 5 discovery: ${err.message}`;
    return summary;
  }

  const upsertQueue = [];
  const recruitingReady = []; // non-VIP prospects with a usable email

  for (const raw of raws) {
    const url = raw.socialProfileUrl ? String(raw.socialProfileUrl) : '';
    // Step 6 dedup skip.
    if (url && dedupIndex.has(url.toLowerCase())) {
      summary.duplicatesSkipped += 1;
      continue;
    }
    if (url) dedupIndex.add(url.toLowerCase());
    summary.processed += 1;

    const name = [raw.firstName, raw.lastName].filter(Boolean).join(' ').trim() || 'Unknown';
    const record = {
      [M.PROSPECT_FIELDS.dedupKey]: url,
      [M.PROSPECT_FIELDS.firstName]: raw.firstName || '',
      [M.PROSPECT_FIELDS.lastName]: raw.lastName || '',
      [M.PROSPECT_FIELDS.email]: raw.email || '',
      [M.PROSPECT_FIELDS.organization]: raw.organization || '',
      [M.PROSPECT_FIELDS.channelSource]: raw.channelSource || '',
    };
    const gapsForProspect = [];

    // Step 6: profile building — contact-info presence.
    const hasEmail = !!(raw.email && String(raw.email).trim());
    record[M.PROSPECT_FIELDS.contactFound] = hasEmail;
    if (!url) gapsForProspect.push(M.GAP_TYPES.noPublicProfile);
    if (!hasEmail) gapsForProspect.push(M.GAP_TYPES.noEmail);

    // Step 7: Claude assessment (safe defaults on parse failure).
    let assessment;
    try {
      const res = await claude.assessProspect(assembleProfileText(raw));
      assessment = res.assessment;
      if (res.error === 'parse') gapsForProspect.push(M.GAP_TYPES.parseError);
      if (res.error === 'api') {
        gapsForProspect.push(M.GAP_TYPES.parseError);
        summary.errors.push(`Claude assessment API error for ${name}: ${res.apiError || 'unknown'}`);
      }
    } catch (err) {
      assessment = { ...M.SAFE_ASSESSMENT_DEFAULTS };
      gapsForProspect.push(M.GAP_TYPES.parseError);
      summary.errors.push(`Claude assessment threw for ${name}: ${err.message}`);
    }

    record[M.PROSPECT_FIELDS.motivationTag] = assessment.motivationHypothesis || '';
    record[M.PROSPECT_FIELDS.roleCategory] = assessment.roleCategory || '';
    record[M.PROSPECT_FIELDS.missionAlignmentScore] = assessment.missionAlignmentScore || 0;
    record[M.PROSPECT_FIELDS.orgInfluenceScore] = assessment.orgInfluenceScore || 0;

    // Step 8: VIP scoring.
    const vip = scoring.computeVipScore({
      followerCount: raw.followerCount,
      orgInfluenceScore: assessment.orgInfluenceScore,
      missionAlignmentScore: assessment.missionAlignmentScore,
    });
    record[M.PROSPECT_FIELDS.vipProspect] = vip.isVip;
    record[M.PROSPECT_FIELDS.vipProspectScore] = vip.total;

    if (!vip.isVip && vip.missionAlignment === 0) {
      gapsForProspect.push(M.GAP_TYPES.lowMissionAlignment);
    }

    if (vip.isVip) {
      summary.vipCount += 1;
      record[M.PROSPECT_FIELDS.vipPipelineStage] = M.VIP_PIPELINE_STAGES.warmFollow;
      record[M.PROSPECT_FIELDS.outreachStatus] = 'VIP Pipeline';

      // Step 9: VIP briefing generation (retry once per §9), then notify.
      const briefResult = await generateAndSaveBriefing({
        name, raw, vip, assessment, brand, moduleApi, today, now,
        deps, workdrive, claude, webhooks, alerts, runType, summary,
      });
      if (briefResult.briefing) summary.briefings.push(briefResult.briefing);
      // VIP prospects are NOT routed to recruiting agents.
    } else {
      record[M.PROSPECT_FIELDS.outreachStatus] = 'Standard';
      // Step 11: standard routing eligibility.
      if (hasEmail) recruitingReady.push({ name, roleCategory: record[M.PROSPECT_FIELDS.roleCategory], url });
    }

    // Consolidate gap flags onto the record.
    if (gapsForProspect.length) {
      record[M.PROSPECT_FIELDS.gapType] = gapsForProspect[0]; // primary gap on the record
      for (const g of gapsForProspect) {
        summary.gaps.push({ name, url, channel: raw.channelSource || '', gapType: g });
      }
    }

    upsertQueue.push({ name, record });
  }

  // ── Step 10: CRM upsert (with end-of-run retry for failures) ────────────────
  const retryLater = [];
  for (const item of upsertQueue) {
    try {
      const res = await zoho.upsertProspect(moduleApi, item.record, dedupField);
      if (res.op === 'create') summary.upserts.created += 1; else summary.upserts.updated += 1;
    } catch (err) {
      retryLater.push({ item, error: err.message });
    }
  }
  for (const { item } of retryLater) {
    try {
      const res = await zoho.upsertProspect(moduleApi, item.record, dedupField);
      if (res.op === 'create') summary.upserts.created += 1; else summary.upserts.updated += 1;
    } catch (err) {
      summary.upserts.failed += 1;
      summary.errors.push(`CRM upsert failed for ${item.name}: ${err.message}`);
    }
  }
  if (summary.upserts.failed > 0) {
    await alert('CRM upsert failure', `${summary.upserts.failed} record(s) failed to upsert after retry.`,
      'Review the Agent 0 run log and reconcile the failed prospect records.');
  }

  // ── Step 12: gap report ─────────────────────────────────────────────────────
  try {
    const folder07 = M.getEnv('WORKDRIVE_FOLDER_07_ID');
    const report = buildGapReport(summary, today);
    const filename = `Agent0_Gap_Report_${today}.txt`;
    if (folder07) {
      const up = await workdrive.uploadTextFile(folder07, filename, report);
      summary.gapReport = { filename, id: up.id };
    } else {
      summary.gapReport = { filename, id: null, note: 'WORKDRIVE_FOLDER_07_ID not set' };
    }
  } catch (err) {
    summary.errors.push(`Gap report save failed: ${err.message}`);
    await alert('gap report save failure', err.message, 'Gap report content is in the run log; retry the WorkDrive write.');
  }

  // ── Step 13: consolidated recruiting trigger ────────────────────────────────
  const recruitingUrl = M.getEnv('MAKE_AGENT0_COMPLETE_WEBHOOK_URL');
  if (recruitingUrl) {
    const byRole = {};
    for (const r of recruitingReady) { byRole[r.roleCategory || 'Uncategorized'] = (byRole[r.roleCategory || 'Uncategorized'] || 0) + 1; }
    const res = await webhooks.fireWebhook(recruitingUrl, {
      type: 'agent0_run_complete', date: today, mode,
      standardProspects: recruitingReady.length, byRoleCategory: byRole,
    }, { retryDelayMs: input.fastRetry ? 0 : 60000, deps });
    summary.standardRouted = recruitingReady.length;
    summary.recruitingWebhook = res;
    if (!res.ok) {
      await alert('recruiting webhook failure', res.error || 'non-200',
        'Recruiting agents did not receive this run. Re-fire the Make.com recruiting scenario.');
    }
  } else {
    summary.recruitingWebhook = { ok: false, error: 'MAKE_AGENT0_COMPLETE_WEBHOOK_URL not set' };
  }

  return summary;
}

// Step 9 helper — generate briefing (retry once), upload to Folder 09, notify.
async function generateAndSaveBriefing(ctx) {
  const { name, raw, vip, assessment, brand, moduleApi, today, now,
    deps, workdrive, claude, webhooks, alerts, runType, summary } = ctx;

  const prospectContext = [
    `Prospect: ${name}`,
    raw.organization && `Organization: ${raw.organization}`,
    raw.socialProfileUrl && `Profile: ${raw.socialProfileUrl}`,
    `Audience size: ${raw.followerCount || 'unknown'}`,
    `VIP score: ${vip.total} (reach ${vip.audienceReach}, influence ${vip.orgInfluence}, alignment ${vip.missionAlignment})`,
    assessment.roleCategory && `Role category: ${assessment.roleCategory}`,
    assessment.motivationHypothesis && `Likely motivation: ${assessment.motivationHypothesis}`,
    raw.recentContent && `Recent content: ${raw.recentContent}`,
    assessment.notes && `Assessment notes: ${assessment.notes}`,
  ].filter(Boolean).join('\n');

  let briefingText = null;
  for (let attempt = 1; attempt <= 2 && briefingText == null; attempt++) {
    try {
      briefingText = await claude.generateVIPBriefing({ voiceGuidelines: brand.voiceGuidelines, prospectContext });
    } catch (err) {
      if (attempt === 2) {
        summary.errors.push(`VIP briefing generation failed for ${name}: ${err.message}`);
        await alerts.sendAlert({
          errorType: 'VIP briefing failure', detail: err.message,
          action: 'Prospect is flagged VIP in CRM. Add to the manual briefing queue and write the briefing by hand.',
          prospect: name, runType, date: today, timeCst: timeCstNow(now),
        }, { deps });
        return { briefing: null };
      }
    }
  }

  const filename = `VIP_Brief_${safeName(name)}_${today}.txt`;
  const folder09 = M.getEnv('WORKDRIVE_FOLDER_09_ID');
  let fileId = null;
  try {
    if (folder09) {
      const up = await workdrive.uploadTextFile(folder09, filename, briefingText);
      fileId = up.id;
    }
  } catch (err) {
    summary.errors.push(`VIP briefing upload failed for ${name}: ${err.message}`);
  }

  // Fire VIP notification webhook (retry once per §9).
  const vipUrl = M.getEnv('MAKE_VIP_NOTIFY_WEBHOOK_URL');
  const res = await webhooks.fireWebhook(vipUrl, {
    type: 'vip_prospect', prospect: name, vipScore: vip.total,
    briefingFile: filename, briefingFileId: fileId, moduleApi, date: today,
    vipManagerEmail: M.getEnv('VIP_MANAGER_EMAIL'),
  }, { retryDelayMs: ctx.deps && ctx.deps.now ? 0 : 30000, deps });
  if (!res.ok) {
    await alerts.sendAlert({
      errorType: 'VIP notification failure', detail: res.error || 'non-200',
      action: 'Notify the VIP relationship manager manually. Human follow-up required.',
      prospect: `${name} (VIP score ${vip.total})`, runType, date: today, timeCst: timeCstNow(now),
    }, { deps });
  }

  return { briefing: { name, filename, fileId, vipScore: vip.total, notified: res.ok } };
}

function timeCstNow(now) { return timeCst(now); }

function buildGapReport(summary, today) {
  const lines = [];
  lines.push(`Agent 0 Gap Report — ${today}`);
  lines.push(`Run mode: ${summary.mode}`);
  lines.push(`Prospects processed: ${summary.processed} | Duplicates skipped: ${summary.duplicatesSkipped} | VIP: ${summary.vipCount}`);
  lines.push('');
  if (!summary.gaps.length) {
    lines.push('No gaps recorded this run.');
  } else {
    lines.push('Prospect Name | Source Channel | Gap Type | Recommendation');
    lines.push('-'.repeat(70));
    for (const g of summary.gaps) {
      lines.push(`${g.name} | ${g.channel || 'N/A'} | ${g.gapType} | ${gapRecommendation(g.gapType)}`);
    }
  }
  lines.push('');
  lines.push('Reviewed by Jessica at the Day 60 review to decide whether Apollo.io or Hunter.io should be activated.');
  return lines.join('\n');
}

function gapRecommendation(gapType) {
  switch (gapType) {
    case M.GAP_TYPES.noEmail: return 'Email enrichment candidate (Apollo.io / Hunter.io at Day 60).';
    case M.GAP_TYPES.noPublicProfile: return 'No public profile URL found; manual review.';
    case M.GAP_TYPES.parseError: return 'Claude assessment could not be parsed; re-run assessment.';
    case M.GAP_TYPES.lowMissionAlignment: return 'Low mission alignment; deprioritize for outreach.';
    default: return 'Review.';
  }
}

module.exports = { runCycle, buildRawProspects, assembleProfileText, buildGapReport, dateStr, timeCst };
