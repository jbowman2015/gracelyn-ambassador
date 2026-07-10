'use strict';

/**
 * Agent 4 tests — no network, no deps, no secrets.
 * Run: node __tests__/agent4.test.js
 *
 * Covers: manifest reconciliation constants, SLA breach evaluation (Tier 2 vs
 * Tier 3/VIP thresholds, no-breach, already-breached guard), the weekly SLA
 * summary, the VIP recalculation audit's six checks (pass, anomaly, the
 * "zero is expected" outreach caveat, the reinterpreted single-select
 * consistency check), content compliance scanning, fraud/eligibility item
 * building, weekly report section math, and CRM context divergence surfacing
 * — all with in-memory fakes injected through each module's `deps`.
 */

const assert = require('assert');
const M = require('../manifest');
const dates = require('../dates');
const sla = require('../sla');
const vipAudit = require('../vipAudit');
const contentCompliance = require('../contentCompliance');
const fraud = require('../fraud');
const eligibility = require('../eligibility');
const weeklyReport = require('../weeklyReport');
const alertsModule = require('../alerts');
const { resolveContext } = require('../context');

let passed = 0;
const cases = [];
const test = (name, fn) => cases.push([name, fn]);

function fakeAlerts(calls) {
  return { async sendAlert(a) { calls.push(a); return { delivered: true, via: 'log-only' }; } };
}

function fakeMail(calls) {
  return { async sendEmail(a) { calls.push(a); return { ok: true, status: 200, error: null }; } };
}

function baseEnv() {
  process.env.SUPPORT_COORDINATOR_EMAIL = 'coordinator@gracelyn.edu';
  process.env.PARMEET_ALERT_EMAIL = 'parmeet@gracelyn.edu';
  process.env.VIP_MANAGER_EMAIL = 'vipmanager@gracelyn.edu';
}
function clearEnv() {
  delete process.env.SUPPORT_COORDINATOR_EMAIL;
  delete process.env.PARMEET_ALERT_EMAIL;
  delete process.env.VIP_MANAGER_EMAIL;
  delete process.env.MAKE_AGENT4_SLA_BREACH_WEBHOOK;
  delete process.env.MAKE_AGENT4_COMPLIANCE_WEBHOOK;
}

// ─── manifest / SLA threshold constants ───────────────────────────────────────
test('SLA_COORDINATION_FIELDS is exactly the nine shared field names', () => {
  const expected = [
    'Ticket_Tier', 'Ambassador_VIP_Status', 'Escalation_Timestamp', 'First_Response_Timestamp',
    'Resolution_Timestamp', 'Resolution_Status', 'Resolution_Complexity', 'SLA_Breached', 'Resolution_SLA_Breached',
  ];
  assert.strictEqual(M.SLA_COORDINATION_FIELDS.length, 9);
  assert.strictEqual(new Set(M.SLA_COORDINATION_FIELDS).size, 9);
  for (const f of expected) assert.ok(M.SLA_COORDINATION_FIELDS.includes(f), `missing ${f}`);
});

test('Escalation_Timestamp field name matches the webhook payload key exactly (Coordination #3)', () => {
  assert.strictEqual(M.SUPPORT_TICKET_FIELDS.escalationTimestamp, 'Escalation_Timestamp');
});

test('isUrgentTier / threshold selection', () => {
  assert.strictEqual(M.isUrgentTier('Tier 2'), false);
  assert.strictEqual(M.isUrgentTier('Tier 3'), true);
  assert.strictEqual(M.isUrgentTier('VIP Priority'), true);
  assert.strictEqual(M.firstResponseThresholdHours('Tier 2'), 24);
  assert.strictEqual(M.firstResponseThresholdHours('VIP Priority'), 4);
  assert.strictEqual(M.resolutionThresholdHours('Tier 2'), 72);
  assert.strictEqual(M.resolutionThresholdHours('Tier 3'), 24);
});

