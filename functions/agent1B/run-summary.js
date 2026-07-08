'use strict';

/**
 * Pure run-summary payload builder (design doc §8 Scenario 5): "posts
 * published, new prospects discovered, high-engagement flags, VIP warm
 * follow alerts sent, and any errors." No network — the caller POSTs this to
 * MAKE_AGENT1B_RUN_SUMMARY_WEBHOOK (Make.com renders/emails it to Parmeet).
 */
function buildRunSummary(summary) {
  return {
    trigger_source: 'agent_1b_run_complete',
    triggered_at: summary.triggeredAt,
    cycle_type: summary.cycleType, // 'post_cycle' | 'intelligence_cycle'
    posts_published: summary.postsPublished || 0,
    posts_failed: summary.postsFailed || 0,
    new_prospects_discovered: summary.newProspectsDiscovered || 0,
    high_engagement_flags: summary.highEngagementFlags || 0,
    high_engagement_prospects: summary.highEngagementProspects || [], // design doc §6: names + Social_Profile_URLs, for Agent 0 priority scoring next run.
    vip_warm_follow_alerts_sent: summary.vipWarmFollowAlertsSent || 0,
    vip_accounts_suppressed: summary.vipAccountsSuppressed || 0,
    crm_write_failures: summary.crmWriteFailures || [],
    social_post_log_skipped: !!summary.socialPostLogSkipped,
    run_status: summary.status,
    errors: summary.errors || [],
  };
}

module.exports = { buildRunSummary };
