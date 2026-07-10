'use strict';

/**
 * Escalation webhook payload builder (design §6, §6.1). Pure function — the
 * caller (pipeline.js) is responsible for generating `escalationTimestamp` once
 * and writing the identical string to both this payload and the CRM
 * Escalation_Timestamp field (Coordination #3).
 */

const M = require('./manifest');

function buildEscalationPayload({ ticketId, ambassador, questionText, tier, issueCategory, resolutionComplexity, escalationTimestamp }) {
  return {
    ticket_id: ticketId,
    ambassador_id: ambassador.id || null,
    ambassador_name: ambassador.name || '',
    tier,
    issue_category: issueCategory,
    is_urgent: tier === M.TICKET_TIERS.tier3 || tier === M.TICKET_TIERS.vip,
    is_vip: !!ambassador.isVip,
    resolution_complexity: resolutionComplexity,
    question_text: questionText,
    escalation_timestamp: escalationTimestamp,
  };
}

module.exports = { buildEscalationPayload };
