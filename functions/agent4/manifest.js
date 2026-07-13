'use strict';

/**
 * Agent 4 — Compliance Oversight: canonical constants.
 *
 * Single source of truth for this agent's env-var names, the Support Tickets /
 * Ambassadors / Referrals field API names it reads and writes, the SLA
 * thresholds, and the VIP audit tolerance bands (shared with Agent 3).
 *
 * Naming authority (per CLAUDE.md + ClaudeCode_Zoho_API_Names_Instruction):
 *   - CRM MODULE + FIELD api_names are authoritative in Zoho. `SUPPORT_TICKET_FIELDS`
 *     below is reconciled live (2026-07-10): the `Support_Tickets` custom module did
 *     not exist yet (only Cases/Solutions were live — confirmed via
 *     GET /crm/v6/settings/modules), so this session created it plus its 12 fields.
 *     Zoho generated every api_name identically to what agent5A/manifest.js already
 *     specifies in SLA_COORDINATION_FIELDS / CRM_FIELDS.supportTickets — no
 *     divergence to report for the nine SLA coordination fields (Coordination #2),
 *     and Escalation_Timestamp matches Coordination #3 exactly by construction.
 *   - Three real divergences from the design doc, reconciled against the live
 *     `Ambassadors` / `Referrals` modules (2026-07-10):
 *       1. Design doc's "Disqualification_Flag" -> live field is `Fraud_Flag`
 *          (boolean, on Ambassadors). No separate self-referral/household-match/
 *          duplicate-referral sub-flags exist; the blueprint writes one flag.
 *       2. Design doc's "Zoho CRM: Activity Log" module (for
 *          Escalated_To_Human = true records) does not exist as its own module.
 *          Agent 3 writes `Escalated_To_Human` directly on `Ambassadors`
 *          (functions/agent3/manifest.js AMBASSADOR_FIELDS.escalatedToHuman) —
 *          Agent 4 reads it there instead.
 *       3. Design doc's "Referral_Fee_Status" -> live field is `Commission_Status`
 *          on `Referrals` (module was renamed from Commissions; this field's
 *          api_name was not renamed with it). Values: Pending, Eligible, Paid, Void.
 *     `Referral_Stage` (Applied/Enrolled/Active/Ineligible/Eligible/Paid) and the
 *     "suspension trigger" (`Ambassador_Status` = Suspended, values: Applicant/
 *     Approved/Active/Suspended/Terminated) both matched the design doc's intent
 *     with no rename needed.
 *   - "Ad Campaign Log" and a dedicated CRM "Escalation Queue" / "Coordinator
 *     Dashboard" module do not exist live either (Agent 1C — the only writer of
 *     an ad-spend log — is unbuilt, and no separate queue module was ever created).
 *     Both are treated as optional/best-effort: the daily checkpoint always
 *     includes those sections, but degrades to "not yet available" rather than
 *     failing when the module can't be resolved. Escalation items are never lost
 *     — they are always in the checkpoint/weekly emails; a structured queue module
 *     can be wired in later via *_MODULE_API_NAME with no code change.
 *   - ENV-VAR names are canonical per agent5A/manifest.js / Master Reference
 *     Sheet §1. `COORDINATOR_EMAIL` (design doc) is accepted as an alias of the
 *     canonical `SUPPORT_COORDINATOR_EMAIL` (agent5A ENV_VARS).
 */

