'use strict';

/**
 * Agent 1B test suite — pure logic + orchestration with injected fakes.
 * No network, no deps, no secrets. Run: node __tests__/agent1b.test.js
 */

const assert = require('assert');

const M = require('../manifest');
const criteria = require('../criteria');
const sequencing = require('../sequencing');
const alertsMod = require('../alerts');
const runSummaryMod = require('../run-summary');
const { retryFailedWritesOnce } = require('../retry');
const { fireWebhook } = require('../webhook');
const reconcile = require('../reconcile');
const zohoMeta = require('../zoho'); // for monkeypatching in reconcile tests
const claudeMod = require('../claude');
const ayrshareMod = require('../ayrshare');
const workdriveMod = require('../workdrive');
const { runAgent1B, runPostCycle, runIntelligenceCycle } = require('../orchestrate');

let passed = 0;
const cases = [];
const test = (name, fn) => cases.push([name, fn]);

// ─── manifest.js ────────────────────────────────────────────────────────────

test('manifest: VIP suppression uses VIP_Prospect (doc\'s VIP_Flag does not exist)', () => {
  const vipField = M.PROSPECT_FIELDS.find((f) => f.api === 'VIP_Prospect');
  assert.ok(vipField);
  assert.strictEqual(vipField.docName, 'VIP_Flag');
});

test('manifest: Outreach_Status Converted extends the shared picklist, "Identified" is not used', () => {
  assert.strictEqual(M.OUTREACH_STATUS_NEW_PROSPECT_VALUE, 'Standard');
  assert.strictEqual(M.OUTREACH_STATUS_CONVERTED_VALUE, 'Converted');
});

test('manifest: VIP_Pipeline_Stage stage names map onto the doc\'s Stage 1/4', () => {
  assert.strictEqual(M.VIP_STAGE_WARM_FOLLOW, 'Warm Follow');
  assert.strictEqual(M.VIP_STAGE_ONBOARDING, 'VIP Onboarding');
});

// ─── criteria.js ────────────────────────────────────────────────────────────

test('criteria: parseGapReportPriorities tallies No_Email gaps per channel, most first', () => {
  const report = [
    'Agent 0 Gap Report — 2026-07-18',
    'Run mode: weekly',
    'Prospects processed: 5 | Duplicates skipped: 0 | VIP: 1',
    '',
    'Prospect Name | Source Channel | Gap Type | Recommendation',
    '-'.repeat(70),
    'Jane Doe | LinkedIn K12 Group | No_Email | Email enrichment candidate.',
    'Sam Lee | LinkedIn K12 Group | No_Email | Email enrichment candidate.',
    'Ana Cruz | Faith FB Group | No_Email | Email enrichment candidate.',
    'Tom Yu | Faith FB Group | No_Public_Profile | No public profile URL found; manual review.',
    '',
    'Reviewed by Jessica at the Day 60 review...',
  ].join('\n');
  const result = criteria.parseGapReportPriorities(report);
  assert.deepStrictEqual(result, [
    { channel: 'LinkedIn K12 Group', noEmailCount: 2 },
    { channel: 'Faith FB Group', noEmailCount: 1 },
  ]);
});

test('criteria: parseGapReportPriorities returns [] for "No gaps recorded this run."', () => {
  const report = 'Agent 0 Gap Report — 2026-07-18\nRun mode: weekly\n\nNo gaps recorded this run.\n';
  assert.deepStrictEqual(criteria.parseGapReportPriorities(report), []);
});

test('criteria: parseGapReportPriorities returns [] for unparseable/empty input', () => {
  assert.deepStrictEqual(criteria.parseGapReportPriorities(''), []);
  assert.deepStrictEqual(criteria.parseGapReportPriorities(null), []);
  assert.deepStrictEqual(criteria.parseGapReportPriorities('not a gap report'), []);
});

test('criteria: matchedMissionKeywords is case-insensitive and returns only the hits', () => {
  const kws = 'teacher development, educational equity, faith educator';
  const matched = criteria.matchedMissionKeywords('We are proud of our TEACHER DEVELOPMENT program this year.', kws);
  assert.deepStrictEqual(matched, ['teacher development']);
  assert.deepStrictEqual(criteria.matchedMissionKeywords('unrelated post about lunch', kws), []);
});

test('criteria: isStage1WarmFollow / isStage4Onboarding match exact live picklist values', () => {
  assert.strictEqual(criteria.isStage1WarmFollow('Warm Follow'), true);
  assert.strictEqual(criteria.isStage1WarmFollow('Personal Outreach'), false);
  assert.strictEqual(criteria.isStage4Onboarding('VIP Onboarding'), true);
});

test('criteria: isReapproachSuppressed enforces exactly the 12-month window from Prospect_Declined_Date', () => {
  const declined = '2026-01-01';
  assert.strictEqual(criteria.isReapproachSuppressed(declined, new Date('2026-06-01')), true);
  assert.strictEqual(criteria.isReapproachSuppressed(declined, new Date('2027-02-01')), false);
  assert.strictEqual(criteria.isReapproachSuppressed(null, new Date('2027-02-01')), false);
});

