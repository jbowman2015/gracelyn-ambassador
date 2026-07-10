'use strict';

/**
 * Agent 1C tests — no network, no deps, no secrets.
 * Run: node __tests__/agent1C.test.js
 *
 * Covers env alias resolution, the §7.1 alert template, webhook retry, the
 * spend-alert Zoho Mail fallback, and the pipeline's five jobs with in-memory
 * fakes injected through `deps` — with special attention to the kill switch
 * (confirmed vs not confirmed) and the restart-without-confirmation rejection.
 */

const assert = require('assert');
const M = require('../manifest');
const claudeModule = require('../claude');
const alertsModule = require('../alerts');
const webhooksModule = require('../webhooks');
const pipeline = require('../pipeline');

let passed = 0;
const cases = [];
const test = (name, fn) => cases.push([name, fn]);

// ─── manifest / env alias resolution ──────────────────────────────────────────
test('getEnv resolves canonical name, then documented alias', () => {
  delete process.env.ANTHROPIC_API_KEY;
  process.env.CLAUDE_API_KEY = 'sk-alias';
  assert.strictEqual(M.getEnv('ANTHROPIC_API_KEY'), 'sk-alias');
  delete process.env.CLAUDE_API_KEY;

  delete process.env.ZOHO_WORKDRIVE_CLIENT_ID;
  process.env.WORKDRIVE_CLIENT_ID = 'wd-alias';
  assert.strictEqual(M.getEnv('ZOHO_WORKDRIVE_CLIENT_ID'), 'wd-alias');
  delete process.env.WORKDRIVE_CLIENT_ID;
});

test('Prospects read fields are reconciled to Agent 0\'s LIVE field names, not the design doc\'s stale names', () => {
  assert.strictEqual(M.PROSPECT_READ_FIELDS.roleCategory, 'Role_Category');
  assert.strictEqual(M.PROSPECT_READ_FIELDS.motivationTag, 'Motivation_Tag');
  assert.strictEqual(M.PROSPECT_READ_FIELDS.vipScore, 'VIP_Prospect_Score');
  assert.notStrictEqual(M.PROSPECT_READ_FIELDS.roleCategory, 'Ambassador_Role_Category');
});

// ─── claude prompt (design §5.1 voice rules) ──────────────────────────────────
test('audience recommendation prompt forbids em dashes and commission language', () => {
  const p = claudeModule.buildSystemPrompt();
  assert.ok(/No em dashes/.test(p));
  assert.ok(/No commission language/.test(p));
  assert.ok(!p.includes('—'), 'prompt must not contain an em dash character');
});

// ─── webhooks retry ────────────────────────────────────────────────────────────
test('fireWebhook retries once on failure, then succeeds', async () => {
  let attempts = 0;
  const fakePost = async () => { attempts += 1; return attempts === 1 ? { status: 500 } : { status: 200 }; };
  const res = await webhooksModule.fireWebhook('https://hook/x', { a: 1 }, { retryDelayMs: 0, deps: { postJson: fakePost } });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.attempts, 2);
});

test('fireWebhook reports failure after both attempts fail', async () => {
  const fakePost = async () => ({ status: 500 });
  const res = await webhooksModule.fireWebhook('https://hook/x', {}, { retryDelayMs: 0, deps: { postJson: fakePost } });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.attempts, 2);
});

// ─── alerts §7.1 template ──────────────────────────────────────────────────────
test('alert format matches the §7.1 template exactly', () => {
  const { subject, body } = alertsModule.formatAlert({
    failureType: 'token refresh failure', date: '2026-07-19', runDateTime: '2026-07-19 07:50 CST',
    jobType: 'compileDailySpend', failedStep: 'Step A1: Refresh All Tokens', errorDetails: 'CRM token failed',
    financialImpact: 'Campaigns continue running.', campaignIds: 'None', recommendedAction: 'Re-check credentials.',
  });
  assert.strictEqual(subject, '[AGENT 1C ERROR] token refresh failure - 2026-07-19');
  assert.ok(body.includes('Agent: Paid Advertising Agent (Agent 1C)'));
  assert.ok(body.includes('Job Type: compileDailySpend'));
  assert.ok(body.includes('Failed Step: Step A1: Refresh All Tokens'));
  assert.ok(body.includes('Error Details: CRM token failed'));
  assert.ok(body.includes('Financial Impact: Campaigns continue running.'));
  assert.ok(body.includes('Recommended Action: Re-check credentials.'));
});