// ─── Environment variables (canonical primary, design-doc alias fallback) ─────
const ENV_SPEC = [
  // Zoho CRM OAuth trio (records + metadata; token needs ZohoCRM.settings.READ
  // plus ZohoCRM.modules.READ/UPDATE per design §1).
  { key: 'ZOHO_CRM_CLIENT_ID', required: true, group: 'Zoho' },
  { key: 'ZOHO_CRM_CLIENT_SECRET', required: true, group: 'Zoho' },
  { key: 'ZOHO_CRM_REFRESH_TOKEN', required: true, group: 'Zoho' },

  // Zoho Mail OAuth trio — daily checkpoint, weekly report, SLA + compliance alerts.
  { key: 'ZOHO_MAIL_CLIENT_ID', required: true, group: 'Zoho' },
  { key: 'ZOHO_MAIL_CLIENT_SECRET', required: true, group: 'Zoho' },
  { key: 'ZOHO_MAIL_REFRESH_TOKEN', required: true, group: 'Zoho' },
  { key: 'AGENT4_MAIL_FROM_ADDRESS', required: false, group: 'Zoho',
    note: 'Default compliance@gracelyn.edu placeholder — confirm with Parmeet.' },

  // Zoho WorkDrive OAuth trio — reads ambassador_copy_rules.txt (Folder 08).
  { key: 'ZOHO_WORKDRIVE_CLIENT_ID', required: true, group: 'Zoho' },
  { key: 'ZOHO_WORKDRIVE_CLIENT_SECRET', required: true, group: 'Zoho' },
  { key: 'ZOHO_WORKDRIVE_REFRESH_TOKEN', required: true, group: 'Zoho' },
  { key: 'WORKDRIVE_FOLDER_08_ID', required: true, group: 'WorkDrive', note: 'Brand assets + ambassador_copy_rules.txt.' },

  // Zoho Analytics — HARD STOP item #2. Workspace + table created live
  // 2026-07-13 (org hartwell2, workspace "Ambassador Program Dashboards",
  // table Coordinator_Dashboard_Log). Client/secret/refresh token are still
  // this deployed function's own OAuth self-client, separate from whatever
  // authorized the setup session — not yet issued as of this commit. Optional:
  // when unset/unreachable, the checkpoint/report fall back to emailing the
  // coordinator a text summary (design §8 failure table: "Zoho Analytics
  // write fails").
  { key: 'ZOHO_ANALYTICS_CLIENT_ID', required: false, group: 'Zoho', note: 'Needs its own OAuth self-client — see DEPLOY.md.' },
  { key: 'ZOHO_ANALYTICS_CLIENT_SECRET', required: false, group: 'Zoho' },
  { key: 'ZOHO_ANALYTICS_REFRESH_TOKEN', required: false, group: 'Zoho' },
  { key: 'ZOHO_ANALYTICS_WORKSPACE_ID', required: false, group: 'Zoho',
    note: '✅ Confirmed live 2026-07-13: 2396292000008898001 ("Ambassador Program Dashboards").' },
  { key: 'ZOHO_ANALYTICS_COORDINATOR_VIEW_ID', required: false, group: 'Zoho',
    note: '✅ Confirmed live 2026-07-13: 2396292000008901002 (Coordinator_Dashboard_Log table).' },

  // CRM module names.
  { key: 'AMBASSADORS_MODULE_API_NAME', required: false, group: 'Config', note: 'Confirmed live: Ambassadors.' },
  { key: 'REFERRALS_MODULE_API_NAME', required: false, group: 'Config', note: 'Confirmed live: Referrals.' },
  { key: 'SUPPORT_TICKETS_MODULE_API_NAME', required: false, group: 'Config',
    note: 'Created live this session: Support_Tickets (see manifest header).' },
  { key: 'ACTIVITY_LOG_MODULE_API_NAME', required: false, group: 'Config',
    note: 'Module does not exist. Escalated_To_Human is read from Ambassadors instead — leave unset.' },
  { key: 'AD_CAMPAIGN_LOG_MODULE_API_NAME', required: false, group: 'Config',
    note: 'Module does not exist (Agent 1C unbuilt). Checkpoint degrades gracefully when unset.' },

  // SLA thresholds (Parmeet-adjustable, per design §11 NOTE).
  { key: 'SLA_TIER2_FIRST_RESPONSE_HOURS', required: false, group: 'Policy', note: 'Default 24.' },
  { key: 'SLA_VIP_FIRST_RESPONSE_HOURS', required: false, group: 'Policy', note: 'Default 4 (Tier 3 + VIP Priority).' },
  { key: 'SLA_TIER2_RESOLUTION_HOURS', required: false, group: 'Policy', note: 'Default 72.' },
  { key: 'SLA_VIP_RESOLUTION_HOURS', required: false, group: 'Policy', note: 'Default 24 (Tier 3 + VIP Priority).' },
  { key: 'SLA_WEEKLY_BREACH_RATE_THRESHOLD_PCT', required: false, group: 'Policy',
    note: 'Default 10 (design §4.1 "below 10% of all escalated tickets").' },
  { key: 'SLA_AVG_FIRST_RESPONSE_TARGET_HOURS', required: false, group: 'Policy',
    note: 'Default 12 (design §4.1 "below 12 hours across all tiers").' },

  // VIP audit bands — SAME env vars as Agent 3 (design §10.2: "must be shared,
  // not duplicated with different names").
  { key: 'VIP_AUDIT_TOLERANCE_PCT', required: false, group: 'Policy', note: 'Default 10.' },
  { key: 'VIP_POPULATION_THRESHOLD', required: false, group: 'Policy', note: 'Default 10000.' },
  { key: 'VIP_HIGH_PCT_SMALL', required: false, group: 'Policy', note: 'Default 2.5.' },
  { key: 'VIP_STD_PCT_SMALL', required: false, group: 'Policy', note: 'Default 5.' },
  { key: 'VIP_HIGH_PCT_LARGE', required: false, group: 'Policy', note: 'Default 0.5.' },
  { key: 'VIP_STD_PCT_LARGE', required: false, group: 'Policy', note: 'Default 2.5.' },

  // Make.com webhooks.
  { key: 'MAKE_AGENT4_SLA_BREACH_WEBHOOK', required: false, group: 'Make.com', note: 'Scenario 4.' },
  { key: 'MAKE_AGENT4_COMPLIANCE_WEBHOOK', required: false, group: 'Make.com', note: 'Scenario 5.' },
  { key: 'MAKE_AGENT3_RECALC_COMPLETE_WEBHOOK', required: false, group: 'Make.com',
    note: 'Informational only — this function does not read it directly. Agent 3 now fires it live (2026-07-13, see functions/agent3/monthly.js), Make.com Scenario 3 routes it to POST /vip-audit here. Only the Make.com scenario itself remains unbuilt — see functions/agent3/DEPLOY.md.' },

  // Alert + role routing.
  { key: 'SUPPORT_COORDINATOR_EMAIL', aliases: ['COORDINATOR_EMAIL'], required: true, group: 'Alerts',
    note: 'Canonical (agent5A ENV_VARS). Design doc calls it COORDINATOR_EMAIL — accepted as alias.' },
  { key: 'PARMEET_ALERT_EMAIL', required: true, group: 'Alerts' },
  { key: 'VIP_MANAGER_EMAIL', required: true, group: 'Alerts', note: 'CC on VIP breach escalations (design §11).' },
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
  const n = parseInt(getEnv(key), 10);
  return Number.isFinite(n) ? n : fallback;
}

