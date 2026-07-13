'use strict';

/**
 * Agent 5 tests — no network, no deps, no secrets.
 * Run: node __tests__/agent5.test.js
 *
 * Covers tier/issue-category/complexity classification (design §5, §5.1, §6.1),
 * the escalation payload shape + Coordination #3 (escalation_timestamp ==
 * Escalation_Timestamp exactly), the §10.1 fixed response bodies, session
 * verification gating, the Tier 1/2/3/VIP ticket-write paths, the OpenAI
 * timeout fallback ticket, the inactive-ambassador minimal ticket, webhook
 * retry + fallback email, and that Agent 5 never writes SLA_Breached /
 * Resolution_SLA_Breached — all via in-memory fakes injected through the
 * pipeline's `deps`.
 */

const assert = require('assert');
const M = require('../manifest');
const classify = require('../classify');
const { buildEscalationPayload } = require('../escalation');
const alerts = require('../alerts');
const { handleChatMessage, validatePayload } = require('../pipeline');

let passed = 0;
const cases = [];
const test = (name, fn) => cases.push([name, fn]);

// ─── classify.js ────────────────────────────────────────────────────────────

test('classifyTier: VIP override beats everything', () => {
  assert.strictEqual(
    classify.classifyTier({ isVip: true, questionText: 'where is my referral link', responseText: 'Here you go.' }),
    M.TICKET_TIERS.vip,
  );
});

test('classifyTier: Tier 3 complex signal in the question', () => {
  assert.strictEqual(
    classify.classifyTier({ isVip: false, questionText: 'I want to file a payment dispute', responseText: 'ok' }),
    M.TICKET_TIERS.tier3,
  );
});

test('classifyTier: Tier 2 escalation signal in the response', () => {
  assert.strictEqual(
    classify.classifyTier({ isVip: false, questionText: 'why is my referral not showing', responseText: 'Please contact our support coordinator for help.' }),
    M.TICKET_TIERS.tier2,
  );
});

test('classifyTier: Tier 2 "speak to a person" in the question', () => {
  assert.strictEqual(
    classify.classifyTier({ isVip: false, questionText: 'I want to speak to a person', responseText: 'Sure, here is info.' }),
    M.TICKET_TIERS.tier2,
  );
});

test('classifyTier: Tier 1 default when nothing matches', () => {
  assert.strictEqual(
    classify.classifyTier({ isVip: false, questionText: 'where is my referral link', responseText: 'It is on your Dashboard Home.' }),
    M.TICKET_TIERS.tier1,
  );
});

test('classifyIssueCategory: Payment', () => {
  assert.strictEqual(classify.classifyIssueCategory('When will I receive my referral fee?'), M.ISSUE_CATEGORIES.payment);
});
test('classifyIssueCategory: Compliance', () => {
  // NOTE: design §11.1 names "Why can't I see my referral link?" as the
  // Compliance test example, but none of §5.1's Compliance keywords
  // (agreement/ethics/training/compliance/signature/document/activate/
  // "referral link not working"/"portal access") match that literal question —
  // only "link" matches, which is a Referral Tracking keyword. Implemented
  // §5.1's keyword table faithfully rather than special-casing the §11.1
  // example; see README "Known scope decisions / gaps". Using a question that
  // actually contains a Compliance keyword instead.
  assert.strictEqual(classify.classifyIssueCategory('How do I complete my compliance steps?'), M.ISSUE_CATEGORIES.compliance);
});
test('classifyIssueCategory: Portal Access', () => {
  assert.strictEqual(classify.classifyIssueCategory('I cannot log in to the portal.'), M.ISSUE_CATEGORIES.portalAccess);
});
test('classifyIssueCategory: Other fallback', () => {
  assert.strictEqual(classify.classifyIssueCategory('What is the weather today'), M.ISSUE_CATEGORIES.other);
});

test('classifyComplexity: complex/moderate/simple', () => {
  assert.strictEqual(classify.classifyComplexity('this is a payment dispute'), M.RESOLUTION_COMPLEXITY.complex);
  assert.strictEqual(classify.classifyComplexity('my referral fee tracking is off'), M.RESOLUTION_COMPLEXITY.moderate);
  assert.strictEqual(classify.classifyComplexity('where is my dashboard'), M.RESOLUTION_COMPLEXITY.simple);
});

