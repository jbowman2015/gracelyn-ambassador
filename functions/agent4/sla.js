'use strict';

/**
 * Support ticket SLA tracking (design §4). Daily monitoring (6:30 AM CST)
 * detects newly-breached tickets and writes SLA_Breached / Resolution_SLA_Breached
 * (Agent 4 owns both fields exclusively — design §7 NOTE on Agent 5's doc: "Agent 5
 * must not write this field"). The weekly summary (design §4.1, §6) is computed
 * from the same ticket set.
 */

const M = require('./manifest');
const dates = require('./dates');
const { resolveContext } = require('./context');
const queries = require('./queries');
const { notifyCoordinator } = require('./coordinator');

const defaultZoho = require('./zoho');
const defaultAlerts = require('./alerts');

function resolveDeps(input) {
  const d = input.deps || {};
  return { zoho: d.zoho || defaultZoho, alerts: d.alerts || defaultAlerts, now: (d.now && d.now()) || new Date() };
}

function ticketLabel(rec) {
  const F = M.SUPPORT_TICKET_FIELDS;
  return `${rec.id} (${rec[F.ticketTier] || 'unknown tier'})`;
}

/**
 * Evaluate first-response and resolution SLA breaches for one ticket record.
 * Returns { firstResponseBreach, resolutionBreach, hoursSinceEscalation } — pure,
 * no I/O, so it is directly unit-testable.
 */
function evaluateTicket(rec, nowIso) {
  const F = M.SUPPORT_TICKET_FIELDS;
  const tier = rec[F.ticketTier];
  const escalation = rec[F.escalationTimestamp];
  if (!escalation) return { firstResponseBreach: false, resolutionBreach: false, hoursSinceEscalation: null };

  const hoursSinceEscalation = dates.hoursBetween(escalation, nowIso);
  const firstResponseBreach = !rec[F.firstResponseTimestamp]
    && !rec[F.slaBreached]
    && hoursSinceEscalation > M.firstResponseThresholdHours(tier);
  const resolutionBreach = !rec[F.resolutionTimestamp]
    && !rec[F.resolutionSlaBreached]
    && hoursSinceEscalation > M.resolutionThresholdHours(tier);

  return { firstResponseBreach, resolutionBreach, hoursSinceEscalation };
}

/**
 * Daily SLA monitoring job. Writes newly-breached flags and fires breach
 * alerts (design §4.1, §7 Scenario 4: coordinator always, + Parmeet for
 * Tier 3 / VIP Priority).
 */
async function slaMonitoringJob(input = {}) {
  const deps = resolveDeps(input);
  const { zoho, alerts, now } = deps;
  const nowIso = now.toISOString();
  const runCtx = { runType: 'scheduled', date: dates.dateStr(now), timeCst: dates.timeCst(now), deps: input.deps };
  const summary = { checked: 0, firstResponseBreaches: 0, resolutionBreaches: 0, urgentBreaches: 0, halted: null, errors: [] };

  let ctx;
  try {
    ctx = await resolveContext(zoho, alerts, runCtx);
    if (ctx.missingFields.length) { summary.halted = `Missing required CRM fields: ${ctx.missingFields.join(', ')}`; return summary; }
  } catch (err) {
    summary.halted = `module resolution: ${err.message}`;
    return summary;
  }

  let openTickets;
  try {
    const [awaitingFirstResponse, awaitingResolution] = await Promise.all([
      queries.fetchAwaitingFirstResponse(zoho, ctx.supportTicketsModuleApiName),
      queries.fetchAwaitingResolution(zoho, ctx.supportTicketsModuleApiName),
    ]);
    const byId = new Map();
    for (const r of [...awaitingFirstResponse, ...awaitingResolution]) byId.set(r.id, r);
    openTickets = [...byId.values()];
  } catch (err) {
    await alerts.sendAlert({
      errorType: 'SLA monitoring query failure', detail: err.message,
      action: 'SLA breach detection paused until resolved.', ...runCtx,
    });
    summary.halted = `SLA query: ${err.message}`;
    return summary;
  }

  summary.checked = openTickets.length;
  const F = M.SUPPORT_TICKET_FIELDS;

  for (const rec of openTickets) {
    const verdict = evaluateTicket(rec, nowIso);
    const patch = {};
    if (verdict.firstResponseBreach) { patch[F.slaBreached] = true; summary.firstResponseBreaches += 1; }
    if (verdict.resolutionBreach) { patch[F.resolutionSlaBreached] = true; summary.resolutionBreaches += 1; }
    if (!Object.keys(patch).length) continue;

    try {
      await zoho.updateRecord(ctx.supportTicketsModuleApiName, rec.id, patch);
    } catch (err) {
      summary.errors.push(`CRM update failed for ${rec.id}: ${err.message}`);
      continue;
    }

    const tier = rec[F.ticketTier];
    const urgent = M.isUrgentTier(tier);
    if (urgent) summary.urgentBreaches += 1;

    const breachKind = verdict.firstResponseBreach && verdict.resolutionBreach
      ? 'first response AND resolution'
      : verdict.firstResponseBreach ? 'first response' : 'resolution';
    const body = [
      `SLA breach: ${breachKind} — ticket ${ticketLabel(rec)}.`,
      `Hours since escalation: ${verdict.hoursSinceEscalation.toFixed(1)}.`,
      `Issue category: ${rec[F.issueCategory] || 'unknown'}.`,
      `VIP: ${rec[F.ambassadorVipStatus] ? 'yes' : 'no'}.`,
    ].join('\n');

    const webhook = M.getEnv('MAKE_AGENT4_SLA_BREACH_WEBHOOK');
    if (webhook) {
      const fireWebhook = (deps.fireWebhook) || require('./webhooks').fireWebhook;
      await fireWebhook(webhook, {
        ticket_id: rec.id, tier, issue_category: rec[F.issueCategory], is_urgent: urgent,
        is_vip: !!rec[F.ambassadorVipStatus], breach_kind: breachKind,
        hours_since_escalation: verdict.hoursSinceEscalation,
      }, { retryDelayMs: 0, deps: input.deps });
    } else {
      await notifyCoordinator({ subject: `[Agent 4] SLA breach — ${ticketLabel(rec)}`, text: body }, { deps: input.deps });
    }

    if (urgent) {
      await alerts.sendAlert({
        errorType: 'SLA breach (Tier 3 / VIP Priority)', detail: body,
        action: 'Immediate coordinator + Parmeet attention required.', ...runCtx,
      });
    }
  }

  return summary;
}