function getEnvFloat(key, fallback) {
  const n = parseFloat(getEnv(key));
  return Number.isFinite(n) ? n : fallback;
}

// ─── CRM: module + field API names (cross-check; verified live at run time) ───
const AMBASSADORS_MODULE = { label: 'Ambassadors', envVar: 'AMBASSADORS_MODULE_API_NAME' };
const REFERRALS_MODULE = { label: 'Referrals', envVar: 'REFERRALS_MODULE_API_NAME' };
const SUPPORT_TICKETS_MODULE = { label: 'Support Tickets', envVar: 'SUPPORT_TICKETS_MODULE_API_NAME' };

// Fields Agent 4 reads (and in three cases writes) on Ambassadors.
const AMBASSADOR_FIELDS = {
  id: 'id',
  firstName: 'First_Name',
  lastName: 'Name',
  email: 'Email',
  ambassadorStatus: 'Ambassador_Status',       // suspension trigger: value 'Suspended'
  fraudFlag: 'Fraud_Flag',                     // design doc: Disqualification_Flag
  autoApproved: 'Auto_Approved',
  needsExceptionReview: 'Needs_Exception_Review',
  exceptionReason: 'Exception_Reason',
  escalatedToHuman: 'Escalated_To_Human',       // design doc: read from "Activity Log" — lives on Ambassadors
  engagementTrack: 'Engagement_Track',
  vipFlag: 'VIP_Flag',
  vipScore: 'VIP_Score',
  vipTier: 'VIP_Tier',
  vipTierPrevious: 'VIP_Tier_Previous',
  vipTierUpgradeDate: 'VIP_Tier_Upgrade_Date',
  vipRelationshipManager: 'VIP_Relationship_Manager',
  daysSinceLastReferral: 'Days_Since_Last_Referral',
  lastEngagementDate: 'Last_Engagement_Date',
  approvedDate: 'Approved_Date',
};