test('criteria: dedupCriteria builds an "in" clause over Social_Profile_URL', () => {
  const c = criteria.dedupCriteria(['https://x.com/a', 'https://x.com/b']);
  assert.strictEqual(c, '(Social_Profile_URL:in:https://x.com/a,https://x.com/b)');
});

test('criteria: dedupeByProfileUrl keeps first occurrence, drops candidates with no URL', () => {
  const out = criteria.dedupeByProfileUrl([
    { profileUrl: 'https://x.com/a', name: 'First' },
    { profileUrl: 'https://x.com/a', name: 'Duplicate' },
    { profileUrl: '', name: 'No URL' },
    { profileUrl: 'https://x.com/b', name: 'Second' },
  ]);
  assert.deepStrictEqual(out.map((c) => c.name), ['First', 'Second']);
});

test('criteria: estimateRoleCategory maps community keywords to a best-guess category', () => {
  assert.strictEqual(criteria.estimateRoleCategory('Faith Community Leaders'), 'Faith Community Leader');
  assert.strictEqual(criteria.estimateRoleCategory('K-12 Educators'), 'K-12 Educator');
  assert.strictEqual(criteria.estimateRoleCategory('something else entirely'), 'Community Member');
});

// ─── sequencing.js ──────────────────────────────────────────────────────────

test('sequencing: classifyRunMode accepts post_cycle and intelligence_cycle only', () => {
  assert.strictEqual(sequencing.classifyRunMode({ trigger_type: 'post_cycle' }).ok, true);
  assert.strictEqual(sequencing.classifyRunMode({ trigger_type: 'intelligence_cycle' }).ok, true);
  assert.strictEqual(sequencing.classifyRunMode({ trigger_type: 'nope' }).ok, false);
  assert.strictEqual(sequencing.classifyRunMode(null).ok, false);
});

test('sequencing: buildProspectRecord writes Standard (not doc\'s "Identified") and Contact_Found false', () => {
  const rec = sequencing.buildProspectRecord({ name: 'Jane', socialProfileUrl: 'https://x.com/j', channelSource: 'K12 Group', roleCategory: 'K-12 Educator' });
  assert.strictEqual(rec.Outreach_Status, 'Standard');
  assert.strictEqual(rec.Contact_Found, false);
  assert.strictEqual(rec.Social_Profile_URL, 'https://x.com/j');
});

test('sequencing: buildConvertedUpdate writes the new Converted value', () => {
  assert.deepStrictEqual(sequencing.buildConvertedUpdate('123'), { id: '123', Outreach_Status: 'Converted' });
});

test('sequencing: buildHighEngagementUpdate sets the new High_Engagement_Flag field', () => {
  assert.deepStrictEqual(sequencing.buildHighEngagementUpdate('123'), { id: '123', High_Engagement_Flag: true });
});

test('sequencing: buildWarmFollowAlertPayload includes matched keywords and no email/DM fields', () => {
  const p = sequencing.buildWarmFollowAlertPayload({ prospectName: 'Jane', postUrl: 'https://x.com/p', matchedKeywords: ['teacher shortage'], suggestedResponse: 'Nice comment', prospectRecordId: '1' });
  assert.strictEqual(p.prospect_name, 'Jane');
  assert.deepStrictEqual(p.matched_keywords, ['teacher shortage']);
  assert.ok(!('email' in p) && !('to' in p));
});

// ─── claude.js ──────────────────────────────────────────────────────────────

test('claude: extractJson strips markdown fences', () => {
  const parsed = claudeMod.extractJson('```json\n{"linkedin":"a","facebook":"b","instagram":"c"}\n```');
  assert.deepStrictEqual(parsed, { linkedin: 'a', facebook: 'b', instagram: 'c' });
});

test('claude: hasAllCaptions requires all three non-empty fields', () => {
  assert.strictEqual(claudeMod.hasAllCaptions({ linkedin: 'a', facebook: 'b', instagram: 'c' }), true);
  assert.strictEqual(claudeMod.hasAllCaptions({ linkedin: 'a', facebook: '', instagram: 'c' }), false);
  assert.strictEqual(claudeMod.hasAllCaptions(null), false);
});

test('claude: generateCaptions returns ok:true with parsed captions on valid JSON', async () => {
  const fakeCaller = async () => '{"linkedin":"LI text","facebook":"FB text","instagram":"IG text"}';
  const result = await claudeMod.generateCaptions('flyer.png', 'rules', 'voice', fakeCaller);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.captions.linkedin, 'LI text');
});

test('claude: generateCaptions returns ok:false on non-JSON (design doc §9 — skip, don\'t post)', async () => {
  const fakeCaller = async () => 'Sure! Here are your captions: LinkedIn - great post';
  const result = await claudeMod.generateCaptions('flyer.png', 'rules', 'voice', fakeCaller);
  assert.strictEqual(result.ok, false);
  assert.ok(result.raw);
});

// ─── ayrshare.js ────────────────────────────────────────────────────────────