// ─── escalation.js ──────────────────────────────────────────────────────────

test('buildEscalationPayload: all ten fields present, is_urgent/is_vip correct', () => {
  const payload = buildEscalationPayload({
    ticketId: 'tkt-1', ambassador: { id: 'amb-1', name: 'Jane Doe', isVip: false },
    questionText: 'payment dispute please', tier: M.TICKET_TIERS.tier3,
    issueCategory: M.ISSUE_CATEGORIES.payment, resolutionComplexity: M.RESOLUTION_COMPLEXITY.complex,
    escalationTimestamp: '2026-07-19T04:05:00.000Z',
  });
  const keys = ['ticket_id', 'ambassador_id', 'ambassador_name', 'tier', 'issue_category', 'is_urgent', 'is_vip', 'resolution_complexity', 'question_text', 'escalation_timestamp'];
  for (const k of keys) assert.ok(k in payload, `missing ${k}`);
  assert.strictEqual(payload.is_urgent, true);
  assert.strictEqual(payload.is_vip, false);
});

// ─── alerts.js ──────────────────────────────────────────────────────────────

test('alert format names the error type and action', () => {
  const { subject, body } = alerts.formatAlert({ errorType: 'OpenAI run timeout', detail: 'timed out', action: 'check it', ambassador: 'a@x.com' });
  assert.strictEqual(subject, '[Agent 5 Alert] OpenAI run timeout');
  assert.ok(body.includes('Affected ambassador: a@x.com'));
  assert.ok(body.includes('Error detail: timed out'));
});

// ─── pipeline.js: validation ────────────────────────────────────────────────

test('validatePayload: missing session_token', () => {
  assert.ok(/session_token/.test(validatePayload({ message_text: 'hi' })));
});
test('validatePayload: missing message_text', () => {
  assert.ok(/message_text/.test(validatePayload({ session_token: 't' })));
});
test('validatePayload: message over 2000 chars', () => {
  assert.ok(/2000/.test(validatePayload({ session_token: 't', message_text: 'x'.repeat(2001) })));
});

// ─── pipeline.js: full turn with injected fakes ─────────────────────────────

function makeDeps(overrides = {}) {
  const calls = { tickets: [], webhooks: [], mails: [], alerts: [] };
  const fakeZoho = {
    resetToken() {},
    async getCrmToken() { return 'crm-token'; },
    async findOneByField() {
      return { id: 'amb-1', First_Name: 'Jane', Name: 'Doe', Email: 'jane@x.com', Ambassador_Status: 'Active', VIP_Flag: false };
    },
    async createRecord(mod, record) { calls.tickets.push(record); return { id: `ticket-${calls.tickets.length}`, op: 'create' }; },
  };
  const fakeWorkdrive = {
    resetToken() {},
    async getWorkDriveToken() { return 'wd-token'; },
    async readBrandAssets() { return { copyRules: 'RULES', programDescriptions: 'DESC' }; },
  };
  const fakeWordpress = {
    async verifySession(token) {
      return token === 'valid-token' ? { valid: true, email: 'jane@x.com' } : { valid: false, email: null };
    },
  };
  const fakeOpenai = {
    async runAssistantTurn({ threadId, message }) {
      if (message.includes('TIMEOUT_TRIGGER')) return { ok: false, reason: 'run_timeout', threadId: 'th-timeout', error: 'poll exhausted' };
      let responseText = 'Your referral link is on Dashboard Home. Use the referral fee terminology.';
      if (message.includes('ESCALATE_TRIGGER')) responseText = 'I cannot fully answer that — please contact our support coordinator.';
      return { ok: true, threadId: threadId || 'th-new', responseText };
    },
  };
  const fakeWebhooks = { async fireWebhook(url, payload) { calls.webhooks.push({ url, payload }); return { ok: true, status: 200, attempts: 1 }; } };
  const fakeMail = {
    resetToken() {}, async getMailToken() { return 'mail-token'; },
    async sendMail(opts) { calls.mails.push(opts); return { ok: true }; },
  };
  const fakeAlerts = { async sendAlert(a) { calls.alerts.push(a); return { delivered: true, via: 'test' }; } };

  const deps = {
    zoho: { ...fakeZoho, ...(overrides.zoho || {}) },
    workdrive: { ...fakeWorkdrive, ...(overrides.workdrive || {}) },
    wordpress: { ...fakeWordpress, ...(overrides.wordpress || {}) },
    openai: { ...fakeOpenai, ...(overrides.openai || {}) },
    webhooks: { ...fakeWebhooks, ...(overrides.webhooks || {}) },
    mail: { ...fakeMail, ...(overrides.mail || {}) },
    alerts: { ...fakeAlerts, ...(overrides.alerts || {}) },
    now: () => new Date('2026-07-19T04:05:00.000Z'),
  };
  return { deps, calls };
}

