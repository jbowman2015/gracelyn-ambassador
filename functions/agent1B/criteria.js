'use strict';

/**
 * Pure logic for Agent 1B: gap-report parsing, mission-keyword matching, VIP
 * pipeline stage/suppression predicates, and CRM dedup criteria. No network —
 * kept separate so this is unit-testable without mocking HTTP, same pattern
 * as functions/agent1A/criteria.js.
 */

const M = require('./manifest');

// ─── Gap report parsing (design doc §3.2) ─────────────────────────────────────
// Agent 0's real gap report (functions/agent0/pipeline.js buildGapReport) is a
// flat per-prospect table — "Prospect Name | Source Channel | Gap Type |
// Recommendation" — not a pre-aggregated audience-category breakdown. Agent
// 1B derives "audience categories with the highest no-contact-found rate"
// (design doc §3.2) by tallying No_Email gaps per Source Channel, using
// Channel as the closest live proxy for "audience category" — this is the
// concrete reconciliation of the design doc's expectation against Agent 0's
// actual, already-built output format.
const GAP_TYPE_NO_EMAIL = 'No_Email';
const TABLE_HEADER_PREFIX = 'Prospect Name |';

/**
 * Parses Agent 0's gap report text into priority channels, most-gaps-first.
 * Returns [] for "No gaps recorded this run." or an unparseable report —
 * caller degrades to the default community config (design doc §9).
 */
function parseGapReportPriorities(reportText, topN = 3) {
  if (!reportText || typeof reportText !== 'string') return [];
  const lines = reportText.split('\n');
  const headerIdx = lines.findIndex((l) => l.trim().startsWith(TABLE_HEADER_PREFIX));
  if (headerIdx === -1) return [];

  const counts = new Map();
  for (let i = headerIdx + 2; i < lines.length; i++) { // +2 skips header + "----" divider
    const line = lines[i];
    if (!line || !line.trim()) break; // table ends at the first blank line
    const cols = line.split('|').map((c) => c.trim());
    if (cols.length < 3) continue;
    const [, channel, gapType] = cols;
    if (gapType !== GAP_TYPE_NO_EMAIL) continue;
    const key = channel || 'Unknown';
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([channel, count]) => ({ channel, noEmailCount: count }));
}

// ─── Mission keyword matching (design doc §5.1) ───────────────────────────────
function parseMissionKeywords(csv) {
  return String(csv || '')
    .split(',')
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
}

/** Returns the list of MISSION_KEYWORDS found in `text` (case-insensitive substring match). */
function matchedMissionKeywords(text, keywordsCsv) {
  const haystack = String(text || '').toLowerCase();
  return parseMissionKeywords(keywordsCsv).filter((kw) => haystack.includes(kw));
}

// ─── VIP_Pipeline_Stage predicates (design doc §5, manifest.js divergence #4) ──
function isStage1WarmFollow(stageValue) {
  return stageValue === M.VIP_STAGE_WARM_FOLLOW;
}

function isStage4Onboarding(stageValue) {
  return stageValue === M.VIP_STAGE_ONBOARDING;
}

function isStage5Declined(stageValue) {
  return stageValue === M.VIP_STAGE_DECLINED;
}

/**
 * Design doc §5 Stage 5: 12-month re-approach suppression, computed from the
 * existing Prospect_Declined_Date field rather than a new flag (manifest.js
 * divergence #5). `declinedDateStr` is Zoho's date string ("YYYY-MM-DD") or
 * falsy if never declined.
 */
function isReapproachSuppressed(declinedDateStr, today) {
  if (!declinedDateStr) return false;
  const declined = new Date(declinedDateStr);
  if (Number.isNaN(declined.getTime())) return false;
  const suppressUntil = new Date(declined.getTime());
  suppressUntil.setDate(suppressUntil.getDate() + M.REAPPROACH_SUPPRESSION_DAYS);
  return today < suppressUntil;
}

// ─── CRM dedup criteria (design doc §4.2 Step 3) ──────────────────────────────
/** Zoho COQL "in" criteria for a batch of discovered Social_Profile_URL values. */
function dedupCriteria(urls) {
  const escaped = urls.map((u) => String(u).replace(/,/g, '')).join(',');
  return `(Social_Profile_URL:in:${escaped})`;
}

/**
 * Dedupes discovered candidates within a single monitoring pass by
 * profileUrl, keeping the first (highest-priority community) occurrence.
 * Candidates without a profileUrl are dropped — Social_Profile_URL is the
 * dedup key and a required field on the Prospect record.
 */
function dedupeByProfileUrl(candidates) {
  const seen = new Set();
  const out = [];
  for (const c of candidates) {
    if (!c.profileUrl || seen.has(c.profileUrl)) continue;
    seen.add(c.profileUrl);
    out.push(c);
  }
  return out;
}

/**
 * Design doc §4.2 Step 4: "Role_Category (best estimate from profile
 * context)". Best-effort keyword mapping from the community/channel this
 * candidate was discovered in — a simple, deterministic proxy since no
 * classifier is specified. Falls back to 'Community Member'.
 */
function estimateRoleCategory(channelKeyword) {
  const k = String(channelKeyword || '').toLowerCase();
  if (k.includes('faith')) return 'Faith Community Leader';
  if (k.includes('early childhood') || k.includes('childcare')) return 'Early Childhood Educator';
  if (k.includes('youth')) return 'Youth-Serving Advocate';
  if (k.includes('k-12') || k.includes('educator') || k.includes('teacher')) return 'K-12 Educator';
  return 'Community Member';
}

module.exports = {
  GAP_TYPE_NO_EMAIL,
  parseGapReportPriorities,
  parseMissionKeywords,
  matchedMissionKeywords,
  isStage1WarmFollow,
  isStage4Onboarding,
  isStage5Declined,
  isReapproachSuppressed,
  dedupCriteria,
  dedupeByProfileUrl,
  estimateRoleCategory,
};