test('ayrshare: buildPostPayload sends per-platform captions via platformOptions', () => {
  const payload = ayrshareMod.buildPostPayload({ linkedin: 'LI', facebook: 'FB', instagram: 'IG' }, 'https://cdn/img.png');
  assert.deepStrictEqual(payload.platforms, ['linkedin', 'facebook', 'instagram']);
  assert.strictEqual(payload.platformOptions.linkedin.post, 'LI');
  assert.deepStrictEqual(payload.mediaUrls, ['https://cdn/img.png']);
});

test('ayrshare: parsePostResponse reports one platform failing without blocking the others', () => {
  const results = ayrshareMod.parsePostResponse(200, {
    posts: [
      { platform: 'linkedin', status: 'success', id: 'p1' },
      { platform: 'facebook', status: 'error', errors: ['rate limited'] },
      { platform: 'instagram', status: 'success', id: 'p3' },
    ],
  });
  assert.strictEqual(results.find((r) => r.platform === 'linkedin').ok, true);
  assert.strictEqual(results.find((r) => r.platform === 'facebook').ok, false);
  assert.strictEqual(results.find((r) => r.platform === 'instagram').ok, true);
});

test('ayrshare: parsePostResponse treats a non-2xx HTTP response as all platforms failed', () => {
  const results = ayrshareMod.parsePostResponse(500, { error: 'server error' });
  assert.ok(results.every((r) => !r.ok));
  assert.strictEqual(results.length, 3);
});

// ─── workdrive.js (pure helpers) ────────────────────────────────────────────

test('workdrive: postedFilename inserts the suffix before the extension', () => {
  assert.strictEqual(workdriveMod.postedFilename('flyer.png'), 'flyer_POSTED.png');
  assert.strictEqual(workdriveMod.postedFilename('no-extension'), 'no-extension_POSTED');
});

test('workdrive: daysSinceLastPost computes from the most recent _POSTED file, null if none', () => {
  const today = new Date('2026-07-15T00:00:00Z');
  const tenDaysAgoMs = today.getTime() - 10 * 86400000;
  const files = [{ name: 'a_POSTED.png', createdTime: tenDaysAgoMs }, { name: 'b.png', createdTime: today.getTime() }];
  assert.strictEqual(workdriveMod.daysSinceLastPost(files, today), 10);
  assert.strictEqual(workdriveMod.daysSinceLastPost([{ name: 'b.png', createdTime: today.getTime() }], today), null);
});

// ─── alerts.js / run-summary.js ─────────────────────────────────────────────

test('alerts: buildLowContentAlertPayload matches design doc §6 content', () => {
  const p = alertsMod.buildLowContentAlertPayload({ daysSinceLastPost: 5 });
  assert.strictEqual(p.days_since_last_post, 5);
  assert.ok(/Parmeet/.test(p.request));
});

test('alerts: buildPostFailureAlert distinguishes single-platform vs all-platform failure', () => {
  const one = alertsMod.buildPostFailureAlert({ runDate: 'd', platform: 'facebook', errorCode: 'HTTP 400', assetFilename: 'a.png', allPlatformsFailed: false });
  assert.ok(/facebook/.test(one.subject));
  const all = alertsMod.buildPostFailureAlert({ runDate: 'd', platform: 'facebook', errorCode: 'HTTP 500', assetFilename: 'a.png', allPlatformsFailed: true });
  assert.ok(/ALL platforms/.test(all.subject));
  assert.ok(/Do not retry automatically/.test(all.body));
});

test('run-summary: buildRunSummary reflects both cycle types', () => {
  const s = runSummaryMod.buildRunSummary({ triggeredAt: 't', cycleType: 'intelligence_cycle', newProspectsDiscovered: 3, status: 'Complete' });
  assert.strictEqual(s.new_prospects_discovered, 3);
  assert.strictEqual(s.cycle_type, 'intelligence_cycle');
});

// ─── retry.js ───────────────────────────────────────────────────────────────

test('retry: retryFailedWritesOnce recovers items that succeed on the second attempt', async () => {
  let attempts = 0;
  const { recovered, stillFailed } = await retryFailedWritesOnce(['a', 'b'], async (item) => {
    attempts += 1;
    if (item === 'b' && attempts <= 2) throw new Error('still failing'); // b fails once more than a
  });
  assert.deepStrictEqual(recovered, ['a']);
  assert.strictEqual(stillFailed.length, 1);
  assert.strictEqual(stillFailed[0].item, 'b');
});

// ─── webhook.js ─────────────────────────────────────────────────────────────

test('webhook: fireWebhook reports not-configured without throwing when URL is empty', async () => {
  const res = await fireWebhook(undefined, { a: 1 });
  assert.strictEqual(res.ok, false);
  assert.ok(/not configured/.test(res.error));
});

test('webhook: fireWebhook retries once and succeeds on the second attempt', async () => {
  let attempts = 0;
  const fakePost = async () => { attempts += 1; if (attempts === 1) return { status: 500, body: '' }; return { status: 200, body: '' }; };
  const res = await fireWebhook('https://example.com/hook', { a: 1 }, { deps: { postJson: fakePost } });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(attempts, 2);
});

// ─── reconcile.js ───────────────────────────────────────────────────────────

