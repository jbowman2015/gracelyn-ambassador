'use strict';

/**
 * Agent 1C — Paid Advertising: canonical constants.
 *
 * Single source of truth for this agent's env-var names, the Ad Campaign Log
 * fields it writes, the Prospects fields it reads, and the spend/kill-switch
 * policy values.
 *
 * Naming authority (per CLAUDE.md + ClaudeCode_Zoho_API_Names_Instruction):
 *   - CRM MODULE + FIELD api_names are authoritative in Zoho. `zoho.js` resolves
 *     the Ad Campaign Log module api_name live and verifies every field this
 *     agent writes against Zoho's fields metadata; a divergence is surfaced,
 *     never papered over.
 *   - ENV-VAR names are the canonical strings reconciled in
 *     docs/planning/Ambassador_Master_Reference_Sheet.md and CLAUDE.md. Where the
 *     Agent 1C design doc used a different spelling, the doc name is accepted as
 *     a read-only ALIAS (see ENV.get) so nothing silently breaks.
 *
 * Two reconciliations worth calling out:
 *   1. Spend threshold: CLAUDE.md resolved the combined-vs-split conflict in
 *      favor of split `META_DAILY_SPEND_THRESHOLD` + `GOOGLE_DAILY_SPEND_THRESHOLD`
 *      (matches the design doc's code). The master reference sheet's alternate
 *      combined `AGENT1C_DAILY_SPEND_THRESHOLD` is NOT used.
 *   2. Admin alert routing: Agent 0 already reconciled the design doc's
 *      "Parmeet" developer-alert role to `ADMIN_ALERT_EMAIL` (Jessica). Agent 1C
 *      reuses that same canonical name rather than reintroducing
 *      `PARMEET_ALERT_EMAIL` as a second competing name. The Ambassador Program
 *      Coordinator (Parmeet Kaur, per Master Reference Sheet §6) who confirms
 *      daily spend is a distinct, separate role: `COORDINATOR_ALERT_EMAIL`.
 *      `DR_FLIPPEN_EMAIL` is unaffected by either alias and used as-is.
 */

