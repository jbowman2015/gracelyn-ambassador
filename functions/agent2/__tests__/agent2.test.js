'use strict';

/**
 * Agent 2 tests — no network, no deps, no secrets.
 * Run: node __tests__/agent2.test.js
 *
 * Covers: reminder-tier day math + 5-day gap, win-back/dormant timing, all
 * five auto-approve criteria (pass + each failure), VIP_Prospect_Origin
 * override, Phase 1 manual no-op, win-back survey routing (all four paths),
 * WordPress-upgrade-gates-Email-D, Agent 3 webhook payload shape, motivation
 * classification fallback, and threshold alert selection.
 */

const assert = require('assert');
const M = require('../manifest');
const { AMBASSADORS_FIELDS: AF, AMBASSADOR_STATUS: STATUS } = M;
const dates = require('../dates');
const { runAutoApproveCriteria } = require('../autoApprove');
const { validateMotivationTag } = require('../prompts');
const { runFunctionA } = require('../functionA');
const { runFunctionB } = require('../functionB');
const { runDailyComplianceSweep, routeWinBackSurveyResponse } = require('../functionC');
const { runFunctionD } = require('../functionD');
const { runThresholdCheck } = require('../thresholds');

let passed = 0;
const cases = [];
const test = (name, fn) => cases.push([name, fn]);

const NOW = new Date('2026-07-19T13:30:00Z'); // CST date 2026-07-19
const AMB = 'Ambassadors';
const PROS = 'Ambassador_Leads';

// ─── in-memory fake CRM ─────────────────────────────────────────────────────
function makeFakeZoho(store) {
  function coerce(v) { return v === undefined || v === null ? '' : String(v); }
  function parseConditions(criteriaStr) {
    const conditions = [];
    const re = /\(([^:()]+):([^:()]+):([^()]+)\)/g;
    let m;
    while ((m = re.exec(criteriaStr))) conditions.push({ field: m[1], operator: m[2], value: m[3] });
    return conditions;
  }
  function matches(record, conditions) {
    return conditions.every((c) => coerce(record[c.field]) === c.value);
  }
  return {
    calls: { updates: [] },
    async getRecord(mod, id) {
      const arr = mod === AMB ? store.ambassadors : store.prospects;
      return arr.find((r) => r.id === id) || null;
    },
    async findOneByField(mod, field, value) {
      const arr = mod === AMB ? store.ambassadors : store.prospects;
      return arr.find((r) => coerce(r[field]) === coerce(value)) || null;
    },
    async searchByCriteria(mod, criteriaStr) {
      const arr = mod === AMB ? store.ambassadors : store.prospects;
      const conditions = parseConditions(criteriaStr);
      return arr.filter((r) => matches(r, conditions));
    },
    async fetchAllByConditions(mod, conditions) {
      const arr = mod === AMB ? store.ambassadors : store.prospects;
      return arr.filter((r) => matches(r, conditions));
    },
    async updateRecord(mod, id, patch) {
      const arr = mod === AMB ? store.ambassadors : store.prospects;
      const rec = arr.find((r) => r.id === id);
      if (!rec) throw new Error(`no record ${id}`);
      Object.assign(rec, patch);
      this.calls.updates.push({ mod, id, patch });
      return { id, op: 'update' };
    },
  };
}

