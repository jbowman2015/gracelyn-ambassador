'use strict';

/**
 * Pure alert-email builder matching the design doc's §7.1 format exactly, plus
 * the consecutive-failure thresholds from §7's error handling table. No
 * network — orchestrate.js sends the built email via mail.sendAlertEmail.
 */

// §7: "Yes if more than 10 consecutive Claude failures" / "more than 10 consecutive deviations".
const CONSECUTIVE_CLAUDE_FAILURE_THRESHOLD = 10;
// §7: "Yes if more than 20 consecutive mail failures (possible account issue)".
const CONSECUTIVE_MAIL_FAILURE_THRESHOLD = 20;

function buildAlertEmail({
  failureType, runDate, triggerType, failedStep, errorDetails,
  emailsSentBeforeFailure, contactsNeedingManualUpdate, recommendedAction,
}) {
  const subject = `[AGENT 1A ERROR] ${failureType} - ${runDate}`;
  const body = [
    `Agent: Database and Email Agent (Agent 1A)`,
    `Run Date: ${runDate}`,
    `Trigger Type: ${triggerType}`,
    `Failed Step: ${failedStep}`,
    `Error Details: ${errorDetails}`,
    `Emails Sent Before Failure: ${emailsSentBeforeFailure}`,
    `Contacts Needing Manual CRM Update: ${
      contactsNeedingManualUpdate && contactsNeedingManualUpdate.length
        ? contactsNeedingManualUpdate.join(', ')
        : 'None'
    }`,
    `Recommended Action: ${recommendedAction}`,
  ].join('\n');
  return { subject, body };
}

module.exports = { buildAlertEmail, CONSECUTIVE_CLAUDE_FAILURE_THRESHOLD, CONSECUTIVE_MAIL_FAILURE_THRESHOLD };
