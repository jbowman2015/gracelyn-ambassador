'use strict';

/**
 * Agent 0 — Research & Intelligence: canonical constants.
 *
 * The single source of truth for this agent's env-var names, the Prospects /
 * Ambassadors field API names it reads and writes, the VIP Prospect scoring
 * bands, and the controlled vocabularies (role categories, motivation tags,
 * gap types) shared downstream.
 *
 * Naming authority (per CLAUDE.md + ClaudeCode_Zoho_API_Names_Instruction):
 *   - CRM MODULE + FIELD api_names are authoritative in Zoho. The names below are
 *     the human cross-check reconciled in functions/agent5A/manifest.js; Agent 0
 *     resolves the module api_name live at run time and verifies these field
 *     names against Zoho's fields metadata (see zoho.js). A divergence is
 *     surfaced to Jessica, never papered over.
 *   - ENV-VAR names are the canonical strings from agent5A/manifest.js. Where the
 *     Agent 0 design doc used a different spelling, the doc name is accepted as a
 *     read-only ALIAS (see ENV.get) so nothing silently breaks, but the canonical
 *     name is what Agent 5A validates and what should be set in Catalyst.
 */

// ─── Environment variables (canonical primary, design-doc alias fallback) ─────
// Each: { key, aliases?, required, note? }. `required` is advisory metadata used
// by the preflight check; the run halts per the design doc's failure table.
const ENV_SPEC = [
  { key: 'ANTHROPIC_API_KEY', required: true, group: 'AI' },

  // Zoho CRM OAuth trio (records + metadata; token needs ZohoCRM.settings.READ).
  { key: 'ZOHO_CRM_CLIENT_ID', required: true, group: 'Zoho' },
  { key: 'ZOHO_CRM_CLIENT_SECRET', required: true, group: 'Zoho' },
  { key: 'ZOHO_CRM_REFRESH_TOKEN', required: true, group: 'Zoho' },

  // Zoho WorkDrive OAuth trio (read brand assets 08; write briefings 09, gaps 07).
  { key: 'ZOHO_WORKDRIVE_CLIENT_ID', required: true, group: 'Zoho' },
  { key: 'ZOHO_WORKDRIVE_CLIENT_SECRET', required: true, group: 'Zoho' },
  { key: 'ZOHO_WORKDRIVE_REFRESH_TOKEN', required: true, group: 'Zoho' },

  // WorkDrive folder IDs (canonical *_ID names; doc used the un-suffixed form).
  { key: 'WORKDRIVE_FOLDER_07_ID', aliases: ['WORKDRIVE_FOLDER_07'], required: true, group: 'WorkDrive',
    note: 'Analytics + gap reports.' },
  { key: 'WORKDRIVE_FOLDER_08_ID', aliases: ['WORKDRIVE_FOLDER_08'], required: true, group: 'WorkDrive',
    note: 'Brand assets (voice guidelines + mission statement).' },
  { key: 'WORKDRIVE_FOLDER_09_ID', aliases: ['WORKDRIVE_FOLDER_09'], required: true, group: 'WorkDrive',
    note: 'VIP Prospect briefings.' },

  // Behaviour / policy.
  { key: 'AGENT0_AUDIENCE_CONFIG', required: true, group: 'Config',
    note: 'JSON — audience categories, channels, role priorities. Jessica edits without code.' },
  { key: 'VIP_PROSPECT_SCORE_THRESHOLD', required: false, group: 'Config', note: 'Default 60.' },
  { key: 'AGENT0_RUN_MODE', required: false, group: 'Config', note: 'WEEKLY (default) | ON_DEMAND.' },
  { key: 'ANTHROPIC_MODEL', required: false, group: 'Config',
    note: 'Default claude-sonnet-4-20250514 (CLAUDE.md).' },

  // Make.com webhooks (canonical names; doc aliases accepted).
  { key: 'MAKE_VIP_NOTIFY_WEBHOOK_URL', aliases: ['MAKE_VIP_NOTIFICATION_WEBHOOK'], required: false, group: 'Make.com',
    note: 'Scenario 2 — VIP notification.' },
  { key: 'MAKE_AGENT0_COMPLETE_WEBHOOK_URL', aliases: ['MAKE_RECRUITING_TRIGGER_WEBHOOK'], required: false, group: 'Make.com',
    note: 'Scenario 3 — consolidated recruiting trigger.' },
  { key: 'MAKE_AGENT0_ONDEMAND_WEBHOOK_URL', required: false, group: 'Make.com',
    note: 'Scenario 4 — on-demand result callback (optional).' },

  // Alert routing. The program admin who receives Agent 0 error alerts is Jessica
  // (jessica.bowman@gracelyn.edu). Canonical name is role-neutral so it survives
  // staff changes; JESSICA_ALERT_EMAIL and the legacy PARMEET_ALERT_EMAIL (which
  // Agent 5A still validates) are accepted as aliases.
  { key: 'ADMIN_ALERT_EMAIL', aliases: ['JESSICA_ALERT_EMAIL', 'PARMEET_ALERT_EMAIL'], required: true, group: 'Alerts',
    note: 'Set to jessica.bowman@gracelyn.edu. Receives all Agent 0 error alerts.' },
  { key: 'VIP_MANAGER_EMAIL', aliases: ['VIP_RELATIONSHIP_MANAGER_EMAIL'], required: true, group: 'Alerts',
    note: 'Receives VIP briefing notifications.' },
  // Optional webhook used to deliver admin alert emails (else logged only).
  { key: 'MAKE_ADMIN_ALERT_WEBHOOK_URL', aliases: ['MAKE_PARMEET_ALERT_WEBHOOK_URL'], required: false, group: 'Alerts',
    note: 'Optional. If set, alert emails are POSTed here for delivery to the admin.' },

  // Phase-2 enrichment — stored but never called at launch.
  { key: 'APOLLO_API_KEY', required: false, group: 'Phase2', note: 'Dormant until Day 60 review.' },
  { key: 'HUNTER_API_KEY', required: false, group: 'Phase2', note: 'Dormant until Day 60 review.' },
];