function makeDeps(store, overrides = {}) {
  const calls = { mail: [], webhooks: [], alerts: [] };
  const zoho = makeFakeZoho(store);
  const mail = { async sendMail(m) { calls.mail.push(m); return { ok: true }; } };
  const workdrive = {
    async readVoiceGuidelines() { return 'VOICE'; },
    async generateWelcomeKitLinks() { return { links: [{ name: 'kit.pdf', url: 'https://wd/kit.pdf' }], failures: [] }; },
  };
  const claude = {
    async classifyMotivation(text) {
      if (/mission/i.test(text)) return { tag: 'Mission Impact', needsReview: false, raw: 'Mission Impact', attempts: 1 };
      if (/garbage/i.test(text)) return { tag: 'Unknown', needsReview: true, raw: 'nonsense', attempts: 2 };
      return { tag: 'Unknown', needsReview: false, raw: 'Unknown', attempts: 1 };
    },
    async generateVIPParagraph() { return 'A warm VIP paragraph.'; },
  };
  const wordpress = { async upgradeToActive() { return { ok: true, status: 200, attempts: 1 }; } };
  const heygen = { async submitVipWelcomeVideo() { return { jobId: 'heygen-job-1' }; } };
  const webhooks = { async fireWebhook(url, payload) { calls.webhooks.push({ url, payload }); return { ok: true, status: 200, attempts: 1 }; } };
  const alerts = { async sendAlert(a) { calls.alerts.push(a); return { delivered: true, via: 'test' }; } };

  const deps = {
    zoho: { ...zoho, ...(overrides.zoho || {}) },
    mail: { ...mail, ...(overrides.mail || {}) },
    workdrive: { ...workdrive, ...(overrides.workdrive || {}) },
    claude: { ...claude, ...(overrides.claude || {}) },
    wordpress: { ...wordpress, ...(overrides.wordpress || {}) },
    heygen: { ...heygen, ...(overrides.heygen || {}) },
    webhooks: { ...webhooks, ...(overrides.webhooks || {}) },
    alerts: { ...alerts, ...(overrides.alerts || {}) },
    now: () => NOW,
  };
  return { deps, calls, zoho };
}

function baseEnv() {
  process.env.APPROVAL_MODE = 'MANUAL';
  process.env.AUTO_APPROVE_CRITERIA_VERSION = 'v2.0';
  process.env.ACTIVE_AMBASSADOR_THRESHOLD_ALERT = '800';
  process.env.ACTIVE_AMBASSADOR_THRESHOLD_AUTO = '1000';
  process.env.WORKDRIVE_FOLDER_03_ID = 'f03';
  process.env.WORKDRIVE_FOLDER_08_ID = 'f08';
  process.env.MAKE_AGENT3_WEBHOOK_URL = 'https://hook/agent3';
  process.env.MAKE_VIP_MANAGER_NOTIFY_WEBHOOK_URL = 'https://hook/vip';
  process.env.MAKE_WINBACK_SURVEY_WEBHOOK = 'https://hook/winback';
  process.env.PARMEET_ALERT_EMAIL = 'parmeet@gracelyn.edu';
  process.env.VIP_MANAGER_EMAIL = 'vip@gracelyn.edu';
}
function clearEnv() {
  ['APPROVAL_MODE', 'AUTO_APPROVE_CRITERIA_VERSION', 'ACTIVE_AMBASSADOR_THRESHOLD_ALERT',
    'ACTIVE_AMBASSADOR_THRESHOLD_AUTO', 'WORKDRIVE_FOLDER_03_ID', 'WORKDRIVE_FOLDER_08_ID',
    'MAKE_AGENT3_WEBHOOK_URL', 'MAKE_VIP_MANAGER_NOTIFY_WEBHOOK_URL', 'MAKE_WINBACK_SURVEY_WEBHOOK',
    'PARMEET_ALERT_EMAIL', 'VIP_MANAGER_EMAIL',
  ].forEach((k) => delete process.env[k]);
}

function baseAmbassador(overrides = {}) {
  return {
    id: 'amb-1', [AF.firstName]: 'Jamie', [AF.lastName]: 'Rivera', [AF.email]: 'jamie@example.com',
    [AF.state]: 'TX', [AF.roleCategory]: 'K12 Educator', [AF.consentGiven]: true,
    [AF.status]: STATUS.applicant, [AF.fraudFlag]: false, [AF.vipFlag]: false, [AF.vipProspectOrigin]: false,
    [AF.complianceComplete]: false, [AF.winBackSent]: false, [AF.dormantCompliance]: false,
    [AF.wordpressUserId]: 'wp-42', [AF.audienceTrack]: 'K12 Educator',
    ...overrides,
  };
}