const AMBASSADOR_STATUS_VALUES = { applicant: 'Applicant', approved: 'Approved', active: 'Active', suspended: 'Suspended', terminated: 'Terminated' };
const ENGAGEMENT_TRACK_VALUES = { sprint: 'Sprint', standard: 'Standard', alternative: 'Alternative', dormant: 'Dormant' };
const VIP_TIER_VALUES = { notVip: 'Not VIP', standardVip: 'Standard VIP', highVip: 'High VIP' };

// Fields Agent 4 reads on Referrals.
const REFERRAL_FIELDS = {
  id: 'id',
  ambassadorLookup: 'Ambassador',
  referralStage: 'Referral_Stage',              // 'Eligible' gate matches design doc exactly
  commissionStatus: 'Commission_Status',        // design doc: Referral_Fee_Status
  commissionAmount: 'Commission_Amount',
  programLevel: 'Program_Level',                // Undergraduate | Graduate
  paymentDate: 'Payment_Date',
  eligibilityDate: 'Eligibility_Date',
  applicationDate: 'Application_Date',
};

const REFERRAL_STAGE_VALUES = { eligible: 'Eligible', paid: 'Paid', ineligible: 'Ineligible' };
const COMMISSION_STATUS_VALUES = { pending: 'Pending', eligible: 'Eligible', paid: 'Paid', void: 'Void' };
const PROGRAM_LEVEL_VALUES = { undergraduate: 'Undergraduate', graduate: 'Graduate' };

// The nine Support Tickets SLA field API names shared with Agent 5
// (Coordination #2). Created live 2026-07-10 — Zoho generated every api_name
// identically to agent5A/manifest.js SLA_COORDINATION_FIELDS; no divergence.
const SUPPORT_TICKET_FIELDS = {
  id: 'id',
  ambassadorId: 'Ambassador_ID',
  questionText: 'Question_Text',
  ticketTier: 'Ticket_Tier',
  issueCategory: 'Issue_Category',
  ambassadorVipStatus: 'Ambassador_VIP_Status',
  resolutionComplexity: 'Resolution_Complexity',
  resolutionStatus: 'Resolution_Status',
  escalationTimestamp: 'Escalation_Timestamp',      // Coordination #3 — matches webhook payload's escalation_timestamp exactly
  firstResponseTimestamp: 'First_Response_Timestamp',
  resolutionTimestamp: 'Resolution_Timestamp',
  slaBreached: 'SLA_Breached',                      // written by Agent 4 only
  resolutionSlaBreached: 'Resolution_SLA_Breached', // written by Agent 4 only
};

// The nine coordination fields exactly, for the cross-agent field-name check.
const SLA_COORDINATION_FIELDS = [
  SUPPORT_TICKET_FIELDS.ticketTier, SUPPORT_TICKET_FIELDS.ambassadorVipStatus,
  SUPPORT_TICKET_FIELDS.escalationTimestamp, SUPPORT_TICKET_FIELDS.firstResponseTimestamp,
  SUPPORT_TICKET_FIELDS.resolutionTimestamp, SUPPORT_TICKET_FIELDS.resolutionStatus,
  SUPPORT_TICKET_FIELDS.resolutionComplexity, SUPPORT_TICKET_FIELDS.slaBreached,
  SUPPORT_TICKET_FIELDS.resolutionSlaBreached,
];

const TICKET_TIER_VALUES = { tier1: 'Tier 1', tier2: 'Tier 2', tier3: 'Tier 3', vipPriority: 'VIP Priority' };
const ISSUE_CATEGORY_VALUES = ['Payment', 'Compliance', 'Referral Tracking', 'Portal Access', 'Recruiting', 'Other'];
const RESOLUTION_STATUS_VALUES = { resolved: 'Resolved', escalated: 'Escalated', failed: 'Failed' };

