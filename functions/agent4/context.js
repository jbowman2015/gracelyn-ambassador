'use strict';

/**
 * Resolves the three CRM module api_names Agent 4 depends on and cross-checks
 * their fields, per ClaudeCode_Zoho_API_Names_Instruction. Every route runs
 * this first and surfaces (never silently swallows) any divergence — same
 * pattern as functions/agent2/index.js resolveContext and
 * functions/agent3/sprint.js moduleAndVerify.
 */

const M = require('./manifest');

async function resolveContext(zoho, alerts, ctx = {}) {
  const [ambassadors, referrals, supportTickets] = await Promise.all([
    zoho.resolveModuleApiName(M.AMBASSADORS_MODULE),
    zoho.resolveModuleApiName(M.REFERRALS_MODULE),
    zoho.resolveModuleApiName(M.SUPPORT_TICKETS_MODULE),
  ]);
  const divergences = [ambassadors.divergence, referrals.divergence, supportTickets.divergence].filter(Boolean);

  const [ambFields, refFields, stFields] = await Promise.all([
    zoho.verifyFields(ambassadors.apiName, Object.values(M.AMBASSADOR_FIELDS).filter((f) => f !== 'id')),
    zoho.verifyFields(referrals.apiName, Object.values(M.REFERRAL_FIELDS).filter((f) => f !== 'id')),
    zoho.verifyFields(supportTickets.apiName, Object.values(M.SUPPORT_TICKET_FIELDS).filter((f) => f !== 'id')),
  ]);
  const missingFields = [
    ...ambFields.missing.map((f) => `Ambassadors.${f}`),
    ...refFields.missing.map((f) => `Referrals.${f}`),
    ...stFields.missing.map((f) => `Support_Tickets.${f}`),
  ];

  for (const d of divergences) {
    await alerts.sendAlert({
      errorType: 'module name divergence', detail: d,
      action: 'Reconcile the module api_name env var with the live Zoho value.',
      runType: ctx.runType, date: ctx.date, timeCst: ctx.timeCst,
    }, { deps: ctx.deps });
  }
  if (missingFields.length) {
    await alerts.sendAlert({
      errorType: 'CRM field divergence', detail: `Fields missing: ${missingFields.join(', ')}`,
      action: 'Create the missing fields in Zoho (see manifest.js reconciliation notes) before relying on this run.',
      runType: ctx.runType, date: ctx.date, timeCst: ctx.timeCst,
    }, { deps: ctx.deps });
  }

  return {
    ambassadorsModuleApiName: ambassadors.apiName,
    referralsModuleApiName: referrals.apiName,
    supportTicketsModuleApiName: supportTickets.apiName,
    missingFields,
    divergences,
  };
}

module.exports = { resolveContext };