test('reconcile: resolveModules resolves Prospects (critical) and flags Social Post Log as unresolved (warn)', async () => {
  const orig = zohoMeta.fetchModules;
  zohoMeta.fetchModules = async () => ({
    byLabel: new Map([['ambassador_leads', { api_name: 'Ambassador_Leads' }]]),
  });
  try {
    const result = await reconcile.resolveModules();
    assert.strictEqual(result.resolved.prospects, 'Ambassador_Leads');
    assert.ok(!result.resolved.socialPostLog);
    assert.ok(result.unresolved.some((u) => u.key === 'socialPostLog' && u.severity === 'warn'));
  } finally {
    zohoMeta.fetchModules = orig;
  }
});

test('reconcile: checkProspectFields flags High_Engagement_Flag as missing-new if not yet created', async () => {
  const orig = zohoMeta.fetchFields;
  zohoMeta.fetchFields = async () => ({ byApi: new Map([['Social_Profile_URL', {}], ['VIP_Prospect', {}]]) });
  try {
    const result = await reconcile.checkProspectFields('Ambassador_Leads');
    assert.strictEqual(result.ok, false);
    assert.ok(result.missingNew.includes('High_Engagement_Flag'));
  } finally {
    zohoMeta.fetchFields = orig;
  }
});

// ─── orchestrate.js — fakes + full-run integration ─────────────────────────

function makeFakeDeps(overrides = {}) {
  const state = { crmCreates: [], crmUpdates: [], alertsSent: [], webhookCalls: {}, renamed: [] };
  const deps = {
    zoho: {
      getCrmToken: async () => 'crm-token',
      crmSearch: async () => [],
      crmCreateRecord: async (moduleApi, record) => { state.crmCreates.push({ moduleApi, record }); return { status: 'success' }; },
      crmUpdateRecord: async (moduleApi, record) => { state.crmUpdates.push({ moduleApi, record }); return { status: 'success' }; },
    },
    workdrive: {
      getWorkdriveToken: async () => 'wd-token',
      listUnpostedAssets: async () => [{ id: 'a1', name: 'flyer.png', createdTime: 1, permalink: 'https://cdn/flyer.png' }],
      listFolderFiles: async () => [],
      readBrandAssets: async () => ({ assets: { [M.COPY_RULES_FILE]: 'rules', [M.VOICE_GUIDELINES_FILE]: 'voice' }, missing: [] }),
      markAssetPosted: async (id, name) => { state.renamed.push({ id, name }); return { id, name: `${name}_POSTED` }; },
      readMostRecentGapReport: async () => null,
      readAllBriefings: async () => [],
    },
    ayrshare: {
      postToAllPlatforms: async () => ({
        results: [{ platform: 'linkedin', ok: true, postId: 'p1', errorCode: null }, { platform: 'facebook', ok: true, postId: 'p2', errorCode: null }, { platform: 'instagram', ok: true, postId: 'p3', errorCode: null }],
        allFailed: false,
      }),
    },
    claude: {
      generateCaptions: async () => ({ ok: true, captions: { linkedin: 'LI', facebook: 'FB', instagram: 'IG' }, raw: '{}' }),
    },
    socialMonitoring: {
      searchCommunity: async () => [],
      fetchRecentPostsForProfile: async () => [],
    },
    zohoSocial: {
      fetchRecentEngagers: async () => [],
    },
    reconcile: {
      resolveModules: async () => ({ resolved: { prospects: 'Ambassador_Leads', socialPostLog: 'Social_Post_Log' }, unresolved: [], divergences: [] }),
      checkProspectFields: async () => ({ ok: true, missingExisting: [], missingNew: [] }),
    },
    webhook: {
      fireWebhook: async (url, payload) => {
        (state.webhookCalls[url] = state.webhookCalls[url] || []).push(payload);
        if (url === process.env.MAKE_AGENT1B_ALERT_WEBHOOK) state.alertsSent.push(payload);
        return { ok: true, status: 200, attempts: 1 };
      },
      postJson: async () => ({ status: 200, body: '' }),
    },
  };
  for (const k of Object.keys(overrides)) Object.assign(deps[k], overrides[k]);
  return { deps, state };
}

const TODAY = new Date('2026-07-21T15:00:00Z');
const ENV_BACKUP = {};
function withWebhookEnv(fn) {
  const keys = ['MAKE_LOW_CONTENT_WEBHOOK', 'MAKE_VIP_WARM_FOLLOW_WEBHOOK', 'MAKE_AGENT1B_RUN_SUMMARY_WEBHOOK', 'MAKE_AGENT1B_ALERT_WEBHOOK', 'WORKDRIVE_FOLDER_02_ID', 'WORKDRIVE_FOLDER_07_ID', 'WORKDRIVE_FOLDER_08_ID', 'WORKDRIVE_FOLDER_09_ID', 'MISSION_KEYWORDS'];
  for (const k of keys) ENV_BACKUP[k] = process.env[k];
  process.env.MAKE_LOW_CONTENT_WEBHOOK = 'https://hooks.example.com/low-content';
  process.env.MAKE_VIP_WARM_FOLLOW_WEBHOOK = 'https://hooks.example.com/warm-follow';
  process.env.MAKE_AGENT1B_RUN_SUMMARY_WEBHOOK = 'https://hooks.example.com/summary';
  process.env.MAKE_AGENT1B_ALERT_WEBHOOK = 'https://hooks.example.com/alert';
  process.env.WORKDRIVE_FOLDER_02_ID = 'f02';
  process.env.WORKDRIVE_FOLDER_07_ID = 'f07';
  process.env.WORKDRIVE_FOLDER_08_ID = 'f08';
  process.env.WORKDRIVE_FOLDER_09_ID = 'f09';
  process.env.MISSION_KEYWORDS = 'teacher shortage, educational equity';
  return fn().finally(() => { for (const k of keys) process.env[k] = ENV_BACKUP[k]; });
}

