'use strict';

/**
 * Admin alert emails (design §9 + §9.1). The program admin is Jessica
 * (jessica.bowman@gracelyn.edu) — the design doc's "Parmeet" role.
 *
 * Agent 0 has no direct mail credential in its tool table, so alerts are
 * formatted to the exact §9.1 template and delivered via an optional Make.com
 * webhook (MAKE_ADMIN_ALERT_WEBHOOK_URL). When no webhook is configured the
 * alert is logged (and returned to the caller) so nothing is lost.
 */

const M = require('./manifest');
const { fireWebhook } = require('./webhooks');

/**
 * Format an alert to the §9.1 template.
 * @param {object} a
 * @param {string} a.errorType   e.g. "token refresh failure"
 * @param {string} a.runType     "scheduled" | "on-demand"
 * @param {string} a.timeCst     "HH:MM CST"
 * @param {string} a.date        "YYYY-MM-DD"
 * @param {string} [a.prospect]  affected prospect name or N/A
 * @param {string} a.detail      specific error message
 * @param {string} a.action      what Parmeet needs to do
 */
function formatAlert(a) {
  const subject = `[Agent 0 Alert] ${a.errorType} — ${a.date}`;
  const body = [
    `Agent 0 encountered an error during the ${a.runType} run.`,
    ``,
    `Error type: ${a.errorType}`,
    `Time: ${a.timeCst}`,
    `Affected prospect: ${a.prospect || 'N/A'}`,
    `Error detail: ${a.detail}`,
    `Action required: ${a.action}`,
    ``,
    `This alert was generated automatically by Agent 0. Contact your developer if the error repeats after corrective action.`,
  ].join('\n');
  return { subject, body };
}

/**
 * Send an admin alert (to Jessica). Never throws — returns { delivered, via, subject }.
 * `deps.fireWebhook` is injectable for tests.
 */
async function sendAlert(a, { deps = {} } = {}) {
  const { subject, body } = formatAlert(a);
  const to = M.getEnv('ADMIN_ALERT_EMAIL');
  const webhook = M.getEnv('MAKE_ADMIN_ALERT_WEBHOOK_URL');
  console.error(`[Agent0][ALERT] ${subject}\n${body}`);

  if (webhook) {
    const fire = deps.fireWebhook || fireWebhook;
    const res = await fire(webhook, { to, subject, body, type: 'agent0_alert' }, { retryDelayMs: 0, deps });
    return { delivered: !!res.ok, via: 'webhook', subject, to };
  }
  return { delivered: false, via: 'log-only', subject, to };
}

module.exports = { formatAlert, sendAlert };
