'use strict';

/**
 * Agent 2 — Onboarding: canonical constants.
 *
 * Single source of truth for this agent's env-var names, the Ambassadors /
 * Ambassador_Leads field API names it reads and writes, the controlled
 * vocabularies (motivation tags, win-back responses, role categories), and
 * the auto-approve / compliance-reminder timing constants.
 *
 * Naming authority (per CLAUDE.md + ClaudeCode_Zoho_API_Names_Instruction):
 *   - CRM MODULE + FIELD api_names are authoritative in Zoho. AMBASSADORS_FIELDS
 *     below was reconciled live against the `Ambassadors` module (CustomModule37)
 *     on 2026-07-10. The module had only 60 fields before this build; 23 were
 *     missing and created live (see AMBASSADORS_FIELDS comments for the three
 *     that had to be renamed to fit Zoho's 25-char field-label limit, and the
 *     one — Ambassador_Role_Category — created as text instead of picklist for
 *     the same reason Agent 0 hit on Role_Category: two of the six controlled
 *     role values exceed the 25-char picklist-option limit). Four design-doc
 *     field names map onto fields that already existed under a different name
 *     (Ethics_Acknowledged -> Ethics_Signed, Training_Complete ->
 *     Training_Completed, Approval_Date -> Approved_Date, Status ->
 *     Ambassador_Status) — these were NOT duplicated.
 *   - ENV-VAR names are the canonical strings from agent5A/manifest.js /
 *     .env.example. Where the Agent 2 design doc used a different spelling,
 *     the doc name is accepted as a read-only ALIAS (see ENV.get) so nothing
 *     silently breaks, but the canonical name is what Agent 5A validates and
 *     what should be set in Catalyst.
 */

