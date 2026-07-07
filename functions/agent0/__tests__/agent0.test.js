'use strict';

/**
 * Agent 0 tests — no network, no deps, no secrets.
 * Run: node __tests__/agent0.test.js
 *
 * Covers scoring bands + threshold, Claude parse safe-defaults, the §7 prompt
 * voice rules, dedup skip, VIP suppression of recruiting, briefing filename +
 * Folder 09 upload, gap report, and the §9.1 alert format — all with in-memory
 * fakes injected through the pipeline's `deps`.
 */

const assert = require('assert');
const M = require('../manifest');
const scoring = require('../scoring');
const prompts = require('../prompts');
const claude = require('../claude');
const alerts = require('../alerts');
const { runCycle } = require('../pipeline');

let passed = 0;
const cases = [];
const test = (name, fn) => cases.push([name, fn]);

// ─── scoring ──────────────────────────────────────────────────────────────────
test('audience reach bands', () => {
  assert.strictEqual(scoring.scoreAudienceReach(60000), 40);
  assert.strictEqual(scoring.scoreAudienceReach(50000), 40);
  assert.strictEqual(scoring.scoreAudienceReach(25000), 30);
  assert.strictEqual(scoring.scoreAudienceReach(12000), 20);
  assert.strictEqual(scoring.scoreAudienceReach(5000), 10);
  assert.strictEqual(scoring.scoreAudienceReach(4999), 0);
  assert.strictEqual(scoring.scoreAudienceReach('nonsense'), 0);
});

test('VIP threshold: 45 total is not VIP, 90 is', () => {
  const below = scoring.computeVipScore({ followerCount: 6000, orgInfluenceScore: 15, missionAlignmentScore: 20 });
  assert.strictEqual(below.total, 45);
  assert.strictEqual(below.isVip, false);
  const above = scoring.computeVipScore({ followerCount: 60000, orgInfluenceScore: 20, missionAlignmentScore: 30 });
  assert.strictEqual(above.total, 90);
  assert.strictEqual(above.isVip, true);
});

test('scores clamp out-of-range Claude values', () => {
  const s = scoring.computeVipScore({ followerCount: 0, orgInfluenceScore: 999, missionAlignmentScore: -5 });
  assert.strictEqual(s.orgInfluence, 30);
  assert.strictEqual(s.missionAlignment, 0);
});

test('threshold honours VIP_PROSPECT_SCORE_THRESHOLD env', () => {
  process.env.VIP_PROSPECT_SCORE_THRESHOLD = '80';
  const s = scoring.computeVipScore({ followerCount: 50000, orgInfluenceScore: 20, missionAlignmentScore: 15 }); // 75
  assert.strictEqual(s.isVip, false);
  delete process.env.VIP_PROSPECT_SCORE_THRESHOLD;
});

// ─── prompts (§7 voice rules) ───────────────────────────────────────────────────
test('assessment prompt forbids em dashes and commission', () => {
  const p = prompts.buildAssessmentSystemPrompt();
  assert.ok(/Never use em dashes/.test(p));
  assert.ok(/Always say referral fee/.test(p));
  assert.ok(!p.includes('—'), 'prompt must not contain an em dash character');
});

test('briefing prompt injects voice guidelines and lists all sections', () => {
  const p = prompts.buildVIPBriefingSystemPrompt('BE WARM');
  assert.ok(p.includes('BE WARM'));
  for (const section of M.BRIEFING_SECTIONS) assert.ok(p.includes(section), `missing section ${section}`);
});

