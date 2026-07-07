'use strict';

/**
 * VIP Prospect scoring (design §3.1, Step 8).
 *
 * Three dimensions:
 *   - Audience Reach       0-40  (computed here from a follower/subscriber count)
 *   - Organizational Influence 0-30  (assessed by Claude, clamped here)
 *   - Mission Alignment    0-30  (assessed by Claude, clamped here)
 *
 * A total at or above the threshold (default 60) flags the prospect as a VIP
 * Prospect: automated outreach is suppressed and a briefing is generated.
 */

const M = require('./manifest');

/** Highest audience-reach band whose `min` the follower count meets. */
function scoreAudienceReach(followerCount) {
  const n = Number(followerCount);
  if (!Number.isFinite(n) || n < 0) return 0;
  for (const band of M.AUDIENCE_REACH_BANDS) {
    if (n >= band.min) return band.points;
  }
  return 0;
}

/** Clamp a numeric dimension score into [0, max], coercing junk to 0. */
function clampScore(value, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(max, Math.round(n)));
}

function vipThreshold() {
  const raw = M.getEnv('VIP_PROSPECT_SCORE_THRESHOLD');
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : M.DEFAULT_VIP_THRESHOLD;
}

/**
 * Compute the total VIP Prospect score and flag.
 *
 * @param {object} p
 * @param {number} p.followerCount        raw audience size (any platform)
 * @param {number} p.orgInfluenceScore    Claude's 0-30 org-influence score
 * @param {number} p.missionAlignmentScore Claude's 0-30 mission-alignment score
 * @returns {{audienceReach, orgInfluence, missionAlignment, total, isVip, threshold}}
 */
function computeVipScore(p = {}) {
  const audienceReach = scoreAudienceReach(p.followerCount);
  const orgInfluence = clampScore(p.orgInfluenceScore, M.MAX_ORG_INFLUENCE);
  const missionAlignment = clampScore(p.missionAlignmentScore, M.MAX_MISSION_ALIGNMENT);
  const total = audienceReach + orgInfluence + missionAlignment;
  const threshold = vipThreshold();
  return {
    audienceReach,
    orgInfluence,
    missionAlignment,
    total,
    threshold,
    isVip: total >= threshold,
  };
}

module.exports = { scoreAudienceReach, clampScore, vipThreshold, computeVipScore };
