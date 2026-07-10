'use strict';

/**
 * Daily eligibility queue check (design §2.3, 6:15 AM CST). Reads Referrals at
 * Stage = Eligible (matches the live `Referral_Stage` field's "Eligible" value
 * exactly — no divergence) and surfaces them to the payment queue view
 * compiled into the daily checkpoint (design §3 "Referral fee queue").
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

function buildEligibilityQueueItems(records) {
  const F = M.REFERRAL_FIELDS;
  return records.map((r) => ({
    referralId: r.id,
    ambassadorId: (r[F.ambassadorLookup] && r[F.ambassadorLookup].id) || null,
    programLevel: r[F.programLevel] || '',
    commissionAmount: r[F.commissionAmount] || 0,
    recommendedAction: 'Confirm eligibility and trigger payment via Zoho Books.',
  }));
}

async function eligibilityQueueCheck(input = {}) {
  const deps = resolveDeps(input);
  const { zoho, alerts, now } = deps;
  const runCtx = { runType: 'scheduled', date: dates.dateStr(now), timeCst: dates.timeCst(now), deps: input.deps };
  const summary = { checked: 0, queued: 0, halted: null, items: [], errors: [] };

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
    records = await queries.fetchEligibleReferrals(zoho, ctx.referralsModuleApiName);
  } catch (err) {
    await alerts.sendAlert({
      errorType: 'eligibility query failure', detail: err.message,
      action: 'Retry. The referral fee queue may be stale until resolved.', ...runCtx,
    });
    summary.halted = `eligibility query: ${err.message}`;
    return summary;
  }

  summary.checked = records.length;
  summary.items = buildEligibilityQueueItems(records);
  summary.queued = summary.items.length;
  return summary;
}

module.exports = { eligibilityQueueCheck, buildEligibilityQueueItems };
