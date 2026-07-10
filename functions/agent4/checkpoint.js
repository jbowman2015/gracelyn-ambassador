'use strict';

/**
 * Daily coordinator checkpoint (design §3, 7:00 AM CST). Compiles every
 * monitored item from the prior 24 hours into one email + (best-effort)
 * Zoho Analytics dashboard update.
 *
 * Two sections have no live CRM data source yet and degrade gracefully rather
 * than failing the whole checkpoint:
 *   - Ad spend alert: Agent 1C (the only writer of an ad-spend/kill-switch
 *     log) and the "Ad Campaign Log" module are both unbuilt. Reported as
 *     "not yet available" until AD_CAMPAIGN_LOG_MODULE_API_NAME resolves.
 *   - Kill switch events: no CRM field/module tracks this yet. The section
 *     always exists (empty by default) and — per design's own protocol — is
 *     rendered first if it is ever non-empty.
 *   - System health summary (agent error counts, failed automations, token
 *     usage): not instrumented anywhere in this program yet. Reported as
 *     "not yet instrumented" rather than fabricated zeros.
 */

const M = require('./manifest');
const dates = require('./dates');
const { resolveContext } = require('./context');
const queries = require('./queries');
const { notifyCoordinator } = require('./coordinator');
const analytics = require('./analytics');
const { fraudFlagCheck } = require('./fraud');
const { eligibilityQueueCheck } = require('./eligibility');

const defaultZoho = require('./zoho');
const defaultAlerts = require('./alerts');

function resolveDeps(input) {
  const d = input.deps || {};
  return {
    zoho: d.zoho || defaultZoho, alerts: d.alerts || defaultAlerts,
    analytics: d.analytics || analytics, now: (d.now && d.now()) || new Date(),
  };
}

function formatCheckpointBody(cp) {
  const lines = [`Daily coordinator checkpoint — ${cp.date}`, ''];

  if (cp.killSwitchEvents.length) {
    lines.push('*** KILL SWITCH ACTIVATED IN PRIOR 24 HOURS ***');
    for (const e of cp.killSwitchEvents) lines.push(`- ${e}`);
    lines.push('');
  }

  lines.push(`Ad spend alert: ${cp.adSpendAlert}`, '');

  lines.push(`Fraud flag escalations (${cp.fraudItems.length}):`);
  for (const i of cp.fraudItems) lines.push(`- ${i.name} (${i.ambassadorId}): ${i.flagType} — ${i.recommendedAction}`);
  lines.push('');

  lines.push(`Ambassador applications awaiting Phase 1 approval (${cp.applicationsAwaitingApproval.length}):`);
  for (const a of cp.applicationsAwaitingApproval) lines.push(`- ${a.name} (${a.ambassadorId})`);
  lines.push('');

  lines.push(`Auto-approve exceptions (${cp.exceptionReviewItems.length}):`);
  for (const e of cp.exceptionReviewItems) lines.push(`- ${e.name} (${e.ambassadorId}): ${e.reason || 'no reason recorded'}`);
  lines.push('');

  lines.push(`Referral fee queue (${cp.eligibilityItems.length}):`);
  for (const e of cp.eligibilityItems) lines.push(`- Referral ${e.referralId} (${e.programLevel}, $${e.commissionAmount}): ${e.recommendedAction}`);
  lines.push('');

  lines.push(`Dormant ambassador escalations (${cp.dormantEscalations.length}):`);
  for (const d of cp.dormantEscalations) lines.push(`- ${d.name} (${d.ambassadorId})`);
  lines.push('');

  lines.push(`SLA breach alerts, currently open (${cp.slaBreaches.length}):`);
  for (const s of cp.slaBreaches) lines.push(`- Ticket ${s.id} (${s.tier}): ${s.kind}`);
  lines.push('');

  lines.push(`System health summary: ${cp.systemHealthNote}`);

  return lines.join('\n');
}