/**
 * Resolve an env value by canonical key, then any documented alias.
 * Returns the trimmed value or '' when unset.
 */
function getEnv(key) {
  const spec = ENV_SPEC.find((e) => e.key === key);
  const names = [key, ...((spec && spec.aliases) || [])];
  for (const n of names) {
    const v = process.env[n];
    if (typeof v === 'string' && v.trim() !== '') return v.trim();
  }
  return '';
}

// ─── CRM: module + field API names (cross-check; verified live at run time) ────
const PROSPECTS_MODULE = { label: 'Prospects', envVar: 'PROSPECTS_MODULE_API_NAME' };
const AMBASSADORS_MODULE = { label: 'Ambassadors', envVar: 'AMBASSADORS_MODULE_API_NAME' };

// Fields Agent 0 writes on a Prospect upsert (Step 10). Kept in sync with
// agent5A/manifest.js CRM_FIELDS.prospects.
//
// Reconciled live against the Ambassador_Leads module (2026-07-07). Two fields map
// to existing columns instead of duplicating: `First_Name` -> `Name` (display label
// "First Name") and `Organization` -> `Company_Name`. The other 13 were created live
// on Ambassador_Leads this date; api_names below match what Zoho generated. Note the
// VIP pipeline field was created with the label "VIP Pipeline Stage" (the 27-char
// "VIP Prospect Pipeline Stage" exceeded the field-label limit), so its api_name is
// `VIP_Pipeline_Stage`. `Outreach_Status` is now its own dedicated picklist field
// (values: Standard, VIP Pipeline). `Role_Category` was created as text (two role
// values exceeded the 25-char picklist-option limit); the Claude assessment prompt
// still constrains the written values to the controlled role vocabulary.
const PROSPECT_FIELDS = {
  dedupKey: 'Social_Profile_URL',
  firstName: 'Name',              // existing field (label "First Name"); not First_Name
  lastName: 'Last_Name',
  email: 'Email',
  organization: 'Company_Name',   // existing field; not Organization
  channelSource: 'Channel_Source',
  outreachStatus: 'Outreach_Status',
  contactFound: 'Contact_Found',
  gapType: 'Gap_Type',
  roleCategory: 'Role_Category',
  motivationTag: 'Motivation_Tag',
  missionAlignmentScore: 'Mission_Alignment_Score',
  orgInfluenceScore: 'Org_Influence_Score',
  vipProspect: 'VIP_Prospect',
  vipProspectScore: 'VIP_Prospect_Score',
  vipPipelineStage: 'VIP_Pipeline_Stage',   // created label "VIP Pipeline Stage"
  prospectDeclinedDate: 'Prospect_Declined_Date',
};

