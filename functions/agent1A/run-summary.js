'use strict';

/**
 * Pure run-summary payload builder (design doc §4 Step 8). No network — the
 * caller POSTs this to MAKE_COORDINATOR_SUMMARY_WEBHOOK_URL.
 */
function buildRunSummary(summary) {
  return {
    trigger_source: 'agent_1a_run_complete',
    triggered_at: summary.triggeredAt,
    run_type: summary.runType,
    emails_sent: summary.emailsSent,
    emails_failed: summary.emailsFailed,
    contacts_processed: summary.contactsProcessed,
    para_db_sent: summary.paraDBSent || 0,
    prospect_sent: summary.prospectSent || 0,
    student_alumni_sent: summary.studentAlumniSent || 0,
    test_segment_active: !!summary.testSegmentActive,
    run_status: summary.status,
    crm_update_failures: summary.crmUpdateFailures || [],
  };
}

module.exports = { buildRunSummary };