// ─── dates.js ────────────────────────────────────────────────────────────────
test('reminderTier: day 2-6 window fires day2, respects null last-reminder', () => {
  assert.strictEqual(dates.reminderTier(2, null, NOW), 'day2');
  assert.strictEqual(dates.reminderTier(6, null, NOW), 'day2');
  assert.strictEqual(dates.reminderTier(1, null, NOW), null);
});
test('reminderTier: day 14 suppressed if last reminder sent within 5 days', () => {
  const threeDaysAgo = dates.dateStr(new Date(NOW.getTime() - 3 * 86400000));
  assert.strictEqual(dates.reminderTier(14, threeDaysAgo, NOW), null);
  const sixDaysAgo = dates.dateStr(new Date(NOW.getTime() - 6 * 86400000));
  assert.strictEqual(dates.reminderTier(14, sixDaysAgo, NOW), 'day14');
});
test('isWinBackDue: day 15+ and not yet sent', () => {
  assert.strictEqual(dates.isWinBackDue(15, false), true);
  assert.strictEqual(dates.isWinBackDue(14, false), false);
  assert.strictEqual(dates.isWinBackDue(20, true), false);
});
test('isDormantDue: day 75+, win-back sent, not yet dormant', () => {
  assert.strictEqual(dates.isDormantDue(75, true, false), true);
  assert.strictEqual(dates.isDormantDue(74, true, false), false);
  assert.strictEqual(dates.isDormantDue(80, false, false), false);
});

// ─── prompts.js ──────────────────────────────────────────────────────────────
test('validateMotivationTag falls back to Unknown for junk', () => {
  assert.strictEqual(validateMotivationTag('Mission Impact'), 'Mission Impact');
  assert.strictEqual(validateMotivationTag('nonsense'), 'Unknown');
  assert.strictEqual(validateMotivationTag(''), 'Unknown');
});

// ─── autoApprove.js ──────────────────────────────────────────────────────────
test('auto-approve: all five criteria pass', async () => {
  const store = { ambassadors: [baseAmbassador()], prospects: [] };
  const zoho = makeFakeZoho(store);
  const result = await runAutoApproveCriteria(store.ambassadors[0], AMB, zoho);
  assert.strictEqual(result.allPass, true);
});
test('auto-approve: fraud flag blocks', async () => {
  const store = { ambassadors: [baseAmbassador({ [AF.fraudFlag]: true })], prospects: [] };
  const zoho = makeFakeZoho(store);
  const result = await runAutoApproveCriteria(store.ambassadors[0], AMB, zoho);
  assert.strictEqual(result.allPass, false);
  assert.ok(result.failures.some((f) => f.criterion === 'fraudFlag'));
});
test('auto-approve: duplicate email (existing Active record) blocks', async () => {
  const applicant = baseAmbassador();
  const existing = baseAmbassador({ id: 'amb-2', [AF.status]: STATUS.active });
  const store = { ambassadors: [applicant, existing], prospects: [] };
  const zoho = makeFakeZoho(store);
  const result = await runAutoApproveCriteria(applicant, AMB, zoho);
  assert.strictEqual(result.allPass, false);
  assert.ok(result.failures.some((f) => f.criterion === 'duplicateEmail'));
});
test('auto-approve: household match (same address, different email) blocks', async () => {
  const applicant = baseAmbassador({ [AF.address]: '1 Main St', [AF.city]: 'Austin', [AF.state]: 'TX' });
  const existing = baseAmbassador({
    id: 'amb-2', [AF.email]: 'other@example.com', [AF.status]: STATUS.active,
    [AF.address]: '1 Main St', [AF.city]: 'Austin', [AF.state]: 'TX',
  });
  const store = { ambassadors: [applicant, existing], prospects: [] };
  const zoho = makeFakeZoho(store);
  const result = await runAutoApproveCriteria(applicant, AMB, zoho);
  assert.ok(result.failures.some((f) => f.criterion === 'householdMatch'));
});
test('auto-approve: invalid referral code blocks', async () => {
  const applicant = baseAmbassador({ [AF.recruitedBy]: 'BADCODE' });
  const store = { ambassadors: [applicant], prospects: [] };
  const zoho = makeFakeZoho(store);
  const result = await runAutoApproveCriteria(applicant, AMB, zoho);
  assert.ok(result.failures.some((f) => f.criterion === 'referralCode'));
});
test('auto-approve: valid referral code (active ambassador) passes', async () => {
  const referrer = baseAmbassador({ id: 'amb-ref', Referral_Code: 'GOODCODE', [AF.status]: STATUS.active, [AF.email]: 'ref@example.com' });
  const applicant = baseAmbassador({ [AF.recruitedBy]: 'GOODCODE' });
  const store = { ambassadors: [referrer, applicant], prospects: [] };
  const zoho = makeFakeZoho(store);
  const result = await runAutoApproveCriteria(applicant, AMB, zoho);
  assert.ok(!result.failures.some((f) => f.criterion === 'referralCode'), JSON.stringify(result.failures));
});
test('auto-approve: incomplete application blocks', async () => {
  const applicant = baseAmbassador({ [AF.state]: '' });
  const store = { ambassadors: [applicant], prospects: [] };
  const zoho = makeFakeZoho(store);
  const result = await runAutoApproveCriteria(applicant, AMB, zoho);
  assert.ok(result.failures.some((f) => f.criterion === 'completeness'));
});