function baseInput(overrides = {}) {
  return {
    session_token: 'valid-token', message_text: 'where is my referral link',
    ambassadorsModuleApiName: 'Ambassadors', supportTicketsModuleApiName: 'Support_Tickets',
    ...overrides,
  };
}

function baseEnv() {
  process.env.WORKDRIVE_FOLDER_08_ID = 'f08';
  process.env.MAKE_ESCALATION_WEBHOOK_URL = 'https://hook/escalate';
  process.env.SUPPORT_COORDINATOR_EMAIL = 'coordinator@gracelyn.edu';
  process.env.PARMEET_ALERT_EMAIL = 'parmeet@gracelyn.edu';
}
function clearEnv() {
  ['WORKDRIVE_FOLDER_08_ID', 'MAKE_ESCALATION_WEBHOOK_URL', 'SUPPORT_COORDINATOR_EMAIL', 'PARMEET_ALERT_EMAIL']
    .forEach((k) => delete process.env[k]);
}

test('unauthenticated access blocked: NOT_VERIFIED_RESPONSE, no CRM ticket', async () => {
  baseEnv();
  const { deps, calls } = makeDeps();
  const result = await handleChatMessage(baseInput({ session_token: 'bad-token' }), { deps });
  assert.deepStrictEqual(result, M.NOT_VERIFIED_RESPONSE);
  assert.strictEqual(calls.tickets.length, 0);
  clearEnv();
});

test('Tier 1: resolved ticket, no escalation webhook', async () => {
  baseEnv();
  const { deps, calls } = makeDeps();
  const result = await handleChatMessage(baseInput(), { deps });
  assert.strictEqual(result.success, true);
  assert.strictEqual(calls.tickets.length, 1);
  const ticket = calls.tickets[0];
  assert.strictEqual(ticket[M.SUPPORT_TICKET_FIELDS.ticketTier], M.TICKET_TIERS.tier1);
  assert.strictEqual(ticket[M.SUPPORT_TICKET_FIELDS.resolutionStatus], M.RESOLUTION_STATUS.resolved);
  assert.ok(ticket[M.SUPPORT_TICKET_FIELDS.resolutionTimestamp]);
  assert.ok(!ticket[M.SUPPORT_TICKET_FIELDS.escalationTimestamp]);
  assert.strictEqual(calls.webhooks.length, 0, 'no escalation webhook for Tier 1');
  clearEnv();
});

test('Tier 2: escalation ticket + webhook fires, Escalation_Timestamp == webhook escalation_timestamp exactly', async () => {
  baseEnv();
  const { deps, calls } = makeDeps();
  const result = await handleChatMessage(baseInput({ message_text: 'ESCALATE_TRIGGER please help' }), { deps });
  assert.strictEqual(result.success, true);
  const ticket = calls.tickets[0];
  assert.strictEqual(ticket[M.SUPPORT_TICKET_FIELDS.ticketTier], M.TICKET_TIERS.tier2);
  assert.strictEqual(calls.webhooks.length, 1);
  const webhookPayload = calls.webhooks[0].payload;
  assert.strictEqual(webhookPayload.escalation_timestamp, ticket[M.SUPPORT_TICKET_FIELDS.escalationTimestamp]);
  clearEnv();
});

test('Tier 3: payment dispute question → is_urgent true in webhook payload', async () => {
  baseEnv();
  const { deps, calls } = makeDeps();
  await handleChatMessage(baseInput({ message_text: 'I need to file a payment dispute about my fee' }), { deps });
  const ticket = calls.tickets[0];
  assert.strictEqual(ticket[M.SUPPORT_TICKET_FIELDS.ticketTier], M.TICKET_TIERS.tier3);
  assert.strictEqual(calls.webhooks[0].payload.is_urgent, true);
  clearEnv();
});

