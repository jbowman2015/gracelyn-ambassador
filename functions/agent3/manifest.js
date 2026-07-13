'use strict';

/**
 * Agent 3 — Engagement: canonical constants.
 *
 * Single source of truth for this agent's env-var names, the Ambassadors /
 * Referrals field API names it reads and writes, the 30-Day Activation Sprint
 * schedule, the four-week content calendar, the Alternative track rotation,
 * and the dynamic VIP tier scoring model.
 *
 * Naming authority (per CLAUDE.md + ClaudeCode_Zoho_API_Names_Instruction):
 *   - CRM MODULE + FIELD api_names are authoritative in Zoho. `AMBASSADOR_FIELDS`
 *     and `REFERRAL_FIELDS` below are reconciled live (2026-07-10) against the
 *     `Ambassadors` and `Referrals` custom modules — see zoho.js verifyFields.
 *     Sixteen fields are new in this session, created live on `Ambassadors`:
 *     Activation_Sprint_Week, Sprint_Start_Date, Sprint_Referral_Submitted,
 *     Content_Week_Position, Engagement_Track, Days_Since_Last_Referral,
 *     Alt_Track_Entry_Date, Alternative_Track_Month, Re_Engagement_Attempt,
 *     Escalated_To_Human, VIP_Score, VIP_Tier, VIP_Tier_Previous,
 *     VIP_Tier_Upgrade_Date, Last_Engagement_Date, Last_Story_File_Used.
 *     Two diverge from the design doc's name because Zoho's 25-char field-label
 *     limit forced a shorter label (Zoho derives api_name from the label):
 *       design doc `Activation_Sprint_Start_Date` -> live `Sprint_Start_Date`
 *       design doc `Alternative_Track_Entry_Date` -> live `Alt_Track_Entry_Date`
 *     `Ambassador_Role_Category`, `Motivation_Tag`, and `VIP_Prospect_Origin` are
 *     Agent 2's fields (not yet created — Agent 2 is unbuilt); Agent 3 only reads
 *     them and degrades gracefully (empty/false) rather than failing when absent,
 *     with the gap surfaced in run summaries the same way Agent 0 surfaces gaps.
 *   - ENV-VAR names are the canonical strings from agent5A/manifest.js /
 *     Ambassador_Master_Reference_Sheet.md §1.
 */