// ─── Function A ──────────────────────────────────────────────────────────────
test('Function A: Email A sent, Prospect Outreach_Status set to Applied, queue date written', async () => {
  baseEnv();
  const store = {
    ambassadors: [baseAmbassador()],
    prospects: [{ id: 'lead-1', Email: 'jamie@example.com', Outreach_Status: 'Standard' }],
  };
  const { deps, calls } = makeDeps(store);
  const result = await runFunctionA({ ambassadorId: 'amb-1', ambassadorsModuleApiName: AMB, prospectsModuleApiName: PROS }, deps);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.prospectUpdated, true);
  assert.ok(calls.mail.some((m) => m.to === 'jamie@example.com'));
  assert.strictEqual(store.prospects[0].Outreach_Status, 'Applied');
  assert.ok(store.ambassadors[0][AF.approvalQueueAddedDate]);
  clearEnv();
});

// ─── Function B ────────────────────────────────────────────────────────────
test('Function B: Phase 1 MANUAL takes no action while still Applicant', async () => {
  baseEnv();
  const store = { ambassadors: [baseAmbassador()], prospects: [] };
  const { deps } = makeDeps(store);
  const result = await runFunctionB({ ambassadorId: 'amb-1', ambassadorsModuleApiName: AMB }, deps);
  assert.strictEqual(result.action, 'waiting_for_manual_approval');
  clearEnv();
});
test('Function B: Phase 1 MANUAL proceeds once Status is already Approved', async () => {
  baseEnv();
  const store = { ambassadors: [baseAmbassador({ [AF.status]: STATUS.approved })], prospects: [] };
  const { deps, calls } = makeDeps(store);
  const result = await runFunctionB({ ambassadorId: 'amb-1', ambassadorsModuleApiName: AMB }, deps);
  assert.strictEqual(result.action, 'approved');
  assert.strictEqual(result.track, 'standard');
  assert.ok(calls.mail.length === 1);
  assert.ok(store.ambassadors[0][AF.approvalDate]);
  clearEnv();
});
test('Function B: Phase 2 AUTO approves when all criteria pass', async () => {
  baseEnv();
  process.env.APPROVAL_MODE = 'AUTO';
  const store = { ambassadors: [baseAmbassador()], prospects: [] };
  const { deps } = makeDeps(store);
  const result = await runFunctionB({ ambassadorId: 'amb-1', ambassadorsModuleApiName: AMB }, deps);
  assert.strictEqual(result.action, 'approved');
  assert.strictEqual(store.ambassadors[0][AF.autoApproved], true);
  assert.strictEqual(store.ambassadors[0][AF.autoApproveCriteriaVersion], 'v2.0');
  clearEnv();
});
test('Function B: Phase 2 AUTO routes fraud-flagged application to exception queue', async () => {
  baseEnv();
  process.env.APPROVAL_MODE = 'AUTO';
  const store = { ambassadors: [baseAmbassador({ [AF.fraudFlag]: true })], prospects: [] };
  const { deps, calls } = makeDeps(store);
  const result = await runFunctionB({ ambassadorId: 'amb-1', ambassadorsModuleApiName: AMB }, deps);
  assert.strictEqual(result.action, 'exception_queue');
  assert.strictEqual(store.ambassadors[0][AF.needsExceptionReview], true);
  assert.strictEqual(store.ambassadors[0][AF.autoApproved], undefined);
  assert.ok(calls.alerts.some((a) => a.errorType === 'auto-approve routed to exception queue'));
  clearEnv();
});
test('Function B: VIP_Prospect_Origin always routes to human review in AUTO mode', async () => {
  baseEnv();
  process.env.APPROVAL_MODE = 'AUTO';
  const store = { ambassadors: [baseAmbassador({ [AF.vipProspectOrigin]: true })], prospects: [] };
  const { deps } = makeDeps(store);
  const result = await runFunctionB({ ambassadorId: 'amb-1', ambassadorsModuleApiName: AMB }, deps);
  assert.strictEqual(result.action, 'exception_queue');
  assert.strictEqual(result.reason, 'vip_prospect_origin');
  assert.strictEqual(store.ambassadors[0][AF.autoApproved], undefined);
  clearEnv();
});
test('Function B: VIP track sends personalized email, submits HeyGen job, notifies VIP manager', async () => {
  baseEnv();
  const store = { ambassadors: [baseAmbassador({ [AF.status]: STATUS.approved, [AF.vipFlag]: true })], prospects: [] };
  const { deps, calls } = makeDeps(store);
  const result = await runFunctionB({ ambassadorId: 'amb-1', ambassadorsModuleApiName: AMB }, deps);
  assert.strictEqual(result.track, 'vip');
  assert.ok(calls.mail[0].content.includes('A warm VIP paragraph.'));
  assert.strictEqual(store.ambassadors[0][AF.vipHeyGenJobId], 'heygen-job-1');
  assert.ok(calls.webhooks.some((w) => w.url === 'https://hook/vip'));
  clearEnv();
});

