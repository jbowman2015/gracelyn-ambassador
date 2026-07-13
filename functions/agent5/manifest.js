'use strict';

/**
 * Agent 5 — Ambassador Support: canonical constants.
 *
 * Single source of truth for this agent's env-var names, the Support Tickets /
 * Ambassadors field API names it reads and writes, the tier/issue-category/
 * complexity classification signals (design §5, §5.1, §6.1), and the fixed
 * fallback response bodies (design §10.1).
 *
 * Naming authority (per CLAUDE.md + ClaudeCode_Zoho_API_Names_Instruction):
 *   - CRM MODULE + FIELD api_names are authoritative in Zoho. SUPPORT_TICKETS_FIELDS
 *     and the read subset of AMBASSADORS_FIELDS below were reconciled live against
 *     the `Support_Tickets` (CustomModule42) and `Ambassadors` (CustomModule37)
 *     modules on 2026-07-10. Support_Tickets already existed with all nine SLA
 *     fields Agent 4 also depends on (agent5A/manifest.js CRM_FIELDS.supportTickets /
 *     SLA_COORDINATION_FIELDS) — api_names, data_types, and picklist values all
 *     matched exactly; no divergence, no fields created. Coordination #2 (nine SLA
 *     field names shared with Agent 4) and #3 (escalation_timestamp ==
 *     Escalation_Timestamp) are both satisfied by construction: this agent writes
 *     the field named literally `Escalation_Timestamp` and the webhook payload key
 *     `escalation_timestamp` from the same generated ISO string (see pipeline.js).
 *   - ENV-VAR names are the canonical strings from agent5A/manifest.js /
 *     .env.example (OPENAI_AMBASSADOR_ASSISTANT_ID, not OPENAI_ASSISTANT_ID). The
 *     design doc's OPENAI_ASSISTANT_ID spelling is accepted as a read-only alias.
 */

