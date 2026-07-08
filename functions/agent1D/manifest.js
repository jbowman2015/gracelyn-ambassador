'use strict';

/**
 * Agent 1D — Lead Capture — canonical spec.
 *
 * Single source of truth for this agent's env vars and the CRM fields it
 * reads/writes. Per ClaudeCode_Zoho_API_Names_Instruction, module/field
 * API names are the live-reconciled values Agent 0 and Agent 1A already
 * confirmed against Zoho on 2026-07-07 (see functions/agent0/manifest.js and
 * functions/agent1A/manifest.js) — not transcribed blindly from the Agent 1D
 * design doc. Where the design doc's name diverges from what actually exists
 * in Zoho, the divergence is called out below.
 *
 * ─── Divergences from Gracelyn_Agent_1D_Lead_Capture_v2.md, reconciled live ───
 *
 * 1. "Prospects module" is Ambassador_Leads — the same module Agent 0 and
 *    Agent 1A already write to. There is no separate "Prospects" module.
 *    PROSPECTS_MODULE_API_NAME must resolve to Ambassador_Leads, confirmed
 *    live via GET /crm/v6/settings/modules (still resolved live at runtime,
 *    never hardcoded — see zoho.js).
 * 2. Doc's `First_Name` -> live field `Name`. Same divergence Agent 0 and
 *    Agent 1A already documented; do not create a duplicate field.
 * 3. Doc's `Recruiting_Source` is typed Picklist in the doc; the live field
 *    (created by Agent 1A 2026-07-07) is Text. Agent 1D writes the string
 *    "Agent 1D" into that text field — no picklist option to add.
 * 4. Doc's `Outreach_Status` = "Identified" on new-record creation does not
 *    exist on the live picklist. Agent 0 only populated two values on this
 *    field — `Standard` (not yet VIP, not yet contacted) and `VIP Pipeline`
 *    — and Agent 1A's "new prospect ready for outreach" query filters on
 *    `Standard`. Agent 1D writes `Standard` for the same semantic meaning
 *    ("Identified"/not yet contacted) so a lead-capture prospect is picked
 *    up by Agent 1A exactly like an Agent-0-sourced prospect. Using the
 *    doc's literal "Identified" would silently orphan every 1D lead from
 *    Agent 1A's weekly query (this agent's own handoff webhook still fires
 *    immediately regardless — see orchestrate.js Step 8).
 * 5. `Audience_Track`, `Lead_Magnets_Downloaded`, `UTM_Source`, `UTM_Campaign`
 *    are NEW fields this design doc introduces (Section 9 Parmeet pre-build
 *    task: add the Audience_Track picklist before development begins). They
 *    are not yet confirmed live as of this build — verifyFields() surfaces
 *    (not silently swallows) any of these missing at runtime, same pattern
 *    as Agent 0's Step 4.
 * 6. `State` (plain form field, Section 4 Step 5a) is assumed to map to a
 *    live text field named `State` on Ambassador_Leads. Not yet confirmed;
 *    also surfaced by verifyFields() if missing.
 * 7. `Recruiting_Channel` (existing, created by Agent 1A) stores the
 *    lead_magnet_id value for a 1D-sourced lead — same field, same shape.
 */