// ─── Environment variables (canonical primary, design-doc alias fallback) ─────
const ENV_SPEC = [
  { key: 'ANTHROPIC_API_KEY', required: true, group: 'AI' },
  { key: 'ANTHROPIC_MODEL', required: false, group: 'AI', note: 'Default claude-sonnet-4-20250514 (CLAUDE.md).' },

  // Zoho CRM OAuth trio (records + metadata; token needs ZohoCRM.settings.READ).
  { key: 'ZOHO_CRM_CLIENT_ID', required: true, group: 'Zoho' },
  { key: 'ZOHO_CRM_CLIENT_SECRET', required: true, group: 'Zoho' },
  { key: 'ZOHO_CRM_REFRESH_TOKEN', required: true, group: 'Zoho' },

  // Zoho Mail OAuth trio — sends every sprint + standard-cycle email.
  { key: 'ZOHO_MAIL_CLIENT_ID', required: true, group: 'Zoho' },
  { key: 'ZOHO_MAIL_CLIENT_SECRET', required: true, group: 'Zoho' },
  { key: 'ZOHO_MAIL_REFRESH_TOKEN', required: true, group: 'Zoho' },
  { key: 'AMBASSADOR_MAIL_FROM_ADDRESS', required: false, group: 'Zoho',
    note: 'Default ambassadors@gracelyn.edu (design doc §1).' },

  // Zoho WorkDrive OAuth trio (Folder 05 story files, Folder 08 update brief).
  { key: 'ZOHO_WORKDRIVE_CLIENT_ID', required: true, group: 'Zoho' },
  { key: 'ZOHO_WORKDRIVE_CLIENT_SECRET', required: true, group: 'Zoho' },
  { key: 'ZOHO_WORKDRIVE_REFRESH_TOKEN', required: true, group: 'Zoho' },
  { key: 'WORKDRIVE_FOLDER_05_ID', required: true, group: 'WorkDrive', note: 'Story file buffer.' },
  { key: 'WORKDRIVE_FOLDER_08_ID', required: true, group: 'WorkDrive', note: 'Brand assets + update_brief.txt.' },

  // HeyGen — milestone recognition videos only (design doc §1).
  { key: 'HEYGEN_API_KEY', required: false, group: 'HeyGen' },
  { key: 'HEYGEN_TEMPLATE_ID', required: false, group: 'HeyGen' },
  { key: 'HEYGEN_FLIPPEN_AVATAR_ID', required: false, group: 'HeyGen', note: 'Canonical. Do NOT use HEYGEN_AVATAR_ID.' },

  // CRM module names (confirmed live 2026-07-10).
  { key: 'AMBASSADORS_MODULE_API_NAME', required: false, group: 'Config', note: 'Confirmed live: Ambassadors.' },
  { key: 'REFERRALS_MODULE_API_NAME', required: false, group: 'Config', note: 'Confirmed live: Referrals.' },

  // Policy thresholds (Ambassador_Master_Reference_Sheet.md §5).
  { key: 'SPRINT_GRADUATION_DAYS', required: false, group: 'Policy', note: 'Default 28. Do not set below 21.' },
  { key: 'NON_REFERRAL_DAYS_THRESHOLD', required: false, group: 'Policy', note: 'Default 90.' },
  { key: 'DORMANT_DAYS_THRESHOLD', required: false, group: 'Policy', note: 'Default 30.' },
  { key: 'VIP_POPULATION_THRESHOLD', required: false, group: 'Policy', note: 'Default 10000.' },
  { key: 'VIP_HIGH_PCT_SMALL', required: false, group: 'Policy', note: 'Default 2.5.' },
  { key: 'VIP_STD_PCT_SMALL', required: false, group: 'Policy', note: 'Default 5.' },
  { key: 'VIP_HIGH_PCT_LARGE', required: false, group: 'Policy', note: 'Default 0.5.' },
  { key: 'VIP_STD_PCT_LARGE', required: false, group: 'Policy', note: 'Default 2.5.' },
  { key: 'STORY_BUFFER_MINIMUM', required: false, group: 'Policy', note: 'Default 4.' },
  { key: 'WEEKLY_BATCH_SIZE', required: false, group: 'Policy', note: 'Default 100.' },

  // Make.com webhooks.
  { key: 'MAKE_AGENT3_WEBHOOK_URL', required: false, group: 'Make.com', note: 'Referral stage-change trigger source.' },
  { key: 'MAKE_AGENT3_ERROR_WEBHOOK', required: false, group: 'Make.com', note: 'Optional delivery for Parmeet alert emails.' },
  { key: 'MAKE_AGENT3_RECALC_COMPLETE_WEBHOOK', required: false, group: 'Make.com',
    note: "Fired by monthlyVipRecalculation on completion (population/scoredCount/upgradedCount). Routes via Make.com Scenario 3 to Agent 4 /vip-audit (design §5, Agent 4 HARD STOP #3) — same URL value as functions/agent4/manifest.js' informational note of the same key." },

  // Alert + role routing.
  { key: 'PARMEET_ALERT_EMAIL', required: true, group: 'Alerts', note: 'Canonical (matches agent5A/manifest.js). Receives all Agent 3 error alerts.' },
  { key: 'VIP_MANAGER_EMAIL', required: true, group: 'Alerts', note: 'High VIP personal outreach CRM tasks assigned here.' },
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

function getEnvInt(key, fallback) {
  const v = getEnv(key);
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function getEnvFloat(key, fallback) {
  const v = getEnv(key);
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

// ─── CRM: module + field API names (cross-check; verified live at run time) ───
const AMBASSADORS_MODULE = { label: 'Ambassadors', envVar: 'AMBASSADORS_MODULE_API_NAME' };
const REFERRALS_MODULE = { label: 'Referrals', envVar: 'REFERRALS_MODULE_API_NAME' };

// Fields Agent 3 reads and writes on Ambassadors (reconciled live 2026-07-10).
const AMBASSADOR_FIELDS = {
  id: 'id',
  firstName: 'First_Name',
  lastName: 'Name',              // this module's system "Name" field is relabeled "Last Name"
  email: 'Email',
  referralCode: 'Referral_Code',
  referralLink: 'Referral_Link',
  ambassadorStatus: 'Ambassador_Status',
  complianceComplete: 'Compliance_Complete',

  // Owned by Agent 2 (not yet created live — Agent 2 unbuilt). Read defensively.
  roleCategory: 'Ambassador_Role_Category',
  motivationTag: 'Motivation_Tag',
  vipProspectOrigin: 'VIP_Prospect_Origin',

  // Owned by Agent 3 — created live 2026-07-10.
  activationSprintWeek: 'Activation_Sprint_Week',
  sprintStartDate: 'Sprint_Start_Date',                 // design doc: Activation_Sprint_Start_Date
  sprintReferralSubmitted: 'Sprint_Referral_Submitted',
  contentWeekPosition: 'Content_Week_Position',
  engagementTrack: 'Engagement_Track',
  daysSinceLastReferral: 'Days_Since_Last_Referral',
  alternativeTrackEntryDate: 'Alt_Track_Entry_Date',    // design doc: Alternative_Track_Entry_Date
  alternativeTrackMonth: 'Alternative_Track_Month',
  reEngagementAttempt: 'Re_Engagement_Attempt',
  escalatedToHuman: 'Escalated_To_Human',
  vipScore: 'VIP_Score',
  vipTier: 'VIP_Tier',
  vipTierPrevious: 'VIP_Tier_Previous',
  vipTierUpgradeDate: 'VIP_Tier_Upgrade_Date',
  lastEngagementDate: 'Last_Engagement_Date',
  lastStoryFileUsed: 'Last_Story_File_Used',
};

// Fields Agent 3 reads on Referrals — no new fields needed (confirmed live 2026-07-10).
const REFERRAL_FIELDS = {
  ambassadorLookup: 'Ambassador',
  referralStage: 'Referral_Stage',
  applicationDate: 'Application_Date',
  enrollmentDate: 'Enrollment_Date',
  createdTime: 'Created_Time',
  modifiedTime: 'Modified_Time',
};

const REFERRAL_STAGE_VALUES = { applied: 'Applied', enrolled: 'Enrolled' };

const ENGAGEMENT_TRACK_VALUES = { sprint: 'Sprint', standard: 'Standard', alternative: 'Alternative', dormant: 'Dormant' };

const VIP_TIER_VALUES = { notVip: 'Not VIP', standardVip: 'Standard VIP', highVip: 'High VIP' };

// ─── 30-Day Activation Sprint (design §4) ──────────────────────────────────────
const SPRINT_WEEKS = [1, 2, 3, 4];
const DEFAULT_SPRINT_GRADUATION_DAYS = 28;
const MIN_SPRINT_GRADUATION_DAYS = 21;

function sprintGraduationDays() {
  const n = getEnvInt('SPRINT_GRADUATION_DAYS', DEFAULT_SPRINT_GRADUATION_DAYS);
  return n >= MIN_SPRINT_GRADUATION_DAYS ? n : DEFAULT_SPRINT_GRADUATION_DAYS;
}

// ─── Standard four-week content calendar (design §5.2) ─────────────────────────
const CONTENT_CALENDAR = [
  { week: 1, theme: 'Mission Moment' },
  { week: 2, theme: 'Success Story' },
  { week: 3, theme: 'Ambassador Spotlight' },
  { week: 4, theme: 'Program Update' },
];

// ─── Alternative track content rotation (design §5.4) ──────────────────────────
// Month is 1-indexed months-since-Alternative_Track_Entry_Date.
const ALTERNATIVE_CONTENT_TYPES = {
  storyInvitation: 'story_invitation',       // months 1,4,7,10
  experienceInvitation: 'experience_invitation', // months 2,5,8,11
  referralAsk: 'referral_ask',               // months 3,6,9,12
};
function alternativeContentTypeForMonth(month) {
  const m = ((Number(month) - 1) % 3 + 3) % 3; // 0,1,2 repeating
  if (m === 0) return ALTERNATIVE_CONTENT_TYPES.storyInvitation;
  if (m === 1) return ALTERNATIVE_CONTENT_TYPES.experienceInvitation;
  return ALTERNATIVE_CONTENT_TYPES.referralAsk;
}

// ─── Dynamic VIP tier system (design §6) ───────────────────────────────────────
const VIP_SCORING = {
  maxReferralActivity: 40,
  pointsPerReferral: 10,
  engagementBands: [
    { min: 80, points: 30 },
    { min: 50, points: 20 },
    { min: 25, points: 10 },
    { min: 0, points: 0 },
  ],
  tenureBands: [
    { minMonths: 24, points: 30 },
    { minMonths: 12, points: 20 },
    { minMonths: 6, points: 10 },
    { minMonths: 0, points: 0 },
  ],
  consecutiveVipBonus: 5,
  maxTenure: 30,
};

function vipPopulationThreshold() { return getEnvInt('VIP_POPULATION_THRESHOLD', 10000); }
function vipHighPctSmall() { return getEnvFloat('VIP_HIGH_PCT_SMALL', 2.5); }
function vipStdPctSmall() { return getEnvFloat('VIP_STD_PCT_SMALL', 5); }
function vipHighPctLarge() { return getEnvFloat('VIP_HIGH_PCT_LARGE', 0.5); }
function vipStdPctLarge() { return getEnvFloat('VIP_STD_PCT_LARGE', 2.5); }

function nonReferralDaysThreshold() { return getEnvInt('NON_REFERRAL_DAYS_THRESHOLD', 90); }
function dormantDaysThreshold() { return getEnvInt('DORMANT_DAYS_THRESHOLD', 30); }
function storyBufferMinimum() { return getEnvInt('STORY_BUFFER_MINIMUM', 4); }
function weeklyBatchSize() { return getEnvInt('WEEKLY_BATCH_SIZE', 100); }

// ─── Story file convention (Coordination Point #1 with Agent 6) ───────────────
// The second line of every story file in WorkDrive Folder 05 is a metadata
// header of the exact form `ROLE_CATEGORY: <value>`. This literal label
// ("ROLE_CATEGORY", uppercase, underscore) is the coordination contract with
// Agent 6 (Story Content Intake) — Agent 6's session must write this same
// label on the same line. See docs/planning/Agent_Build_Playbook.md Agent 6 entry.
const ROLE_CATEGORY_HEADER = 'ROLE_CATEGORY';
const ROLE_CATEGORY_ANY = 'Any';
const STORY_FILE_PREFIX = 'Story_';
const STORY_FILE_SUFFIX = '.txt';

// Shared controlled vocabulary (must match Agent 0's Prospects vocabulary —
// role category flows Prospect -> Ambassador at Agent 2 approval).
const ROLE_CATEGORIES = [
  'K12 Educator', 'Early Childhood', 'Faith Community',
  'Youth Serving Professional', 'Mission Aligned Influencer', 'Gracelyn Community',
];
const MOTIVATION_TAGS = [
  'Professional Growth', 'Mission Impact', 'Kingdom Calling',
  'Problem Solver', 'Community Recognition',
];

// Brand asset filename expected in WorkDrive Folder 08 (design §5.2 Week 4).
const UPDATE_BRIEF_FILENAME = 'update_brief.txt';

module.exports = {
  ENV_SPEC,
  getEnv,
  getEnvInt,
  getEnvFloat,
  AMBASSADORS_MODULE,
  REFERRALS_MODULE,
  AMBASSADOR_FIELDS,
  REFERRAL_FIELDS,
  REFERRAL_STAGE_VALUES,
  ENGAGEMENT_TRACK_VALUES,
  VIP_TIER_VALUES,
  SPRINT_WEEKS,
  DEFAULT_SPRINT_GRADUATION_DAYS,
  MIN_SPRINT_GRADUATION_DAYS,
  sprintGraduationDays,
  CONTENT_CALENDAR,
  ALTERNATIVE_CONTENT_TYPES,
  alternativeContentTypeForMonth,
  VIP_SCORING,
  vipPopulationThreshold,
  vipHighPctSmall,
  vipStdPctSmall,
  vipHighPctLarge,
  vipStdPctLarge,
  nonReferralDaysThreshold,
  dormantDaysThreshold,
  storyBufferMinimum,
  weeklyBatchSize,
  ROLE_CATEGORY_HEADER,
  ROLE_CATEGORY_ANY,
  STORY_FILE_PREFIX,
  STORY_FILE_SUFFIX,
  ROLE_CATEGORIES,
  MOTIVATION_TAGS,
  UPDATE_BRIEF_FILENAME,
};