test('VIP Priority overrides tier regardless of question content', async () => {
  baseEnv();
  const { deps, calls } = makeDeps({
    zoho: { async findOneByField() { return { id: 'amb-vip', First_Name: 'Vip', Name: 'Star', Email: 'vip@x.com', Ambassador_Status: 'Active', VIP_Flag: true }; } },
  });
  await handleChatMessage(baseInput({ message_text: 'where is my referral link' }), { deps });
  const ticket = calls.tickets[0];
  assert.strictEqual(ticket[M.SUPPORT_TICKET_FIELDS.ticketTier], M.TICKET_TIERS.vip);
  assert.strictEqual(ticket[M.SUPPORT_TICKET_FIELDS.ambassadorVipStatus], true);
  assert.strictEqual(calls.webhooks[0].payload.is_vip, true);
  clearEnv();
});

test('OpenAI run timeout → FALLBACK_RESPONSE, Tier 2 escalation ticket created, webhook fired', async () => {
  baseEnv();
  const { deps, calls } = makeDeps();
  const result = await handleChatMessage(baseInput({ message_text: 'TIMEOUT_TRIGGER question' }), { deps });
  assert.deepStrictEqual(result, M.FALLBACK_RESPONSE);
  assert.strictEqual(calls.tickets.length, 1);
  assert.strictEqual(calls.tickets[0][M.SUPPORT_TICKET_FIELDS.ticketTier], M.TICKET_TIERS.tier2);
  assert.strictEqual(calls.webhooks.length, 1);
  assert.ok(calls.alerts.some((a) => a.errorType === 'OpenAI run timeout'));
  clearEnv();
});

test('Inactive ambassador: NOT_ACTIVE_RESPONSE + minimal ticket, no escalation webhook', async () => {
  baseEnv();
  const { deps, calls } = makeDeps({
    zoho: { async findOneByField() { return { id: 'amb-2', First_Name: 'Sam', Name: 'Lee', Email: 'sam@x.com', Ambassador_Status: 'Suspended', VIP_Flag: false }; } },
  });
  const result = await handleChatMessage(baseInput(), { deps });
  assert.deepStrictEqual(result, M.NOT_ACTIVE_RESPONSE);
  assert.strictEqual(calls.tickets.length, 1);
  assert.strictEqual(calls.webhooks.length, 0);
  clearEnv();
});

test('Escalation webhook failure (both attempts) → fallback email sent + Parmeet alerted', async () => {
  baseEnv();
  const { deps, calls } = makeDeps({
    webhooks: { async fireWebhook() { return { ok: false, status: 0, attempts: 2, error: 'HTTP 500' }; } },
  });
  await handleChatMessage(baseInput({ message_text: 'ESCALATE_TRIGGER need help' }), { deps });
  assert.strictEqual(calls.mails.length, 1, 'fallback email sent to coordinator');
  assert.strictEqual(calls.mails[0].to, 'coordinator@gracelyn.edu');
  assert.ok(calls.alerts.some((a) => a.errorType === 'escalation webhook failure'));
  clearEnv();
});

test('Never writes SLA_Breached or Resolution_SLA_Breached (Agent 4 owns those exclusively)', async () => {
  baseEnv();
  const { deps, calls } = makeDeps();
  await handleChatMessage(baseInput({ message_text: 'ESCALATE_TRIGGER please help' }), { deps });
  const ticket = calls.tickets[0];
  assert.ok(!('SLA_Breached' in ticket));
  assert.ok(!('Resolution_SLA_Breached' in ticket));
  clearEnv();
});

test('Validation error: over-length message never reaches CRM', async () => {
  baseEnv();
  const { deps, calls } = makeDeps();
  const result = await handleChatMessage(baseInput({ message_text: 'x'.repeat(2001) }), { deps });
  assert.strictEqual(result.success, false);
  assert.strictEqual(calls.tickets.length, 0);
  clearEnv();
});

// ─── run ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log('Agent 5 tests\n');
  for (const [name, fn] of cases) {
    try { await fn(); console.log(`  ✓ ${name}`); passed++; }
    catch (err) { console.error(`  ✗ ${name}\n    ${err.stack || err.message}`); process.exitCode = 1; }
  }
  console.log(`\n${passed}/${cases.length} passed${process.exitCode ? ' (with failures)' : ''}`);
})();
