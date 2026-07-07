'use strict';

/**
 * Agent 5A — canonical validation manifest for the Ambassador Scaling Program.
 *
 * This file is the single source of truth for what "ready to launch" means:
 *   - every environment variable each agent depends on (canonical names only)
 *   - every CRM module + the fields the agents read/write, with expected types
 *   - the three silent-failure coordination points
 *   - the WorkDrive folder IDs and Zoho Form IDs that must exist
 *   - the policy thresholds Dr. Flippen confirms
 *
 * Env-var naming conflicts are RESOLVED here (per Master Reference Sheet §1):
 *   ANTHROPIC_API_KEY            (not CLAUDE_API_KEY)
 *   OPENAI_AMBASSADOR_ASSISTANT_ID (not OPENAI_ASSISTANT_ID)
 *   HEYGEN_FLIPPEN_AVATAR_ID     (not HEYGEN_AVATAR_ID)
 *   META_ADS_ACCESS_TOKEN        (not META_ACCESS_TOKEN)
 *   Ad spend: SPLIT per-platform — META_DAILY_SPEND_THRESHOLD + GOOGLE_DAILY_SPEND_THRESHOLD
 *             (AGENT1C_DAILY_SPEND_THRESHOLD accepted as an optional combined alias)
 *
 * Severity: 'critical' checks block launch (go/no-go). 'warn' checks are surfaced
 * but do not fail the gate. 'info' is advisory.
 */

// ─── Environment variables ────────────────────────────────────────────────────
// Each entry: { name, severity, group, note? }
// A var is "present" when process.env[name] is a non-empty string.