// ─── dates ────────────────────────────────────────────────────────────────────
test('hoursBetween computes fractional hours', () => {
  assert.strictEqual(dates.hoursBetween('2026-07-01T00:00:00.000Z', '2026-07-01T04:00:00.000Z'), 4);
  assert.strictEqual(dates.hoursBetween('2026-07-01T00:00:00.000Z', '2026-07-02T01:00:00.000Z'), 25);
});

// ─── SLA breach evaluation (design §9.1 test protocol) ────────────────────────
test('SLA breach — Tier 2 first response, 25h elapsed', () => {
  const rec = { id: 't1', Ticket_Tier: 'Tier 2', Escalation_Timestamp: '2026-07-09T06:00:00.000Z', First_Response_Timestamp: null };
  const v = sla.evaluateTicket(rec, '2026-07-10T07:00:00.000Z'); // 25h later
  assert.strictEqual(v.firstResponseBreach, true);
  assert.strictEqual(v.resolutionBreach, false); // 72h resolution threshold not yet crossed
});

test('SLA breach — VIP Priority first response, 5h elapsed', () => {
  const rec = { id: 't2', Ticket_Tier: 'VIP Priority', Escalation_Timestamp: '2026-07-10T02:00:00.000Z', First_Response_Timestamp: null };
  const v = sla.evaluateTicket(rec, '2026-07-10T07:00:00.000Z'); // 5h later
  assert.strictEqual(v.firstResponseBreach, true);
});

test('SLA no breach — Tier 2 within threshold at 12h', () => {
  const rec = { id: 't3', Ticket_Tier: 'Tier 2', Escalation_Timestamp: '2026-07-09T19:00:00.000Z', First_Response_Timestamp: null };
  const v = sla.evaluateTicket(rec, '2026-07-10T07:00:00.000Z'); // 12h later
  assert.strictEqual(v.firstResponseBreach, false);
});

test('already-flagged ticket is not re-flagged', () => {
  const rec = { id: 't4', Ticket_Tier: 'Tier 2', Escalation_Timestamp: '2026-07-01T00:00:00.000Z', First_Response_Timestamp: null, SLA_Breached: true };
  const v = sla.evaluateTicket(rec, '2026-07-10T07:00:00.000Z');
  assert.strictEqual(v.firstResponseBreach, false, 'guard against re-flagging an already-breached ticket');
});

test('slaMonitoringJob writes SLA_Breached and alerts coordinator + Parmeet for VIP breach', async () => {
  baseEnv();
  const updates = []; const alertCalls = []; const mailCalls = [];
  const fakeZoho = {
    async resolveModuleApiName({ label }) { return { apiName: label.replace(/\s/g, '_'), divergence: null }; },
    async verifyFields() { return { missing: [] }; },
    async fetchAllRecords(moduleApi, opts) {
      return [{ id: 'vip1', Ticket_Tier: 'VIP Priority', Escalation_Timestamp: '2026-07-10T02:00:00.000Z', First_Response_Timestamp: null, Issue_Category: 'Payment', Ambassador_VIP_Status: true }];
    },
    async updateRecord(moduleApi, id, patch) { updates.push({ moduleApi, id, patch }); },
  };
  const deps = { zoho: fakeZoho, alerts: fakeAlerts(alertCalls), mail: fakeMail(mailCalls), now: () => new Date('2026-07-10T07:00:00.000Z') };
  const summary = await sla.slaMonitoringJob({ deps });
  assert.strictEqual(summary.firstResponseBreaches, 1);
  assert.strictEqual(summary.urgentBreaches, 1);
  assert.ok(updates.some((u) => u.patch.SLA_Breached === true));
  assert.ok(mailCalls.some((m) => /SLA breach/.test(m.subject)));
  assert.ok(alertCalls.some((a) => a.errorType === 'SLA breach (Tier 3 / VIP Priority)'));
  clearEnv();
});