// ─── Environment variables ────────────────────────────────────────────────────
const ENV_VARS = [
  { name: 'ANTHROPIC_API_KEY', severity: 'critical', group: 'AI',
    note: 'Canonical (Master Reference Sheet §1). Model: claude-sonnet-4-20250514.' },

  { name: 'ZOHO_CRM_CLIENT_ID',     severity: 'critical', group: 'Zoho' },
  { name: 'ZOHO_CRM_CLIENT_SECRET', severity: 'critical', group: 'Zoho' },
  { name: 'ZOHO_CRM_REFRESH_TOKEN', severity: 'critical', group: 'Zoho',
    note: 'Scopes: ZohoCRM.modules.READ/CREATE/UPDATE + ZohoCRM.settings.READ.' },

  { name: 'ZOHO_FORMS_CLIENT_ID',     severity: 'critical', group: 'Zoho',
    note: 'Used only by the nightly cleanup job (Scenario 3), never the real-time path.' },
  { name: 'ZOHO_FORMS_CLIENT_SECRET', severity: 'critical', group: 'Zoho' },
  { name: 'ZOHO_FORMS_REFRESH_TOKEN', severity: 'critical', group: 'Zoho' },

  { name: 'ZOHO_WORKDRIVE_CLIENT_ID',     severity: 'critical', group: 'Zoho' },
  { name: 'ZOHO_WORKDRIVE_CLIENT_SECRET', severity: 'critical', group: 'Zoho' },
  { name: 'ZOHO_WORKDRIVE_REFRESH_TOKEN', severity: 'critical', group: 'Zoho' },
  { name: 'WORKDRIVE_FOLDER_06_ID', severity: 'critical', group: 'Zoho',
    note: 'Lead magnets, one subfolder per audience track.' },
  { name: 'WORKDRIVE_FOLDER_08_ID', severity: 'critical', group: 'Zoho',
    note: 'Brand asset ambassador_copy_rules.txt, read for the Claude opening prompt.' },

  { name: 'ZOHO_MAIL_CLIENT_ID',     severity: 'critical', group: 'Zoho' },
  { name: 'ZOHO_MAIL_CLIENT_SECRET', severity: 'critical', group: 'Zoho' },
  { name: 'ZOHO_MAIL_REFRESH_TOKEN', severity: 'critical', group: 'Zoho' },
  { name: 'AMBASSADOR_MAIL_ACCOUNT_ID',   severity: 'critical', group: 'Zoho',
    note: 'Zoho Mail account ID for ambassadors@gracelyn.edu (shared with Agent 1A).' },
  { name: 'AMBASSADOR_MAIL_FROM_ADDRESS', severity: 'critical', group: 'Zoho',
    note: 'Must be ambassadors@gracelyn.edu. Plain text sends only.' },

  { name: 'PROSPECTS_MODULE_API_NAME', severity: 'critical', group: 'CRM',
    note: 'Resolves to Ambassador_Leads (confirmed live by Agent 0/1A 2026-07-07). Still resolved live at runtime.' },

  { name: 'LEAD_MAGNET_MAP', severity: 'critical', group: 'Config',
    note: 'JSON object: lead_magnet_id -> WorkDrive relative file path within Folder 06. Parmeet edits without code.' },
  { name: 'LEAD_CAPTURE_FORM_IDS', severity: 'critical', group: 'Config',
    note: 'JSON array of the 4 Zoho Forms IDs (k12, ec, faith, youth). Used by the nightly cleanup job.' },
  { name: 'AGENT1D_DELIVERY_EMAIL_SUBJECT', severity: 'critical', group: 'Config',
    note: 'Subject line template. May include [RESOURCE_NAME] placeholder.' },
  { name: 'AGENT1D_LEAD_MAGNET_LINK_MIN_DAYS', severity: 'warn', group: 'Config',
    note: 'Minimum share-link validity in days. Default 7 (design §4 Step 4).' },

  { name: 'MAKE_AGENT1A_FROM_1D_WEBHOOK_URL', severity: 'warn', group: 'Make.com',
    note: 'Scenario 2 — Agent 1A handoff on CRM record creation/update.' },
  { name: 'MAKE_AGENT1D_ERROR_WEBHOOK', severity: 'warn', group: 'Make.com',
    note: 'Scenario 4 — centralizes error alert formatting/delivery to Parmeet.' },

  { name: 'PARMEET_ALERT_EMAIL', severity: 'critical', group: 'Alerts',
    note: 'Included in every error webhook payload so Make.com Scenario 4 knows who to email.' },
];

// ─── CRM module ────────────────────────────────────────────────────────────────
const PROSPECTS_MODULE = { label: 'Prospects', envVar: 'PROSPECTS_MODULE_API_NAME' };

// ─── CRM fields Agent 1D reads/writes on Ambassador_Leads ─────────────────────
const PROSPECT_FIELDS = {
  dedupKey: 'Email',
  firstName: 'Name',                        // live field; doc calls it First_Name
  email: 'Email',
  roleCategory: 'Role_Category',
  audienceTrack: 'Audience_Track',           // NEW — Parmeet pre-build task
  state: 'State',
  leadMagnetsDownloaded: 'Lead_Magnets_Downloaded', // NEW
  outreachStatus: 'Outreach_Status',
  recruitingSource: 'Recruiting_Source',     // existing (Agent 1A); text, not picklist
  recruitingChannel: 'Recruiting_Channel',   // existing (Agent 1A)
  utmSource: 'UTM_Source',                   // NEW
  utmCampaign: 'UTM_Campaign',               // NEW
  contactFound: 'Contact_Found',
};

