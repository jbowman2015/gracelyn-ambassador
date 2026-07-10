'use strict';

/**
 * Parmeet alert emails (design §10 failure table). Agent 3's design doc names
 * Parmeet as the alert recipient directly (PARMEET_ALERT_EMAIL is already the
 * canonical name in agent5A/manifest.js — no alias resolution needed, unlike
 * Agent 0's Jessica rename).
 *
 * Agent 3 has no direct mail credential dedicated to alerting — it reuses the
 * Zoho Mail sender (mail.js) when no Make.com alert webhook is configured, so
 * an alert is never silently dropped.
 */

const M = require('./manifest');
const { fireWebhook } = require('./webhooks');

function formatAlert(a) {
  const subject = `[Agent 3 Alert] ${a.errorType} — ${a.date}`;
  const body = [
    `Agent 3 encountered an error during the ${a.runType} run.`,
    ``,
    `Error type: ${a.errorType}`,
    `Time: ${a.timeCst}`,
    `Affected ambassador: ${a.ambassador || 'N/A'}`,
    `Error detail: ${a.detail}`,
    `Action required: ${a.action}`,
    ``,
    `This alert was generated automatically by Agent 3. Contact your developer if the error repeats after corrective action.`,
  ].join('\n');
  return { subject, body };
}

/**
 * Send a Parmeet alert. Never throws — returns { delivered, via, subject }.
 * `deps.fireWebhook` / `deps.mail` are injectable for tests.
 */
async function sendAlert(a, { deps = {} } = {}) {
  const { subject, body } = formatAlert(a);
  const to = M.getEnv('PARMEET_ALERT_EMAIL');
  console.error(`[Agent3][ALERT] ${subject}\n${body}`);

  const webhook = M.getEnv('MAKE_AGENT3_ERROR_WEBHOOK');
  if (webhook) {
    const fire = deps.fireWebhook || fireWebhook;
    const res = await fire(webhook, { to, subject, body, type: 'agent3_alert' }, { retryDelayMs: 0, deps });
    return { delivered: !!res.ok, via: 'webhook', subject, to };
  }
  if (to) {
    const mail = deps.mail || require('./mail');
    const res = await mail.sendEmail({ to, subject, text: body });
    return { delivered: !!res.ok, via: 'mail', subject, to };
  }
  return { delivered: false, via: 'log-only', subject, to };
}

module.exports = { formatAlert, sendAlert };