// ─── Environment variables (canonical primary, design-doc alias fallback) ─────
const ENV_SPEC = [
  { key: 'ANTHROPIC_API_KEY', required: true, group: 'AI' },
  { key: 'ANTHROPIC_MODEL', required: false, group: 'AI', note: 'Default claude-sonnet-4-20250514.' },

  // Zoho CRM OAuth trio (records + metadata; token needs ZohoCRM.settings.READ).
  { key: 'ZOHO_CRM_CLIENT_ID', required: true, group: 'Zoho' },
  { key: 'ZOHO_CRM_CLIENT_SECRET', required: true, group: 'Zoho' },
  { key: 'ZOHO_CRM_REFRESH_TOKEN', required: true, group: 'Zoho' },

  // Zoho Mail OAuth trio (send from ambassadors@gracelyn.edu).
  { key: 'ZOHO_MAIL_CLIENT_ID', required: true, group: 'Zoho' },
  { key: 'ZOHO_MAIL_CLIENT_SECRET', required: true, group: 'Zoho' },
  { key: 'ZOHO_MAIL_REFRESH_TOKEN', required: true, group: 'Zoho' },
  { key: 'ZOHO_MAIL_ACCOUNT_ID', required: true, group: 'Zoho',
    note: 'Not in the design doc\'s env table but required by the Zoho Mail send API (POST /api/accounts/{id}/messages). Added during build; flag for Parmeet.' },
  { key: 'ZOHO_MAIL_FROM_ADDRESS', required: false, group: 'Zoho', note: 'Default ambassadors@gracelyn.edu.' },

  // Zoho WorkDrive OAuth trio (welcome kit share links; brand voice for VIP copy).
  { key: 'ZOHO_WORKDRIVE_CLIENT_ID', required: true, group: 'Zoho' },
  { key: 'ZOHO_WORKDRIVE_CLIENT_SECRET', required: true, group: 'Zoho' },
  { key: 'ZOHO_WORKDRIVE_REFRESH_TOKEN', required: true, group: 'Zoho' },
  { key: 'WORKDRIVE_FOLDER_03_ID', required: true, group: 'WorkDrive', note: 'Ambassador welcome kits.' },
  { key: 'WORKDRIVE_FOLDER_08_ID', required: true, group: 'WorkDrive', note: 'Brand assets (voice guidelines for VIP personalization).' },

  // WordPress (canonical names shared with the rest of the program; design doc's
  // per-agent wp-agent2 spelling is accepted as an alias — see Master Reference
  // Sheet §1, this reconciliation is still open pending Parmeet's confirmation
  // of shared-vs-per-agent WordPress users).
  { key: 'WORDPRESS_API_BASE_URL', aliases: ['WORDPRESS_SITE_URL'], required: true, group: 'WordPress' },
  { key: 'WP_ADMIN_USER', aliases: ['WORDPRESS_APP_USERNAME'], required: true, group: 'WordPress',
    note: 'Design doc wants a dedicated wp-agent2 application user; alias accepted either way.' },
  { key: 'WP_ADMIN_APP_PASSWORD', aliases: ['WORDPRESS_APP_PASSWORD'], required: true, group: 'WordPress',
    note: 'Application password, not the login password.' },
  { key: 'AMBASSADOR_PORTAL_URL', required: false, group: 'WordPress', note: 'Linked in onboarding emails.' },

  // HeyGen (VIP welcome video).
  { key: 'HEYGEN_API_KEY', required: true, group: 'Channels' },
  { key: 'HEYGEN_TEMPLATE_ID', required: true, group: 'Channels' },
  { key: 'HEYGEN_FLIPPEN_AVATAR_ID', required: true, group: 'Channels', note: 'Canonical. Do NOT use HEYGEN_AVATAR_ID.' },

  // Behaviour / policy.
  { key: 'APPROVAL_MODE', required: true, group: 'Policy', note: 'MANUAL (Phase 1) | AUTO (Phase 2). Parmeet flips manually.' },
  { key: 'AUTO_APPROVE_CRITERIA_VERSION', required: false, group: 'Policy', note: 'Default v2.0.' },
  { key: 'ACTIVE_AMBASSADOR_THRESHOLD_ALERT', required: false, group: 'Policy', note: 'Default 800.' },
  { key: 'ACTIVE_AMBASSADOR_THRESHOLD_AUTO', required: false, group: 'Policy', note: 'Default 1000.' },
  { key: 'AMBASSADORS_MODULE_API_NAME', required: false, group: 'Config',
    note: 'Confirmed live 2026-07-10: "Ambassadors" (CustomModule37).' },
  { key: 'PROSPECTS_MODULE_API_NAME', required: false, group: 'Config',
    note: 'Confirmed live (Agent 0 build 2026-07-07): "Ambassador_Leads".' },
  { key: 'COMBINED_FORM_ID', required: true, group: 'Forms' },
  { key: 'WINBACK_SURVEY_FORM_ID', required: true, group: 'Forms' },
  { key: 'ZOHO_FORMS_BASE_URL', required: false, group: 'Forms',
    note: 'Used with *_FORM_ID to build email links, e.g. https://forms.zoho.com/gracelynuniversity/form.' },
  { key: 'WINBACK_WALKTHROUGH_VIDEO_URL', required: false, group: 'Config',
    note: 'WorkDrive link for the win-back Response B walkthrough video.' },

  // Make.com webhooks (canonical program-wide names; design-doc aliases accepted).
  { key: 'MAKE_AGENT3_WEBHOOK_URL', aliases: ['MAKE_AGENT3_ACTIVATION_WEBHOOK'], required: false, group: 'Make.com',
    note: 'Function D5 — Agent 3 activation notification.' },
  { key: 'MAKE_VIP_MANAGER_NOTIFY_WEBHOOK_URL', aliases: ['MAKE_VIP_ACTIVATION_WEBHOOK'], required: false, group: 'Make.com',
    note: 'Function B4-VIP + D6 — VIP relationship manager notifications.' },
  { key: 'MAKE_COORDINATOR_QUEUE_WEBHOOK_URL', required: false, group: 'Make.com',
    note: 'Function A4 — coordinator approval queue notification.' },
  { key: 'MAKE_WINBACK_SURVEY_WEBHOOK', required: false, group: 'Make.com',
    note: 'Win-back Response D — immediate coordinator notification for a reported technical problem.' },
  { key: 'MAKE_AGENT2_ERROR_WEBHOOK', required: false, group: 'Make.com', note: 'Delivers Agent 2 alert emails.' },

  // Alert routing.
  { key: 'PARMEET_ALERT_EMAIL', required: true, group: 'Alerts', note: 'Receives all Agent 2 error + threshold alerts.' },
  { key: 'VIP_MANAGER_EMAIL', aliases: ['VIP_RELATIONSHIP_MANAGER_EMAIL'], required: true, group: 'Alerts' },
  { key: 'SUPPORT_COORDINATOR_EMAIL', required: false, group: 'Alerts', note: 'Win-back Response A/D personal follow-up.' },
];

function getEnv(key) {
  const spec = ENV_SPEC.find((e) => e.key === key);
  const names = [key, ...((spec && spec.aliases) || [])];
  for (const n of names) {
    const v = process.env[n];
    if (typeof v === 'string' && v.trim() !== '') return v.trim();
  }
  return '';
}

// ─── CRM: module + field API names (cross-check; verified live 2026-07-10) ────
const AMBASSADORS_MODULE = { label: 'Ambassadors', envVar: 'AMBASSADORS_MODULE_API_NAME' };
const PROSPECTS_MODULE = { label: 'Prospects', envVar: 'PROSPECTS_MODULE_API_NAME' };