test('computeWeeklySlaSummary aggregates by tier and computes breach rate', async () => {
  baseEnv();
  const tickets = [
    { id: 'a', Ticket_Tier: 'Tier 2', Escalation_Timestamp: '2026-07-08T00:00:00.000Z', First_Response_Timestamp: '2026-07-08T10:00:00.000Z', SLA_Breached: false, Resolution_Timestamp: '2026-07-08T20:00:00.000Z' },
    { id: 'b', Ticket_Tier: 'Tier 2', Escalation_Timestamp: '2026-07-09T00:00:00.000Z', First_Response_Timestamp: null, SLA_Breached: true, Resolution_Timestamp: null },
    { id: 'c', Ticket_Tier: 'VIP Priority', Escalation_Timestamp: '2026-07-06T00:00:00.000Z', First_Response_Timestamp: null, SLA_Breached: false, Resolution_Timestamp: null }, // outside the 7-day window
  ];
  const fakeZoho = {
    async resolveModuleApiName({ label }) { return { apiName: label.replace(/\s/g, '_'), divergence: null }; },
    async verifyFields() { return { missing: [] }; },
    async fetchAllRecords() { return tickets; },
  };
  const deps = { zoho: fakeZoho, alerts: fakeAlerts([]), now: () => new Date('2026-07-10T12:00:00.000Z') };
  const result = await sla.computeWeeklySlaSummary({ sinceIso: '2026-07-03T00:00:00.000Z', deps });
  assert.strictEqual(result.halted, null);
  assert.strictEqual(result.totalEscalated, 3);
  assert.strictEqual(result.totalBreaches, 1);
  assert.ok(Math.abs(result.breachRatePct - (1 / 3) * 100) < 0.01);
  clearEnv();
});

// ─── VIP recalculation audit (design §5, §9.1) ────────────────────────────────
test('expectedTierCounts uses small-population bands under the threshold', () => {
  const { expectedHighVip, expectedStdVip } = vipAudit.expectedTierCounts(500);
  assert.strictEqual(expectedHighVip, Math.round(500 * 0.025));
  assert.strictEqual(expectedStdVip, Math.round(500 * 0.05));
});

test('withinTolerance default 10%', () => {
  assert.strictEqual(vipAudit.withinTolerance(11, 10, 10), true);
  assert.strictEqual(vipAudit.withinTolerance(12, 10, 10), false);
});

test('VIP audit passes when tier counts, upgrades, and outreach all line up', async () => {
  baseEnv();
  const alertCalls = [];
  const ambassadors = [];
  for (let i = 0; i < 462; i++) ambassadors.push({ id: `a${i}`, VIP_Tier: 'Not VIP', VIP_Flag: false });
  for (let i = 0; i < 13; i++) ambassadors.push({ id: `hv${i}`, VIP_Tier: 'High VIP', VIP_Flag: true, VIP_Tier_Upgrade_Date: i < 2 ? '2026-07-06' : null, Days_Since_Last_Referral: 5 });
  for (let i = 0; i < 25; i++) ambassadors.push({ id: `sv${i}`, VIP_Tier: 'Standard VIP', VIP_Flag: true, Days_Since_Last_Referral: 5 });
  const fakeZoho = {
    async resolveModuleApiName({ label }) { return { apiName: label.replace(/\s/g, '_'), divergence: null }; },
    async verifyFields() { return { missing: [] }; },
    async fetchAllRecords() { return ambassadors; },
  };
  const deps = { zoho: fakeZoho, alerts: fakeAlerts(alertCalls), now: () => new Date('2026-07-06T08:00:00.000Z') };
  const result = await vipAudit.runVipRecalculationAudit(
    { population: 500, scoredCount: 500, upgradedCount: 2, welcomeMessagesSent: 2, outreachTasksCreated: 0 },
    { deps },
  );
  assert.strictEqual(result.passed, true, JSON.stringify(result.anomalies));
  assert.ok(alertCalls.some((a) => a.errorType === 'VIP recalculation audit passed'));
  clearEnv();
});