test('spend alert falls back to Zoho Mail when the webhook fails twice', async () => {
  process.env.COORDINATOR_ALERT_EMAIL = 'coordinator@gracelyn.edu';
  process.env.ADMIN_ALERT_EMAIL = 'jessica.bowman@gracelyn.edu';
  const mailCalls = [];
  const fakeZohoMail = { async sendMail(m) { mailCalls.push(m); return { ok: true }; } };
  const res = await alertsModule.sendSpendAlert(
    { date: '2026-07-19', metaSpend: 50, metaThreshold: 40, metaOverThreshold: true, googleSpend: 10, googleThreshold: 40, googleOverThreshold: false, combinedSpend: 60 },
    'log-1',
    { retryDelayMs: 0, deps: { postJson: async () => ({ status: 500 }), zohoMail: fakeZohoMail } },
  );
  assert.strictEqual(res.delivered, true);
  assert.strictEqual(res.via, 'zoho-mail-fallback');
  assert.strictEqual(mailCalls.length, 1);
  assert.ok(mailCalls[0].content.includes('OVER THRESHOLD'));
  delete process.env.COORDINATOR_ALERT_EMAIL;
  delete process.env.ADMIN_ALERT_EMAIL;
});

// ─── pipeline fakes ────────────────────────────────────────────────────────────
function baseEnv() {
  process.env.META_AD_ACCOUNT_ID = 'act123';
  process.env.META_ADS_ACCESS_TOKEN = 'meta-tok';
  process.env.META_DAILY_SPEND_THRESHOLD = '100';
  process.env.GOOGLE_DAILY_SPEND_THRESHOLD = '100';
  process.env.AD_CAMPAIGN_LOG_MODULE_API_NAME = 'Ad_Campaign_Log';
  process.env.PROSPECTS_MODULE_API_NAME = 'Ambassador_Leads';
  process.env.MAKE_SPEND_ALERT_WEBHOOK_URL = 'https://hook/spend';
  process.env.MAKE_KILL_SWITCH_ALERT_WEBHOOK_URL = 'https://hook/killswitch';
  process.env.ADMIN_ALERT_EMAIL = 'jessica.bowman@gracelyn.edu';
  process.env.COORDINATOR_ALERT_EMAIL = 'coordinator@gracelyn.edu';
  process.env.DR_FLIPPEN_EMAIL = 'flippen@gracelyn.edu';
}
function clearEnv() {
  ['META_AD_ACCOUNT_ID', 'META_ADS_ACCESS_TOKEN', 'META_DAILY_SPEND_THRESHOLD', 'GOOGLE_DAILY_SPEND_THRESHOLD',
    'AD_CAMPAIGN_LOG_MODULE_API_NAME', 'PROSPECTS_MODULE_API_NAME', 'MAKE_SPEND_ALERT_WEBHOOK_URL',
    'MAKE_KILL_SWITCH_ALERT_WEBHOOK_URL', 'ADMIN_ALERT_EMAIL', 'COORDINATOR_ALERT_EMAIL', 'DR_FLIPPEN_EMAIL',
  ].forEach((k) => delete process.env[k]);
}