// ─── Function C ────────────────────────────────────────────────────────────
test('Function C daily sweep: day 2 reminder fires and Last_Reminder_Sent_Date is set', async () => {
  baseEnv();
  const approvedTwoDaysAgo = dates.dateStr(new Date(NOW.getTime() - 2 * 86400000));
  const store = { ambassadors: [baseAmbassador({ [AF.status]: STATUS.approved, [AF.approvalDate]: approvedTwoDaysAgo })], prospects: [] };
  const { deps, calls } = makeDeps(store);
  const result = await runDailyComplianceSweep({ ambassadorsModuleApiName: AMB }, deps);
  assert.strictEqual(result.remindersSent.day2, 1);
  assert.ok(calls.mail.length === 1);
  assert.strictEqual(store.ambassadors[0][AF.lastReminderSentDate], dates.dateStr(NOW));
  clearEnv();
});
test('Function C daily sweep: day 15 fires win-back instead of a reminder, sets Win_Back_Sent', async () => {
  baseEnv();
  const fifteenDaysAgo = dates.dateStr(new Date(NOW.getTime() - 15 * 86400000));
  const store = { ambassadors: [baseAmbassador({ [AF.status]: STATUS.approved, [AF.approvalDate]: fifteenDaysAgo })], prospects: [] };
  const { deps, calls } = makeDeps(store);
  const result = await runDailyComplianceSweep({ ambassadorsModuleApiName: AMB }, deps);
  assert.strictEqual(result.winBackSent, 1);
  assert.strictEqual(result.remindersSent.day14, 0);
  assert.strictEqual(store.ambassadors[0][AF.winBackSent], true);
  assert.ok(calls.mail[0].subject.match(/checking in/i));
  clearEnv();
});
test('Function C daily sweep: day 75 sets Dormant_Compliance and sends reactivation email', async () => {
  baseEnv();
  const seventyFiveDaysAgo = dates.dateStr(new Date(NOW.getTime() - 75 * 86400000));
  const store = {
    ambassadors: [baseAmbassador({
      [AF.status]: STATUS.approved, [AF.approvalDate]: seventyFiveDaysAgo, [AF.winBackSent]: true,
    })],
    prospects: [],
  };
  const { deps, calls } = makeDeps(store);
  const result = await runDailyComplianceSweep({ ambassadorsModuleApiName: AMB }, deps);
  assert.strictEqual(result.dormantSet, 1);
  assert.strictEqual(store.ambassadors[0][AF.dormantCompliance], true);
  assert.ok(calls.mail.some((m) => m.subject.match(/still thinking/i)));
  clearEnv();
});
test('Function C: win-back survey response "Too Busy" routes to calendar path', async () => {
  baseEnv();
  const store = { ambassadors: [baseAmbassador({ [AF.status]: STATUS.approved })], prospects: [] };
  const { deps, calls } = makeDeps(store);
  const result = await routeWinBackSurveyResponse({ ambassadorId: 'amb-1', response: 'Too Busy', ambassadorsModuleApiName: AMB }, deps);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(store.ambassadors[0][AF.winBackSurveyResponse], 'Too Busy');
  assert.ok(calls.mail[0].subject.match(/together/i));
  clearEnv();
});
test('Function C: win-back survey response "Technical Problem" notifies coordinator immediately', async () => {
  baseEnv();
  const store = { ambassadors: [baseAmbassador({ [AF.status]: STATUS.approved })], prospects: [] };
  const { deps, calls } = makeDeps(store);
  await routeWinBackSurveyResponse({ ambassadorId: 'amb-1', response: 'Technical Problem', ambassadorsModuleApiName: AMB }, deps);
  assert.ok(calls.webhooks.some((w) => w.url === 'https://hook/winback' && w.payload.type === 'winback_technical_problem'));
  clearEnv();
});
test('Function C: win-back survey response "Not Sure" sends re-engagement email with no compliance link', async () => {
  baseEnv();
  const store = { ambassadors: [baseAmbassador({ [AF.status]: STATUS.approved })], prospects: [] };
  const { deps, calls } = makeDeps(store);
  await routeWinBackSurveyResponse({ ambassadorId: 'amb-1', response: 'Not Sure', ambassadorsModuleApiName: AMB }, deps);
  assert.ok(!/COMBINED_FORM_ID|compliance form/i.test(calls.mail[0].content) || !calls.mail[0].content.includes('http'));
  clearEnv();
});

