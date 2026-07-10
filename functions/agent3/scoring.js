'use strict';

/**
 * Dynamic VIP tier scoring (design §6, §6.1, §6.2).
 *
 * Three dimensions per ambassador:
 *   - Referral Activity   0-40  (10 pts per confirmed referral in past 90 days)
 *   - Engagement Rate     0-30  (banded on open/click rate)
 *   - Tenure & Consistency 0-30  (banded on months active, +5 bonus, capped 30)
 *
 * Tiering is population-relative: the top `highPct` of scored ambassadors are
 * High VIP, the next slice up to `stdPct` are Standard VIP, the rest are Not
 * VIP. Percentage bands shift once the active population crosses
 * VIP_POPULATION_THRESHOLD (design §6.2).
 */

const M = require('./manifest');

function clamp(n, min, max) {
  const v = Number(n);
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function referralActivityPoints(referralCount90d) {
  const n = Math.max(0, Number(referralCount90d) || 0);
  return Math.min(M.VIP_SCORING.maxReferralActivity, n * M.VIP_SCORING.pointsPerReferral);
}

function engagementRatePoints(engagementRatePct) {
  const pct = clamp(engagementRatePct, 0, 100);
  for (const band of M.VIP_SCORING.engagementBands) {
    if (pct >= band.min) return band.points;
  }
  return 0;
}

function tenurePoints(tenureMonths, consecutivePriorVipQuarters) {
  const months = Math.max(0, Number(tenureMonths) || 0);
  let base = 0;
  for (const band of M.VIP_SCORING.tenureBands) {
    if (months >= band.minMonths) { base = band.points; break; }
  }
  const bonus = (Number(consecutivePriorVipQuarters) || 0) >= 2 ? M.VIP_SCORING.consecutiveVipBonus : 0;
  return Math.min(M.VIP_SCORING.maxTenure, base + bonus);
}

/**
 * @param {object} p
 * @param {number} p.referralCount90d           confirmed referrals in past 90 days
 * @param {number} p.engagementRatePct           0-100 open/click rate
 * @param {number} p.tenureMonths                months active
 * @param {number} [p.consecutivePriorVipQuarters] count of consecutive prior VIP quarters
 * @returns {{referralActivity, engagementRate, tenure, total}}
 */
function computeVipScore(p = {}) {
  const referralActivity = referralActivityPoints(p.referralCount90d);
  const engagementRate = engagementRatePoints(p.engagementRatePct);
  const tenure = tenurePoints(p.tenureMonths, p.consecutivePriorVipQuarters);
  return { referralActivity, engagementRate, tenure, total: referralActivity + engagementRate + tenure };
}

/** The high/standard percentage bands for the given active population size. */
function tierPercentBands(populationSize) {
  const large = populationSize >= M.vipPopulationThreshold();
  return large
    ? { highPct: M.vipHighPctLarge(), stdPct: M.vipStdPctLarge() }
    : { highPct: M.vipHighPctSmall(), stdPct: M.vipStdPctSmall() };
}

/**
 * Assign VIP tiers by rank. `scored` is [{ id, total, ... }], any order.
 * Returns a new array (same order as input) with `tier` set to one of
 * M.VIP_TIER_VALUES. Ties keep input order (stable sort).
 */
function assignVipTiers(scored) {
  const n = scored.length;
  if (n === 0) return [];
  const { highPct, stdPct } = tierPercentBands(n);
  const highCount = Math.ceil((highPct / 100) * n);
  const stdCount = Math.max(highCount, Math.ceil((stdPct / 100) * n));

  const ranked = scored
    .map((amb, idx) => ({ amb, idx }))
    .sort((a, b) => (b.amb.total - a.amb.total) || (a.idx - b.idx));

  const tierByIdx = new Map();
  ranked.forEach((r, rank) => {
    let tier = M.VIP_TIER_VALUES.notVip;
    if (rank < highCount) tier = M.VIP_TIER_VALUES.highVip;
    else if (rank < stdCount) tier = M.VIP_TIER_VALUES.standardVip;
    tierByIdx.set(r.idx, tier);
  });

  return scored.map((amb, idx) => ({ ...amb, tier: tierByIdx.get(idx) }));
}

module.exports = {
  referralActivityPoints,
  engagementRatePoints,
  tenurePoints,
  computeVipScore,
  tierPercentBands,
  assignVipTiers,
};