function makeDeps(overrides = {}) {
  const calls = { creates: [], updates: [], analytics: [], webhooks: [], alerts: [], spendAlerts: [], killSwitchAlerts: [], metaPause: 0, googlePause: 0 };
  let searchResults = overrides.searchResults || [];

  const fakeZoho = {
    resetCrmToken() {}, resetAnalyticsToken() {}, resetWorkDriveToken() {},
    async getCrmToken() { return 'crm-tok'; }, async getAnalyticsToken() { return 'an-tok'; },
    async resolveModuleApiName({ label }) { return { apiName: label === 'Ad Campaign Log' ? 'Ad_Campaign_Log' : 'Ambassador_Leads', divergence: null }; },
    async verifyFields() { return { missing: [] }; },
    async searchByCriteria() { return searchResults; },
    async fetchRecords() { return searchResults; },
    async createRecord(mod, record) { calls.creates.push(record); return { id: 'log-new', op: 'create' }; },
    async updateRecord(mod, id, record) { calls.updates.push({ id, record }); return { id, op: 'update' }; },
    async updateAnalyticsDashboard(row) { calls.analytics.push(row); return { ok: true }; },
  };
  const fakeMeta = {
    async getMetaDailySpend(dateStr) { return { date: dateStr, totalSpend: 50, threshold: 100, overThreshold: false, campaigns: [] }; },
    async getMetaWeeklyPerformance() { return [{ campaign_name: 'Meta A', spend: '70', cpc: '2.50', ctr: '1.1' }]; },
    async pauseAllMetaCampaigns() { calls.metaPause += 1; return { pausedIds: ['m1', 'm2'], failed: [] }; },
    async resumeMetaCampaigns(ids) { return { resumed: ids, failed: [] }; },
    async metaPost() { return {}; },
  };
  const fakeGoogle = {
    resetToken() {}, async getGoogleAdsToken() { return 'g-tok'; },
    async getGoogleDailySpend(dateStr) { return { date: dateStr, totalSpend: 20, threshold: 100, overThreshold: false, campaigns: [] }; },
    async getGoogleWeeklyPerformance() { return []; },
    async pauseAllGoogleCampaigns() { calls.googlePause += 1; return { pausedIds: ['g1'], failed: [] }; },
    async resumeGoogleCampaigns(ids) { return { resumed: ids, failed: [] }; },
  };
  const fakeClaude = { async generateAudienceRecommendation() { return '- Recommendation text'; } };
  const fakeWebhooks = { async fireWebhook(url, payload) { calls.webhooks.push({ url, payload }); return { ok: true, status: 200, attempts: 1 }; } };
  const fakeAlerts = {
    async sendAlert(a) { calls.alerts.push(a); return { delivered: true }; },
    async sendSpendAlert(summary, id) { calls.spendAlerts.push({ summary, id }); return { delivered: true, via: 'webhook' }; },
    async sendKillSwitchAlert(a) { calls.killSwitchAlerts.push(a); return { ok: true }; },
  };

  const deps = {
    zoho: { ...fakeZoho, ...(overrides.zoho || {}) },
    meta: { ...fakeMeta, ...(overrides.meta || {}) },
    google: { ...fakeGoogle, ...(overrides.google || {}) },
    claude: { ...fakeClaude, ...(overrides.claude || {}) },
    webhooks: { ...fakeWebhooks, ...(overrides.webhooks || {}) },
    alerts: { ...fakeAlerts, ...(overrides.alerts || {}) },
    now: () => new Date('2026-07-19T13:00:00Z'), // ~08:00 CST
  };
  return { deps, calls, setSearchResults: (r) => { searchResults = r; } };
}

// ─── compileDailySpend ─────────────────────────────────────────────────────────
test('compileDailySpend: writes CRM log, updates dashboard, delivers spend alert', async () => {
  baseEnv();
  const { deps, calls } = makeDeps();
  const summary = await pipeline.compileDailySpend({ deps, fastRetry: true });
  assert.strictEqual(summary.combinedSpend, 70);
  assert.strictEqual(calls.creates.length, 1);
  assert.strictEqual(calls.creates[0][M.LOG_FIELDS.combinedSpend], 70);
  assert.strictEqual(calls.analytics.length, 1);
  assert.strictEqual(calls.spendAlerts.length, 1);
  clearEnv();
});

