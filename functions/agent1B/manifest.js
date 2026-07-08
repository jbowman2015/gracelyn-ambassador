'use strict';

/**
 * Agent 1B — Social Outreach Agent (Recruiting) — canonical spec.
 *
 * Mirrors functions/agent5A/manifest.js and functions/agent1A/manifest.js:
 * this file is the single source of truth for Agent 1B's environment
 * variables and the CRM fields/modules it reads and writes. Per
 * ClaudeCode_Zoho_API_Names_Instruction, module/field API names here are
 * RECONCILED against live Zoho metadata (confirmed 2026-07-08), not
 * transcribed blindly from Gracelyn_Agent_1B_Social_Outreach_v2.md.
 *
 * ─── Divergences from the design doc, confirmed live 2026-07-08 ───────────
 *
 * 1. Prospects module: the doc calls it "Prospects module" generically (§2.2,
 *    §4.2 Step 4). It is the SAME module Agent 0 and Agent 1A use: api_name
 *    `Ambassador_Leads`. There is no separate "Prospects" module in the org.
 *    PROSPECTS_MODULE_API_NAME resolves to Ambassador_Leads, confirmed live
 *    via GET /crm/v6/settings/modules (same call agent1A made 2026-07-07).
 * 2. Doc's `VIP_Flag` does not exist (§2.1 VIP Prospect Rule box, §4.2 Step
 *    5.1). Agent 0 created `VIP_Prospect` (boolean) for the same purpose —
 *    same divergence agent1A already documented. Agent 1B's VIP suppression
 *    filter MUST use VIP_Prospect, never VIP_Flag.
 * 3. Outreach_Status (shared picklist, coordination point with Agent 0 and
 *    Agent 1A) already has 7 live values: -None-, Standard, VIP Pipeline,
 *    Outreach Sent, Follow-Up Sent, Unresponsive, Applied — but NOT the doc's
 *    `Identified` (§4.2 Step 4) or a value for VIP pipeline Stage 4
 *    completion (§5 table: "Agent 1B updates the prospect CRM record status
 *    to Converted"). Per agent1A's precedent (extend, don't fork), Agent 1B
 *    writes `Standard` for the doc's "Identified" state (same mapping 1A
 *    already established) and this build EXTENDED the live picklist with a
 *    new `Converted` value via updateField (2026-07-08) rather than creating
 *    a second status field — see DEPLOY.md.
 * 4. Doc's `VIP_Prospect_Pipeline_Stage` (§2.2 WRITES TO row) does not exist.
 *    The live field Agent 0 created is `VIP_Pipeline_Stage` (picklist) with
 *    values -None-, Warm Follow, Personal Outreach, Ambassador Invitation,
 *    VIP Onboarding, Declined, Inactive — these map directly onto the doc's
 *    Stage 1–5 names (§5 table), confirmed live 2026-07-08. Agent 1B READS
 *    this field to find Stage 1 ("Warm Follow") accounts and Stage 4 ("VIP
 *    Onboarding") conversions; it never writes to it (design doc §5: "Agent
 *    1B never advances a pipeline stage autonomously").
 * 5. Doc's "12-month re-approach suppression flag" (§5 table, Stage 5) is NOT
 *    a new field. Agent 0 already created `Prospect_Declined_Date` (date) for
 *    the same VIP-decline concept. Rather than fork a second flag/date field,
 *    Agent 1B computes the 12-month suppression window from the existing
 *    `Prospect_Declined_Date` in code — see criteria.js `isReapproachSuppressed`.
 * 6. `High_Engagement_Flag` (doc §4.2 Step 5) did NOT exist. Created live as a
 *    new boolean field on Ambassador_Leads, 2026-07-08 (field id
 *    4849477000258337026) — scoped to Agent 1B only, following the same
 *    live-creation-then-document pattern Agent 1A used for its six fields.
 * 7. `SOCIAL_POST_LOG_MODULE_API_NAME` — the Master Reference Sheet §4 lists
 *    this module as "(new)" and unconfirmed (⬜). Confirmed live 2026-07-08:
 *    it does NOT exist in the org (GET /crm/v6/settings/modules has no
 *    Social Post Log / Social_Post_Log module). Unlike the missing fields
 *    above, creating a brand-new custom module is a bigger, less-reversible
 *    action than adding a field to an existing module, and — unlike
 *    High_Engagement_Flag or the Outreach_Status picklist value — was not
 *    pre-authorized for this build. Agent 1B resolves it live like every
 *    other module and DEGRADES GRACEFULLY if unresolved, the same pattern
 *    Agent 1A used for the unconfirmed Para DB / Student-Alumni modules:
 *    the post cycle still posts (the primary function) and logs/alerts that
 *    compliance logging was skipped, rather than blocking posting or silently
 *    creating org structure Agent 4's own developer hasn't specified fields
 *    for yet. This is a real Week 1 gap, not a design choice to gloss over —
 *    see DEPLOY.md "Still open."
 * 8. WorkDrive folder env vars: the doc uses `WORKDRIVE_FOLDER_02/07/08/09`
 *    (§12, no `_ID` suffix). Agent 0's manifest.js already established the
 *    canonical convention `WORKDRIVE_FOLDER_0N_ID` (with the doc's un-suffixed
 *    name as a recognized alias) — Agent 1B follows that same convention for
 *    consistency across all agents sharing these folders.
 * 9. `VIP_RELATIONSHIP_MANAGER_EMAIL` (doc §12) is an alias for the Master
 *    Reference Sheet's own canonical `VIP_MANAGER_EMAIL` (§1 Alert emails
 *    row) — same concept (email of the VIP Relationship Manager), two names
 *    across the two documents. Per the reconciliation instruction, this
 *    build picks ONE canonical name: `VIP_MANAGER_EMAIL` (Master Reference
 *    Sheet is the cross-agent coordination document). Do not use
 *    `VIP_RELATIONSHIP_MANAGER_EMAIL`.
 * 10. `PARMEET_ALERT_EMAIL` — no conflict for 1B; the doc names this directly
 *     and it matches the Master Reference Sheet's own canonical spelling.
 *     (Agent 1A separately resolved its own `SUPPORT_COORDINATOR_EMAIL` vs
 *     `COORDINATOR_ALERT_EMAIL` conflict — a different variable, not reused
 *     here.)
 * 11. Zoho Social: the doc's sample code (§1.1) reads `ZOHO_SOCIAL_ACCESS_TOKEN`
 *     directly (no client id/secret/refresh-token OAuth trio, unlike CRM/
 *     WorkDrive/Mail) — Zoho Social is documented as using "its own OAuth
 *     token for read-only monitoring", supplied as a ready token, not
 *     refreshed by this function. Kept as-is; paired with
 *     `ZOHO_SOCIAL_PORTAL_ID` (Master Reference Sheet §1).
 */