const ENV_VARS = [
  // Core AI credentials (canonical names — conflicts resolved)
  { name: 'ANTHROPIC_API_KEY',              severity: 'critical', group: 'AI',
    note: 'Canonical. Do NOT use CLAUDE_API_KEY.' },
  { name: 'OPENAI_API_KEY',                 severity: 'critical', group: 'AI' },
  { name: 'OPENAI_AMBASSADOR_ASSISTANT_ID', severity: 'critical', group: 'AI',
    note: 'Canonical. Do NOT use OPENAI_ASSISTANT_ID.' },
  { name: 'OPENAI_POLL_INTERVAL_MS',        severity: 'warn',     group: 'AI', note: 'Default 2000.' },
  { name: 'OPENAI_POLL_MAX_ATTEMPTS',       severity: 'warn',     group: 'AI', note: 'Default 15.' },

  // Zoho OAuth trios
  { name: 'ZOHO_CRM_CLIENT_ID',        severity: 'critical', group: 'Zoho' },
  { name: 'ZOHO_CRM_CLIENT_SECRET',    severity: 'critical', group: 'Zoho' },
  { name: 'ZOHO_CRM_REFRESH_TOKEN',    severity: 'critical', group: 'Zoho',
    note: 'Must include ZohoCRM.settings.READ scope for metadata pulls.' },
  { name: 'ZOHO_MAIL_CLIENT_ID',       severity: 'critical', group: 'Zoho' },
  { name: 'ZOHO_MAIL_CLIENT_SECRET',   severity: 'critical', group: 'Zoho' },
  { name: 'ZOHO_MAIL_REFRESH_TOKEN',   severity: 'critical', group: 'Zoho' },
  { name: 'ZOHO_WORKDRIVE_CLIENT_ID',     severity: 'critical', group: 'Zoho' },
  { name: 'ZOHO_WORKDRIVE_CLIENT_SECRET', severity: 'critical', group: 'Zoho' },
  { name: 'ZOHO_WORKDRIVE_REFRESH_TOKEN', severity: 'critical', group: 'Zoho' },
  { name: 'ZOHO_FORMS_CLIENT_ID',      severity: 'critical', group: 'Zoho' },
  { name: 'ZOHO_FORMS_CLIENT_SECRET',  severity: 'critical', group: 'Zoho' },
  { name: 'ZOHO_FORMS_REFRESH_TOKEN',  severity: 'critical', group: 'Zoho' },
  { name: 'ZOHO_BOOKS_ORGANIZATION_ID', severity: 'critical', group: 'Zoho' },
  { name: 'ZOHO_BOOKS_CLIENT_ID',      severity: 'critical', group: 'Zoho' },
  { name: 'ZOHO_BOOKS_CLIENT_SECRET',  severity: 'critical', group: 'Zoho' },
  { name: 'ZOHO_BOOKS_REFRESH_TOKEN',  severity: 'critical', group: 'Zoho' },
  { name: 'ZOHO_SOCIAL_PORTAL_ID',     severity: 'warn',     group: 'Zoho' },

  // Payments — Wise/Tremendous have the external verification clock
  { name: 'PAYPAL_CLIENT_ID',              severity: 'critical', group: 'Payments' },
  { name: 'PAYPAL_CLIENT_SECRET',          severity: 'critical', group: 'Payments' },
  { name: 'WISE_API_TOKEN',                severity: 'warn',     group: 'Payments',
    note: 'Launch can proceed on PayPal only; Wise is fast-follow.' },
  { name: 'WISE_PROFILE_ID',               severity: 'warn',     group: 'Payments' },
  { name: 'TREMENDOUS_API_KEY',            severity: 'warn',     group: 'Payments' },
  { name: 'TREMENDOUS_FUNDING_SOURCE_ID',  severity: 'warn',     group: 'Payments' },

  // Social / ads / video
  { name: 'AYRSHARE_API_KEY',          severity: 'critical', group: 'Channels' },
  { name: 'HEYGEN_API_KEY',            severity: 'critical', group: 'Channels' },
  { name: 'HEYGEN_FLIPPEN_AVATAR_ID',  severity: 'critical', group: 'Channels',
    note: 'Canonical. Do NOT use HEYGEN_AVATAR_ID.' },
  { name: 'HEYGEN_TEMPLATE_ID',        severity: 'critical', group: 'Channels' },
  { name: 'META_APP_ID',               severity: 'critical', group: 'Channels' },
  { name: 'META_APP_SECRET',           severity: 'critical', group: 'Channels' },
  { name: 'META_ADS_ACCESS_TOKEN',     severity: 'critical', group: 'Channels',
    note: 'Canonical. Do NOT use META_ACCESS_TOKEN.' },
  { name: 'META_AD_ACCOUNT_ID',        severity: 'critical', group: 'Channels' },
  { name: 'GOOGLE_ADS_CLIENT_ID',      severity: 'critical', group: 'Channels' },
  { name: 'GOOGLE_ADS_CLIENT_SECRET',  severity: 'critical', group: 'Channels' },
  { name: 'GOOGLE_ADS_REFRESH_TOKEN',  severity: 'critical', group: 'Channels' },
  { name: 'GOOGLE_ADS_DEVELOPER_TOKEN', severity: 'critical', group: 'Channels' },
  { name: 'GOOGLE_ADS_CUSTOMER_ID',    severity: 'critical', group: 'Channels' },

  // WordPress portal
  { name: 'WORDPRESS_API_BASE_URL',    severity: 'critical', group: 'WordPress' },
  { name: 'WP_ADMIN_USER',             severity: 'critical', group: 'WordPress' },
  { name: 'WP_ADMIN_APP_PASSWORD',     severity: 'critical', group: 'WordPress',
    note: 'WordPress application password, not the login password.' },
  { name: 'AMBASSADOR_PORTAL_URL',     severity: 'critical', group: 'WordPress' },
  { name: 'AMBASSADOR_PORTAL_CHAT_URL', severity: 'critical', group: 'WordPress' },

  // Alert routing emails
  { name: 'SUPPORT_COORDINATOR_EMAIL', severity: 'critical', group: 'Alerts' },
  { name: 'VIP_MANAGER_EMAIL',         severity: 'critical', group: 'Alerts' },
  { name: 'PARMEET_ALERT_EMAIL',       severity: 'critical', group: 'Alerts' },
];