test('index: rejects malformed trigger_type with 400', async () => {
  const { deps } = makeFakeDeps();
  const result = await runAgent1B({ trigger_type: 'nope' }, deps, TODAY);
  assert.strictEqual(result.statusCode, 400);
});

test('post_cycle: token refresh failure halts the run with an alert (§9 row 1)', () => withWebhookEnv(async () => {
  const { deps, state } = makeFakeDeps({ zoho: { getCrmToken: async () => { throw new Error('bad refresh token'); } } });
  const result = await runPostCycle(deps, TODAY);
  assert.strictEqual(result.statusCode, 502);
  assert.ok(/aborted/.test(result.body.error));
  assert.strictEqual(state.alertsSent.length, 1);
  assert.ok(/Token refresh failed/.test(state.alertsSent[0].subject));
}));

test('post_cycle: empty Folder 02 sends the low content alert and exits gracefully (§9 row 2)', () => withWebhookEnv(async () => {
  const { deps, state } = makeFakeDeps({ workdrive: { listUnpostedAssets: async () => [] } });
  const result = await runPostCycle(deps, TODAY);
  assert.strictEqual(result.statusCode, 200);
  assert.strictEqual(result.body.status, 'low_content');
  assert.strictEqual(state.webhookCalls['https://hooks.example.com/low-content'].length, 1);
}));

test('post_cycle: missing brand asset halts the post cycle with an alert (§9 row 3)', () => withWebhookEnv(async () => {
  const { deps, state } = makeFakeDeps({ workdrive: { readBrandAssets: async () => ({ assets: {}, missing: [M.COPY_RULES_FILE] }) } });
  const result = await runPostCycle(deps, TODAY);
  assert.strictEqual(result.statusCode, 200);
  assert.strictEqual(result.body.status, 'halted_missing_brand_assets');
  assert.strictEqual(state.alertsSent.length, 1);
  assert.ok(state.alertsSent[0].body.includes(M.COPY_RULES_FILE));
}));

test('post_cycle: non-JSON captions skip the run without posting (§9 row 6)', () => withWebhookEnv(async () => {
  const { deps, state } = makeFakeDeps({ claude: { generateCaptions: async () => ({ ok: false, captions: null, raw: 'not json', error: 'bad' }) } });
  const result = await runPostCycle(deps, TODAY);
  assert.strictEqual(result.statusCode, 200);
  assert.strictEqual(result.body.status, 'skipped_invalid_captions');
  assert.strictEqual(state.renamed.length, 0, 'must not post/rename without valid captions');
  assert.strictEqual(state.alertsSent.length, 1);
}));

test('post_cycle: Claude API network/auth failure (distinct from non-JSON) also skips the run with its own alert (§9 row 6)', () => withWebhookEnv(async () => {
  const { deps, state } = makeFakeDeps({ claude: { generateCaptions: async () => { throw new Error('ANTHROPIC_API_KEY is not set'); } } });
  const result = await runPostCycle(deps, TODAY);
  assert.strictEqual(result.statusCode, 200);
  assert.strictEqual(result.body.status, 'skipped_caption_api_failure');
  assert.strictEqual(state.renamed.length, 0);
  assert.ok(state.alertsSent.some((a) => /Claude API request failed/.test(a.subject)));
}));

test('post_cycle: one platform failing logs it and does not block the others (§9 row 4)', () => withWebhookEnv(async () => {
  const { deps, state } = makeFakeDeps({
    ayrshare: {
      postToAllPlatforms: async () => ({
        results: [{ platform: 'linkedin', ok: true, postId: 'p1', errorCode: null }, { platform: 'facebook', ok: false, postId: null, errorCode: 'HTTP 400' }, { platform: 'instagram', ok: true, postId: 'p3', errorCode: null }],
        allFailed: false,
      }),
    },
  });
  const result = await runPostCycle(deps, TODAY);
  assert.strictEqual(result.statusCode, 200);
  assert.strictEqual(result.body.status, 'posted');
  assert.strictEqual(state.crmCreates.length, 3, 'Social Post Log gets one record per platform, success or failed');
  assert.strictEqual(state.crmCreates.filter((c) => c.record.Status === 'failed').length, 1);
  assert.strictEqual(state.renamed.length, 1, 'partial success still marks the asset posted');
  assert.strictEqual(state.alertsSent.length, 1);
}));