// ─── Environment variables ────────────────────────────────────────────────────
// Each entry: { name, severity, group, note? }. 'critical' blocks the run mode
// that depends on it from proceeding; 'warn' degrades that specific capability
// (logged + alerted) without aborting the whole cycle.

const ENV_VARS = [
  // AI — shared key, do not generate a separate one (design doc §12 note).
  { name: 'ANTHROPIC_API_KEY', severity: 'critical', group: 'AI',
    note: 'Canonical (Master Reference Sheet §1). Shared with other agents. Model: claude-sonnet-4-20250514.' },

  // Zoho CRM OAuth (metadata + data reads/writes) — Prospects + Social Post Log.
  { name: 'ZOHO_CRM_CLIENT_ID',     severity: 'critical', group: 'Zoho' },
  { name: 'ZOHO_CRM_CLIENT_SECRET', severity: 'critical', group: 'Zoho' },
  { name: 'ZOHO_CRM_REFRESH_TOKEN', severity: 'critical', group: 'Zoho',
    note: 'Needs ZohoCRM.modules.READ/CREATE/UPDATE + ZohoCRM.settings.READ for metadata reconciliation.' },

  // Zoho WorkDrive OAuth — Folders 02 (assets), 07 (gap report), 08 (brand), 09 (VIP briefings).
  { name: 'ZOHO_WORKDRIVE_CLIENT_ID',     severity: 'critical', group: 'Zoho' },
  { name: 'ZOHO_WORKDRIVE_CLIENT_SECRET', severity: 'critical', group: 'Zoho' },
  { name: 'ZOHO_WORKDRIVE_REFRESH_TOKEN', severity: 'critical', group: 'Zoho' },
  { name: 'WORKDRIVE_FOLDER_02_ID', severity: 'critical', group: 'Zoho',
    note: 'Folder 02 — Approved Social Content. Doc alias (no _ID suffix): WORKDRIVE_FOLDER_02 — do not use, matches Agent 0\'s convention.' },
  { name: 'WORKDRIVE_FOLDER_07_ID', severity: 'warn', group: 'Zoho',
    note: 'Folder 07 — Gap Reports. Missing/empty degrades gracefully (design doc §9): intelligence cycle runs with default community config + alert.' },
  { name: 'WORKDRIVE_FOLDER_08_ID', severity: 'critical', group: 'Zoho',
    note: 'Folder 08 — Brand Assets (copy rules + voice guidelines). Missing halts the post cycle (design doc §9).' },
  { name: 'WORKDRIVE_FOLDER_09_ID', severity: 'warn', group: 'Zoho',
    note: 'Folder 09 — VIP Prospect Briefings, read-only. Missing/empty degrades: no Stage 1 warm-follow monitoring that cycle.' },

  // Zoho Social — read-only engagement monitoring on Gracelyn's own posted content.
  { name: 'ZOHO_SOCIAL_ACCESS_TOKEN', severity: 'warn', group: 'Social',
    note: 'Doc §1.1: used directly, no refresh flow. Missing degrades: engagement-flag step (§4.2 Step 5) skipped + alerted.' },
  { name: 'ZOHO_SOCIAL_PORTAL_ID', severity: 'warn', group: 'Social' },

  // Ayrshare — the only posting path (never post via Graph/LinkedIn API directly).
  { name: 'AYRSHARE_API_KEY', severity: 'critical', group: 'Social',
    note: 'Static API key, no refresh. All LinkedIn/Facebook/Instagram posting goes through Ayrshare.' },

  // Read-only community monitoring tokens (intelligence cycle only).
  { name: 'FACEBOOK_READ_TOKEN', severity: 'warn', group: 'Social',
    note: 'Read-only, community monitoring only — never used to post. Missing degrades: Facebook community search skipped that cycle + alerted.' },
  { name: 'LINKEDIN_READ_TOKEN', severity: 'warn', group: 'Social',
    note: 'Read-only, community monitoring only — never used to post. Missing degrades: LinkedIn community search skipped that cycle + alerted.' },

  // CRM module resolution.
  { name: 'PROSPECTS_MODULE_API_NAME', severity: 'critical', group: 'CRM',
    note: 'Confirmed live 2026-07-08: resolves to Ambassador_Leads (same module Agent 0/1A use). Still resolved live at runtime, never hardcoded.' },
  { name: 'SOCIAL_POST_LOG_MODULE_API_NAME', severity: 'warn', group: 'CRM',
    note: 'NOT confirmed in Zoho as of this build (Master Reference Sheet §4, ⬜) — module does not exist live. Post cycle degrades: posts still go out, the per-platform CRM log write is skipped + alerted + included in run summary. See manifest.js divergence #7 and DEPLOY.md.' },

  // Mission keyword matching (§5.1) — Parmeet-maintained, comma-separated.
  { name: 'MISSION_KEYWORDS', severity: 'critical', group: 'Policy',
    note: 'Comma-separated. Parmeet updates without touching code (design doc §5.1 NOTE box).' },

  // Make.com outbound webhooks Agent 1B actually POSTs to.
  { name: 'MAKE_VIP_WARM_FOLLOW_WEBHOOK', severity: 'warn', group: 'Make.com',
    note: 'Scenario 3 — warm follow engagement alert (CRM task, not email). Week 2 gate, warn so Week 1 build doesn\'t block.' },
  { name: 'MAKE_LOW_CONTENT_WEBHOOK', severity: 'warn', group: 'Make.com',
    note: 'Scenario 4 — low content alert email to Parmeet.' },
  { name: 'MAKE_AGENT1B_RUN_SUMMARY_WEBHOOK', severity: 'warn', group: 'Make.com',
    note: 'Scenario 5 — weekly run summary. NOT in design doc §12 (a real gap in the doc — Scenario 5 is specified in §8 but has no corresponding env var listed). Name inferred following the MAKE_<AGENT>_<PURPOSE>_WEBHOOK convention used elsewhere in this doc and Agent 1A\'s MAKE_COORDINATOR_SUMMARY_WEBHOOK_URL. Confirm the exact name with Parmeet/the Agent 0 developer before Week 2 — see DEPLOY.md.' },
  { name: 'MAKE_AGENT1B_INTELLIGENCE_WEBHOOK', severity: 'warn', group: 'Make.com',
    note: 'Scenario 2 trigger registration (Make.com calls INTO Agent 1B) — informational only, not something this code POSTs to. Same pattern as Agent 1A\'s MAKE_AGENT1A_WEBHOOK_URL.' },
  { name: 'MAKE_AGENT1B_ALERT_WEBHOOK', severity: 'warn', group: 'Make.com',
    note: 'General Parmeet ops-alert channel: token refresh failure, brand asset missing, Ayrshare post failure, Claude non-JSON captions, gap report missing. NOT in design doc §12 — another real gap: §6\'s "Post failure alert" and §9\'s token-refresh/brand-asset/Claude rows all say "alert Parmeet" but no Make.com Scenario or webhook var is specified for them anywhere in §8/§12 (only Warm Follow, Low Content, and Run Summary have named scenarios). Modeled on Agent 0\'s MAKE_ADMIN_ALERT_WEBHOOK_URL, since Agent 1B — like Agent 0 — has no direct mail credential of its own. Confirm the exact name/scenario with Parmeet before Week 2.' },

  // Alerts.
  { name: 'PARMEET_ALERT_EMAIL', severity: 'critical', group: 'Alerts',
    note: 'Canonical, matches Master Reference Sheet + design doc §12 directly. No alias conflict for 1B.' },
  { name: 'VIP_MANAGER_EMAIL', severity: 'warn', group: 'Alerts',
    note: 'Canonical (Master Reference Sheet §1). Doc v2 §12 alias: VIP_RELATIONSHIP_MANAGER_EMAIL — do not use. Used for informational context only; the warm-follow CRM task itself is assigned by Make.com Scenario 3, not this code.' },
];