test('compileDailySpend: Meta read failure uses $0 safe default and alerts, Google unaffected', async () => {
  baseEnv();
  const { deps, calls } = makeDeps({ meta: { async getMetaDailySpend() { throw new Error('token expired'); } } });
  const summary = await pipeline.compileDailySpend({ deps, fastRetry: true });
  assert.strictEqual(summary.metaSpend, 0);
  assert.strictEqual(summary.googleSpend, 20);
  assert.ok(calls.alerts.some((a) => a.failureType === 'Meta Ads token/read failure'));
  clearEnv();
});

// ─── checkSpendConfirmation — THE KILL SWITCH ─────────────────────────────────
test('kill switch: confirmed → campaigns are NOT paused', async () => {
  baseEnv();
  const { deps, calls, setSearchResults } = makeDeps();
  setSearchResults([{ id: 'log-1', [M.LOG_FIELDS.confirmed]: true, [M.LOG_FIELDS.confirmedAt]: '2026-07-19T12:00:00Z' }]);
  const summary = await pipeline.checkSpendConfirmation({ deps, fastRetry: true });
  assert.strictEqual(summary.confirmed, true);
  assert.strictEqual(summary.killSwitchFired, false);
  assert.strictEqual(calls.metaPause, 0);
  assert.strictEqual(calls.googlePause, 0);
  clearEnv();
});

test('kill switch: NOT confirmed → pauses both platforms, logs event, fires the kill switch alert', async () => {
  baseEnv();
  const { deps, calls, setSearchResults } = makeDeps();
  setSearchResults([]); // no confirmation record for today
  const summary = await pipeline.checkSpendConfirmation({ deps, fastRetry: true });
  assert.strictEqual(summary.confirmed, false);
  assert.strictEqual(summary.killSwitchFired, true);
  assert.deepStrictEqual(summary.pausedMetaIds, ['m1', 'm2']);
  assert.deepStrictEqual(summary.pausedGoogleIds, ['g1']);
  assert.strictEqual(calls.killSwitchAlerts.length, 1);
  assert.strictEqual(calls.killSwitchAlerts[0].pausedCount, 3);
  // No existing record → pipeline creates one so there is a CRM trail.
  assert.strictEqual(calls.creates.length, 1);
  assert.strictEqual(calls.creates[0][M.LOG_FIELDS.killSwitchFired], true);
  clearEnv();
});

test('kill switch: pause failures are retried once, then alerted with campaign IDs', async () => {
  baseEnv();
  const { deps, calls, setSearchResults } = makeDeps({
    meta: {
      async pauseAllMetaCampaigns() { return { pausedIds: [], failed: [{ id: 'm1', error: 'rate limited' }] }; },
      async metaPost() { throw new Error('still failing'); },
    },
  });
  setSearchResults([]);
  await pipeline.checkSpendConfirmation({ deps, fastRetry: true });
  assert.ok(calls.alerts.some((a) => a.failureType === 'Meta campaign pause failure' && a.campaignIds === 'm1'));
  clearEnv();
});

// ─── recordConfirmation ────────────────────────────────────────────────────────
test('recordConfirmation: updates the CRM log record with Confirmed = true', async () => {
  baseEnv();
  const { deps, calls } = makeDeps();
  const res = await pipeline.recordConfirmation({ log_record_id: 'log-1', confirmed_at: '2026-07-19T14:00:00Z' }, { deps });
  assert.strictEqual(res.success, true);
  assert.strictEqual(calls.updates[0].id, 'log-1');
  assert.strictEqual(calls.updates[0].record[M.LOG_FIELDS.confirmed], true);
  clearEnv();
});