// Make.com webhook URLs — recorded after each scenario is built (Week 2).
// Warn (not critical) so 5A can pass in Week 1 before scenarios exist.
const MAKE_WEBHOOK_VARS = [
  'MAKE_AGENT0_COMPLETE_WEBHOOK_URL', 'MAKE_AGENT0_ONDEMAND_WEBHOOK_URL',
  'MAKE_VIP_NOTIFY_WEBHOOK_URL', 'MAKE_AGENT1A_WEBHOOK_URL',
  'MAKE_AGENT1A_FROM_1D_WEBHOOK_URL', 'MAKE_AGENT1B_WEBHOOK_URL',
  'MAKE_AGENT1C_WEBHOOK_URL', 'MAKE_AGENT1D_WEBHOOK_URL', 'MAKE_AGENT3_WEBHOOK_URL',
  'MAKE_VIP_MANAGER_NOTIFY_WEBHOOK_URL', 'MAKE_COORDINATOR_QUEUE_WEBHOOK_URL',
  'MAKE_SPEND_ALERT_WEBHOOK_URL', 'MAKE_SPEND_CONFIRM_WEBHOOK_URL',
  'MAKE_KILL_SWITCH_ALERT_WEBHOOK_URL', 'MAKE_CAMPAIGN_RESTART_WEBHOOK_URL',
  'MAKE_FEE_PAYMENT_CONFIRM_WEBHOOK_URL', 'MAKE_ESCALATION_WEBHOOK_URL',
].map((name) => ({ name, severity: 'warn', group: 'Make.com' }));

// WorkDrive folder IDs
const WORKDRIVE_FOLDER_VARS = [
  'WORKDRIVE_FOLDER_01_ID', 'WORKDRIVE_FOLDER_02_ID', 'WORKDRIVE_FOLDER_03_ID',
  'WORKDRIVE_FOLDER_04_ID', 'WORKDRIVE_FOLDER_05_ID', 'WORKDRIVE_FOLDER_06_ID',
  'WORKDRIVE_FOLDER_07_ID', 'WORKDRIVE_FOLDER_08_ID', 'WORKDRIVE_FOLDER_09_ID',
].map((name) => ({ name, severity: 'critical', group: 'WorkDrive' }));

// Zoho Form identifiers
const FORM_VARS = [
  { name: 'AMBASSADOR_FORM_ID',       severity: 'critical', group: 'Forms' },
  { name: 'AMBASSADOR_FORM_BASE_URL', severity: 'critical', group: 'Forms' },
  { name: 'LEAD_CAPTURE_FORM_IDS',    severity: 'critical', group: 'Forms',
    note: 'JSON/CSV mapping the 4 track forms (k12, ec, faith, youth).' },
  { name: 'LEAD_MAGNET_MAP',          severity: 'critical', group: 'Forms',
    note: 'Maps each lead_magnet_id → WorkDrive file path.' },
];

// ─── Policy thresholds (Dr. Flippen confirms) ─────────────────────────────────
// expected: the fixed value from the design docs (null = Dr. Flippen defines, presence-only).
const POLICY_VARS = [
  { name: 'APPROVAL_MODE',                     expected: 'MANUAL', severity: 'critical' },
  { name: 'ACTIVE_AMBASSADOR_THRESHOLD_ALERT', expected: '800',    severity: 'critical' },
  { name: 'ACTIVE_AMBASSADOR_THRESHOLD_AUTO',  expected: '1000',   severity: 'critical' },
  { name: 'NON_REFERRAL_DAYS_THRESHOLD',       expected: '90',     severity: 'critical' },
  { name: 'DORMANT_DAYS_THRESHOLD',            expected: '30',     severity: 'critical' },
  { name: 'VIP_HIGH_PCT_SMALL',                expected: '2.5',    severity: 'warn' },
  { name: 'VIP_STD_PCT_SMALL',                 expected: '5',      severity: 'warn' },
  { name: 'VIP_HIGH_PCT_LARGE',                expected: '0.5',    severity: 'warn' },
  { name: 'VIP_STD_PCT_LARGE',                 expected: '2.5',    severity: 'warn' },
  { name: 'VIP_POPULATION_THRESHOLD',          expected: '10000',  severity: 'warn' },
  { name: 'VIP_AUDIT_TOLERANCE_PCT',           expected: '10',     severity: 'warn' },
  { name: 'STORY_BUFFER_MINIMUM',              expected: '4',      severity: 'warn' },
  { name: 'WEEKLY_BATCH_SIZE',                 expected: '100',    severity: 'warn' },
  { name: 'MISSION_KEYWORDS',                  expected: null,     severity: 'critical',
    note: 'Dr. Flippen / Parmeet define. Presence-only.' },
  { name: 'SLA_TIER2_FIRST_RESPONSE_HOURS',    expected: '24',     severity: 'critical' },
  { name: 'SLA_VIP_FIRST_RESPONSE_HOURS',      expected: '4',      severity: 'critical' },
  { name: 'SLA_TIER2_RESOLUTION_HOURS',        expected: '72',     severity: 'critical' },
  { name: 'SLA_VIP_RESOLUTION_HOURS',          expected: '24',     severity: 'critical' },
  // Ad spend — SPLIT per-platform (canonical). Combined alias accepted in code.
  { name: 'META_DAILY_SPEND_THRESHOLD',        expected: null,     severity: 'critical',
    note: 'Dr. Flippen sets. Split model chosen over one combined limit.' },
  { name: 'GOOGLE_DAILY_SPEND_THRESHOLD',      expected: null,     severity: 'critical',
    note: 'Dr. Flippen sets.' },
];