// Value written to Outreach_Status for a newly captured, not-yet-contacted
// lead. See divergence note #4 above — matches Agent 0's "Standard", not the
// design doc's literal "Identified".
const OUTREACH_STATUS_NEW_LEAD_VALUE = 'Standard';
const RECRUITING_SOURCE_VALUE = 'Agent 1D';

// ─── Audience tracks (design §3) ──────────────────────────────────────────────
const AUDIENCE_TRACKS = {
  k12: 'K12 Educator',
  earlyChildhood: 'Early Childhood',
  faithCommunity: 'Faith Community',
  youthServing: 'Youth Serving Professional',
  unknown: 'Unknown',
};

// lead_magnet_id prefix -> Audience_Track value (design §3.3).
const LEAD_MAGNET_PREFIX_ROUTES = [
  { prefix: 'lm_k12_', track: AUDIENCE_TRACKS.k12 },
  { prefix: 'lm_ec_', track: AUDIENCE_TRACKS.earlyChildhood },
  { prefix: 'lm_faith_', track: AUDIENCE_TRACKS.faithCommunity },
  { prefix: 'lm_youth_', track: AUDIENCE_TRACKS.youthServing },
];

// WorkDrive Folder 06 subfolder convention (design §3.2) — informational; the
// actual file lookup goes through LEAD_MAGNET_MAP, not this table.
const FOLDER_06_SUBFOLDERS = {
  [AUDIENCE_TRACKS.k12]: 'k12-educator',
  [AUDIENCE_TRACKS.earlyChildhood]: 'early-childhood',
  [AUDIENCE_TRACKS.faithCommunity]: 'faith-community',
  [AUDIENCE_TRACKS.youthServing]: 'youth-serving',
};

// Delivery email tone/closing framing per track (design §5).
const DELIVERY_FRAMING = {
  [AUDIENCE_TRACKS.k12]: {
    tone: 'Collegial and affirming. Acknowledge that teaching is demanding. Frame the resource as something a fellow educator found genuinely useful, not a marketing piece.',
    closing: 'This resource comes from Gracelyn University, where we exist to equip incredible teachers like you.',
  },
  [AUDIENCE_TRACKS.earlyChildhood]: {
    tone: 'Warm and validating. Explicitly acknowledge the undervalued nature of early childhood work. Frame the resource as recognition that their work matters.',
    closing: 'The children in your care are lucky to have someone like you.',
  },
  [AUDIENCE_TRACKS.faithCommunity]: {
    tone: 'Faith-aware and mission-aligned. Acknowledge the calling nature of their work. Frame the resource as a tool for living out that calling well.',
    closing: 'This resource exists to help you equip the next generation, in the classroom or the ministry.',
  },
  [AUDIENCE_TRACKS.youthServing]: {
    tone: 'Mission-driven and practical. Acknowledge the complexity of their work with youth in challenging circumstances. Frame the resource as a tool for the real situations they face.',
    closing: 'Every child in your program deserves someone equipped to meet them where they are.',
  },
};

const FALLBACK_LEAD_MAGNET_MESSAGE = 'Your resource will be sent to you shortly by our team.';
const FALLBACK_OPENING_SENTENCE = (firstName) => `Hello ${firstName || 'there'}, here is your resource from Gracelyn University.`;

const BRAND_ASSET_FILENAME = 'ambassador_copy_rules.txt';

function getEnv(key) {
  const v = process.env[key];
  return typeof v === 'string' ? v.trim() : '';
}

module.exports = {
  ENV_VARS,
  getEnv,
  PROSPECTS_MODULE,
  PROSPECT_FIELDS,
  OUTREACH_STATUS_NEW_LEAD_VALUE,
  RECRUITING_SOURCE_VALUE,
  AUDIENCE_TRACKS,
  LEAD_MAGNET_PREFIX_ROUTES,
  FOLDER_06_SUBFOLDERS,
  DELIVERY_FRAMING,
  FALLBACK_LEAD_MAGNET_MESSAGE,
  FALLBACK_OPENING_SENTENCE,
  BRAND_ASSET_FILENAME,
};
