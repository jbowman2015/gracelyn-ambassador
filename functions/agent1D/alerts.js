'use strict';

/**
 * Error alert routing for Agent 1D (design §7 Scenario 4). Every error is
 * fired to MAKE_AGENT1D_ERROR_WEBHOOK — Make.com centralizes the actual
 * email formatting/delivery to Parmeet so alert format stays consistent
 * across every agent, per the design doc. Never throws; logs regardless of
 * webhook delivery so nothing is lost if Make.com is unreachable.
 */

const M = require('./manifest');
const { fireWebhook } = require('./webhooks');

/**
 * @param {object} a
 * @param {string} a.errorType   e.g. "Form submission missing email"
 * @param {string} a.detail      specific error message
 * @param {string} [a.email]     affected submitter email, if known
 * @param {string} [a.leadMagnetId]
 */
async function sendAlert(a, { deps = {} } = {}) {
  const payload = {
    type: 'agent1d_error',
    errorType: a.errorType,
    detail: a.detail,
    email: a.email || null,
    leadMagnetId: a.leadMagnetId || null,
    parmeetAlertEmail: M.getEnv('PARMEET_ALERT_EMAIL'),
    timestamp: (deps.now ? deps.now() : new Date()).toISOString(),
  };
  console.error(`[Agent1D][ALERT] ${a.errorType}: ${a.detail}`);

  const url = M.getEnv('MAKE_AGENT1D_ERROR_WEBHOOK');
  const fire = deps.fireWebhook || fireWebhook;
  const res = await fire(url, payload, { retryDelayMs: 0, deps });
  return { delivered: !!res.ok, via: url ? 'webhook' : 'log-only', payload };
}

module.exports = { sendAlert };
