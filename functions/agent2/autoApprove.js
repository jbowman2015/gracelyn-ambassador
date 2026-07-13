'use strict';

/**
 * Phase 2 auto-approve criteria (design §4.1). All five must pass; any single
 * failure routes the application to the human exception queue (§4.2). Each
 * check is isolated so a single CRM lookup failure doesn't silently pass the
 * others — it fails closed (routes to exception queue) with a clear reason.
 */

const M = require('./manifest');
const { AMBASSADORS_FIELDS: AF, AMBASSADOR_STATUS: STATUS } = M;

async function checkFraudFlag(record) {
  const flagged = record[AF.fraudFlag] === true || record[AF.fraudFlag] === 'true';
  return { pass: !flagged, reason: flagged ? 'Fraud_Flag is set on this application.' : null };
}

async function checkDuplicateEmail(record, moduleApiName, zoho) {
  const email = record[AF.email];
  if (!email) return { pass: false, reason: 'No email on the application.' };
  try {
    const matches = await zoho.searchByCriteria(moduleApiName, `(${AF.email}:equals:${email})`);
    const conflict = matches.find((m) => m.id !== record.id
      && [STATUS.active, STATUS.approved].includes(m[AF.status]));
    return conflict
      ? { pass: false, reason: `Duplicate email — existing record ${conflict.id} is ${conflict[AF.status]}.`, conflictId: conflict.id }
      : { pass: true, reason: null };
  } catch (err) {
    return { pass: false, reason: `Duplicate-email check failed: ${err.message}` };
  }
}

async function checkHouseholdMatch(record, moduleApiName, zoho) {
  const address = record[AF.address];
  if (!address) return { pass: true, reason: null }; // nothing to match on
  try {
    const matches = await zoho.searchByCriteria(moduleApiName, `(${AF.address}:equals:${address})`);
    const conflict = matches.find((m) => m.id !== record.id
      && [STATUS.active, STATUS.approved].includes(m[AF.status])
      && m[AF.city] === record[AF.city] && m[AF.state] === record[AF.state]);
    return conflict
      ? { pass: false, reason: `Household match — existing record ${conflict.id} shares this mailing address.`, conflictId: conflict.id }
      : { pass: true, reason: null };
  } catch (err) {
    return { pass: false, reason: `Household-match check failed: ${err.message}` };
  }
}

async function checkReferralCode(record, moduleApiName, zoho) {
  const code = record[AF.recruitedBy];
  if (!code) return { pass: true, reason: null }; // no referral code submitted, nothing to validate
  try {
    const match = await zoho.findOneByField(moduleApiName, 'Referral_Code', code);
    const valid = match && match[AF.status] === STATUS.active;
    return valid ? { pass: true, reason: null } : { pass: false, reason: `Referral code "${code}" does not resolve to an active ambassador.` };
  } catch (err) {
    return { pass: false, reason: `Referral-code check failed: ${err.message}` };
  }
}

async function checkCompleteness(record) {
  const required = [AF.firstName, AF.lastName, AF.email, AF.state, AF.roleCategory, AF.consentGiven];
  const missing = required.filter((f) => {
    const v = record[f];
    return v === undefined || v === null || v === '' || v === false;
  });
  return { pass: missing.length === 0, reason: missing.length ? `Missing required field(s): ${missing.join(', ')}.` : null };
}

/**
 * Run all five criteria (design §4.1). Returns { allPass, failures, results }.
 * `zoho` and `moduleApiName` are required for the CRM-lookup checks.
 */
async function runAutoApproveCriteria(record, moduleApiName, zoho) {
  const results = {
    fraudFlag: await checkFraudFlag(record),
    duplicateEmail: await checkDuplicateEmail(record, moduleApiName, zoho),
    householdMatch: await checkHouseholdMatch(record, moduleApiName, zoho),
    referralCode: await checkReferralCode(record, moduleApiName, zoho),
    completeness: await checkCompleteness(record),
  };
  const failures = Object.entries(results).filter(([, r]) => !r.pass).map(([k, r]) => ({ criterion: k, reason: r.reason }));
  return { allPass: failures.length === 0, failures, results };
}

module.exports = {
  checkFraudFlag, checkDuplicateEmail, checkHouseholdMatch, checkReferralCode, checkCompleteness,
  runAutoApproveCriteria,
};
