'use strict';

/**
 * Referrals module helpers shared by weekly.js, milestones.js, and scoring
 * inputs for monthly.js. No new Referrals fields were needed (confirmed live
 * 2026-07-10) — `Ambassador` (lookup), `Referral_Stage`, `Application_Date`,
 * `Enrollment_Date`, and `Created_Time` already exist with the values this
 * design doc needs (`Referral_Stage` includes Applied and Enrolled).
 */

const M = require('./manifest');

/** Referrals with Created_Time on/after `sinceIso` (an ISO datetime string). */
async function fetchReferralsSince(zoho, referralsModuleApi, sinceIso) {
  const F = M.REFERRAL_FIELDS;
  const criteria = `(${F.createdTime}:greater_equal:${sinceIso})`;
  return zoho.fetchAllRecords(referralsModuleApi, { criteria });
}

/** Group referral records by their Ambassador lookup id. Returns Map<ambassadorId, records[]>. */
function groupByAmbassador(referralRecords) {
  const F = M.REFERRAL_FIELDS;
  const byAmbassador = new Map();
  for (const r of referralRecords) {
    const lookup = r[F.ambassadorLookup];
    const ambassadorId = lookup && (lookup.id || lookup);
    if (!ambassadorId) continue;
    if (!byAmbassador.has(ambassadorId)) byAmbassador.set(ambassadorId, []);
    byAmbassador.get(ambassadorId).push(r);
  }
  return byAmbassador;
}

/** The ambassador id with the most referrals in `referralRecords`, or null if empty. */
function topReferrerId(referralRecords) {
  const grouped = groupByAmbassador(referralRecords);
  let best = null;
  for (const [ambassadorId, records] of grouped.entries()) {
    if (!best || records.length > best.count) best = { ambassadorId, count: records.length };
  }
  return best;
}

module.exports = { fetchReferralsSince, groupByAmbassador, topReferrerId };
