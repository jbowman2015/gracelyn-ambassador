'use strict';

/**
 * Shared CRM read queries reused across the daily jobs and the checkpoint /
 * weekly report compilers, so the criteria strings live in one place.
 */

const M = require('./manifest');

/** Ambassadors with Fraud_Flag = true (design doc: Disqualification_Flag). */
async function fetchFraudFlagged(zoho, moduleApi) {
  const F = M.AMBASSADOR_FIELDS;
  const criteria = `(${F.fraudFlag}:equals:true)`;
  return zoho.fetchAllRecords(moduleApi, { criteria });
}

/** Ambassadors awaiting Phase 2 auto-approve exception review. */
async function fetchExceptionReview(zoho, moduleApi) {
  const F = M.AMBASSADOR_FIELDS;
  const criteria = `(${F.needsExceptionReview}:equals:true)`;
  return zoho.fetchAllRecords(moduleApi, { criteria });
}

/** Ambassadors escalated to human (dormant re-engagement exhausted, design §2.2 / Agent 3 §5.1). */
async function fetchEscalatedToHuman(zoho, moduleApi) {
  const F = M.AMBASSADOR_FIELDS;
  const criteria = `(${F.escalatedToHuman}:equals:true)`;
  return zoho.fetchAllRecords(moduleApi, { criteria });
}

/** Referrals at Stage = Eligible, not yet Paid — the payment confirmation queue. */
async function fetchEligibleReferrals(zoho, moduleApi) {
  const F = M.REFERRAL_FIELDS;
  const criteria = `(${F.referralStage}:equals:${M.REFERRAL_STAGE_VALUES.eligible})`;
  return zoho.fetchAllRecords(moduleApi, { criteria });
}

/** Referrals marked Paid this calendar week/month/all-time (Payment_Date-based; filtered in-memory by caller). */
async function fetchPaidReferrals(zoho, moduleApi) {
  const F = M.REFERRAL_FIELDS;
  const criteria = `(${F.commissionStatus}:equals:${M.COMMISSION_STATUS_VALUES.paid})`;
  return zoho.fetchAllRecords(moduleApi, { criteria });
}

/** All Ambassadors (paged) — used by weekly Ambassador Health + VIP audit. */
async function fetchAllAmbassadors(zoho, moduleApi) {
  return zoho.fetchAllRecords(moduleApi, {});
}

/** Support Tickets escalated (Escalation_Timestamp set) with no First_Response_Timestamp yet. */
async function fetchAwaitingFirstResponse(zoho, moduleApi) {
  const F = M.SUPPORT_TICKET_FIELDS;
  const criteria = `(${F.escalationTimestamp}:greater_than:1900-01-01T00:00:00%2B00:00)`;
  const all = await zoho.fetchAllRecords(moduleApi, { criteria });
  return all.filter((r) => r[F.escalationTimestamp] && !r[F.firstResponseTimestamp]);
}

/** Support Tickets escalated with a first response but no Resolution_Timestamp yet. */
async function fetchAwaitingResolution(zoho, moduleApi) {
  const F = M.SUPPORT_TICKET_FIELDS;
  const criteria = `(${F.escalationTimestamp}:greater_than:1900-01-01T00:00:00%2B00:00)`;
  const all = await zoho.fetchAllRecords(moduleApi, { criteria });
  return all.filter((r) => r[F.escalationTimestamp] && !r[F.resolutionTimestamp]);
}

/** All Support Tickets (paged) — used by the weekly SLA report. */
async function fetchAllTickets(zoho, moduleApi) {
  return zoho.fetchAllRecords(moduleApi, {});
}

/** Open tickets currently flagged SLA_Breached or Resolution_SLA_Breached (not yet resolved). */
async function fetchOpenSlaBreaches(zoho, moduleApi) {
  const F = M.SUPPORT_TICKET_FIELDS;
  const criteria = `((${F.slaBreached}:equals:true)or(${F.resolutionSlaBreached}:equals:true))`;
  const all = await zoho.fetchAllRecords(moduleApi, { criteria });
  return all.filter((r) => !r[F.resolutionTimestamp]);
}

/** Ambassador applications awaiting Phase 1 manual approval (Ambassador_Status = Applicant, not auto-approved). */
async function fetchApplicationsAwaitingApproval(zoho, moduleApi) {
  const F = M.AMBASSADOR_FIELDS;
  const criteria = `(${F.ambassadorStatus}:equals:${M.AMBASSADOR_STATUS_VALUES.applicant})`;
  const all = await zoho.fetchAllRecords(moduleApi, { criteria });
  return all.filter((r) => !r[F.autoApproved]);
}

module.exports = {
  fetchFraudFlagged,
  fetchExceptionReview,
  fetchEscalatedToHuman,
  fetchEligibleReferrals,
  fetchPaidReferrals,
  fetchAllAmbassadors,
  fetchAwaitingFirstResponse,
  fetchAwaitingResolution,
  fetchAllTickets,
  fetchOpenSlaBreaches,
  fetchApplicationsAwaitingApproval,
};
