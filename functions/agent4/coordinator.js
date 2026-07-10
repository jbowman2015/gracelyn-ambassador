'use strict';

/**
 * Coordinator-facing email delivery (daily checkpoint, weekly report, SLA
 * breach alerts, content compliance alerts). Distinct from alerts.js, which
 * is for Parmeet-level operational failures of Agent 4 itself.
 */

const M = require('./manifest');

/**
 * Send an email to the coordinator (and optional cc list). Never throws —
 * returns { ok, error }. `deps.mail` is injectable for tests.
 */
async function notifyCoordinator({ subject, text, cc = [] }, { deps = {} } = {}) {
  const mail = deps.mail || require('./mail');
  const to = M.getEnv('SUPPORT_COORDINATOR_EMAIL');
  if (!to) return { ok: false, error: 'SUPPORT_COORDINATOR_EMAIL not configured' };
  const results = await Promise.all([to, ...cc].filter(Boolean).map((addr) => mail.sendEmail({ to: addr, subject, text })));
  const ok = results.length > 0 && results.every((r) => r.ok);
  return { ok, error: ok ? null : results.map((r) => r.error).filter(Boolean).join('; ') };
}

module.exports = { notifyCoordinator };