const ENV_SPEC = [
  { key: 'ANTHROPIC_API_KEY', aliases: ['CLAUDE_API_KEY'], required: true, group: 'AI' },
  { key: 'ANTHROPIC_MODEL', required: false, group: 'AI', note: 'Default claude-sonnet-4-20250514 (CLAUDE.md).' },

  // Zoho CRM OAuth trio (Ad Campaign Log writes; Prospects reads; needs ZohoCRM.settings.READ).
  { key: 'ZOHO_CRM_CLIENT_ID', required: true, group: 'Zoho' },
  { key: 'ZOHO_CRM_CLIENT_SECRET', required: true, group: 'Zoho' },
  { key: 'ZOHO_CRM_REFRESH_TOKEN', required: true, group: 'Zoho' },

  // Zoho Analytics OAuth trio (coordinator dashboard push).
  { key: 'ZOHO_ANALYTICS_CLIENT_ID', required: true, group: 'Zoho' },
  { key: 'ZOHO_ANALYTICS_CLIENT_SECRET', required: true, group: 'Zoho' },
  { key: 'ZOHO_ANALYTICS_REFRESH_TOKEN', required: true, group: 'Zoho' },
  { key: 'AMBASSADOR_ANALYTICS_WORKSPACE_ID', required: true, group: 'Zoho', note: 'Coordinator dashboard workspace.' },
  { key: 'AMBASSADOR_ANALYTICS_DAILY_SPEND_VIEW', required: false, group: 'Zoho', note: 'Default DailySpendLog.' },

  // Zoho WorkDrive OAuth trio (canonical ZOHO_WORKDRIVE_* per Master Reference
  // Sheet + Agent 0; doc used the un-prefixed WORKDRIVE_* spelling — alias only).
  { key: 'ZOHO_WORKDRIVE_CLIENT_ID', aliases: ['WORKDRIVE_CLIENT_ID'], required: true, group: 'Zoho' },
  { key: 'ZOHO_WORKDRIVE_CLIENT_SECRET', aliases: ['WORKDRIVE_CLIENT_SECRET'], required: true, group: 'Zoho' },
  { key: 'ZOHO_WORKDRIVE_REFRESH_TOKEN', aliases: ['WORKDRIVE_REFRESH_TOKEN'], required: true, group: 'Zoho' },
  { key: 'WORKDRIVE_FOLDER_08_ID', required: true, group: 'WorkDrive', note: 'Brand assets: ad copy rules + voice guidelines.' },

  // Meta Ads — long-lived token, real spend authority.
  { key: 'META_ADS_ACCESS_TOKEN', required: true, group: 'Meta', note: 'Long-lived (60 days). Real spend authority.' },
  { key: 'META_AD_ACCOUNT_ID', required: true, group: 'Meta' },

  // Google Ads.
  { key: 'GOOGLE_ADS_CLIENT_ID', required: true, group: 'Google' },
  { key: 'GOOGLE_ADS_CLIENT_SECRET', required: true, group: 'Google' },
  { key: 'GOOGLE_ADS_REFRESH_TOKEN', required: true, group: 'Google' },
  { key: 'GOOGLE_ADS_DEVELOPER_TOKEN', required: true, group: 'Google' },
  { key: 'GOOGLE_ADS_CUSTOMER_ID', required: true, group: 'Google' },
  { key: 'GOOGLE_ADS_API_VERSION', required: false, group: 'Google', note: 'Default v16.' },

  // Split daily spend thresholds — hard caps, not guidelines (design §2.3).
  { key: 'META_DAILY_SPEND_THRESHOLD', required: true, group: 'Policy', note: 'Dr. Flippen sets. USD.' },
  { key: 'GOOGLE_DAILY_SPEND_THRESHOLD', required: true, group: 'Policy', note: 'Dr. Flippen sets. USD.' },

  // CRM module api_names (cross-checked live; see zoho.js).
  { key: 'PROSPECTS_MODULE_API_NAME', required: true, group: 'CRM' },
  { key: 'AD_CAMPAIGN_LOG_MODULE_API_NAME', required: true, group: 'CRM' },

  // Make.com webhooks this agent fires.
  { key: 'MAKE_SPEND_ALERT_WEBHOOK_URL', required: false, group: 'Make.com', note: 'Scenario 1 — daily spend alert.' },
  { key: 'MAKE_KILL_SWITCH_ALERT_WEBHOOK_URL', required: false, group: 'Make.com', note: 'Scenario 3 — kill switch fired.' },
  { key: 'MAKE_ADMIN_ALERT_WEBHOOK_URL', aliases: ['MAKE_PARMEET_ALERT_WEBHOOK_URL'], required: false, group: 'Make.com',
    note: 'Optional. Delivers admin (developer) alert emails.' },

  // Alert routing.
  { key: 'ADMIN_ALERT_EMAIL', aliases: ['JESSICA_ALERT_EMAIL', 'PARMEET_ALERT_EMAIL'], required: true, group: 'Alerts',
    note: 'Developer/admin error alerts — same canonical name Agent 0 uses.' },
  { key: 'COORDINATOR_ALERT_EMAIL', required: true, group: 'Alerts',
    note: 'Ambassador Program Coordinator (Parmeet Kaur). Confirms daily spend.' },
  { key: 'DR_FLIPPEN_EMAIL', required: true, group: 'Alerts', note: 'Kill switch + threshold breach alerts.' },

  // Zoho Mail — §7 fallback: direct-send when the spend alert webhook fails twice.
  { key: 'ZOHO_MAIL_CLIENT_ID', required: false, group: 'Fallback' },
  { key: 'ZOHO_MAIL_CLIENT_SECRET', required: false, group: 'Fallback' },
  { key: 'ZOHO_MAIL_REFRESH_TOKEN', required: false, group: 'Fallback' },
  { key: 'AMBASSADOR_MAIL_ACCOUNT_ID', required: false, group: 'Fallback', note: 'Zoho Mail account id for fallback sends.' },
];

