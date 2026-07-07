'use strict';

/**
 * Agent 1A — Database and Email Agent (Recruiting) — canonical spec.
 *
 * Mirrors functions/agent5A/manifest.js: this file is the single source of
 * truth for Agent 1A's environment variables and the CRM fields it reads and
 * writes. Per ClaudeCode_Zoho_API_Names_Instruction, module/field API names
 * here are RECONCILED against live Zoho metadata (confirmed 2026-07-07), not
 * transcribed blindly from the design doc. Where the design doc's name
 * diverged from what actually exists in Zoho, the divergence is called out
 * below — Zoho wins.
 *
 * ─── Divergences from Gracelyn_Agent_1A_Database_Email_v1.md, confirmed live ───
 *
 * 1. Prospects module: the design doc calls it "Prospects" generically. It is
 *    the SAME module Agent 0 writes to: api_name `Ambassador_Leads`. There is
 *    no separate "Prospects" module in the org. PROSPECTS_MODULE_API_NAME must
 *    resolve to Ambassador_Leads, confirmed live via GET /crm/v6/settings/modules.
 * 2. Doc's `First_Name` → live field `Name`. Doc's `Organization` → live field
 *    `Company_Name`. Do NOT create duplicate fields — reuse the existing ones.
 * 3. Doc's `VIP_Flag` (boolean) does not exist. Agent 0 created `VIP_Prospect`
 *    (boolean) for the same purpose. Agent 1A's VIP suppression filter MUST use
 *    VIP_Prospect, not VIP_Flag. VIP prospects are never routed to recruiting.
 * 4. Doc's `Motivation_Hypothesis` → live field `Motivation_Tag` (Agent 0's
 *    field, same purpose). Doc's `Ambassador_Role_Category` → live field
 *    `Role_Category` (text, Agent 0's field).
 * 5. Doc's `Role_Title` → live field `Title` (pre-existing text field on
 *    Ambassador_Leads). Confirm with Parmeet this is the intended mapping.
 * 6. Outreach_Status (picklist) exists but Agent 0 only populated two values:
 *    `Standard` (not VIP — routed to recruiting) and `VIP Pipeline` (suppressed,
 *    human VIP manager). The design doc's lifecycle values — `Identified`,
 *    `Outreach Sent`, `Follow-Up Sent`, `Unresponsive`, `Applied` — do not exist
 *    on the live picklist. Rather than fork a second status field (which would
 *    re-create the exact silent-failure risk CLAUDE.md warns about), Agent 1A
 *    EXTENDS the existing picklist with its four lifecycle values and treats
 *    `Standard` as the doc's `Identified` state (new prospect, VIP_Prospect
 *    false, not yet contacted). This was done live 2026-07-07 — see
 *    OUTREACH_STATUS_LIFECYCLE_VALUES below and DEPLOY.md.
 * 7. Sequence_Email_1_Sent, Sequence_Email_1_Sent_Date, Sequence_Email_2_Sent,
 *    Sequence_Email_2_Sent_Date, Recruiting_Source, Recruiting_Channel did not
 *    exist on Ambassador_Leads. Created live 2026-07-07 (see DEPLOY.md for the
 *    field-creation record). New fields must be created live, never assumed.
 * 8. PARA_DB_MODULE_NAME and STUDENT_ALUMNI_MODULE are NOT yet confirmed in
 *    Zoho (Master Reference Sheet §4 lists both ⬜). Parmeet has not loaded the
 *    paraprofessional test segment or confirmed the student/alumni module as
 *    of this build. Agent 1A resolves them live like every other module and
 *    degrades gracefully (skips that population, does not abort the whole run)
 *    if unresolved — this is expected at Week 1, not a bug.
 */

// ─── Environment variables ────────────────────────────────────────────────────
// Each entry: { name, severity, group, note? }. 'critical' blocks a run from
// starting; 'warn' is Week-2/optional (Make.com webhooks, test segment cap).

