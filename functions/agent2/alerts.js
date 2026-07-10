'use strict';

/**
 * Parmeet alerts (design §9, §10). Formatted consistently across every failure
 * scenario and delivered via the optional MAKE_AGENT2_ERROR_WEBHOOK; when no
 * webhook is configured the alert is logged (and returned to the caller) so
 * nothing is lost.
 */

const M = require('./manifest');
const { fireWebhook } = require('./webhooks');

/**
 * @param {object} a
 * @param {string} a.errorType   e.g. "WordPress role upgrade failure"
 * @param {string} a.detail      specific error message
 * @param {string} a.action      what Parmeet needs to do
 * @param {string} [a.ambassador] affected ambassador name/email or N/A
 * @param {string} [a.date]      YYYY-MM-DD
 */
function formatAlert(a) {
  const subject = `[Agent 2 Alert] ${a.errorType}${a.date ? ` — ${a.date}` : ''}`;
  const body = [
    `Agent 2 encountered an error.`,
    ``,
    `Error type: ${a.errorType}`,
    `Affected ambassador: ${a.ambassador || 'N/A'}`,
    `Error detail: ${a.detail}`,
    `Action required: ${a.action}`,
    ``,
    `This alert was generated automatically by Agent 2. Contact your developer if the error repeats after corrective action.`,
  ].join('\n');
  return { subject, body };
}

/** Send a Parmeet alert. Never throws — returns { delivered, via, subject }. */
async function sendAlert(a, { deps = {} } = {}) {
  const { subject, body } = formatAlert(a);
  const to = M.getEnv('PARMEET_ALERT_EMAIL');
  const webhook = M.getEnv('MAKE_AGENT2_ERROR_WEBHOOK');
  console.error(`[Agent2][ALERT] ${subject}\n${body}`);

  if (webhook) {
    const fire = deps.fireWebhook || fireWebhook;
    const res = await fire(webhook, { to, subject, body, type: 'agent2_alert' }, { retryDelayMs: 0, deps });
    return { delivered: !!res.ok, via: 'webhook', subject, to };
  }
  return { delivered: false, via: 'log-only', subject, to };
}

module.exports = { formatAlert, sendAlert };
