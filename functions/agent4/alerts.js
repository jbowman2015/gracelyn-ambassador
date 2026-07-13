'use strict';

/**
 * Parmeet alert emails (design §8 failure table). Distinct from the
 * coordinator-facing checkpoint/weekly report — this is for operational
 * failures of Agent 4 itself (job errors, CRM query failures, VIP audit
 * anomalies, recalculation-failure detection).
 *
 * Agent 4 always has a direct Zoho Mail credential (design §1), so an alert
 * is delivered via Make.com webhook when configured, else directly by mail —
 * never silently dropped.
 */

const M = require('./manifest');
const { fireWebhook } = require('./webhooks');

function formatAlert(a) {
  const subject = `[Agent 4 Alert] ${a.errorType} — ${a.date}`;
  const body = [
    `Agent 4 encountered an issue during the ${a.runType} run.`,
    ``,
    `Error type: ${a.errorType}`,
    `Time: ${a.timeCst}`,
    `Affected record: ${a.recordId || 'N/A'}`,
    `Error detail: ${a.detail}`,
    `Action required: ${a.action}`,
    ``,
    `This alert was generated automatically by Agent 4. Contact your developer if the error repeats after corrective action.`,
  ].join('\n');
  return { subject, body };
}

/**
 * Send a Parmeet-level alert. Never throws — returns { delivered, via, subject }.
 * `deps.fireWebhook` / `deps.mail` are injectable for tests. Pass `cc` (array
 * of emails) to also notify e.g. the coordinator on urgent SLA breaches.
 */
async function sendAlert(a, { deps = {}, cc = [] } = {}) {
  const { subject, body } = formatAlert(a);
  const to = M.getEnv('PARMEET_ALERT_EMAIL');
  console.error(`[Agent4][ALERT] ${subject}\n${body}`);

  const webhook = M.getEnv('MAKE_AGENT4_SLA_BREACH_WEBHOOK') && a.viaSlaWebhook
    ? M.getEnv('MAKE_AGENT4_SLA_BREACH_WEBHOOK')
    : '';
  if (webhook) {
    const fire = deps.fireWebhook || fireWebhook;
    const res = await fire(webhook, { to, cc, subject, body, type: 'agent4_alert' }, { retryDelayMs: 0, deps });
    return { delivered: !!res.ok, via: 'webhook', subject, to };
  }
  if (to) {
    const mail = deps.mail || require('./mail');
    const results = await Promise.all([to, ...cc].filter(Boolean).map((addr) => mail.sendEmail({ to: addr, subject, text: body })));
    const delivered = results.some((r) => r.ok);
    return { delivered, via: 'mail', subject, to };
  }
  return { delivered: false, via: 'log-only', subject, to };
}

module.exports = { formatAlert, sendAlert };