test('post_cycle: all platforms failing does not rename the asset and alerts do-not-retry (§9 row 5)', () => withWebhookEnv(async () => {
  const { deps, state } = makeFakeDeps({
    ayrshare: {
      postToAllPlatforms: async () => ({
        results: [{ platform: 'linkedin', ok: false, postId: null, errorCode: 'HTTP 500' }, { platform: 'facebook', ok: false, postId: null, errorCode: 'HTTP 500' }, { platform: 'instagram', ok: false, postId: null, errorCode: 'HTTP 500' }],
        allFailed: true,
      }),
    },
  });
  const result = await runPostCycle(deps, TODAY);
  assert.strictEqual(result.statusCode, 200);
  assert.strictEqual(result.body.status, 'all_platforms_failed');
  assert.strictEqual(result.body.success, false);
  assert.strictEqual(state.renamed.length, 0, 'asset must remain available for manual retry');
  assert.ok(state.alertsSent.some((a) => /ALL platforms/.test(a.subject)));
}));

test('post_cycle: Social Post Log module unresolved degrades (still posts, skip+alert) instead of blocking (manifest.js divergence #7)', () => withWebhookEnv(async () => {
  const { deps, state } = makeFakeDeps({ reconcile: { resolveModules: async () => ({ resolved: { prospects: 'Ambassador_Leads' }, unresolved: [{ key: 'socialPostLog', severity: 'warn' }], divergences: [] }) } });
  const result = await runPostCycle(deps, TODAY);
  assert.strictEqual(result.statusCode, 200);
  assert.strictEqual(result.body.status, 'posted', 'posting must not be blocked by a missing compliance-log module');
  assert.strictEqual(state.crmCreates.length, 0, 'no Social Post Log writes attempted when module unresolved');
  assert.strictEqual(state.renamed.length, 1);
  assert.ok(state.alertsSent.some((a) => /not provisioned/.test(a.subject)));
}));

test('post_cycle: run summary webhook delivery failure triggers its own alert with the full summary', () => withWebhookEnv(async () => {
  const { deps, state } = makeFakeDeps({
    webhook: {
      fireWebhook: async (url, payload) => {
        (state.webhookCalls[url] = state.webhookCalls[url] || []).push(payload);
        if (url === process.env.MAKE_AGENT1B_RUN_SUMMARY_WEBHOOK) return { ok: false, status: 0, attempts: 2, error: 'DNS failure' };
        if (url === process.env.MAKE_AGENT1B_ALERT_WEBHOOK) state.alertsSent.push(payload);
        return { ok: true, status: 200, attempts: 1 };
      },
    },
  });
  const result = await runPostCycle(deps, TODAY);
  assert.strictEqual(result.body.summaryWebhookDelivered, false);
  assert.ok(state.alertsSent.some((a) => /Webhook Delivery Failed/.test(a.subject) && a.body.includes('DNS failure')));
}));

test('intelligence_cycle: aborts when Prospects module cannot be resolved live', () => withWebhookEnv(async () => {
  const { deps } = makeFakeDeps({ reconcile: { resolveModules: async () => ({ resolved: {}, unresolved: [{ key: 'prospects' }], divergences: [] }) } });
  const result = await runIntelligenceCycle(deps, TODAY);
  assert.strictEqual(result.statusCode, 502);
}));

test('intelligence_cycle: aborts when a required Prospects field is missing (pre-flight check)', () => withWebhookEnv(async () => {
  const { deps } = makeFakeDeps({ reconcile: { checkProspectFields: async () => ({ ok: false, missingExisting: ['VIP_Prospect'], missingNew: ['High_Engagement_Flag'] }) } });
  const result = await runIntelligenceCycle(deps, TODAY);
  assert.strictEqual(result.statusCode, 502);
  assert.deepStrictEqual(result.body.missingNewFields, ['High_Engagement_Flag']);
}));

test('intelligence_cycle: gap report missing degrades to default communities + alert (§9 row 9)', () => withWebhookEnv(async () => {
  let searchedCommunities = [];
  const { deps, state } = makeFakeDeps({
    workdrive: { readMostRecentGapReport: async () => null },
    socialMonitoring: { searchCommunity: async (c) => { searchedCommunities.push(c); return []; } },
  });
  const result = await runIntelligenceCycle(deps, TODAY);
  assert.strictEqual(result.statusCode, 200);
  assert.deepStrictEqual(searchedCommunities, M.DEFAULT_COMMUNITIES);
  assert.ok(state.alertsSent.some((a) => /Gap report missing/.test(a.subject)));
}));

