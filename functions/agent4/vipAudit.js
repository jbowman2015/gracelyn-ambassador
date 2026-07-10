'use strict';

/**
 * Post-recalculation VIP audit (design §5). Runs after Agent 3's quarterly VIP
 * recalculation: Make.com Scenario 3 is triggered by Agent 3's completion
 * webhook (HARD STOP #3 — URL not yet confirmed) and in turn POSTs /vip-audit
 * here. Agent 3's own run summaries (functions/agent3/monthly.js
 * monthlyVipRecalculation/monthlyVipSupplemental) are the only source for two
 * of the six checks — see the per-check notes below for exactly what's
 * independently re-queried from the CRM vs. what is taken from the webhook
 * payload, so nothing is silently assumed.
 *
 * Uses the SAME VIP_HIGH_PCT_* / VIP_STD_PCT_* / VIP_POPULATION_THRESHOLD /
 * VIP_AUDIT_TOLERANCE_PCT env vars as Agent 3 (design §10.2) — the audit code
 * pattern below mirrors design §5.1 almost verbatim, adapted to the live field
 * names (VIP_Tier, VIP_Score, VIP_Tier_Upgrade_Date).
 */

const M = require('./manifest');
const dates = require('./dates');
const { resolveContext } = require('./context');
const queries = require('./queries');

const defaultZoho = require('./zoho');
const defaultAlerts = require('./alerts');

function resolveDeps(input) {
  const d = input.deps || {};
  return { zoho: d.zoho || defaultZoho, alerts: d.alerts || defaultAlerts, now: (d.now && d.now()) || new Date() };
}

/** Expected tier counts for a population, per design §5.1's code pattern. */
function expectedTierCounts(population) {
  const isLarge = population >= M.vipPopulationThreshold();
  const highPct = isLarge ? M.vipHighPctLarge() : M.vipHighPctSmall();
  const stdPct = isLarge ? M.vipStdPctLarge() : M.vipStdPctSmall();
  return {
    expectedHighVip: Math.round(population * (highPct / 100)),
    expectedStdVip: Math.round(population * (stdPct / 100)),
  };
}

function withinTolerance(actual, expected, tolerancePct) {
  if (expected === 0) return actual === 0;
  const deviation = Math.abs(actual - expected) / expected;
  return deviation <= tolerancePct / 100;
}

/**
 * Run all six audit checks. `payload` carries the numbers Agent 4 cannot
 * independently re-derive from CRM state alone (Agent 3's own run summary):
 *   - population           ambassador population size used for the % bands
 *   - scoredCount          how many ambassadors Agent 3 scored this cycle
 *                          (check #6 fallback signal — see note below)
 *   - upgradedCount        Agent 3's monthlyVipRecalculation summary.upgraded
 *   - welcomeMessagesSent  optional — Agent 3 does not currently persist a
 *                          message-sent flag distinct from VIP_Tier_Upgrade_Date
 *                          (functions/agent3/monthly.js sets the upgrade date
 *                          before the welcome email send result is known), so
 *                          when omitted this check can only compare against
 *                          itself and is reported as "not independently
 *                          verifiable" rather than silently assumed to pass.
 *   - outreachTasksCreated Agent 3's monthlyVipSupplemental summary.outreachTasksCreated
 */
