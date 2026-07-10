'use strict';

/**
 * Agent 1C alerting (design §7 + §7.1).
 *
 * Three distinct kinds of outbound message:
 *   1. sendAlert()        — the §7.1 developer/admin error template, delivered
 *                            to ADMIN_ALERT_EMAIL via an optional Make.com webhook.
 *   2. sendSpendAlert()    — Scenario 1 daily spend alert (Step A5). Retries the
 *                            webhook once; on a second failure, sends a direct
 *                            Zoho Mail fallback so spend data reaches the
 *                            coordinator regardless (§7: "spend data must reach
 *                            coordinator somehow").
 *   3. sendKillSwitchAlert() — Scenario 3 kill switch alert (Step B4). This is
 *                            the most important message in the system: it goes
 *                            to the coordinator, the admin, AND Dr. Flippen.
 */

const M = require('./manifest');
const { fireWebhook } = require('./webhooks');
const zohoMail = require('./zohoMail');

/** §7.1 template. */
function formatAlert(a) {
  const subject = `[AGENT 1C ERROR] ${a.failureType} - ${a.date}`;
  const body = [
    `Agent: Paid Advertising Agent (Agent 1C)`,
    `Run Date: ${a.runDateTime}`,
    `Job Type: ${a.jobType}`,
    `Failed Step: ${a.failedStep}`,
    `Error Details: ${a.errorDetails}`,
    `Financial Impact: ${a.financialImpact}`,
    `Campaign IDs Needing Manual Action: ${a.campaignIds || 'None'}`,
    `Recommended Action: ${a.recommendedAction}`,
  ].join('\n');
  return { subject, body };
}

/** Deliver the §7.1 admin alert. Never throws. */
async function sendAlert(a, { deps = {} } = {}) {
  const { subject, body } = formatAlert(a);
  const to = M.getEnv('ADMIN_ALERT_EMAIL');
  const webhook = M.getEnv('MAKE_ADMIN_ALERT_WEBHOOK_URL');
  console.error(`[Agent1C][ALERT] ${subject}\n${body}`);
  if (webhook) {
    const fire = deps.fireWebhook || fireWebhook;
    const res = await fire(webhook, { to, subject, body, type: 'agent1c_alert' }, { retryDelayMs: 0, deps });
    return { delivered: !!res.ok, via: 'webhook', subject, to };
  }
  return { delivered: false, via: 'log-only', subject, to };
}

/**
 * Step A5 — daily spend alert (Scenario 1). Retries the webhook once (30s
 * default); on second failure, sends the spend data directly via Zoho Mail to
 * the coordinator and admin, per §7's fallback requirement.
 */
async function sendSpendAlert(spendSummary, logRecordId, { deps = {}, retryDelayMs = 30000 } = {}) {
  const overThresholdWarning = spendSummary.metaOverThreshold || spendSummary.googleOverThreshold
    ? 'WARNING: One or more platforms exceeded the daily spend threshold.'
    : 'All platforms within daily spend threshold.';
  const payload = {
    trigger_source: 'agent_1c_daily_spend_alert',
    alert_date: spendSummary.date,
    meta_spend: spendSummary.metaSpend,
    meta_threshold: spendSummary.metaThreshold,
    meta_over_threshold: spendSummary.metaOverThreshold,
    google_spend: spendSummary.googleSpend,
    google_threshold: spendSummary.googleThreshold,
    google_over_threshold: spendSummary.googleOverThreshold,
    combined_spend: spendSummary.combinedSpend,
    threshold_status: overThresholdWarning,
    log_record_id: logRecordId,
  };
  const fire = deps.fireWebhook || fireWebhook;
  const res = await fire(M.getEnv('MAKE_SPEND_ALERT_WEBHOOK_URL'), payload, { retryDelayMs, deps });
  if (res.ok) return { delivered: true, via: 'webhook' };

  // §7 fallback: send the spend data directly so it is never lost.
  const mail = deps.zohoMail || zohoMail;
  const summaryLines = [
    `Daily Ad Spend Report ${spendSummary.date} - Action Required by 10:00 AM CST`,
    ``,
    `Meta spend: $${spendSummary.metaSpend} (threshold $${spendSummary.metaThreshold})${spendSummary.metaOverThreshold ? ' — OVER THRESHOLD' : ''}`,
    `Google spend: $${spendSummary.googleSpend} (threshold $${spendSummary.googleThreshold})${spendSummary.googleOverThreshold ? ' — OVER THRESHOLD' : ''}`,
    `Combined spend: $${spendSummary.combinedSpend}`,
    ``,
    `The Make.com spend alert scenario failed to deliver twice — this is a direct fallback.`,
    `Confirm today's spend in the coordinator dashboard before 10:00 AM CST or all campaigns will pause.`,
  ].join('\n');
  try {
    await mail.sendMail({
      to: [M.getEnv('COORDINATOR_ALERT_EMAIL'), M.getEnv('ADMIN_ALERT_EMAIL')].filter(Boolean).join(','),
      subject: `Daily Ad Spend Report ${spendSummary.date} - Action Required by 10:00 AM CST`,
      content: summaryLines,
    });
    return { delivered: true, via: 'zoho-mail-fallback' };
  } catch (err) {
    return { delivered: false, via: 'none', error: err.message };
  }
}

/**
 * Step B4 — kill switch alert (Scenario 3). Reaches the coordinator, the
 * admin, and Dr. Flippen. This is the design's non-negotiable alert.
 */
async function sendKillSwitchAlert({ spendDate, pausedCount, firedAt }, { deps = {} } = {}) {
  const payload = {
    trigger_source: 'agent_1c_kill_switch_fired',
    spend_date: spendDate,
    fired_at: firedAt,
    campaigns_paused: pausedCount,
    reason: 'Daily spend not confirmed by coordinator by 10:00 AM CST.',
    restart_instructions: 'Confirm in the coordinator dashboard, then trigger Restart Campaigns. Campaigns will NOT restart automatically.',
    recipients: [M.getEnv('COORDINATOR_ALERT_EMAIL'), M.getEnv('ADMIN_ALERT_EMAIL'), M.getEnv('DR_FLIPPEN_EMAIL')].filter(Boolean),
  };
  const fire = deps.fireWebhook || fireWebhook;
  const res = await fire(M.getEnv('MAKE_KILL_SWITCH_ALERT_WEBHOOK_URL'), payload, { retryDelayMs: 0, deps });
  if (!res.ok) {
    await sendAlert({
      failureType: 'kill switch alert delivery failure', date: spendDate, runDateTime: firedAt,
      jobType: 'checkSpendConfirmation', failedStep: 'Step B4: Log Kill Switch Event and Alert',
      errorDetails: res.error || 'non-200', financialImpact: 'Campaigns are PAUSED.',
      campaignIds: 'See CRM Ad Campaign Log record for this date.',
      recommendedAction: 'Manually notify the coordinator, admin, and Dr. Flippen that the kill switch fired.',
    }, { deps });
  }
  return res;
}

module.exports = { formatAlert, sendAlert, sendSpendAlert, sendKillSwitchAlert };