test('intelligence_cycle: net-new discoveries are written, existing/VIP ones are not duplicated or touched (§4.2 Step 3-4)', () => withWebhookEnv(async () => {
  const { deps, state } = makeFakeDeps({
    workdrive: { readMostRecentGapReport: async () => ({ name: 'r', content: 'No gaps recorded this run.' }) },
    socialMonitoring: {
      searchCommunity: async () => [
        { platform: 'facebook', name: 'New Person', profileUrl: 'https://fb.com/new', snippet: '' },
        { platform: 'facebook', name: 'Known VIP', profileUrl: 'https://fb.com/vip', snippet: '' },
        { platform: 'facebook', name: 'Known Non-VIP', profileUrl: 'https://fb.com/known', snippet: '' },
      ],
      fetchRecentPostsForProfile: async () => [],
    },
    zoho: {
      getCrmToken: async () => 't',
      crmSearch: async (moduleApi, crit, fields) => {
        if (fields.includes('VIP_Prospect') && crit.includes('in:')) {
          return [
            { id: 'vip1', Social_Profile_URL: 'https://fb.com/vip', VIP_Prospect: true },
            { id: 'known1', Social_Profile_URL: 'https://fb.com/known', VIP_Prospect: false },
          ];
        }
        return [];
      },
      crmCreateRecord: async (moduleApi, record) => { state.crmCreates.push({ moduleApi, record }); return { status: 'success' }; },
      crmUpdateRecord: async (moduleApi, record) => { state.crmUpdates.push({ moduleApi, record }); return { status: 'success' }; },
    },
  });
  const result = await runIntelligenceCycle(deps, TODAY);
  assert.strictEqual(result.statusCode, 200);
  const prospectCreates = state.crmCreates.filter((c) => c.record.Social_Profile_URL);
  assert.strictEqual(prospectCreates.length, 1, 'only the net-new discovery gets a new record');
  assert.strictEqual(prospectCreates[0].record.Social_Profile_URL, 'https://fb.com/new');
  assert.strictEqual(result.body.summary.new_prospects_discovered, 1);
  assert.strictEqual(result.body.summary.vip_accounts_suppressed, 1);
}));

test('intelligence_cycle: VIP account detected in standard monitoring is suppressed, never gets outreach fields (§9 row 8)', () => withWebhookEnv(async () => {
  const { deps, state } = makeFakeDeps({
    socialMonitoring: { searchCommunity: async () => [{ platform: 'facebook', name: 'VIP Person', profileUrl: 'https://fb.com/vip', snippet: '' }], fetchRecentPostsForProfile: async () => [] },
    zoho: {
      getCrmToken: async () => 't',
      crmSearch: async () => [{ id: 'vip1', Social_Profile_URL: 'https://fb.com/vip', VIP_Prospect: true }],
      crmCreateRecord: async (moduleApi, record) => { state.crmCreates.push({ moduleApi, record }); return { status: 'success' }; },
      crmUpdateRecord: async (moduleApi, record) => { state.crmUpdates.push({ moduleApi, record }); return { status: 'success' }; },
    },
  });
  const result = await runIntelligenceCycle(deps, TODAY);
  assert.strictEqual(state.crmCreates.length, 0);
  assert.strictEqual(result.body.summary.vip_accounts_suppressed, 1);
}));

test('intelligence_cycle: CRM write failure retries once at end of cycle, still-failed goes to the run summary (§9 row 7)', () => withWebhookEnv(async () => {
  let attempts = 0;
  const { deps } = makeFakeDeps({
    socialMonitoring: { searchCommunity: async (c) => (c === M.DEFAULT_COMMUNITIES[0] ? [{ platform: 'facebook', name: 'Flaky', profileUrl: 'https://fb.com/flaky', snippet: '' }] : []), fetchRecentPostsForProfile: async () => [] },
    zoho: {
      getCrmToken: async () => 't',
      crmSearch: async () => [],
      crmCreateRecord: async () => { attempts += 1; throw new Error('CRM timeout'); },
      crmUpdateRecord: async () => ({ status: 'success' }),
    },
  });
  const result = await runIntelligenceCycle(deps, TODAY);
  assert.strictEqual(attempts, 2, 'first attempt + exactly one retry at end of cycle');
  assert.strictEqual(result.body.summary.crm_write_failures.length, 1);
  assert.strictEqual(result.body.summary.run_status, 'Partial');
}));

test('intelligence_cycle: high engagement flag updates an existing record and never touches a VIP one (§4.2 Step 5)', () => withWebhookEnv(async () => {
  const { deps, state } = makeFakeDeps({
    zohoSocial: { fetchRecentEngagers: async () => [{ name: 'Known', profileUrl: 'https://fb.com/known' }, { name: 'VIP', profileUrl: 'https://fb.com/vip' }] },
    zoho: {
      getCrmToken: async () => 't',
      crmSearch: async (moduleApi, crit) => {
        if (crit.includes('fb.com/known')) return [{ id: 'known1', Social_Profile_URL: 'https://fb.com/known', VIP_Prospect: false }];
        if (crit.includes('fb.com/vip')) return [{ id: 'vip1', Social_Profile_URL: 'https://fb.com/vip', VIP_Prospect: true }];
        return [];
      },
      crmCreateRecord: async (moduleApi, record) => { state.crmCreates.push({ moduleApi, record }); return { status: 'success' }; },
      crmUpdateRecord: async (moduleApi, record) => { state.crmUpdates.push({ moduleApi, record }); return { status: 'success' }; },
    },
  });
  const result = await runIntelligenceCycle(deps, TODAY);
  assert.strictEqual(state.crmUpdates.filter((u) => u.record.High_Engagement_Flag).length, 1);
  assert.strictEqual(state.crmUpdates.filter((u) => u.record.id === 'known1').length, 1);
  assert.ok(!state.crmUpdates.some((u) => u.record.id === 'vip1'), 'VIP record must never be touched');
  assert.strictEqual(result.body.summary.high_engagement_flags, 1);
  assert.deepStrictEqual(result.body.summary.high_engagement_prospects, [{ name: 'Known', socialProfileUrl: 'https://fb.com/known' }],
    'design doc §6: the alert/summary needs the actual list of names+URLs for Agent 0 priority scoring, not just a count');
}));

