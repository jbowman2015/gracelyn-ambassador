'use strict';

/**
 * Daily fraud flag check (design §2.3, 6:00 AM CST). Reads the blueprint's
 * fraud output — `Fraud_Flag` on Ambassadors (design doc: Disqualification_Flag,
 * reconciled live 2026-07-10, see manifest.js header) — and surfaces every
 * currently-flagged record to the coordinator. Agent 4 never rebuilds fraud
 * detection logic (design §2.1 "EXISTING BLUEPRINT — DO NOT REBUILD").
 *
 * There is no separate "already surfaced" marker field in the live schema, so
 * this (and the daily checkpoint) surface every ambassador currently flagged
 * rather than only flags newly set since the prior run — nothing is silently
 * dropped, and the list naturally shrinks once the coordinator resolves a flag
 * (clearing Fraud_Flag back to false).
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

/** Build escalation queue items from Fraud_Flag = true ambassador records. */
function buildFraudEscalationItems(records) {
  const F = M.AMBASSADOR_FIELDS;
  return records.map((r) => ({
    ambassadorId: r.id,
    name: [r[F.firstName], r[F.lastName]].filter(Boolean).join(' ') || r.id,
    flagType: 'Fraud_Flag',
    recommendedAction: 'Review flagged ambassador record. Approve, decline, or hold.',
  }));
}

async function fraudFlagCheck(input = {}) {
  const deps = resolveDeps(input);
  const { zoho, alerts, now } = deps;
  const runCtx = { runType: 'scheduled', date: dates.dateStr(now), timeCst: dates.timeCst(now), deps: input.deps };
  const summary = { checked: 0, escalated: 0, halted: null, items: [], errors: [] };

  let ctx;
  try {
    ctx = await resolveContext(zoho, alerts, runCtx);
    if (ctx.missingFields.length) { summary.halted = `Missing required CRM fields: ${ctx.missingFields.join(', ')}`; return summary; }
  } catch (err) {
    summary.halted = `module resolution: ${err.message}`;
    return summary;
  }

  let records;
  try {
    records = await queries.fetchFraudFlagged(zoho, ctx.ambassadorsModuleApiName);
  } catch (err) {
    await alerts.sendAlert({
      errorType: 'fraud flag query failure', detail: err.message,
      action: 'Fraud flags may be undetected until next run. Retry.', ...runCtx,
    });
    summary.halted = `fraud query: ${err.message}`;
    return summary;
  }

  summary.checked = records.length;
  summary.items = buildFraudEscalationItems(records);
  summary.escalated = summary.items.length;

  if (summary.items.length) {
    const body = [
      `${summary.items.length} ambassador record(s) flagged for fraud review.`, '',
      ...summary.items.map((i) => `- ${i.name} (${i.ambassadorId}): ${i.flagType} — ${i.recommendedAction}`),
    ].join('\n');
    await notifyCoordinator({ subject: `[Agent 4] Fraud flag escalations — ${runCtx.date}`, text: body }, { deps: input.deps });
  }

  return summary;
}

module.exports = { fraudFlagCheck, buildFraudEscalationItems };