// ─── Environment variables (canonical primary, design-doc alias fallback) ─────
const ENV_SPEC = [
  { key: 'OPENAI_API_KEY', required: true, group: 'AI' },
  { key: 'OPENAI_AMBASSADOR_ASSISTANT_ID', aliases: ['OPENAI_ASSISTANT_ID'], required: true, group: 'AI',
    note: 'Canonical. Do NOT use OPENAI_ASSISTANT_ID. Confirm with Parmeet whether this extends the existing Gracelyn website assistant or is a distinct assistant (design §1 hard stop).' },
  { key: 'OPENAI_POLL_INTERVAL_MS', required: false, group: 'AI', note: 'Default 2000 (design §13).' },
  { key: 'OPENAI_POLL_MAX_ATTEMPTS', required: false, group: 'AI', note: 'Default 15 — 30s at 2s interval (design §13).' },

  // Zoho CRM OAuth trio (Ambassadors read, Support Tickets write; metadata needs
  // ZohoCRM.settings.READ).
  { key: 'ZOHO_CRM_CLIENT_ID', required: true, group: 'Zoho' },
  { key: 'ZOHO_CRM_CLIENT_SECRET', required: true, group: 'Zoho' },
  { key: 'ZOHO_CRM_REFRESH_TOKEN', required: true, group: 'Zoho' },

  // Zoho Mail OAuth trio (fallback escalation email only — design §1, §10).
  { key: 'ZOHO_MAIL_CLIENT_ID', required: true, group: 'Zoho' },
  { key: 'ZOHO_MAIL_CLIENT_SECRET', required: true, group: 'Zoho' },
  { key: 'ZOHO_MAIL_REFRESH_TOKEN', required: true, group: 'Zoho' },
  { key: 'ZOHO_MAIL_ACCOUNT_ID', required: true, group: 'Zoho',
    note: 'Not in the design doc\'s env table but required by the Zoho Mail send API (POST /api/accounts/{id}/messages) — same gap Agent 2 flagged. Flag for Parmeet.' },
  { key: 'ZOHO_MAIL_FROM_ADDRESS', required: false, group: 'Zoho', note: 'Default ambassadors@gracelyn.edu.' },

  // Zoho WorkDrive OAuth trio (Folder 08 brand assets — design Step 5).
  { key: 'ZOHO_WORKDRIVE_CLIENT_ID', required: true, group: 'Zoho' },
  { key: 'ZOHO_WORKDRIVE_CLIENT_SECRET', required: true, group: 'Zoho' },
  { key: 'ZOHO_WORKDRIVE_REFRESH_TOKEN', required: true, group: 'Zoho' },
  { key: 'WORKDRIVE_FOLDER_08_ID', required: true, group: 'WorkDrive', note: 'Brand assets: ambassador_copy_rules.txt, ambassador_program_descriptions.txt.' },

  // WordPress (canonical program-wide names; design doc's per-agent wp-agent5
  // spelling accepted as alias, same open reconciliation as Agent 2).
  { key: 'WORDPRESS_API_BASE_URL', aliases: ['WORDPRESS_SITE_URL'], required: true, group: 'WordPress' },
  { key: 'WP_ADMIN_USER', aliases: ['WORDPRESS_APP_USERNAME'], required: true, group: 'WordPress',
    note: 'Design doc wants a dedicated wp-agent5 application user; alias accepted either way.' },
  { key: 'WP_ADMIN_APP_PASSWORD', aliases: ['WORDPRESS_APP_PASSWORD'], required: true, group: 'WordPress',
    note: 'Application password, not the login password.' },
  { key: 'WORDPRESS_SESSION_VERIFY_PATH', required: false, group: 'WordPress',
    note: 'REST path Agent 5 calls to verify session_token and extract the ambassador email + role. Default /wp-json/gracelyn/v1/verify-session. Confirm the real endpoint with Parmeet (design §1 hard stop) — this is a build-time seam, see wordpress.js.' },

  // CRM module api_names (confirmed live 2026-07-10; env override still honored
  // and cross-checked every run per ClaudeCode_Zoho_API_Names_Instruction).
  { key: 'AMBASSADORS_MODULE_API_NAME', required: false, group: 'Config', note: 'Confirmed live: "Ambassadors" (CustomModule37).' },
  { key: 'SUPPORT_TICKETS_MODULE_API_NAME', required: false, group: 'Config',
    note: 'Confirmed live: "Support_Tickets" (CustomModule42). Must match Agent 4 exactly (Coordination #2).' },

  // Make.com / alerts.
  { key: 'MAKE_ESCALATION_WEBHOOK_URL', required: true, group: 'Make.com', note: 'Scenario 1 — escalation routing (design §9).' },
  { key: 'SUPPORT_COORDINATOR_EMAIL', required: true, group: 'Alerts' },
  { key: 'VIP_MANAGER_EMAIL', aliases: ['VIP_RELATIONSHIP_MANAGER_EMAIL'], required: true, group: 'Alerts' },
  { key: 'PARMEET_ALERT_EMAIL', required: true, group: 'Alerts' },
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
const SUPPORT_TICKETS_MODULE = { label: 'Support Tickets', envVar: 'SUPPORT_TICKETS_MODULE_API_NAME' };
const AMBASSADORS_MODULE = { label: 'Ambassadors', envVar: 'AMBASSADORS_MODULE_API_NAME' };

// Fields Agent 5 writes on Support Tickets at creation (design §7). Matches
// agent5A/manifest.js CRM_FIELDS.supportTickets exactly — confirmed live, no
// divergence. Agent 5 must NEVER write SLA_Breached or Resolution_SLA_Breached
// (Agent 4 owns those exclusively); they are intentionally absent below.
const SUPPORT_TICKET_FIELDS = {
  name: 'Name',                     // primary field; ticket display name, generated (see pipeline.js)
  ambassadorId: 'Ambassador_ID',     // lookup
  questionText: 'Question_Text',
  ticketTier: 'Ticket_Tier',
  issueCategory: 'Issue_Category',
  ambassadorVipStatus: 'Ambassador_VIP_Status',
  resolutionComplexity: 'Resolution_Complexity',
  resolutionStatus: 'Resolution_Status',
  escalationTimestamp: 'Escalation_Timestamp',       // coordination #3
  firstResponseTimestamp: 'First_Response_Timestamp', // written later by coordinator/Agent 5 (out of this build's scope)
  resolutionTimestamp: 'Resolution_Timestamp',
};

// The nine fields Agent 4 also reads/writes (coordination #2) — SLA_Breached and
// Resolution_SLA_Breached are Agent-4-owned and deliberately excluded from
// SUPPORT_TICKET_FIELDS above, but listed here so the field-existence check still
// confirms the full shared set exists on the live module.
const SLA_COORDINATION_FIELDS = [
  'Ticket_Tier', 'Ambassador_VIP_Status', 'Escalation_Timestamp',
  'First_Response_Timestamp', 'Resolution_Timestamp', 'Resolution_Status',
  'Resolution_Complexity', 'SLA_Breached', 'Resolution_SLA_Breached',
];

// Fields Agent 5 reads on the Ambassadors module (design Step 4). Confirmed live
// 2026-07-10 — matches functions/agent2/manifest.js AMBASSADORS_FIELDS.
const AMBASSADOR_FIELDS = {
  id: 'id',
  firstName: 'First_Name',
  lastName: 'Name',                 // system field; label is literally "Last Name"
  email: 'Email',
  status: 'Ambassador_Status',      // existing; design doc's generic "Status". Value checked below.
  vipFlag: 'VIP_Flag',
  roleCategory: 'Ambassador_Role_Category', // design doc: Role_Category
  motivationTag: 'Motivation_Tag',
  referralLink: 'Referral_Link',
  referralCode: 'Referral_Code',
};

const AMBASSADOR_ACTIVE_STATUS = 'Active';

// ─── Controlled vocabularies (confirmed live picklist values, 2026-07-10) ─────
const TICKET_TIERS = { tier1: 'Tier 1', tier2: 'Tier 2', tier3: 'Tier 3', vip: 'VIP Priority' };
const ISSUE_CATEGORIES = {
  payment: 'Payment', compliance: 'Compliance', referralTracking: 'Referral Tracking',
  portalAccess: 'Portal Access', recruiting: 'Recruiting', other: 'Other',
};
const RESOLUTION_COMPLEXITY = { simple: 'Simple', moderate: 'Moderate', complex: 'Complex' };
const RESOLUTION_STATUS = { resolved: 'Resolved', escalated: 'Escalated', failed: 'Failed' };

// ─── Tier classification signals (design §5 pseudocode) ──────────────────────
// Sequential — first match wins. VIP override is applied by the caller before
// these are consulted (classify.js).
const TIER3_COMPLEX_SIGNALS = [
  'payment dispute', 'account suspended', 'fraud', 'incorrect amount',
  'escalate to management', 'speak to someone senior',
];
const TIER2_ESCALATION_SIGNALS = [
  'support coordinator', 'human', 'cannot fully answer',
  'please contact', 'reach out to our team',
];
const TIER2_QUESTION_SIGNALS = ['speak to a person'];

// ─── Issue category classification (design §5.1) ──────────────────────────────
// Order matters: first matching category wins. 'other' is the fallback.
const ISSUE_CATEGORY_PATTERNS = [
  { category: ISSUE_CATEGORIES.payment, keywords: [
    'referral fee', 'payment', 'paid', 'when do i get', 'how much', 'bank',
    'paypal', 'wise', 'tremendous', 'tax', '1099', 'earnings', 'payout',
  ] },
  { category: ISSUE_CATEGORIES.compliance, keywords: [
    'agreement', 'ethics', 'training', 'compliance', 'signature', 'document',
    'activate', 'referral link not working', 'portal access',
  ] },
  { category: ISSUE_CATEGORIES.referralTracking, keywords: [
    'referral', 'tracking', 'link', 'applied', 'enrolled', 'status',
    'attribution', 'my student', 'did they apply',
  ] },
  { category: ISSUE_CATEGORIES.portalAccess, keywords: [
    'login', 'password', 'dashboard', 'portal', "can't access", 'cannot access',
    'account', 'profile', 'settings',
  ] },
  { category: ISSUE_CATEGORIES.recruiting, keywords: [
    'recruiting link', 'ambassador recruiting', 'recruit', 'invite another educator',
    'secondary fee', 'my recruits',
  ] },
];

// ─── Resolution complexity classification (design §6.1) ──────────────────────
const COMPLEXITY_SIGNALS = {
  complex: ['dispute', 'incorrect', 'suspended', 'fraud', 'wrong amount'],
  moderate: ['payment', 'referral fee', 'tracking', 'not showing'],
};

// ─── Fixed response bodies (design §10.1) ─────────────────────────────────────
const FALLBACK_RESPONSE = {
  success: true,
  response: 'We are experiencing a technical issue right now. '
    + 'Your question has been forwarded to our support team '
    + 'and you will hear back within 24 hours. '
    + 'We apologize for the inconvenience.',
  thread_id: null,
};
const NOT_VERIFIED_RESPONSE = {
  success: false,
  response: 'Your session could not be verified. '
    + 'Please log in to the ambassador portal and try again.',
  thread_id: null,
};

// Not in the design doc's §10.1 fixed-response table, but Step 4 describes this
// exact outcome ("return a message directing them to contact support") without
// naming a constant — defined here so the copy is consistent and testable.
const NOT_ACTIVE_RESPONSE = {
  success: true,
  response: 'Your ambassador account is not currently active. '
    + 'Please contact our support team for help getting reactivated.',
  thread_id: null,
};

// Brand asset filenames expected in WorkDrive Folder 08 (design §1, Step 5).
const BRAND_ASSETS = {
  copyRules: 'ambassador_copy_rules.txt',
  programDescriptions: 'ambassador_program_descriptions.txt',
};

const MAX_MESSAGE_LENGTH = 2000;
const DEFAULT_OPENAI_POLL_INTERVAL_MS = 2000;
const DEFAULT_OPENAI_POLL_MAX_ATTEMPTS = 15;
const WEBHOOK_RETRY_DELAY_MS = 30000;

module.exports = {
  ENV_SPEC,
  getEnv,
  SUPPORT_TICKETS_MODULE,
  AMBASSADORS_MODULE,
  SUPPORT_TICKET_FIELDS,
  SLA_COORDINATION_FIELDS,
  AMBASSADOR_FIELDS,
  AMBASSADOR_ACTIVE_STATUS,
  TICKET_TIERS,
  ISSUE_CATEGORIES,
  RESOLUTION_COMPLEXITY,
  RESOLUTION_STATUS,
  TIER3_COMPLEX_SIGNALS,
  TIER2_ESCALATION_SIGNALS,
  TIER2_QUESTION_SIGNALS,
  ISSUE_CATEGORY_PATTERNS,
  COMPLEXITY_SIGNALS,
  FALLBACK_RESPONSE,
  NOT_VERIFIED_RESPONSE,
  NOT_ACTIVE_RESPONSE,
  BRAND_ASSETS,
  MAX_MESSAGE_LENGTH,
  DEFAULT_OPENAI_POLL_INTERVAL_MS,
  DEFAULT_OPENAI_POLL_MAX_ATTEMPTS,
  WEBHOOK_RETRY_DELAY_MS,
};