/** True when a ticket's tier takes the tighter Tier-3/VIP SLA bands (design §4.1). */
function isUrgentTier(tier) {
  return tier === TICKET_TIER_VALUES.tier3 || tier === TICKET_TIER_VALUES.vipPriority;
}

// ─── SLA thresholds (design §4.1, §11 — Parmeet-adjustable) ───────────────────
function slaTier2FirstResponseHours() { return getEnvInt('SLA_TIER2_FIRST_RESPONSE_HOURS', 24); }
function slaVipFirstResponseHours() { return getEnvInt('SLA_VIP_FIRST_RESPONSE_HOURS', 4); }
function slaTier2ResolutionHours() { return getEnvInt('SLA_TIER2_RESOLUTION_HOURS', 72); }
function slaVipResolutionHours() { return getEnvInt('SLA_VIP_RESOLUTION_HOURS', 24); }
function slaWeeklyBreachRateThresholdPct() { return getEnvFloat('SLA_WEEKLY_BREACH_RATE_THRESHOLD_PCT', 10); }
function slaAvgFirstResponseTargetHours() { return getEnvFloat('SLA_AVG_FIRST_RESPONSE_TARGET_HOURS', 12); }

function firstResponseThresholdHours(tier) { return isUrgentTier(tier) ? slaVipFirstResponseHours() : slaTier2FirstResponseHours(); }
function resolutionThresholdHours(tier) { return isUrgentTier(tier) ? slaVipResolutionHours() : slaTier2ResolutionHours(); }

// ─── VIP audit bands (design §5.1 — SAME env vars as Agent 3, per §10.2) ──────
function vipAuditTolerancePct() { return getEnvFloat('VIP_AUDIT_TOLERANCE_PCT', 10); }
function vipPopulationThreshold() { return getEnvInt('VIP_POPULATION_THRESHOLD', 10000); }
function vipHighPctSmall() { return getEnvFloat('VIP_HIGH_PCT_SMALL', 2.5); }
function vipStdPctSmall() { return getEnvFloat('VIP_STD_PCT_SMALL', 5); }
function vipHighPctLarge() { return getEnvFloat('VIP_HIGH_PCT_LARGE', 0.5); }
function vipStdPctLarge() { return getEnvFloat('VIP_STD_PCT_LARGE', 2.5); }

// ─── Content compliance (design §3 Content Compliance section, §8) ────────────
const COPY_RULES_FILENAME = 'ambassador_copy_rules.txt';
const EM_DASH_CHAR = '—';
const COMMISSION_LANGUAGE_PATTERN = /\bcommission(s)?\b/i;

module.exports = {
  ENV_SPEC,
  getEnv,
  getEnvInt,
  getEnvFloat,
  AMBASSADORS_MODULE,
  REFERRALS_MODULE,
  SUPPORT_TICKETS_MODULE,
  AMBASSADOR_FIELDS,
  AMBASSADOR_STATUS_VALUES,
  ENGAGEMENT_TRACK_VALUES,
  VIP_TIER_VALUES,
  REFERRAL_FIELDS,
  REFERRAL_STAGE_VALUES,
  COMMISSION_STATUS_VALUES,
  PROGRAM_LEVEL_VALUES,
  SUPPORT_TICKET_FIELDS,
  SLA_COORDINATION_FIELDS,
  TICKET_TIER_VALUES,
  ISSUE_CATEGORY_VALUES,
  RESOLUTION_STATUS_VALUES,
  isUrgentTier,
  slaTier2FirstResponseHours,
  slaVipFirstResponseHours,
  slaTier2ResolutionHours,
  slaVipResolutionHours,
  slaWeeklyBreachRateThresholdPct,
  slaAvgFirstResponseTargetHours,
  firstResponseThresholdHours,
  resolutionThresholdHours,
  vipAuditTolerancePct,
  vipPopulationThreshold,
  vipHighPctSmall,
  vipStdPctSmall,
  vipHighPctLarge,
  vipStdPctLarge,
  COPY_RULES_FILENAME,
  EM_DASH_CHAR,
  COMMISSION_LANGUAGE_PATTERN,
};