// ─── Function D ────────────────────────────────────────────────────────────
test('Function D: WordPress upgrade failure withholds Email D', async () => {
  baseEnv();
  const store = { ambassadors: [baseAmbassador({ [AF.status]: STATUS.active, [AF.complianceComplete]: true })], prospects: [] };
  const { deps, calls } = makeDeps(store, { wordpress: { async upgradeToActive() { return { ok: false, status: 500, attempts: 2, error: 'HTTP 500' }; } } });
  const result = await runFunctionD({ ambassadorId: 'amb-1', ambassadorsModuleApiName: AMB }, deps);
  assert.strictEqual(result.ok, false);
  assert.ok(/WordPress role upgrade/.test(result.halted));
  assert.strictEqual(calls.mail.length, 0, 'Email D must not send before WordPress role is confirmed');
  clearEnv();
});
test('Function D: happy path sends Email D, fires Agent 3 webhook with required fields, writes form version', async () => {
  baseEnv();
  const store = {
    ambassadors: [baseAmbassador({
      [AF.status]: STATUS.active, [AF.complianceComplete]: true,
      [AF.motivationDiscoveryResponse]: 'I care about the mission of reaching every student.',
    })],
    prospects: [],
  };
  const { deps, calls } = makeDeps(store);
  const result = await runFunctionD({ ambassadorId: 'amb-1', ambassadorsModuleApiName: AMB }, deps);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.motivationTag, 'Mission Impact');
  assert.strictEqual(calls.mail.length, 1);
  const agent3Call = calls.webhooks.find((w) => w.url === 'https://hook/agent3');
  assert.ok(agent3Call, 'Agent 3 webhook fired');
  for (const field of ['ambassador_id', 'email', 'first_name', 'role_category', 'audience_track', 'motivation_tag', 'vip_flag', 'vip_prospect_origin']) {
    assert.ok(field in agent3Call.payload, `Agent 3 payload missing ${field}`);
  }
  assert.strictEqual(store.ambassadors[0][AF.lastComplianceFormVersion], 'Combined_v2.0');
  clearEnv();
});
test('Function D: invalid Claude motivation response falls back to Unknown and flags for review', async () => {
  baseEnv();
  const store = {
    ambassadors: [baseAmbassador({
      [AF.status]: STATUS.active, [AF.complianceComplete]: true, [AF.motivationDiscoveryResponse]: 'garbage response',
    })],
    prospects: [],
  };
  const { deps, calls } = makeDeps(store);
  const result = await runFunctionD({ ambassadorId: 'amb-1', ambassadorsModuleApiName: AMB }, deps);
  assert.strictEqual(result.motivationTag, 'Unknown');
  assert.ok(calls.alerts.some((a) => a.errorType === 'motivation classification fell back to Unknown'));
  clearEnv();
});

