/**
 * Agent 2 — Onboarding (Catalyst Advanced I/O).
 *
 * Moves an approved ambassador from application submission to active status:
 * combined compliance form, Standard/VIP track routing, Phase 1/2 approval,
 * win-back sequence, and activation into Agent 3's engagement cycle.
 *
 * Routes (Make.com wiring per design §8):
 *   POST /application-received     Scenario 1 — new Zoho Forms application submission.
 *   POST /approval                 Scenario 2 — Status = Approved Flow trigger, or
 *                                   called directly after A to attempt Phase 2 auto-approve.
 *   POST /compliance-check         Scenario 3 — Catalyst daily job, 8:30 AM CST.
 *   POST /winback-survey-response  Scenario 4 — new win-back survey submission.
 *   POST /activation               Scenario 5 — Compliance_Complete = true Flow trigger.
 *   POST /threshold-check          Catalyst daily job — active ambassador count.
 *   GET  /health                   liveness.
 */

'use strict';

const express = require('express');
const M = require('./manifest');
const zoho = require('./zoho');
const alerts = require('./alerts');
const { runFunctionA } = require('./functionA');
const { runFunctionB } = require('./functionB');
const { runDailyComplianceSweep, routeWinBackSurveyResponse } = require('./functionC');
const { runFunctionD } = require('./functionD');
const { runThresholdCheck } = require('./thresholds');

const app = express();
app.use(express.json({ limit: '2mb' }));

/**
 * Resolve the Ambassadors + Prospects module api_names live and cross-check
 * the fields this agent writes, per ClaudeCode_Zoho_API_Names_Instruction.
 * Every route runs this first and fails loudly (not silently) on divergence,
 * mirroring functions/agent0/pipeline.js Step 4.
 */
async function resolveContext() {
  const ambassadors = await zoho.resolveModuleApiName(M.AMBASSADORS_MODULE);
  const prospects = await zoho.resolveModuleApiName(M.PROSPECTS_MODULE);
  const divergences = [ambassadors.divergence, prospects.divergence].filter(Boolean);

  const { missing } = await zoho.verifyFields(ambassadors.apiName, Object.values(M.AMBASSADORS_FIELDS).filter((f) => f !== 'id'));
  if (missing.length) {
    await alerts.sendAlert({
      errorType: 'CRM field divergence', detail: `Fields missing on "${ambassadors.apiName}": ${missing.join(', ')}`,
      action: 'Create the missing Ambassadors fields in Zoho (or re-run the Agent 2 field reconciliation) before relying on this run.',
    });
  }
  for (const d of divergences) {
    await alerts.sendAlert({ errorType: 'module name divergence', detail: d, action: 'Reconcile the module api_name env var with the live Zoho value.' });
  }

  return {
    ambassadorsModuleApiName: ambassadors.apiName,
    prospectsModuleApiName: prospects.apiName,
    missingFields: missing,
    divergences,
  };
}

function handle(fn) {
  return async (req, res) => {
    try {
      const ctx = await resolveContext();
      const result = await fn({ ...req.body, ...ctx });
      res.json({ success: result.ok !== false, ...result });
    } catch (err) {
      console.error('[Agent2]', err);
      res.status(500).json({ success: false, error: err.message });
    }
  };
}

app.post('/application-received', handle(runFunctionA));
app.post('/approval', handle(runFunctionB));
app.post('/compliance-check', handle(runDailyComplianceSweep));
app.post('/winback-survey-response', handle(routeWinBackSurveyResponse));
app.post('/activation', handle(runFunctionD));
app.post('/threshold-check', handle(runThresholdCheck));

app.get('/health', (req, res) => res.json({ ok: true, agent: '2', role: 'onboarding' }));

module.exports = app;
