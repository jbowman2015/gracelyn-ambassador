'use strict';

/**
 * Parmeet alerts (design §10 failure table). Unlike Agent 0/2 (which deliver
 * alerts via an optional Make.com webhook), Agent 5 already holds a Zoho Mail
 * credential for the fallback-escalation path (design §1), so alerts are sent
 * directly via Zoho Mail to PARMEET_ALERT_EMAIL. Never throws — logs and
 * returns { delivered: false, via: 'log-only' } if the send itself fails, so an
 * alerting failure never breaks the chat response to the ambassador.
 */

const M = require('./manifest');
const defaultMail = require('./mail');

/**
 * @param {object} a
 * @param {string} a.errorType   e.g. "OpenAI run timeout"
 * @param {string} a.detail      specific error message
 * @param {string} [a.action]    what Parmeet needs to do
 * @param {string} [a.ambassador] affected ambassador email or N/A
 */
function formatAlert(a) {
  const subject = `[Agent 5 Alert] ${a.errorType}`;
  const body = [
    'Agent 5 (Ambassador Support) encountered an error.',
    '',
    `Error type: ${a.errorType}`,
    `Affected ambassador: ${a.ambassador || 'N/A'}`,
    `Error detail: ${a.detail}`,
    `Action required: ${a.action || 'Review the Agent 5 run log.'}`,
    '',
    'This alert was generated automatically by Agent 5. Contact your developer if the error repeats after corrective action.',
  ].join('\n');
  return { subject, body };
}

/** Send a Parmeet alert. Never throws — returns { delivered, via, subject, to }. */
async function sendAlert(a, { deps = {} } = {}) {
  const { subject, body } = formatAlert(a);
  const to = M.getEnv('PARMEET_ALERT_EMAIL');
  console.error(`[Agent5][ALERT] ${subject}\n${body}`);

  try {
    const mail = deps.mail || defaultMail;
    await mail.sendMail({ to, subject, content: body });
    return { delivered: true, via: 'zoho-mail', subject, to };
  } catch (err) {
    console.error(`[Agent5][ALERT] delivery failed: ${err.message}`);
    return { delivered: false, via: 'log-only', subject, to, error: err.message };
  }
}

module.exports = { formatAlert, sendAlert };