const ENV_VARS = [
  // AI
  { name: 'ANTHROPIC_API_KEY', severity: 'critical', group: 'AI',
    note: 'Canonical (Master Reference Sheet §1). Do NOT use CLAUDE_API_KEY. Model: claude-sonnet-4-20250514.' },

  // Zoho CRM OAuth (metadata + data reads/writes)
  { name: 'ZOHO_CRM_CLIENT_ID',     severity: 'critical', group: 'Zoho' },
  { name: 'ZOHO_CRM_CLIENT_SECRET', severity: 'critical', group: 'Zoho' },
  { name: 'ZOHO_CRM_REFRESH_TOKEN', severity: 'critical', group: 'Zoho',
    note: 'Needs ZohoCRM.modules.READ/CREATE/UPDATE + ZohoCRM.settings.READ for metadata reconciliation.' },

  // Zoho Mail OAuth — canonical trio per Master Reference Sheet §1 (Zoho OAuth table).
  { name: 'ZOHO_MAIL_CLIENT_ID',     severity: 'critical', group: 'Zoho',
    note: 'Canonical (Master Reference Sheet). Design doc v1 used AMBASSADOR_MAIL_CLIENT_ID — alias, do not use.' },
  { name: 'ZOHO_MAIL_CLIENT_SECRET', severity: 'critical', group: 'Zoho',
    note: 'Canonical. Design doc v1 alias: AMBASSADOR_MAIL_CLIENT_SECRET.' },
  { name: 'ZOHO_MAIL_REFRESH_TOKEN', severity: 'critical', group: 'Zoho',
    note: 'Canonical. Design doc v1 alias: AMBASSADOR_MAIL_REFRESH_TOKEN. Scope: ZohoMail.messages.CREATE.' },
  // Mailbox identity — not an OAuth credential, no conflict; kept as-is.
  { name: 'AMBASSADOR_MAIL_ACCOUNT_ID',  severity: 'critical', group: 'Zoho',
    note: 'Zoho Mail account ID for ambassadors@gracelyn.edu.' },
  { name: 'AMBASSADOR_MAIL_FROM_ADDRESS', severity: 'critical', group: 'Zoho',
    note: 'Must be ambassadors@gracelyn.edu. Plain-text sends only — never HTML.' },

  // Zoho WorkDrive OAuth — brand asset reads (Folder 08).
  { name: 'ZOHO_WORKDRIVE_CLIENT_ID',     severity: 'critical', group: 'Zoho' },
  { name: 'ZOHO_WORKDRIVE_CLIENT_SECRET', severity: 'critical', group: 'Zoho' },
  { name: 'ZOHO_WORKDRIVE_REFRESH_TOKEN', severity: 'critical', group: 'Zoho' },
  { name: 'WORKDRIVE_FOLDER_08_ID',       severity: 'critical', group: 'Zoho',
    note: 'Folder 08 — Brand Assets. Same canonical var as Agent 5A manifest.' },

  // CRM module resolution
  { name: 'PROSPECTS_MODULE_API_NAME', severity: 'critical', group: 'CRM',
    note: 'Confirmed live 2026-07-07: resolves to Ambassador_Leads. Still resolved live at runtime, never hardcoded.' },
  { name: 'PARA_DB_MODULE_NAME',       severity: 'warn', group: 'CRM',
    note: 'Not yet confirmed in Zoho as of this build. Run degrades (skips para DB population) if unresolved.' },
  { name: 'PARA_DB_TEST_SEGMENT_SIZE', severity: 'warn', group: 'CRM',
    note: 'Dr. Flippen sets. Default 5000 if absent, enforced in code regardless.' },
  { name: 'STUDENT_ALUMNI_MODULE',           severity: 'warn', group: 'CRM',
    note: 'Not yet confirmed in Zoho as of this build. Run degrades (skips student/alumni) if unresolved.' },
  { name: 'STUDENT_AMBASSADOR_STATUS_FIELD', severity: 'warn', group: 'CRM' },

  // Email templates — six template pairs, Parmeet writes copy, Agent 1A never does.
  { name: 'AGENT1A_SEQ1_PARA_SUBJECT',     severity: 'critical', group: 'Templates' },
  { name: 'AGENT1A_SEQ1_PARA_BODY',        severity: 'critical', group: 'Templates' },
  { name: 'AGENT1A_SEQ2_PARA_SUBJECT',     severity: 'critical', group: 'Templates' },
  { name: 'AGENT1A_SEQ2_PARA_BODY',        severity: 'critical', group: 'Templates' },
  { name: 'AGENT1A_SEQ1_PROSPECT_SUBJECT', severity: 'critical', group: 'Templates' },
  { name: 'AGENT1A_SEQ1_PROSPECT_BODY',    severity: 'critical', group: 'Templates' },
  { name: 'AGENT1A_SEQ2_PROSPECT_SUBJECT', severity: 'critical', group: 'Templates' },
  { name: 'AGENT1A_SEQ2_PROSPECT_BODY',    severity: 'critical', group: 'Templates' },
  { name: 'AGENT1A_SEQ1_STUDENT_SUBJECT',  severity: 'critical', group: 'Templates' },
  { name: 'AGENT1A_SEQ1_STUDENT_BODY',     severity: 'critical', group: 'Templates' },
  { name: 'AGENT1A_SEQ2_STUDENT_SUBJECT',  severity: 'critical', group: 'Templates' },
  { name: 'AGENT1A_SEQ2_STUDENT_BODY',     severity: 'critical', group: 'Templates' },

  // Make.com — Week 2 gate, warn so Week 1 builds don't block on these.
  { name: 'MAKE_AGENT1A_WEBHOOK_URL',           severity: 'warn', group: 'Make.com' },
  { name: 'MAKE_AGENT1A_FROM_1D_WEBHOOK_URL',   severity: 'warn', group: 'Make.com',
    note: 'Agent 1D handoff trigger (lead_capture_new_contact mode).' },
  { name: 'MAKE_COORDINATOR_SUMMARY_WEBHOOK_URL', severity: 'warn', group: 'Make.com' },

  // Alert routing — canonical per Master Reference Sheet §1 Alert emails.
  { name: 'PARMEET_ALERT_EMAIL', severity: 'critical', group: 'Alerts' },
  { name: 'SUPPORT_COORDINATOR_EMAIL', severity: 'critical', group: 'Alerts',
    note: 'Canonical (Master Reference Sheet + Agent 5A manifest). Design doc v1 alias: COORDINATOR_ALERT_EMAIL — do not use.' },
];