test('VIP audit flags an anomaly when High VIP count deviates beyond tolerance', async () => {
  baseEnv();
  const alertCalls = [];
  const ambassadors = [];
  for (let i = 0; i < 950; i++) ambassadors.push({ id: `a${i}`, VIP_Tier: 'Not VIP', VIP_Flag: false });
  for (let i = 0; i < 50; i++) ambassadors.push({ id: `hv${i}`, VIP_Tier: 'High VIP', VIP_Flag: true }); // expected ~13, actual 50
  const fakeZoho = {
    async resolveModuleApiName({ label }) { return { apiName: label.replace(/\s/g, '_'), divergence: null }; },
    async verifyFields() { return { missing: [] }; },
    async fetchAllRecords() { return ambassadors; },
  };
  const deps = { zoho: fakeZoho, alerts: fakeAlerts(alertCalls), now: () => new Date('2026-07-06T08:00:00.000Z') };
  const result = await vipAudit.runVipRecalculationAudit({ population: 1000, scoredCount: 1000 }, { deps });
  assert.strictEqual(result.passed, false);
  assert.ok(result.anomalies.some((a) => a.check === 'High VIP count'));
  assert.ok(alertCalls.some((a) => a.errorType === 'VIP recalculation audit anomaly'));
  clearEnv();
});

test('VIP audit — zero scoredCount flags a likely-failed recalculation', async () => {
  baseEnv();
  const fakeZoho = {
    async resolveModuleApiName({ label }) { return { apiName: label.replace(/\s/g, '_'), divergence: null }; },
    async verifyFields() { return { missing: [] }; },
    async fetchAllRecords() { return []; },
  };
  const deps = { zoho: fakeZoho, alerts: fakeAlerts([]), now: () => new Date('2026-07-06T08:00:00.000Z') };
  const result = await vipAudit.runVipRecalculationAudit({ population: 100, scoredCount: 0 }, { deps });
  const recalcCheck = result.checks.find((c) => c.check === 'Recalculation timestamp written');
  assert.strictEqual(recalcCheck.passed, false);
  clearEnv();
});

test('VIP audit — zero outreach tasks with zero eligible High VIP is expected, not a failure', async () => {
  baseEnv();
  const fakeZoho = {
    async resolveModuleApiName({ label }) { return { apiName: label.replace(/\s/g, '_'), divergence: null }; },
    async verifyFields() { return { missing: [] }; },
    async fetchAllRecords() { return [{ id: 'hv1', VIP_Tier: 'High VIP', VIP_Flag: true, Days_Since_Last_Referral: 2 }]; },
  };
  const deps = { zoho: fakeZoho, alerts: fakeAlerts([]), now: () => new Date('2026-07-06T08:00:00.000Z') };
  const result = await vipAudit.runVipRecalculationAudit({ population: 10, scoredCount: 10, outreachTasksCreated: 0 }, { deps });
  const outreachCheck = result.checks.find((c) => c.check === 'Personal outreach list delivered');
  assert.strictEqual(outreachCheck.passed, true);
});

test('VIP audit — VIP_Flag/VIP_Tier mismatch is flagged (reinterpreted single-select check)', async () => {
  baseEnv();
  const fakeZoho = {
    async resolveModuleApiName({ label }) { return { apiName: label.replace(/\s/g, '_'), divergence: null }; },
    async verifyFields() { return { missing: [] }; },
    async fetchAllRecords() { return [{ id: 'x1', VIP_Tier: 'High VIP', VIP_Flag: false }]; }, // tiered but not flagged
  };
  const deps = { zoho: fakeZoho, alerts: fakeAlerts([]), now: () => new Date('2026-07-06T08:00:00.000Z') };
  const result = await vipAudit.runVipRecalculationAudit({ population: 10, scoredCount: 10 }, { deps });
  const consistencyCheck = result.checks.find((c) => c.check.includes('VIP_Flag / VIP_Tier consistency'));
  assert.strictEqual(consistencyCheck.passed, false);
});

// ─── content compliance ───────────────────────────────────────────────────────
test('scanContent detects em dash and commission language', () => {
  assert.deepStrictEqual(contentCompliance.scanContent({ text: 'Great work' }), []);
  const emDash = contentCompliance.scanContent({ text: 'You are doing great — keep going' });
  assert.ok(emDash.some((v) => v.type === 'em_dash'));
  const commission = contentCompliance.scanContent({ text: 'Your commission is ready' });
  assert.ok(commission.some((v) => v.type === 'commission_language'));
});

