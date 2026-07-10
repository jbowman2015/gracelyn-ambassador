'use strict';

/**
 * Weekly content compliance audit (design §2.3 Tuesday 8:00 AM CST). Checks
 * sampled ambassador-facing email content for em dashes and commission
 * language violations (design §8, §9.1).
 *
 * The design doc's source for this data is "Agent 3 generated email content
 * from Activity Log" — but no live "Activity Log" CRM module exists, and
 * Agent 3 (functions/agent3/mail.js) sends via the Zoho Mail API without
 * persisting the generated body text anywhere queryable. `input.samples` must
 * therefore be supplied by the caller (e.g. a future Make.com scenario reading
 * Zoho Mail's sent-items log). When omitted, this alerts clearly instead of
 * silently reporting a false "zero violations".
 */

const M = require('./manifest');
const dates = require('./dates');
const { notifyCoordinator } = require('./coordinator');

const defaultAlerts = require('./alerts');
const defaultWorkdrive = require('./workdrive');

function resolveDeps(input) {
  const d = input.deps || {};
  return { alerts: d.alerts || defaultAlerts, workdrive: d.workdrive || defaultWorkdrive, now: (d.now && d.now()) || new Date() };
}

/** Scan one piece of generated content for em dash / commission language violations. */
function scanContent(sample) {
  const violations = [];
  const text = sample.text || '';
  if (text.includes(M.EM_DASH_CHAR)) violations.push({ type: 'em_dash', detail: 'Contains an em dash character.' });
  if (M.COMMISSION_LANGUAGE_PATTERN.test(text)) violations.push({ type: 'commission_language', detail: 'Contains the word "commission".' });
  return violations;
}

/**
 * `input.samples`: [{ ambassadorId, text, sentDate }] — the generated email
 * content to scan. `input.deps.workdrive` is injectable for tests; the copy
 * rules file is read best-effort purely as reference context attached to any
 * violation alert (its format is not specified by the design doc, so no
 * automated checks are derived from its content beyond the two named above).
 */
async function contentComplianceAudit(input = {}) {
  const deps = resolveDeps(input);
  const { alerts, workdrive, now } = deps;
  const runCtx = { runType: 'scheduled', date: dates.dateStr(now), timeCst: dates.timeCst(now), deps: input.deps };
  const summary = { sampled: 0, violations: [], halted: null };

  const samples = input.samples;
  if (!Array.isArray(samples)) {
    summary.halted = 'No content sample source configured — pass `samples` explicitly (see file header).';
    await alerts.sendAlert({
      errorType: 'content compliance audit skipped', detail: summary.halted,
      action: 'Wire a content sample source (e.g. a Make.com scenario reading Zoho Mail sent items) before relying on this weekly audit.',
      ...runCtx,
    });
    return summary;
  }

  summary.sampled = samples.length;
  for (const sample of samples) {
    const violations = scanContent(sample);
    if (violations.length) summary.violations.push({ ambassadorId: sample.ambassadorId, sentDate: sample.sentDate, violations });
  }

  if (summary.violations.length) {
    let copyRulesNote = '';
    try {
      const folder08 = M.getEnv('WORKDRIVE_FOLDER_08_ID');
      if (folder08) await workdrive.readFileByName(folder08, M.COPY_RULES_FILENAME);
      copyRulesNote = 'Current copy rules: WorkDrive Folder 08 / ambassador_copy_rules.txt.';
    } catch (err) {
      copyRulesNote = `Copy rules file unavailable: ${err.message}`;
    }

    const body = [
      `${summary.violations.length} content compliance violation(s) found in ${summary.sampled} sampled item(s).`,
      copyRulesNote, '',
      ...summary.violations.map((v) => `- Ambassador ${v.ambassadorId} (${v.sentDate}): ${v.violations.map((x) => x.type).join(', ')}`),
    ].join('\n');

    const webhook = M.getEnv('MAKE_AGENT4_COMPLIANCE_WEBHOOK');
    if (webhook) {
      const fireWebhook = deps.fireWebhook || require('./webhooks').fireWebhook;
      await fireWebhook(webhook, { type: 'content_compliance', violations: summary.violations }, { retryDelayMs: 0, deps: input.deps });
    } else {
      await notifyCoordinator({ subject: `[Agent 4] Content compliance violations — ${runCtx.date}`, text: body }, { deps: input.deps });
    }
  }

  return summary;
}

module.exports = { scanContent, contentComplianceAudit };
