'use strict';

/**
 * Agent 5A — Setup Validation (go/no-go gate) for the Ambassador Scaling Program.
 *
 * Runs BEFORE any production agent deploys. It confirms that every credential,
 * policy variable, CRM module/field, encryption requirement, and cross-agent
 * coordination field is actually in place — and reports exactly what is missing.
 *
 * Deploy gate: nothing goes to production until this returns verdict "GO".
 *
 * Routes:
 *   POST /validate        → full JSON report (all checks)
 *   POST /validate?text=1 → same, plus a Cliq-ready text summary in .summary
 *   GET  /health          → liveness
 *
 * Verdict:
 *   GO       — no critical failures
 *   NO-GO    — one or more critical checks failed (blocks deploy)
 * Warnings never block; they are surfaced for follow-up.
 */

const express = require('express');
const { checkEnvVars, checkPolicyVars, checkCrm } = require('./validators');

const app = express();
app.use(express.json());

function summarize(checks) {
  const crit = checks.filter((c) => c.severity === 'critical');
  const warn = checks.filter((c) => c.severity === 'warn');
  const critFail = crit.filter((c) => c.status === 'fail');
  const warnFail = warn.filter((c) => c.status === 'fail');
  const drift    = checks.filter((c) => c.drift);
  const skipped  = checks.filter((c) => c.status === 'skip');

  return {
    verdict: critFail.length === 0 ? 'GO' : 'NO-GO',
    totals: {
      checks: checks.length,
      passed: checks.filter((c) => c.status === 'pass').length,
      failed: checks.filter((c) => c.status === 'fail').length,
      skipped: skipped.length,
      criticalFailures: critFail.length,
      warnings: warnFail.length,
      valueDrift: drift.length,
    },
    blocking: critFail.map((c) => ({ id: c.id, detail: c.detail })),
    warnings: warnFail.map((c) => ({ id: c.id, detail: c.detail })),
    drift: drift.map((c) => ({ id: c.id, detail: c.detail })),
    skipped: skipped.map((c) => ({ id: c.id, detail: c.detail })),
  };
}

function textReport(sum) {
  const emoji = sum.verdict === 'GO' ? '🟢' : '🔴';
  let m = `${emoji} *Agent 5A — Setup Validation: ${sum.verdict}*\n`;
  m += `${sum.totals.passed}/${sum.totals.checks} passed · `;
  m += `${sum.totals.criticalFailures} blocking · ${sum.totals.warnings} warnings · ${sum.totals.valueDrift} drift\n`;
  if (sum.blocking.length) {
    m += `\n🔴 *Blocking (must fix before deploy):*\n`;
    sum.blocking.slice(0, 40).forEach((b) => { m += `  • ${b.detail}\n`; });
    if (sum.blocking.length > 40) m += `  • …and ${sum.blocking.length - 40} more\n`;
  }
  if (sum.warnings.length) {
    m += `\n🟡 *Warnings (non-blocking):*\n`;
    sum.warnings.slice(0, 15).forEach((w) => { m += `  • ${w.detail}\n`; });
    if (sum.warnings.length > 15) m += `  • …and ${sum.warnings.length - 15} more\n`;
  }
  if (sum.drift.length) {
    m += `\n⚠️ *Value drift (confirm intended):*\n`;
    sum.drift.slice(0, 15).forEach((d) => { m += `  • ${d.detail}\n`; });
  }
  return m;
}

async function runAllChecks() {
  const checks = [];
  checks.push(...checkEnvVars());
  checks.push(...checkPolicyVars());
  // CRM checks hit the live Zoho org; isolate failures so the gate still reports.
  try {
    const crm = await checkCrm();
    checks.push(...crm.results);
  } catch (err) {
    checks.push({ id: 'crm:fatal', category: 'crm', severity: 'critical', status: 'fail',
      detail: `CRM validation crashed: ${err.message}` });
  }
  return checks;
}

app.post('/validate', async (req, res) => {
  try {
    const checks = await runAllChecks();
    const summary = summarize(checks);
    const payload = { success: true, ...summary, checks };
    if (req.query.text) payload.summary = textReport(summary);
    // HTTP 200 always — the verdict field carries go/no-go, not the status code.
    res.json(payload);
  } catch (err) {
    console.error('[Agent5A]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Convenience GET for quick manual/browser checks.
app.get('/validate', async (req, res) => {
  try {
    const checks = await runAllChecks();
    const summary = summarize(checks);
    res.json({ success: true, ...summary, summary: textReport(summary) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/health', (req, res) => res.json({ ok: true, agent: '5A', role: 'setup-validation' }));

module.exports = app;