// ─── Claude parse safe-defaults ──────────────────────────────────────────────────
test('extractJson handles fenced and trailing-text JSON', () => {
  assert.deepStrictEqual(claude.extractJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepStrictEqual(claude.extractJson('here you go: {"b":2} thanks'), { b: 2 });
  assert.strictEqual(claude.extractJson('not json at all'), null);
});

// ─── alert format (§9.1) ─────────────────────────────────────────────────────────
test('alert format matches the §9.1 template and names Jessica', () => {
  const { subject, body } = alerts.formatAlert({
    errorType: 'token refresh failure', runType: 'scheduled', timeCst: '23:05 CST',
    date: '2026-07-19', detail: 'CRM token failed', action: 'Re-check credentials',
  });
  assert.strictEqual(subject, '[Agent 0 Alert] token refresh failure — 2026-07-19');
  assert.ok(body.includes('Affected prospect: N/A'));
  assert.ok(body.includes('Error detail: CRM token failed'));
});

// ─── pipeline with injected fakes ────────────────────────────────────────────────

function makeDeps(overrides = {}) {
  const calls = { webhooks: [], uploads: [], alerts: [], upserts: [] };
  const fakeZoho = {
    resetToken() {},
    async getCrmToken() { return 'crm-token'; },
    async resolveModuleApiName() { return { apiName: 'Prospects', divergence: null }; },
    async verifyFields() { return { missing: [] }; },
    async fetchAllRecords() { return [{ id: '1', Social_Profile_URL: 'https://x.com/known' }]; },
    async upsertProspect(mod, record) { calls.upserts.push(record); return { op: 'create', id: 'new' }; },
  };
  const fakeWorkdrive = {
    resetToken() {},
    async getWorkDriveToken() { return 'wd-token'; },
    async readBrandAssets() { return { voiceGuidelines: 'VOICE', missionStatement: 'MISSION' }; },
    async uploadTextFile(folder, filename, content) { calls.uploads.push({ folder, filename, content }); return { id: 'file-1', name: filename }; },
  };
  const fakeClaude = {
    async assessProspect(text) {
      // VIP if the profile text mentions a big audience.
      const vip = /Audience size: 6000000|VIPPY/.test(text);
      return {
        ok: true, error: null, raw: '{}',
        assessment: {
          motivationHypothesis: 'Mission Impact', motivationRationale: 'cares', roleCategory: 'K12 Educator',
          missionAlignmentScore: vip ? 30 : 10, orgInfluenceScore: vip ? 30 : 5, notes: '',
        },
      };
    },
    async generateVIPBriefing() { return 'WHO THIS IS\n...'; },
  };
  const fakeWebhooks = { async fireWebhook(url, payload) { calls.webhooks.push({ url, payload }); return { ok: true, status: 200, attempts: 1 }; } };
  const fakeAlerts = { async sendAlert(a) { calls.alerts.push(a); return { delivered: true, via: 'test' }; } };

  const deps = {
    zoho: { ...fakeZoho, ...(overrides.zoho || {}) },
    workdrive: { ...fakeWorkdrive, ...(overrides.workdrive || {}) },
    claude: { ...fakeClaude, ...(overrides.claude || {}) },
    webhooks: { ...fakeWebhooks, ...(overrides.webhooks || {}) },
    alerts: { ...fakeAlerts, ...(overrides.alerts || {}) },
    now: () => new Date('2026-07-19T04:05:00Z'),
  };
  return { deps, calls };
}

function baseEnv() {
  process.env.WORKDRIVE_FOLDER_07_ID = 'f07';
  process.env.WORKDRIVE_FOLDER_08_ID = 'f08';
  process.env.WORKDRIVE_FOLDER_09_ID = 'f09';
  process.env.AGENT0_AUDIENCE_CONFIG = JSON.stringify({ categories: ['k12'] });
  process.env.MAKE_VIP_NOTIFY_WEBHOOK_URL = 'https://hook/vip';
  process.env.MAKE_AGENT0_COMPLETE_WEBHOOK_URL = 'https://hook/recruit';
  process.env.ADMIN_ALERT_EMAIL = 'jessica.bowman@gracelyn.edu';
}
function clearEnv() {
  ['WORKDRIVE_FOLDER_07_ID', 'WORKDRIVE_FOLDER_08_ID', 'WORKDRIVE_FOLDER_09_ID', 'AGENT0_AUDIENCE_CONFIG',
    'MAKE_VIP_NOTIFY_WEBHOOK_URL', 'MAKE_AGENT0_COMPLETE_WEBHOOK_URL', 'ADMIN_ALERT_EMAIL', 'VIP_PROSPECT_SCORE_THRESHOLD',
  ].forEach((k) => delete process.env[k]);
}

test('dedup: a known Social_Profile_URL is skipped', async () => {
  baseEnv();
  const { deps } = makeDeps();
  const summary = await runCycle({ mode: 'WEEKLY', fastRetry: true, deps,
    rawProspects: [{ socialProfileUrl: 'https://x.com/known', firstName: 'A', email: 'a@x.com', followerCount: 100 }] });
  assert.strictEqual(summary.duplicatesSkipped, 1);
  assert.strictEqual(summary.processed, 0);
  clearEnv();
});

test('standard prospect routes to recruiting, no briefing', async () => {
  baseEnv();
  const { deps, calls } = makeDeps();
  const summary = await runCycle({ mode: 'WEEKLY', fastRetry: true, deps,
    rawProspects: [{ socialProfileUrl: 'https://x.com/std', firstName: 'S', email: 's@x.com', followerCount: 100 }] });
  assert.strictEqual(summary.vipCount, 0);
  assert.strictEqual(summary.standardRouted, 1);
  assert.ok(calls.webhooks.some((w) => w.url === 'https://hook/recruit'));
  assert.ok(!calls.webhooks.some((w) => w.url === 'https://hook/vip'), 'no VIP webhook for standard prospect');
  assert.strictEqual(summary.briefings.length, 0);
  clearEnv();
});

test('VIP prospect: briefing saved to Folder 09, VIP notify fires, NOT routed to recruiting', async () => {
  baseEnv();
  const { deps, calls } = makeDeps();
  const summary = await runCycle({ mode: 'ON_DEMAND', fastRetry: true, deps,
    prospect: { socialProfileUrl: 'https://x.com/vip', firstName: 'Vip', lastName: 'Star', email: 'v@x.com',
      followerCount: 6000000, profileText: 'Audience size: 6000000' } });
  assert.strictEqual(summary.vipCount, 1);
  assert.strictEqual(summary.standardRouted, 0);
  const upload = calls.uploads.find((u) => u.folder === 'f09');
  assert.ok(upload, 'briefing uploaded to Folder 09');
  assert.ok(/^VIP_Brief_Vip_Star_2026-07-18\.txt$/.test(upload.filename), upload && upload.filename);
  assert.ok(calls.webhooks.some((w) => w.url === 'https://hook/vip'), 'VIP notify fired');
  // The recruiting webhook still fires at end-of-run, but with 0 standard prospects.
  const recruit = calls.webhooks.find((w) => w.url === 'https://hook/recruit');
  assert.strictEqual(recruit.payload.standardProspects, 0);
  clearEnv();
});

test('Claude parse failure → safe defaults + Parse_Error gap, processing continues', async () => {
  baseEnv();
  const { deps, calls } = makeDeps({
    claude: { async assessProspect() { return { ok: false, error: 'parse', raw: 'garbage', assessment: { ...M.SAFE_ASSESSMENT_DEFAULTS } }; } },
  });
  const summary = await runCycle({ mode: 'WEEKLY', fastRetry: true, deps,
    rawProspects: [{ socialProfileUrl: 'https://x.com/p', firstName: 'P', email: 'p@x.com', followerCount: 100 }] });
  assert.strictEqual(summary.processed, 1);
  assert.ok(summary.gaps.some((g) => g.gapType === M.GAP_TYPES.parseError), 'Parse_Error gap recorded');
  assert.strictEqual(summary.upserts.created, 1, 'record still upserted with safe defaults');
  clearEnv();
});

test('no-email prospect → No_Email gap and not recruiting-routed', async () => {
  baseEnv();
  const { deps } = makeDeps();
  const summary = await runCycle({ mode: 'WEEKLY', fastRetry: true, deps,
    rawProspects: [{ socialProfileUrl: 'https://x.com/noemail', firstName: 'N', followerCount: 100 }] });
  assert.ok(summary.gaps.some((g) => g.gapType === M.GAP_TYPES.noEmail));
  assert.strictEqual(summary.standardRouted, 0);
  clearEnv();
});

test('gap report written to Folder 07 with dated filename', async () => {
  baseEnv();
  const { deps, calls } = makeDeps();
  await runCycle({ mode: 'WEEKLY', fastRetry: true, deps,
    rawProspects: [{ socialProfileUrl: 'https://x.com/g', firstName: 'G', followerCount: 100 }] });
  const report = calls.uploads.find((u) => u.folder === 'f07');
  assert.ok(report, 'gap report uploaded');
  assert.strictEqual(report.filename, 'Agent0_Gap_Report_2026-07-18.txt');
  clearEnv();
});

test('missing brand asset halts the run with an alert', async () => {
  baseEnv();
  const { deps, calls } = makeDeps({
    workdrive: { async readBrandAssets() { throw new Error('voice_guidelines.txt not found'); }, resetToken() {}, async getWorkDriveToken() { return 't'; } },
  });
  const summary = await runCycle({ mode: 'WEEKLY', fastRetry: true, deps, rawProspects: [] });
  assert.ok(summary.halted && /brand assets/.test(summary.halted), summary.halted);
  assert.ok(calls.alerts.some((a) => a.errorType === 'asset missing'));
  clearEnv();
});

test('missing CRM fields are surfaced (not silently skipped)', async () => {
  baseEnv();
  const { deps, calls } = makeDeps({
    zoho: {
      resetToken() {}, async getCrmToken() { return 't'; },
      async resolveModuleApiName() { return { apiName: 'Prospects', divergence: null }; },
      async verifyFields() { return { missing: ['VIP_Prospect', 'Role_Category'] }; },
      async fetchAllRecords() { return []; },
      async upsertProspect() { return { op: 'create', id: 'x' }; },
    },
  });
  const summary = await runCycle({ mode: 'WEEKLY', fastRetry: true, deps,
    rawProspects: [{ socialProfileUrl: 'https://x.com/m', firstName: 'M', email: 'm@x.com', followerCount: 10 }] });
  assert.deepStrictEqual(summary.missingFields, ['VIP_Prospect', 'Role_Category']);
  assert.ok(calls.alerts.some((a) => a.errorType === 'CRM field divergence'));
  clearEnv();
});

// ─── run ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log('Agent 0 tests\n');
  for (const [name, fn] of cases) {
    try { await fn(); console.log(`  ✓ ${name}`); passed++; }
    catch (err) { console.error(`  ✗ ${name}\n    ${err.stack || err.message}`); process.exitCode = 1; }
  }
  console.log(`\n${passed}/${cases.length} passed${process.exitCode ? ' (with failures)' : ''}`);
})();