// ─── resumeCampaigns ────────────────────────────────────────────────────────────
test('resumeCampaigns: rejected when today\'s spend is not confirmed', async () => {
  baseEnv();
  const { deps, setSearchResults } = makeDeps();
  setSearchResults([]);
  const res = await pipeline.resumeCampaigns({ paused_meta_ids: '["m1"]', paused_google_ids: '["g1"]' }, { deps });
  assert.strictEqual(res.success, false);
  assert.strictEqual(res.reason, 'Cannot restart: spend not confirmed for today.');
  clearEnv();
});

test('resumeCampaigns: succeeds when today\'s spend IS confirmed', async () => {
  baseEnv();
  const { deps, setSearchResults } = makeDeps();
  setSearchResults([{ id: 'log-1', [M.LOG_FIELDS.confirmed]: true }]);
  const res = await pipeline.resumeCampaigns({ log_record_id: 'log-1', paused_meta_ids: '["m1","m2"]', paused_google_ids: '["g1"]' }, { deps });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.metaResumed, 2);
  assert.strictEqual(res.googleResumed, 1);
  clearEnv();
});

// ─── weeklyPerformanceReview ────────────────────────────────────────────────────
test('weeklyPerformanceReview: flags a campaign whose CPC rose more than 20% week-over-week', async () => {
  baseEnv();
  const { deps, setSearchResults } = makeDeps();
  setSearchResults([{ [M.LOG_FIELDS.metaCampaigns]: JSON.stringify([{ name: 'Meta A', cpc: '2.00' }]) }]);
  const summary = await pipeline.weeklyPerformanceReview({ deps });
  assert.strictEqual(summary.flags.length, 1);
  assert.strictEqual(summary.flags[0].name, 'Meta A');
  clearEnv();
});

// ─── weeklyAudienceRefresh ──────────────────────────────────────────────────────
test('weeklyAudienceRefresh: aggregates segment counts using Agent 0\'s live field names', async () => {
  baseEnv();
  const { deps, setSearchResults } = makeDeps();
  setSearchResults([
    { [M.PROSPECT_READ_FIELDS.roleCategory]: 'K12 Educator', [M.PROSPECT_READ_FIELDS.motivationTag]: 'Mission Impact' },
    { [M.PROSPECT_READ_FIELDS.roleCategory]: 'K12 Educator', [M.PROSPECT_READ_FIELDS.motivationTag]: 'Mission Impact' },
  ]);
  const summary = await pipeline.weeklyAudienceRefresh({}, { deps });
  assert.strictEqual(summary.segmentCount, 2);
  assert.strictEqual(summary.bySegment['K12 Educator / Mission Impact'], 2);
  assert.strictEqual(summary.recommendation, '- Recommendation text');
  clearEnv();
});

test('weeklyAudienceRefresh: Claude failure only alerts on the 3rd consecutive week', async () => {
  baseEnv();
  const { deps, calls } = makeDeps({ claude: { async generateAudienceRecommendation() { throw new Error('down'); } } });
  const s1 = await pipeline.weeklyAudienceRefresh({}, { deps, consecutiveFailures: 0 });
  const s2 = await pipeline.weeklyAudienceRefresh({}, { deps, consecutiveFailures: 1 });
  const s3 = await pipeline.weeklyAudienceRefresh({}, { deps, consecutiveFailures: 2 });
  assert.strictEqual(s1.recommendation, null);
  assert.strictEqual(s3.consecutiveFailures, 3);
  assert.strictEqual(calls.alerts.length, 1, 'only the 3rd consecutive failure alerts');
  void s2;
  clearEnv();
});

// ─── run ───────────────────────────────────────────────────────────────────────
(async () => {
  console.log('Agent 1C tests\n');
  for (const [name, fn] of cases) {
    try { await fn(); console.log(`  ✓ ${name}`); passed++; }
    catch (err) { console.error(`  ✗ ${name}\n    ${err.stack || err.message}`); process.exitCode = 1; }
  }
  console.log(`\n${passed}/${cases.length} passed${process.exitCode ? ' (with failures)' : ''}`);
})();