test('intelligence_cycle: a declined prospect within the 12-month suppression window is skipped, not re-flagged (§5 Stage 5)', () => withWebhookEnv(async () => {
  const { deps, state } = makeFakeDeps({
    zohoSocial: { fetchRecentEngagers: async () => [{ name: 'Declined Person', profileUrl: 'https://fb.com/declined' }] },
    zoho: {
      getCrmToken: async () => 't',
      crmSearch: async (moduleApi, crit) => {
        if (crit.includes('fb.com/declined')) {
          return [{ id: 'declined1', Social_Profile_URL: 'https://fb.com/declined', VIP_Prospect: false, Prospect_Declined_Date: '2026-06-01' }]; // 7 weeks before TODAY (2026-07-21) — well within 12 months
        }
        return [];
      },
      crmCreateRecord: async (moduleApi, record) => { state.crmCreates.push({ moduleApi, record }); return { status: 'success' }; },
      crmUpdateRecord: async (moduleApi, record) => { state.crmUpdates.push({ moduleApi, record }); return { status: 'success' }; },
    },
  });
  const result = await runIntelligenceCycle(deps, TODAY);
  assert.strictEqual(state.crmUpdates.length, 0, 'declined-and-suppressed record must not be flagged during the suppression window');
  assert.strictEqual(result.body.summary.high_engagement_flags, 0);
}));

test('intelligence_cycle: warm-follow alert fires once per Stage-1 VIP prospect via CRM task webhook, not email (§5.1)', () => withWebhookEnv(async () => {
  const { deps, state } = makeFakeDeps({
    zoho: {
      getCrmToken: async () => 't',
      crmSearch: async (moduleApi, crit) => {
        if (crit.includes('VIP_Prospect:equals:true')) return [{ id: 'stage1-1', Name: 'Jane', Social_Profile_URL: 'https://fb.com/jane', VIP_Pipeline_Stage: 'Warm Follow', Outreach_Status: 'VIP Pipeline' }];
        return [];
      },
    },
    socialMonitoring: {
      searchCommunity: async () => [],
      fetchRecentPostsForProfile: async (url) => (url === 'https://fb.com/jane'
        ? [{ text: 'Talking about the teacher shortage today.', url: 'https://fb.com/jane/post1' }, { text: 'A second post also about teacher shortage.', url: 'https://fb.com/jane/post2' }]
        : []),
    },
  });
  const result = await runIntelligenceCycle(deps, TODAY);
  const warmFollowCalls = state.webhookCalls['https://hooks.example.com/warm-follow'] || [];
  assert.strictEqual(warmFollowCalls.length, 1, 'max one warm follow alert per VIP Prospect per run (§5.1)');
  assert.deepStrictEqual(warmFollowCalls[0].matched_keywords, ['teacher shortage']);
  assert.strictEqual(result.body.summary.vip_warm_follow_alerts_sent, 1);
}));

test('intelligence_cycle: Stage 4 (VIP Onboarding) prospects get their Outreach_Status set to Converted, once', () => withWebhookEnv(async () => {
  const { deps, state } = makeFakeDeps({
    zoho: {
      getCrmToken: async () => 't',
      crmSearch: async (moduleApi, crit) => {
        if (crit.includes('VIP_Prospect:equals:true')) {
          return [
            { id: 'onboard-1', Outreach_Status: 'VIP Pipeline', VIP_Pipeline_Stage: 'VIP Onboarding' },
            { id: 'onboard-2', Outreach_Status: 'Converted', VIP_Pipeline_Stage: 'VIP Onboarding' },
          ];
        }
        return [];
      },
      crmUpdateRecord: async (moduleApi, record) => { state.crmUpdates.push({ moduleApi, record }); return { status: 'success' }; },
      crmCreateRecord: async () => ({ status: 'success' }),
    },
  });
  await runIntelligenceCycle(deps, TODAY);
  const convertedUpdates = state.crmUpdates.filter((u) => u.record.Outreach_Status === 'Converted');
  assert.strictEqual(convertedUpdates.length, 1, 'already-Converted record must not be re-written');
  assert.strictEqual(convertedUpdates[0].record.id, 'onboard-1');
}));

// ─── run ─────────────────────────────────────────────────────────────────────

console.log('Agent 1B tests\n');
(async () => {
  for (const [name, fn] of cases) {
    try { await fn(); console.log(`  ✓ ${name}`); passed++; }
    catch (err) { console.error(`  ✗ ${name}\n    ${err.stack || err.message}`); process.exitCode = 1; }
  }
  console.log(`\n${passed}/${cases.length} passed${process.exitCode ? ' (with failures)' : ''}`);
})();