test('contentComplianceAudit without samples halts and alerts (never fabricates zero)', async () => {
  const alertCalls = [];
  const summary = await contentCompliance.contentComplianceAudit({ deps: { alerts: fakeAlerts(alertCalls), now: () => new Date('2026-07-14T08:00:00.000Z') } });
  assert.ok(summary.halted);
  assert.ok(alertCalls.some((a) => a.errorType === 'content compliance audit skipped'));
});

test('contentComplianceAudit with samples notifies the coordinator on violations', async () => {
  baseEnv();
  const mailCalls = [];
  const fakeWorkdrive = { async readFileByName() { throw new Error('not configured in test'); } };
  const summary = await contentCompliance.contentComplianceAudit({
    samples: [{ ambassadorId: 'amb1', text: 'Thanks for your help — see you soon', sentDate: '2026-07-13' }],
    deps: { alerts: fakeAlerts([]), mail: fakeMail(mailCalls), workdrive: fakeWorkdrive, now: () => new Date('2026-07-14T08:00:00.000Z') },
  });
  assert.strictEqual(summary.violations.length, 1);
  assert.ok(mailCalls.some((m) => /Content compliance violations/.test(m.subject)));
  clearEnv();
});

// ─── fraud / eligibility item building ────────────────────────────────────────
test('buildFraudEscalationItems maps ambassador records', () => {
  const items = fraud.buildFraudEscalationItems([{ id: 'amb1', First_Name: 'Jamie', Name: 'Rivera' }]);
  assert.deepStrictEqual(items, [{ ambassadorId: 'amb1', name: 'Jamie Rivera', flagType: 'Fraud_Flag', recommendedAction: 'Review flagged ambassador record. Approve, decline, or hold.' }]);
});

test('buildEligibilityQueueItems maps referral records', () => {
  const items = eligibility.buildEligibilityQueueItems([{ id: 'ref1', Ambassador: { id: 'amb1' }, Program_Level: 'Undergraduate', Commission_Amount: 100 }]);
  assert.strictEqual(items[0].referralId, 'ref1');
  assert.strictEqual(items[0].ambassadorId, 'amb1');
  assert.strictEqual(items[0].commissionAmount, 100);
});

// ─── weekly report section math ───────────────────────────────────────────────
test('computeReferralFeeSummary totals by status and program level', () => {
  const referrals = [
    { Commission_Status: 'Eligible', Commission_Amount: 100, Program_Level: 'Undergraduate' },
    { Commission_Status: 'Paid', Commission_Amount: 200, Program_Level: 'Graduate', Payment_Date: '2026-07-09' },
    { Commission_Status: 'Paid', Commission_Amount: 100, Program_Level: 'Undergraduate', Payment_Date: '2026-06-01' },
  ];
  const result = weeklyReport.computeReferralFeeSummary(referrals, '2026-07-03T00:00:00.000Z');
  assert.strictEqual(result.eligibleCount, 1);
  assert.strictEqual(result.eligibleTotal, 100);
  assert.strictEqual(result.paidThisWeekTotal, 200);
  assert.strictEqual(result.cumulativePaidTotal, 300);
});

test('computeAmbassadorHealth counts by engagement track', () => {
  const ambassadors = [
    { Ambassador_Status: 'Active', Engagement_Track: 'Standard', Approved_Date: '2026-07-05' },
    { Ambassador_Status: 'Active', Engagement_Track: 'Dormant' },
    { Ambassador_Status: 'Suspended', Engagement_Track: 'Standard' },
  ];
  const result = weeklyReport.computeAmbassadorHealth(ambassadors, '2026-07-03T00:00:00.000Z');
  assert.strictEqual(result.totalActive, 2);
  assert.strictEqual(result.standardTrack, 2);
  assert.strictEqual(result.dormantTrack, 1);
  assert.strictEqual(result.newActivations, 1);
});