// VIP pipeline picklist values (design §3.2 / §3.4).
const VIP_PIPELINE_STAGES = {
  warmFollow: 'Warm Follow',
  personalOutreach: 'Personal Outreach',
  ambassadorInvitation: 'Ambassador Invitation',
  vipOnboarding: 'VIP Onboarding',
  declined: 'Declined',
  inactive: 'Inactive',
};

// ─── VIP Prospect scoring (design §3.1) ───────────────────────────────────────
const DEFAULT_VIP_THRESHOLD = 60;

// Audience reach is computed in code from a follower/subscriber count (Claude
// scores the other two dimensions). Bands are [minFollowers, points], high→low.
const AUDIENCE_REACH_BANDS = [
  { min: 50000, points: 40 },
  { min: 20000, points: 30 },
  { min: 10000, points: 20 },
  { min: 5000, points: 10 },
  { min: 0, points: 0 },
];
const MAX_AUDIENCE_REACH = 40;
const MAX_ORG_INFLUENCE = 30;
const MAX_MISSION_ALIGNMENT = 30;

// ─── Controlled vocabularies (from the Claude assessment prompt enums) ────────
const MOTIVATION_TAGS = [
  'Professional Growth', 'Mission Impact', 'Kingdom Calling',
  'Problem Solver', 'Community Recognition',
];
const ROLE_CATEGORIES = [
  'K12 Educator', 'Early Childhood', 'Faith Community',
  'Youth Serving Professional', 'Mission Aligned Influencer', 'Gracelyn Community',
];

// Gap types written for the gap report (Step 12).
const GAP_TYPES = {
  noEmail: 'No_Email',
  noPublicProfile: 'No_Public_Profile',
  parseError: 'Parse_Error',
  lowMissionAlignment: 'Low_Mission_Alignment',
};

// Safe defaults applied when Claude returns non-JSON (design §9).
const SAFE_ASSESSMENT_DEFAULTS = {
  motivationHypothesis: '',
  motivationRationale: '',
  roleCategory: '',
  missionAlignmentScore: 0,
  orgInfluenceScore: 0,
  notes: 'Claude assessment could not be parsed — safe defaults applied.',
};

// VIP briefing section headers, in order (design §3.3).
const BRIEFING_SECTIONS = [
  'WHO THIS IS', 'AUDIENCE AND REACH', 'WHY THEY ARE A FIT',
  'THEIR MOST RESONANT RECENT CONTENT', 'SUGGESTED FIRST-TOUCH APPROACH',
  'POTENTIAL CONCERNS', 'CRM RECORD LINK',
];

// Brand asset filenames expected in WorkDrive Folder 08 (design Step 2).
const BRAND_ASSETS = {
  voiceGuidelines: 'voice_guidelines.txt',
  missionStatement: 'mission_statement.txt',
};

module.exports = {
  ENV_SPEC,
  getEnv,
  PROSPECTS_MODULE,
  AMBASSADORS_MODULE,
  PROSPECT_FIELDS,
  VIP_PIPELINE_STAGES,
  DEFAULT_VIP_THRESHOLD,
  AUDIENCE_REACH_BANDS,
  MAX_AUDIENCE_REACH,
  MAX_ORG_INFLUENCE,
  MAX_MISSION_ALIGNMENT,
  MOTIVATION_TAGS,
  ROLE_CATEGORIES,
  GAP_TYPES,
  SAFE_ASSESSMENT_DEFAULTS,
  BRIEFING_SECTIONS,
  BRAND_ASSETS,
};