// ─── CRM module ────────────────────────────────────────────────────────────────
const CRM_MODULES = [
  { envVar: 'PROSPECTS_MODULE_API_NAME', label: 'Ambassador_Leads', key: 'prospects', severity: 'critical',
    note: 'Design doc calls this "Prospects"; the live/only module is Ambassador_Leads (Agent 0\'s module).' },
  { envVar: 'PARA_DB_MODULE_NAME',       label: 'Paraprofessional DB', key: 'paraDb',       severity: 'warn' },
  { envVar: 'STUDENT_ALUMNI_MODULE',     label: 'Student / Alumni',   key: 'studentAlumni', severity: 'warn' },
];

// ─── CRM fields Agent 1A reads/writes on Ambassador_Leads (Prospects) ─────────
// `existing: true` fields were already created by Agent 0 or ship with the
// module. `existing: false` fields must be created live before Agent 1A can
// run in agent0_complete mode (created live 2026-07-07 — see DEPLOY.md).
const PROSPECT_FIELDS = [
  { api: 'Name',              type: 'text',     existing: true,  docName: 'First_Name' },
  { api: 'Last_Name',         type: 'text',     existing: true },
  { api: 'Email',             type: 'email',    existing: true },
  { api: 'Company_Name',      type: 'text',     existing: true,  docName: 'Organization' },
  { api: 'Title',             type: 'text',     existing: true,  docName: 'Role_Title' },
  { api: 'Channel_Source',    type: 'picklist', existing: true },
  { api: 'Motivation_Tag',    type: 'picklist', existing: true,  docName: 'Motivation_Hypothesis' },
  { api: 'Role_Category',     type: 'text',     existing: true,  docName: 'Ambassador_Role_Category' },
  { api: 'Contact_Found',     type: 'boolean',  existing: true },
  { api: 'VIP_Prospect',      type: 'boolean',  existing: true,  docName: 'VIP_Flag', coordination: true,
    note: 'VIP suppression filter. VIP_Prospect=true records are NEVER routed to recruiting.' },
  { api: 'Outreach_Status',   type: 'picklist', existing: true,  coordination: true,
    note: 'Shared lifecycle field with Agent 0. Extended live with 4 new picklist values — see OUTREACH_STATUS_LIFECYCLE_VALUES.' },
  { api: 'Sequence_Email_1_Sent',      type: 'boolean', existing: false },
  { api: 'Sequence_Email_1_Sent_Date', type: 'date',    existing: false },
  { api: 'Sequence_Email_2_Sent',      type: 'boolean', existing: false },
  { api: 'Sequence_Email_2_Sent_Date', type: 'date',    existing: false },
  { api: 'Recruiting_Source',  type: 'text', existing: false,
    note: 'Set to "Agent 1A" on first send. Read by Agent 2 at onboarding.' },
  { api: 'Recruiting_Channel', type: 'text', existing: false,
    note: 'Set to "Email Sequence" on first send. Read by Agent 2 at onboarding.' },
];

// The value Agent 0 set for a not-yet-VIP, not-yet-contacted prospect. Agent 1A's
// "new prospect ready for outreach" query uses THIS value, not the doc's "Identified"
// (which does not exist on the live picklist).
const OUTREACH_STATUS_NEW_PROSPECT_VALUE = 'Standard';
const OUTREACH_STATUS_VIP_VALUE = 'VIP Pipeline';

// Four lifecycle values Agent 1A adds to the existing Outreach_Status picklist.
const OUTREACH_STATUS_LIFECYCLE_VALUES = ['Outreach Sent', 'Follow-Up Sent', 'Unresponsive', 'Applied'];

// ─── Sequencing windows (design doc §4, §7) ───────────────────────────────────
const FOLLOWUP_WINDOW_DAYS = 7;
const UNRESPONSIVE_WINDOW_DAYS = 14;

// ─── The three silent-failure coordination points (CLAUDE.md) ────────────────
// Agent 1A's stake in each: #1 (ROLE_CATEGORY story header) not touched by 1A.
// #2 (nine Support Tickets SLA fields) not touched by 1A. #3 (Escalation_Timestamp)
// not touched by 1A. Agent 1A's OWN coordination points are VIP_Prospect and
// Outreach_Status, shared with Agent 0 — listed above with coordination:true.

module.exports = {
  ENV_VARS,
  CRM_MODULES,
  PROSPECT_FIELDS,
  OUTREACH_STATUS_NEW_PROSPECT_VALUE,
  OUTREACH_STATUS_VIP_VALUE,
  OUTREACH_STATUS_LIFECYCLE_VALUES,
  FOLLOWUP_WINDOW_DAYS,
  UNRESPONSIVE_WINDOW_DAYS,
};