// ─── CRM modules ────────────────────────────────────────────────────────────────
const CRM_MODULES = [
  { envVar: 'PROSPECTS_MODULE_API_NAME', label: 'Ambassador_Leads', key: 'prospects', severity: 'critical',
    note: 'Design doc calls this "Prospects"; the live/only module is Ambassador_Leads (Agent 0\'s module, shared with Agent 1A).' },
  { envVar: 'SOCIAL_POST_LOG_MODULE_API_NAME', label: 'Social Post Log', key: 'socialPostLog', severity: 'warn',
    note: 'Not confirmed live as of this build (2026-07-08). Post cycle degrades if unresolved — see manifest.js divergence #7.' },
];

// ─── CRM fields Agent 1B reads/writes on Ambassador_Leads (Prospects) ─────────
// `existing: true` fields were already created by Agent 0/1A. `existing: false`
// fields must be created live before Agent 1B can run (created live 2026-07-08
// — see DEPLOY.md).
const PROSPECT_FIELDS = [
  { api: 'Name',                type: 'text',     existing: true, docName: 'name (if public)' },
  { api: 'Social_Profile_URL',  type: 'website',  existing: true, coordination: true,
    note: 'Dedup key for community-monitoring discoveries (design doc §4.2 Step 3).' },
  { api: 'Channel_Source',      type: 'picklist', existing: true },
  { api: 'Contact_Found',       type: 'boolean',  existing: true, note: 'Always false for social-discovered prospects (no email yet).' },
  { api: 'Role_Category',       type: 'text',     existing: true },
  { api: 'VIP_Prospect',        type: 'boolean',  existing: true, docName: 'VIP_Flag', coordination: true,
    note: 'VIP suppression filter. VIP_Prospect=true accounts are NEVER routed to standard prospecting — see manifest.js divergence #2.' },
  { api: 'VIP_Pipeline_Stage',  type: 'picklist', existing: true, docName: 'VIP_Prospect_Pipeline_Stage', coordination: true,
    note: 'READ ONLY for Agent 1B. Stage 1 = "Warm Follow" (monitoring target), Stage 4 = "VIP Onboarding" (triggers Converted write). See manifest.js divergence #4.' },
  { api: 'Prospect_Declined_Date', type: 'date', existing: true, coordination: true,
    note: 'Reused for the Stage 5 12-month re-approach suppression window — see manifest.js divergence #5.' },
  { api: 'Outreach_Status',     type: 'picklist', existing: true, coordination: true,
    note: 'Shared lifecycle field with Agent 0/1A. Extended live 2026-07-08 with a new "Converted" value — see manifest.js divergence #3.' },
  { api: 'High_Engagement_Flag', type: 'boolean', existing: false,
    note: 'Created live 2026-07-08 (field id 4849477000258337026). Set true for educators with high engagement on Gracelyn content (design doc §4.2 Step 5).' },
];