/** Resolve an env value by canonical key, then any documented alias. */
function getEnv(key) {
  const spec = ENV_SPEC.find((e) => e.key === key);
  const names = [key, ...((spec && spec.aliases) || [])];
  for (const n of names) {
    const v = process.env[n];
    if (typeof v === 'string' && v.trim() !== '') return v.trim();
  }
  return '';
}

// ─── CRM: module cross-checks (verified live at run time via zoho.js) ─────────
const PROSPECTS_MODULE = { label: 'Prospects', envVar: 'PROSPECTS_MODULE_API_NAME' };
const AD_CAMPAIGN_LOG_MODULE = { label: 'Ad Campaign Log', envVar: 'AD_CAMPAIGN_LOG_MODULE_API_NAME' };

// Ad Campaign Log fields this agent writes (design §3.3/4). Verified live before
// any write via zoho.verifyFields — a mismatch halts the job and alerts, per the
// Zoho API Names authority rule.
const LOG_FIELDS = {
  logDate: 'Log_Date',
  logType: 'Log_Type',
  metaSpend: 'Meta_Spend',
  metaThreshold: 'Meta_Threshold',
  metaOverThreshold: 'Meta_Over_Threshold',
  metaError: 'Meta_Error',
  googleSpend: 'Google_Spend',
  googleThreshold: 'Google_Threshold',
  googleOverThreshold: 'Google_Over_Threshold',
  googleError: 'Google_Error',
  combinedSpend: 'Combined_Spend',
  confirmed: 'Confirmed',
  confirmedAt: 'Confirmed_At',
  killSwitchFired: 'Kill_Switch_Fired',
  killSwitchAt: 'Kill_Switch_At',
  pausedMetaIds: 'Paused_Meta_IDs',
  pausedGoogleIds: 'Paused_Google_IDs',
  restarted: 'Restarted',
  restartedAt: 'Restarted_At',
  reviewPeriodFrom: 'Review_Period_From',
  reviewPeriodTo: 'Review_Period_To',
  metaTotalSpend: 'Meta_Total_Spend',
  googleTotalSpend: 'Google_Total_Spend',
  metaCampaigns: 'Meta_Campaigns',
  performanceFlags: 'Performance_Flags',
};

const LOG_TYPES = {
  spendConfirmation: 'Spend Confirmation',
  weeklyPerformanceReview: 'Weekly Performance Review',
};

// Prospects fields this agent reads (design §3.4), reconciled against Agent 0's
// LIVE field names on the shared Ambassador_Leads module (functions/agent0/manifest.js,
// reconciled 2026-07-07) rather than the Agent 1C design doc's stale spellings.
// This is exactly the kind of divergence the Zoho API Names instruction exists
// to catch: the doc says Ambassador_Role_Category / Motivation_Hypothesis /
// VIP_Score; Zoho's real fields (created for Agent 0) are Role_Category /
// Motivation_Tag / VIP_Prospect_Score. zoho.verifyFields() checks the live
// fields before every read and alerts on any further divergence.
const PROSPECT_READ_FIELDS = {
  roleCategory: 'Role_Category',
  motivationTag: 'Motivation_Tag',
  vipScore: 'VIP_Prospect_Score',
  contactFound: 'Contact_Found',
};

// ─── Policy ────────────────────────────────────────────────────────────────────
const WEEKLY_PERFORMANCE_CPC_FLAG_PCT = 20; // flag if CPC rose >20% week-over-week.

module.exports = {
  ENV_SPEC,
  getEnv,
  PROSPECTS_MODULE,
  AD_CAMPAIGN_LOG_MODULE,
  LOG_FIELDS,
  LOG_TYPES,
  PROSPECT_READ_FIELDS,
  WEEKLY_PERFORMANCE_CPC_FLAG_PCT,
};