async function dailyCheckpoint(input = {}) {
  const deps = resolveDeps(input);
  const { zoho, alerts, now } = deps;
  const runCtx = { runType: 'scheduled', date: dates.dateStr(now), timeCst: dates.timeCst(now), deps: input.deps };
  const cp = {
    date: runCtx.date, halted: null,
    killSwitchEvents: [],
    adSpendAlert: 'Not yet available — Ad Campaign Log / Agent 1C are unbuilt.',
    fraudItems: [], applicationsAwaitingApproval: [], exceptionReviewItems: [],
    eligibilityItems: [], dormantEscalations: [], slaBreaches: [],
    systemHealthNote: 'Not yet instrumented — no CRM/Analytics source for agent error counts, failed automations, or token usage exists yet.',
    analyticsWrite: null,
  };

  let ctx;
  try {
    ctx = await resolveContext(zoho, alerts, runCtx);
    if (ctx.missingFields.length) { cp.halted = `Missing required CRM fields: ${ctx.missingFields.join(', ')}`; return cp; }
  } catch (err) {
    cp.halted = `module resolution: ${err.message}`;
    return cp;
  }

  const F = M.AMBASSADOR_FIELDS;

  try {
    const fraud = await fraudFlagCheck({ deps: input.deps });
    cp.fraudItems = fraud.items || [];
  } catch (err) { cp.systemHealthNote += ` Fraud check error: ${err.message}.`; }

  try {
    const eligibility = await eligibilityQueueCheck({ deps: input.deps });
    cp.eligibilityItems = eligibility.items || [];
  } catch (err) { cp.systemHealthNote += ` Eligibility check error: ${err.message}.`; }

  try {
    const apps = await queries.fetchApplicationsAwaitingApproval(zoho, ctx.ambassadorsModuleApiName);
    cp.applicationsAwaitingApproval = apps.map((r) => ({ ambassadorId: r.id, name: [r[F.firstName], r[F.lastName]].filter(Boolean).join(' ') || r.id }));
  } catch (err) { cp.systemHealthNote += ` Applications query error: ${err.message}.`; }

  try {
    const exceptions = await queries.fetchExceptionReview(zoho, ctx.ambassadorsModuleApiName);
    cp.exceptionReviewItems = exceptions.map((r) => ({ ambassadorId: r.id, name: [r[F.firstName], r[F.lastName]].filter(Boolean).join(' ') || r.id, reason: r[F.exceptionReason] }));
  } catch (err) { cp.systemHealthNote += ` Exceptions query error: ${err.message}.`; }

  try {
    const dormant = await queries.fetchEscalatedToHuman(zoho, ctx.ambassadorsModuleApiName);
    cp.dormantEscalations = dormant.map((r) => ({ ambassadorId: r.id, name: [r[F.firstName], r[F.lastName]].filter(Boolean).join(' ') || r.id }));
  } catch (err) { cp.systemHealthNote += ` Dormant escalation query error: ${err.message}.`; }

  try {
    const ST = M.SUPPORT_TICKET_FIELDS;
    const breaches = await queries.fetchOpenSlaBreaches(zoho, ctx.supportTicketsModuleApiName);
    cp.slaBreaches = breaches.map((r) => ({
      id: r.id, tier: r[ST.ticketTier],
      kind: r[ST.slaBreached] && r[ST.resolutionSlaBreached] ? 'first response AND resolution' : r[ST.slaBreached] ? 'first response' : 'resolution',
    }));
  } catch (err) { cp.systemHealthNote += ` SLA breach query error: ${err.message}.`; }

  const analyticsResult = await deps.analytics.writeSummary({ type: 'daily_checkpoint', ...cp }, { deps: input.deps });
  cp.analyticsWrite = analyticsResult;
  if (!analyticsResult.ok) {
    await alerts.sendAlert({
      errorType: 'Zoho Analytics write failed', detail: analyticsResult.reason,
      action: 'Checkpoint emailed to coordinator directly as a text summary (fallback already applied).', ...runCtx,
    });
  }

  const body = formatCheckpointBody(cp);
  const emailResult = await notifyCoordinator({ subject: `[Agent 4] Daily checkpoint — ${cp.date}`, text: body }, { deps: input.deps });
  if (!emailResult.ok) {
    await alerts.sendAlert({ errorType: 'daily checkpoint delivery failed', detail: emailResult.error, action: 'Coordinator did not receive the checkpoint. Manual check required.', ...runCtx });
  }

  return cp;
}

module.exports = { dailyCheckpoint, formatCheckpointBody };
