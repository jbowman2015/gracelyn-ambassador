'use strict';

/**
 * Pure alert-payload builders for Agent 1B (design doc §6, §9). No network —
 * orchestrate.js sends these via webhook.js. Agent 1B has no direct mail
 * credential (same situation as Agent 0), so every alert is a webhook
 * payload rather than a direct SMTP/API mail send — mirrors
 * functions/agent0/alerts.js's formatAlert() shape, adapted to 1B's own
 * failure types.
 */

/**
 * General ops alert to Parmeet — covers every §9 row without its own
 * dedicated Make.com scenario (token refresh failure, brand asset missing,
 * Ayrshare post failure, Claude non-JSON captions, gap report missing, CRM
 * write failures). Delivered via MAKE_AGENT1B_ALERT_WEBHOOK.
 */
function buildOpsAlert({ failureType, runDate, cycleType, failedStep, errorDetails, recommendedAction }) {
  const subject = `[AGENT 1B ALERT] ${failureType} — ${runDate}`;
  const body = [
    `Agent: Social Outreach Agent (Agent 1B)`,
    `Run Date: ${runDate}`,
    `Cycle: ${cycleType}`,
    `Failed Step: ${failedStep}`,
    `Error Details: ${errorDetails}`,
    `Recommended Action: ${recommendedAction}`,
  ].join('\n');
  return { subject, body, type: 'agent1b_ops_alert' };
}

/**
 * Design doc §6 "Low content alert" / §4.1 Step 1: content queue empty.
 * Delivered via MAKE_LOW_CONTENT_WEBHOOK (Scenario 4).
 */
function buildLowContentAlertPayload({ daysSinceLastPost }) {
  return {
    trigger_source: 'agent_1b_low_content',
    message: 'WorkDrive Folder 02 has no unposted assets remaining.',
    days_since_last_post: daysSinceLastPost,
    request: 'Parmeet: please upload new approved social content assets.',
  };
}

/**
 * Design doc §6 "Post failure alert": platform name, error code, asset
 * filename. Delivered via the general ops alert channel (see manifest.js —
 * no dedicated Make.com scenario is named for this in the design doc).
 */
function buildPostFailureAlert({ runDate, platform, errorCode, assetFilename, allPlatformsFailed }) {
  return buildOpsAlert({
    failureType: allPlatformsFailed ? 'Ayrshare post failed on ALL platforms' : `Ayrshare post failed on ${platform}`,
    runDate,
    cycleType: 'post_cycle',
    failedStep: 'Step 5 — post via Ayrshare',
    errorDetails: `platform=${platform} error=${errorCode} asset=${assetFilename}`,
    recommendedAction: allPlatformsFailed
      ? 'Do not retry automatically (design doc §9). Coordinator decides whether to retry manually.'
      : 'Logged in Social Post Log (if resolvable). Other platforms continued posting.',
  });
}

module.exports = { buildOpsAlert, buildLowContentAlertPayload, buildPostFailureAlert };