test('computeVipProgramStatus counts tiers and inactivity', () => {
  const ambassadors = [
    { VIP_Tier: 'High VIP', Days_Since_Last_Referral: 40, VIP_Tier_Upgrade_Date: '2026-07-06' },
    { VIP_Tier: 'Standard VIP', Days_Since_Last_Referral: 5 },
  ];
  const result = weeklyReport.computeVipProgramStatus(ambassadors);
  assert.strictEqual(result.highVipCount, 1);
  assert.strictEqual(result.standardVipCount, 1);
  assert.strictEqual(result.highVipInactive30dCount, 1);
  assert.strictEqual(result.upgradesThisQuarter, 1);
});

test('summarizeContentComplianceHistory counts violations across runs', () => {
  const history = [
    { violations: [{ ambassadorId: 'a1', violations: [{ type: 'em_dash' }] }] },
    { violations: [{ ambassadorId: 'a2', violations: [{ type: 'commission_language' }, { type: 'em_dash' }] }] },
  ];
  const s = weeklyReport.summarizeContentComplianceHistory(history);
  assert.strictEqual(s.available, true);
  assert.strictEqual(s.emDashCount, 2);
  assert.strictEqual(s.commissionCount, 1);
  assert.strictEqual(s.queuedCount, 2);
});

test('summarizeContentComplianceHistory reports unavailable, never fabricates zero', () => {
  const s = weeklyReport.summarizeContentComplianceHistory(undefined);
  assert.strictEqual(s.available, false);
});

// ─── CRM context resolution (divergence never silently skipped) ──────────────
test('resolveContext surfaces module name divergence', async () => {
  const alertCalls = [];
  const fakeZoho = {
    async resolveModuleApiName({ label }) {
      if (label === 'Ambassadors') return { apiName: 'Ambassadors', divergence: 'AMBASSADORS_MODULE_API_NAME="Ambassador" but Zoho api_name is "Ambassadors"' };
      return { apiName: label.replace(/\s/g, '_'), divergence: null };
    },
    async verifyFields() { return { missing: [] }; },
  };
  const ctx = await resolveContext(fakeZoho, fakeAlerts(alertCalls), {});
  assert.ok(ctx.divergences.length === 1);
  assert.ok(alertCalls.some((a) => a.errorType === 'module name divergence'));
});

test('resolveContext surfaces missing fields (not silently skipped)', async () => {
  const alertCalls = [];
  const fakeZoho = {
    async resolveModuleApiName({ label }) { return { apiName: label.replace(/\s/g, '_'), divergence: null }; },
    async verifyFields(moduleApi) {
      if (moduleApi === 'Support_Tickets') return { missing: ['SLA_Breached'] };
      return { missing: [] };
    },
  };
  const ctx = await resolveContext(fakeZoho, fakeAlerts(alertCalls), {});
  assert.deepStrictEqual(ctx.missingFields, ['Support_Tickets.SLA_Breached']);
  assert.ok(alertCalls.some((a) => a.errorType === 'CRM field divergence'));
});

// ─── alert format ─────────────────────────────────────────────────────────────
test('alert format matches the standard template', () => {
  const { subject, body } = alertsModule.formatAlert({
    errorType: 'SLA monitoring query failure', runType: 'scheduled', timeCst: '06:30 CST',
    date: '2026-07-10', detail: 'CRM query timeout', action: 'Retry.',
  });
  assert.strictEqual(subject, '[Agent 4 Alert] SLA monitoring query failure — 2026-07-10');
  assert.ok(body.includes('Error detail: CRM query timeout'));
});

// ─── run ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log('Agent 4 tests\n');
  for (const [name, fn] of cases) {
    try { await fn(); console.log(`  ✓ ${name}`); passed++; }
    catch (err) { console.error(`  ✗ ${name}\n    ${err.stack || err.message}`); process.exitCode = 1; }
  }
  console.log(`\n${passed}/${cases.length} passed${process.exitCode ? ' (with failures)' : ''}`);
})();
