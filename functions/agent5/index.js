'use strict';

/**
 * Agent 5 — Ambassador Support (Catalyst Advanced I/O).
 *
 * Portal chat: verifies the ambassador's WordPress session, queries the OpenAI
 * ambassador knowledge base, classifies the resolution tier, writes a Support
 * Ticket to CRM, and fires the Make.com escalation webhook for Tier 2+.
 *
 * Routes:
 *   POST /chat     WordPress portal chat widget — { session_token, message_text, thread_id? }
 *   GET  /health   liveness.
 */

const express = require('express');
const M = require('./manifest');
const zoho = require('./zoho');
const alerts = require('./alerts');
const { handleChatMessage } = require('./pipeline');

const app = express();
app.use(express.json({ limit: '1mb' }));

/**
 * Resolve the Ambassadors + Support Tickets module api_names live and
 * cross-check the fields Agent 5 writes, per ClaudeCode_Zoho_API_Names_Instruction.
 * Mirrors functions/agent2/index.js resolveContext — fails loudly (via alert),
 * not silently, on divergence, but does not block the chat response.
 */
async function resolveContext() {
  const ambassadors = await zoho.resolveModuleApiName(M.AMBASSADORS_MODULE);
  const supportTickets = await zoho.resolveModuleApiName(M.SUPPORT_TICKETS_MODULE);
  const divergences = [ambassadors.divergence, supportTickets.divergence].filter(Boolean);

  const writeFields = Object.values(M.SUPPORT_TICKET_FIELDS).filter((f) => f !== M.SUPPORT_TICKET_FIELDS.name);
  const { missing } = await zoho.verifyFields(supportTickets.apiName, writeFields);
  // Coordination #2 — confirm the full nine-field SLA set Agent 4 also depends on.
  const slaCheck = await zoho.verifyFields(supportTickets.apiName, M.SLA_COORDINATION_FIELDS);

  if (missing.length) {
    await alerts.sendAlert({
      errorType: 'CRM field divergence', detail: `Fields missing on "${supportTickets.apiName}": ${missing.join(', ')}`,
      action: 'Create the missing Support Tickets fields in Zoho before relying on this run.',
    });
  }
  if (slaCheck.missing.length) {
    await alerts.sendAlert({
      errorType: 'SLA coordination field divergence',
      detail: `Fields missing on "${supportTickets.apiName}" that Agent 4 also depends on: ${slaCheck.missing.join(', ')}`,
      action: 'Coordination #2 broken — reconcile with the Agent 4 developer before either agent writes CRM calls.',
    });
  }
  for (const d of divergences) {
    await alerts.sendAlert({ errorType: 'module name divergence', detail: d, action: 'Reconcile the module api_name env var with the live Zoho value.' });
  }

  return {
    ambassadorsModuleApiName: ambassadors.apiName,
    supportTicketsModuleApiName: supportTickets.apiName,
    missingFields: missing,
    divergences,
  };
}

app.post('/chat', async (req, res) => {
  try {
    const ctx = await resolveContext();
    const body = req.body || {};
    const result = await handleChatMessage({ ...body, ...ctx });
    res.json(result);
  } catch (err) {
    console.error('[Agent5]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/health', (req, res) => res.json({ ok: true, agent: '5', role: 'ambassador-support' }));

module.exports = app;