// ─── CRM modules + their env var names ────────────────────────────────────────
// Agent 5A confirms each module's real api_name via GET /crm/v6/settings/modules.
const CRM_MODULES = [
  { envVar: 'AMBASSADORS_MODULE_API_NAME',     label: 'Ambassadors',        key: 'ambassadors',   severity: 'critical' },
  { envVar: 'PROSPECTS_MODULE_API_NAME',       label: 'Prospects',          key: 'prospects',     severity: 'critical' },
  { envVar: 'SUPPORT_TICKETS_MODULE_API_NAME', label: 'Support Tickets',    key: 'supportTickets', severity: 'critical' },
  { envVar: 'REFERRALS_MODULE_API_NAME',       label: 'Referrals',          key: 'referrals',     severity: 'critical' },
  { envVar: 'ACTIVITY_LOG_MODULE_API_NAME',    label: 'Ambassador Activity Log', key: 'activityLog', severity: 'warn' },
  { envVar: 'AD_CAMPAIGN_LOG_MODULE_API_NAME', label: 'Ad Campaign Log',    key: 'adCampaignLog', severity: 'warn' },
  { envVar: 'SOCIAL_POST_LOG_MODULE_API_NAME', label: 'Social Post Log',    key: 'socialPostLog', severity: 'warn' },
  { envVar: 'PARA_DB_MODULE_NAME',             label: 'Paraprofessional DB', key: 'paraDb',       severity: 'warn' },
  { envVar: 'STUDENT_ALUMNI_MODULE',           label: 'Student / Alumni',   key: 'studentAlumni', severity: 'warn' },
];

