'use strict';

/**
 * Pure CRM search-criteria builders for Agent 1A. No network — these just
 * build the criteria string / field list handed to zoho.crmSearch(). Kept
 * separate from zoho.js so the query logic is unit-testable without mocking
 * HTTP.
 */

const M = require('./manifest');

const PROSPECT_SEARCH_FIELDS = [
  'id', 'Name', 'Last_Name', 'Email', 'Company_Name', 'Title',
  'Channel_Source', 'Motivation_Tag', 'Role_Category', 'Outreach_Status',
  'Sequence_Email_1_Sent', 'Sequence_Email_1_Sent_Date',
  'Sequence_Email_2_Sent', 'Sequence_Email_2_Sent_Date',
];

/**
 * New prospects ready for sequence email 1: Contact_Found true, Email present,
 * Outreach_Status = Standard (design doc's "Identified" — see manifest.js §6),
 * VIP_Prospect false (VIP suppression — design doc's VIP_Flag does not exist).
 */
function newProspectsCriteria() {
  return '((Contact_Found:equals:true)' +
    `and(Outreach_Status:equals:${M.OUTREACH_STATUS_NEW_PROSPECT_VALUE})` +
    'and(VIP_Prospect:equals:false))';
}

/** YYYY-MM-DD for a given Date, UTC-safe string slice (no timezone math needed here). */
function dateOnly(d) {
  return d.toISOString().split('T')[0];
}

function daysAgo(today, days) {
  const d = new Date(today.getTime());
  d.setDate(d.getDate() - days);
  return d;
}

/**
 * Contacts at exactly the follow-up window mark: email 1 sent on that date,
 * no application, not already marked unresponsive.
 */
function followUpCriteria(today) {
  const dateStr = dateOnly(daysAgo(today, M.FOLLOWUP_WINDOW_DAYS));
  return '((Sequence_Email_1_Sent:equals:true)' +
    `and(Sequence_Email_1_Sent_Date:equals:${dateStr})` +
    'and(Outreach_Status:equals:Outreach Sent))';
}

/** Contacts at exactly the unresponsive window mark: email 2 sent that long ago, no application. */
function unresponsiveCriteria(today) {
  const dateStr = dateOnly(daysAgo(today, M.UNRESPONSIVE_WINDOW_DAYS));
  return '((Sequence_Email_2_Sent:equals:true)' +
    `and(Sequence_Email_2_Sent_Date:equals:${dateStr})` +
    'and(Outreach_Status:equals:Follow-Up Sent))';
}

function paraDbCriteria() {
  return '(Outreach_Status:equals:Not Contacted)';
}

function studentAlumniCriteria(statusField) {
  return `((${statusField}:equals:Active)or(${statusField}:equals:Alumni))` +
    'and(Ambassador_Recruiting_Sent:equals:false)';
}

module.exports = {
  PROSPECT_SEARCH_FIELDS,
  newProspectsCriteria,
  followUpCriteria,
  unresponsiveCriteria,
  paraDbCriteria,
  studentAlumniCriteria,
  dateOnly,
  daysAgo,
};