async function runVipRecalculationAudit(payload = {}, input = {}) {
  const deps = resolveDeps(input);
  const { zoho, alerts, now } = deps;
  const today = dates.dateStr(now);
  const runCtx = { runType: 'scheduled', date: today, timeCst: dates.timeCst(now), deps: input.deps };
  const result = { halted: null, passed: null, checks: [], anomalies: [] };

  let ctx;
  try {
    ctx = await resolveContext(zoho, alerts, runCtx);
    if (ctx.missingFields.length) { result.halted = `Missing required CRM fields: ${ctx.missingFields.join(', ')}`; return result; }
  } catch (err) {
    result.halted = `module resolution: ${err.message}`;
    return result;
  }

  const F = M.AMBASSADOR_FIELDS;
  let ambassadors;
  try {
    ambassadors = await queries.fetchAllAmbassadors(zoho, ctx.ambassadorsModuleApiName);
  } catch (err) {
    result.halted = `VIP audit query: ${err.message}`;
    return result;
  }

  const population = payload.population || ambassadors.length;
  const { expectedHighVip, expectedStdVip } = expectedTierCounts(population);
  const tolerancePct = M.vipAuditTolerancePct();

  const actualHighVip = ambassadors.filter((r) => r[F.vipTier] === M.VIP_TIER_VALUES.highVip).length;
  const actualStdVip = ambassadors.filter((r) => r[F.vipTier] === M.VIP_TIER_VALUES.standardVip).length;

  // Check 1: High VIP count within expected range.
  const highOk = withinTolerance(actualHighVip, expectedHighVip, tolerancePct);
  result.checks.push({ check: 'High VIP count', expected: expectedHighVip, actual: actualHighVip, passed: highOk });
  if (!highOk) result.anomalies.push({ check: 'High VIP count', expected: expectedHighVip, actual: actualHighVip });

  // Check 2: Standard VIP count within expected range.
  const stdOk = withinTolerance(actualStdVip, expectedStdVip, tolerancePct);
  result.checks.push({ check: 'Standard VIP count', expected: expectedStdVip, actual: actualStdVip, passed: stdOk });
  if (!stdOk) result.anomalies.push({ check: 'Standard VIP count', expected: expectedStdVip, actual: actualStdVip });

  // Check 3: No ambassador assigned both tiers. VIP_Tier is a single-select
  // picklist live (not multiselect as the design doc's phrasing assumes), so
  // that literal condition is structurally impossible. The practical analog
  // re-implemented here is VIP_Flag / VIP_Tier consistency: VIP_Flag = true
  // should never coexist with VIP_Tier = 'Not VIP', and vice versa.
  const inconsistent = ambassadors.filter((r) => {
    const flagged = !!r[F.vipFlag];
    const tiered = r[F.vipTier] && r[F.vipTier] !== M.VIP_TIER_VALUES.notVip;
    return flagged !== tiered;
  });
  const consistencyOk = inconsistent.length === 0;
  result.checks.push({
    check: 'VIP_Flag / VIP_Tier consistency (reinterpreted — VIP_Tier is single-select live)',
    expected: 0, actual: inconsistent.length, passed: consistencyOk,
  });
  if (!consistencyOk) result.anomalies.push({ check: 'VIP_Flag / VIP_Tier consistency', expected: 0, actual: inconsistent.length, ids: inconsistent.map((r) => r.id) });

  // Check 4: Tier upgrade messages sent.
  const upgradedToday = ambassadors.filter((r) => r[F.vipTierUpgradeDate] === today).length;
  const upgradedCount = payload.upgradedCount != null ? payload.upgradedCount : upgradedToday;
  let upgradeCheck;
  if (payload.welcomeMessagesSent != null) {
    const ok = payload.welcomeMessagesSent === upgradedCount;
    upgradeCheck = { check: 'Tier upgrade messages sent', expected: upgradedCount, actual: payload.welcomeMessagesSent, passed: ok };
    if (!ok) result.anomalies.push({ check: 'Tier upgrade messages sent', expected: upgradedCount, actual: payload.welcomeMessagesSent });
  } else {
    upgradeCheck = {
      check: 'Tier upgrade messages sent', expected: upgradedCount, actual: null, passed: null,
      note: 'Not independently verifiable — Agent 3 does not persist a message-sent flag distinct from VIP_Tier_Upgrade_Date. Pass welcomeMessagesSent in the webhook payload for a true cross-check.',
    };
  }
  result.checks.push(upgradeCheck);

  // Check 5: Personal outreach list delivered (High VIP, no referral in 30 days).
  const highVipInactive = ambassadors.filter((r) => r[F.vipTier] === M.VIP_TIER_VALUES.highVip && (r[F.daysSinceLastReferral] || 0) >= 30);
  const outreachTasksCreated = payload.outreachTasksCreated;
  let outreachCheck;
  if (outreachTasksCreated == null) {
    outreachCheck = {
      check: 'Personal outreach list delivered', expected: highVipInactive.length, actual: null, passed: null,
      note: 'outreachTasksCreated not provided in the audit payload.',
    };
  } else if (outreachTasksCreated === 0 && highVipInactive.length === 0) {
    outreachCheck = { check: 'Personal outreach list delivered', expected: 0, actual: 0, passed: true, note: 'Zero High VIP ambassadors currently lack a referral in 30 days — zero tasks is expected, not a failure.' };
  } else {
    const ok = outreachTasksCreated > 0;
    outreachCheck = { check: 'Personal outreach list delivered', expected: highVipInactive.length, actual: outreachTasksCreated, passed: ok };
    if (!ok) result.anomalies.push({ check: 'Personal outreach list delivered', expected: highVipInactive.length, actual: outreachTasksCreated });
  }
  result.checks.push(outreachCheck);

  // Check 6: Recalculation timestamp written (design: VIP_Score updated in past 24h).
  // The live schema has no per-field "modified time" Agent 4 can query directly,
  // so `scoredCount` from Agent 3's own run summary is the primary signal; a
  // zero-or-missing count with zero upgrades is treated as a likely-failed run.
  const scoredCount = payload.scoredCount;
  let recalcCheck;
  if (scoredCount == null) {
    recalcCheck = {
      check: 'Recalculation timestamp written', expected: '>0', actual: null, passed: null,
      note: 'scoredCount not provided in the audit payload — pass Agent 3 monthlyVipRecalculation summary.scored for this check to run.',
    };
  } else {
    const ok = scoredCount > 0;
    recalcCheck = { check: 'Recalculation timestamp written', expected: '>0', actual: scoredCount, passed: ok };
    if (!ok) result.anomalies.push({ check: 'Recalculation timestamp written', expected: '>0', actual: scoredCount });
  }
  result.checks.push(recalcCheck);

  const definitiveChecks = result.checks.filter((c) => c.passed !== null);
  result.passed = definitiveChecks.every((c) => c.passed);

  if (!result.passed) {
    await alerts.sendAlert({
      errorType: 'VIP recalculation audit anomaly',
      detail: `Population ${population}. Anomalies: ${JSON.stringify(result.anomalies)}`,
      action: 'Human review required. Do not attempt auto-correction.', ...runCtx,
    });
  } else {
    await alerts.sendAlert({
      errorType: 'VIP recalculation audit passed',
      detail: `Population ${population}. High VIP ${actualHighVip}/${expectedHighVip}, Standard VIP ${actualStdVip}/${expectedStdVip}.`,
      action: 'None — confirmation only.', ...runCtx,
    });
  }

  return result;
}

module.exports = { runVipRecalculationAudit, expectedTierCounts, withinTolerance };