// Fields Agent 2 reads/writes on the Ambassadors module.
const AMBASSADORS_FIELDS = {
  id: 'id',
  firstName: 'First_Name',
  lastName: 'Name',                 // system field; label is literally "Last Name"
  email: 'Email',
  secondaryEmail: 'Secondary_Email',
  phone: 'Phone',
  address: 'Address', city: 'City', state: 'State', country: 'Country', zip: 'Zip_Code',
  organization: 'Organization_Name',
  wordpressUserId: 'WordPress_User_ID',

  status: 'Ambassador_Status',      // existing; design doc's generic "Status". Values below.

  agreementSigned: 'Agreement_Signed',
  ethicsAcknowledged: 'Ethics_Signed',        // existing; design doc calls this Ethics_Acknowledged
  trainingComplete: 'Training_Completed',     // existing; design doc calls this Training_Complete
  complianceComplete: 'Compliance_Complete',  // existing; exact match
  approvalDate: 'Approved_Date',              // existing; design doc calls this Approval_Date

  lastComplianceFormVersion: 'Compliance_Form_Version',   // NEW; design doc: Last_Compliance_Form_Version
  lastReminderSentDate: 'Last_Reminder_Sent_Date',         // NEW
  winBackSent: 'Win_Back_Sent',                            // NEW
  winBackSurveyResponse: 'Win_Back_Survey_Response',       // NEW
  winBackResponseDate: 'Win_Back_Response_Date',           // NEW
  dormantCompliance: 'Dormant_Compliance',                 // NEW

  motivationDiscoveryResponse: 'Motivation_Response',      // NEW; design doc: Motivation_Discovery_Response
  motivationTag: 'Motivation_Tag',                         // NEW

  autoApproved: 'Auto_Approved',                           // NEW
  autoApproveTimestamp: 'Auto_Approve_Timestamp',          // NEW
  autoApproveCriteriaVersion: 'Auto_Approve_Version',      // NEW; design doc: Auto_Approve_Criteria_Version

  vipFlag: 'VIP_Flag',                                     // NEW; set by Agent 0
  vipProspectOrigin: 'VIP_Prospect_Origin',                // NEW; set by Agent 0
  vipHeyGenJobId: 'VIP_HeyGen_Job_ID',                      // NEW
  vipRelationshipManager: 'VIP_Relationship_Manager',      // NEW

  fraudFlag: 'Fraud_Flag',                                 // NEW; Agent 2 creates, Agent 4 will write to it later
  recruitedBy: 'Recruited_By',                             // NEW; referral code entered on application
  roleCategory: 'Ambassador_Role_Category',                // NEW; text (picklist option-length limit)
  audienceTrack: 'Audience_Track',                         // NEW
  consentGiven: 'Consent_Given',                            // NEW

  approvalQueueAddedDate: 'Approval_Queue_Added_Date',     // NEW
  needsExceptionReview: 'Needs_Exception_Review',          // NEW
  exceptionReason: 'Exception_Reason',                      // NEW
};

// Minimal Ambassador_Leads (Prospects) fields Agent 2 touches (Function A3).
const PROSPECT_FIELDS = {
  email: 'Email',
  outreachStatus: 'Outreach_Status',   // existing picklist; "Applied" already a valid option
};

// ─── Controlled vocabularies ───────────────────────────────────────────────────
const AMBASSADOR_STATUS = {
  applicant: 'Applicant', approved: 'Approved', active: 'Active',
  suspended: 'Suspended', terminated: 'Terminated',
};

const MOTIVATION_TAGS = [
  'Professional Growth', 'Mission Impact', 'Kingdom Calling',
  'Problem Solver', 'Community Recognition', 'Unknown',
];

// Reused from Agent 0's controlled vocabulary for cross-agent consistency
// (an ambassador's role category should read the same as the prospect's did).
const ROLE_CATEGORIES = [
  'K12 Educator', 'Early Childhood', 'Faith Community',
  'Youth Serving Professional', 'Mission Aligned Influencer', 'Gracelyn Community',
];

const AUDIENCE_TRACKS = ['K12 Educator', 'Early Childhood', 'Faith Community', 'Youth Serving', 'General'];

const WIN_BACK_RESPONSES = {
  tooBusy: 'Too Busy', confused: 'Confused', notSure: 'Not Sure',
  technicalProblem: 'Technical Problem', noResponse: 'No Response',
};

// ─── Timing constants (design §3.1 / §6.3) ─────────────────────────────────────
const COMPLIANCE_SCHEDULE = {
  day2: 2, day7: 7, day14: 14, winBackDay: 15, dormantDay: 75,
  minReminderGapDays: 5,
};

const WORDPRESS_ROLES = { applicant: 'ambassador_applicant', active: 'ambassador_active' };

const DEFAULT_AUTO_APPROVE_CRITERIA_VERSION = 'v2.0';
const DEFAULT_ACTIVE_AMBASSADOR_THRESHOLD_ALERT = 800;
const DEFAULT_ACTIVE_AMBASSADOR_THRESHOLD_AUTO = 1000;

module.exports = {
  ENV_SPEC,
  getEnv,
  AMBASSADORS_MODULE,
  PROSPECTS_MODULE,
  AMBASSADORS_FIELDS,
  PROSPECT_FIELDS,
  AMBASSADOR_STATUS,
  MOTIVATION_TAGS,
  ROLE_CATEGORIES,
  AUDIENCE_TRACKS,
  WIN_BACK_RESPONSES,
  COMPLIANCE_SCHEDULE,
  WORDPRESS_ROLES,
  DEFAULT_AUTO_APPROVE_CRITERIA_VERSION,
  DEFAULT_ACTIVE_AMBASSADOR_THRESHOLD_ALERT,
  DEFAULT_ACTIVE_AMBASSADOR_THRESHOLD_AUTO,
};
