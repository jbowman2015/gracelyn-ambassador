'use strict';

/**
 * Pure run-mode classification and CRM-update payload builders (design doc §4
 * Step 1, §4 Step 7). No network — these return plain objects that index.js
 * hands to zoho.crmUpdateRecord().
 */

const VALID_TRIGGER_TYPES = [
  'agent0_complete',
  'followup_schedule',
  'unresponsive_mark',
  'lead_capture_new_contact',
];

function classifyRunMode(payload) {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, error: 'Missing request body.' };
  }
  const { trigger_type: triggerType } = payload;
  if (!VALID_TRIGGER_TYPES.includes(triggerType)) {
    return { ok: false, error: `Unknown trigger_type "${triggerType}". Expected one of: ${VALID_TRIGGER_TYPES.join(', ')}.` };
  }
  if (triggerType === 'lead_capture_new_contact') {
    const required = ['prospect_crm_id', 'email', 'first_name', 'role_category', 'lead_magnet_id', 'recruiting_source'];
    const missing = required.filter((k) => !payload[k]);
    if (missing.length) {
      return { ok: false, error: `lead_capture_new_contact missing required fields: ${missing.join(', ')}` };
    }
  }
  return { ok: true, triggerType, payload };
}

function dateOnly(d) {
  return d.toISOString().split('T')[0];
}

/** After sending sequence email 1. Also stamps attribution for Agent 2 (design doc §9.2). */
function markEmail1Sent(contactId, today) {
  return {
    id: contactId,
    Outreach_Status: 'Outreach Sent',
    Sequence_Email_1_Sent: true,
    Sequence_Email_1_Sent_Date: dateOnly(today),
    Recruiting_Source: 'Agent 1A',
    Recruiting_Channel: 'Email Sequence',
  };
}

/** After sending follow-up email 2. */
function markEmail2Sent(contactId, today) {
  return {
    id: contactId,
    Outreach_Status: 'Follow-Up Sent',
    Sequence_Email_2_Sent: true,
    Sequence_Email_2_Sent_Date: dateOnly(today),
  };
}

/** After the 14-day no-response window with no application. */
function markUnresponsive(contactId) {
  return { id: contactId, Outreach_Status: 'Unresponsive' };
}

module.exports = {
  VALID_TRIGGER_TYPES,
  classifyRunMode,
  markEmail1Sent,
  markEmail2Sent,
  markUnresponsive,
};