// The value Agent 1A/Agent 0 use for a not-yet-VIP, not-yet-contacted prospect.
// Agent 1B writes THIS value for newly-discovered prospects, not the doc's
// "Identified" (which does not exist on the live picklist) — matches Agent 1A's
// established mapping exactly (shared coordination point).
const OUTREACH_STATUS_NEW_PROSPECT_VALUE = 'Standard';
const OUTREACH_STATUS_CONVERTED_VALUE = 'Converted';

// VIP_Pipeline_Stage values (confirmed live 2026-07-08) mapped onto design doc §5's stages.
const VIP_STAGE_WARM_FOLLOW = 'Warm Follow';       // Stage 1
const VIP_STAGE_ONBOARDING = 'VIP Onboarding';     // Stage 4
const VIP_STAGE_DECLINED = 'Declined';             // Stage 5

// Design doc §5.1: max one warm-follow alert per VIP Prospect per week. The
// Intelligence Cycle itself only runs weekly (triggered by Agent 0's weekly
// complete webhook), so a per-run cap is sufficient as long as the cycle
// isn't manually re-triggered more than once in the same week — see
// DEPLOY.md "Still open" #2 for this documented assumption.
const MAX_WARM_FOLLOW_ALERTS_PER_PROSPECT_PER_RUN = 1;