// ─── thresholds.js ───────────────────────────────────────────────────────────
test('threshold check: fires approaching-threshold alert at 800, not the auto-threshold alert', async () => {
  baseEnv();
  const store = { ambassadors: Array.from({ length: 850 }, (_, i) => baseAmbassador({ id: `a${i}`, [AF.status]: STATUS.active })), prospects: [] };
  const { deps, calls } = makeDeps(store);
  const result = await runThresholdCheck({ ambassadorsModuleApiName: AMB }, deps);
  assert.strictEqual(result.count, 850);
  assert.deepStrictEqual(result.fired, ['approaching_threshold']);
  assert.ok(calls.alerts.some((a) => a.errorType === 'auto-approve threshold approaching'));
  clearEnv();
});
test('threshold check: fires auto-threshold alert at 1000+', async () => {
  baseEnv();
  const store = { ambassadors: Array.from({ length: 1000 }, (_, i) => baseAmbassador({ id: `a${i}`, [AF.status]: STATUS.active })), prospects: [] };
  const { deps, calls } = makeDeps(store);
  const result = await runThresholdCheck({ ambassadorsModuleApiName: AMB }, deps);
  assert.deepStrictEqual(result.fired, ['auto_threshold']);
  assert.ok(calls.alerts.some((a) => a.errorType === 'Phase 2 auto-approve threshold reached'));
  clearEnv();
});
test('threshold check: below 800 fires nothing', async () => {
  baseEnv();
  const store = { ambassadors: Array.from({ length: 500 }, (_, i) => baseAmbassador({ id: `a${i}`, [AF.status]: STATUS.active })), prospects: [] };
  const { deps, calls } = makeDeps(store);
  const result = await runThresholdCheck({ ambassadorsModuleApiName: AMB }, deps);
  assert.deepStrictEqual(result.fired, []);
  assert.strictEqual(calls.alerts.length, 0);
  clearEnv();
});

// ─── run ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log('Agent 2 tests\n');
  for (const [name, fn] of cases) {
    try { await fn(); console.log(`  ✓ ${name}`); passed++; }
    catch (err) { console.error(`  ✗ ${name}\n    ${err.stack || err.message}`); process.exitCode = 1; }
  }
  console.log(`\n${passed}/${cases.length} passed${process.exitCode ? ' (with failures)' : ''}`);
})();