// ─── CRM fields to confirm exist (with expected type category) ────────────────
// type categories map loosely to Zoho data_type; existence is the critical check.
// encrypted: true → field must return a `crypt` block (encrypted field type).
// The two bank fields are the only encrypted-critical checks.
const CRM_FIELDS = {
  ambassadors: {
    moduleKey: 'ambassadors',
    severity: 'critical',
    fields: [
      { api: 'Recruiting_Source', type: 'picklist' },
      { api: 'Recruiting_Channel', type: 'text' },
      { api: 'VIP_Flag', type: 'boolean' },
      { api: 'VIP_Prospect_Origin', type: 'boolean' },
      { api: 'Motivation_Tag', type: 'picklist' },
      { api: 'Motivation_Discovery_Response', type: 'textarea' },
      { api: 'Ambassador_Role_Category', type: 'picklist' },
      { api: 'Audience_Track', type: 'picklist' },
      { api: 'Last_Engagement_Date', type: 'date' },
      { api: 'Engagement_Track', type: 'picklist' },
      { api: 'Alternative_Track_Entry_Date', type: 'date' },
      { api: 'Alternative_Track_Month', type: 'number' },
      { api: 'Days_Since_Last_Referral', type: 'number' },
      { api: 'Content_Week_Position', type: 'number' },
      { api: 'Last_Story_File_Used', type: 'text' },
      { api: 'Re_Engagement_Attempt', type: 'number' },
      { api: 'Escalated_To_Human', type: 'boolean' },
      { api: 'VIP_Score', type: 'number' },
      { api: 'VIP_Tier', type: 'picklist' },
      { api: 'VIP_Tier_Previous', type: 'picklist' },
      { api: 'VIP_Tier_Upgrade_Date', type: 'date' },
      { api: 'Win_Back_Sent', type: 'boolean' },
      { api: 'Win_Back_Survey_Response', type: 'picklist' },
      { api: 'Win_Back_Response_Date', type: 'date' },
      { api: 'Dormant_Compliance', type: 'boolean' },
      { api: 'Auto_Approved', type: 'boolean' },
      { api: 'Auto_Approve_Timestamp', type: 'datetime' },
      { api: 'Auto_Approve_Criteria_Version', type: 'text' },
      { api: 'Last_Compliance_Form_Version', type: 'text' },
      { api: 'Country_of_Residence', type: 'picklist' },
      { api: 'Payment_Method_Preference', type: 'picklist' },
      { api: 'PayPal_Email', type: 'email' },
      { api: 'Bank_Account_Routing', type: 'text', encrypted: true },
      { api: 'Bank_Account_Number', type: 'text', encrypted: true },
      { api: 'Wise_Email_or_Account', type: 'text' },
      { api: 'Tremendous_Email', type: 'email' },
      { api: 'Payment_Info_Complete', type: 'boolean' },
      { api: 'VIP_HeyGen_Job_ID', type: 'text' },
      { api: 'VIP_Relationship_Manager', type: 'text' },
      { api: 'Approval_Date', type: 'date' },
      { api: 'Last_Reminder_Sent_Date', type: 'date' },
    ],
  },
  prospects: {
    moduleKey: 'prospects',
    severity: 'critical',
    fields: [
      { api: 'First_Name', type: 'text' },
      { api: 'Email', type: 'email' },
      { api: 'Social_Profile_URL', type: 'url' },
      { api: 'Role_Category', type: 'picklist' },
      { api: 'Audience_Track', type: 'picklist' },
      { api: 'Organization', type: 'text' },
      { api: 'Channel_Source', type: 'text' },
      { api: 'Outreach_Status', type: 'picklist' },
      { api: 'Contact_Found', type: 'boolean' },
      { api: 'Gap_Type', type: 'picklist' },
      { api: 'Motivation_Tag', type: 'picklist' },
      { api: 'Mission_Alignment_Score', type: 'number' },
      { api: 'Org_Influence_Score', type: 'number' },
      { api: 'VIP_Prospect', type: 'boolean' },
      { api: 'VIP_Prospect_Score', type: 'number' },
      { api: 'VIP_Prospect_Pipeline_Stage', type: 'picklist' },
      { api: 'Prospect_Declined_Date', type: 'date' },
      { api: 'Lead_Magnets_Downloaded', type: 'textarea' },
      { api: 'UTM_Source', type: 'text' },
      { api: 'UTM_Campaign', type: 'text' },
    ],
  },
  supportTickets: {
    moduleKey: 'supportTickets',
    severity: 'critical',
    fields: [
      { api: 'Ambassador_ID', type: 'lookup' },
      { api: 'Question_Text', type: 'textarea' },
      { api: 'Ticket_Tier', type: 'picklist' },
      { api: 'Issue_Category', type: 'picklist' },
      { api: 'Ambassador_VIP_Status', type: 'boolean' },
      { api: 'Resolution_Complexity', type: 'picklist' },
      { api: 'Resolution_Status', type: 'picklist' },
      { api: 'Escalation_Timestamp', type: 'datetime', coordination: true },
      { api: 'First_Response_Timestamp', type: 'datetime', coordination: true },
      { api: 'Resolution_Timestamp', type: 'datetime', coordination: true },
      { api: 'SLA_Breached', type: 'boolean', coordination: true },
      { api: 'Resolution_SLA_Breached', type: 'boolean', coordination: true },
    ],
  },
};

// The nine Support Tickets SLA field API names that Agent 4 and Agent 5 must
// share exactly (coordination point #2). Escalation_Timestamp is #3.
const SLA_COORDINATION_FIELDS = [
  'Ticket_Tier', 'Ambassador_VIP_Status', 'Escalation_Timestamp',
  'First_Response_Timestamp', 'Resolution_Timestamp', 'Resolution_Status',
  'Resolution_Complexity', 'SLA_Breached', 'Resolution_SLA_Breached',
];

module.exports = {
  ENV_VARS,
  MAKE_WEBHOOK_VARS,
  WORKDRIVE_FOLDER_VARS,
  FORM_VARS,
  POLICY_VARS,
  CRM_MODULES,
  CRM_FIELDS,
  SLA_COORDINATION_FIELDS,
};