// Design doc §5 Stage 5: 12-month re-approach suppression from Prospect_Declined_Date.
const REAPPROACH_SUPPRESSION_DAYS = 365;

// Brand assets required for caption generation (design doc §3.3 — only these
// two; unlike Agent 1A's four-file Folder 08 read).
const COPY_RULES_FILE = 'ambassador_copy_rules.txt';
const VOICE_GUIDELINES_FILE = 'ambassador_voice_guidelines.txt';
const BRAND_ASSET_FILES = [COPY_RULES_FILE, VOICE_GUIDELINES_FILE];

// Design doc §9 "Gap report missing from Folder 07": default community
// config, drawn from the audience categories named throughout the doc
// (§2.1, §4.2 Step 2) since no other default list is specified.
const DEFAULT_COMMUNITIES = ['K-12 Educators', 'Early Childhood Educators', 'Faith Community Leaders', 'Youth-Serving Advocates'];

// ─── The three silent-failure coordination points (CLAUDE.md) ────────────────
// Agent 1B's stake: none of the three directly (ROLE_CATEGORY story header,
// nine SLA fields, Escalation_Timestamp — all Agent 3/4/5/6 concerns). Agent
// 1B's OWN coordination points are VIP_Prospect, VIP_Pipeline_Stage,
// Outreach_Status, and Prospect_Declined_Date — all shared with Agent 0/1A,
// listed above with coordination:true.

module.exports = {
  ENV_VARS,
  CRM_MODULES,
  PROSPECT_FIELDS,
  OUTREACH_STATUS_NEW_PROSPECT_VALUE,
  OUTREACH_STATUS_CONVERTED_VALUE,
  VIP_STAGE_WARM_FOLLOW,
  VIP_STAGE_ONBOARDING,
  VIP_STAGE_DECLINED,
  MAX_WARM_FOLLOW_ALERTS_PER_PROSPECT_PER_RUN,
  REAPPROACH_SUPPRESSION_DAYS,
  COPY_RULES_FILE,
  VOICE_GUIDELINES_FILE,
  BRAND_ASSET_FILES,
  DEFAULT_COMMUNITIES,
};