/**
 * Weekly SLA summary (design §4.1, §6 "SLA Performance"). `sinceIso` marks
 * the start of the reporting week (Monday-to-Monday, design §6).
 */
async function computeWeeklySlaSummary(input = {}) {
  const deps = resolveDeps(input);
  const { zoho, alerts, now } = deps;
  const nowIso = now.toISOString();
  const runCtx = { runType: 'scheduled', date: dates.dateStr(now), timeCst: dates.timeCst(now), deps: input.deps };

  let ctx;
  try {
    ctx = await resolveContext(zoho, alerts, runCtx);
  } catch (err) {
    return { halted: `module resolution: ${err.message}` };
  }
  if (ctx.missingFields.length) return { halted: `Missing required CRM fields: ${ctx.missingFields.join(', ')}` };

  let all;
  try {
    all = await queries.fetchAllTickets(zoho, ctx.supportTicketsModuleApiName);
  } catch (err) {
    return { halted: `SLA report query: ${err.message}` };
  }

  const F = M.SUPPORT_TICKET_FIELDS;
  const sinceIso = input.sinceIso || dates.addDaysStr(dates.dateStr(now), -7) + 'T00:00:00.000Z';
  const escalatedThisWeek = all.filter((r) => r[F.escalationTimestamp] && r[F.escalationTimestamp] >= sinceIso);

  const byTier = {};
  for (const tier of Object.values(M.TICKET_TIER_VALUES)) byTier[tier] = { count: 0, breaches: 0, responseHours: [] };
  for (const r of escalatedThisWeek) {
    const tier = r[F.ticketTier] || 'unknown';
    if (!byTier[tier]) byTier[tier] = { count: 0, breaches: 0, responseHours: [] };
    byTier[tier].count += 1;
    if (r[F.slaBreached]) byTier[tier].breaches += 1;
    if (r[F.firstResponseTimestamp]) byTier[tier].responseHours.push(dates.hoursBetween(r[F.escalationTimestamp], r[F.firstResponseTimestamp]));
  }

  const totalEscalated = escalatedThisWeek.length;
  const totalBreaches = escalatedThisWeek.filter((r) => r[F.slaBreached]).length;
  const breachRatePct = totalEscalated ? (totalBreaches / totalEscalated) * 100 : 0;

  const allResponseHours = escalatedThisWeek
    .filter((r) => r[F.firstResponseTimestamp])
    .map((r) => dates.hoursBetween(r[F.escalationTimestamp], r[F.firstResponseTimestamp]));
  const avgFirstResponseHours = allResponseHours.length
    ? allResponseHours.reduce((a, b) => a + b, 0) / allResponseHours.length
    : null;

  const openTickets = all.filter((r) => r[F.escalationTimestamp] && !r[F.resolutionTimestamp]);
  const openAges = openTickets.map((r) => dates.hoursBetween(r[F.escalationTimestamp], nowIso));
  const openOlderThan48h = openAges.filter((h) => h > 48).length;
  const longestOpenHours = openAges.length ? Math.max(...openAges) : 0;

  return {
    halted: null,
    totalEscalated,
    totalBreaches,
    breachRatePct,
    avgFirstResponseHours,
    byTier,
    openOlderThan48h,
    longestOpenHours,
    breachRateExceedsThreshold: breachRatePct > M.slaWeeklyBreachRateThresholdPct(),
    avgResponseExceedsTarget: avgFirstResponseHours !== null && avgFirstResponseHours > M.slaAvgFirstResponseTargetHours(),
  };
}

module.exports = { evaluateTicket, slaMonitoringJob, computeWeeklySlaSummary, ticketLabel };
