'use strict';

/**
 * Pure classification logic (design §5, §5.1, §6.1). No I/O — safe to unit test
 * without network/deps/secrets.
 */

const M = require('./manifest');

/**
 * Tier classification (design §5). Sequential — first match wins. VIP override
 * is checked first and short-circuits question/response content entirely.
 */
function classifyTier({ isVip, questionText, responseText }) {
  if (isVip) return M.TICKET_TIERS.vip;

  const q = String(questionText || '').toLowerCase();
  const r = String(responseText || '').toLowerCase();

  if (M.TIER3_COMPLEX_SIGNALS.some((s) => q.includes(s))) return M.TICKET_TIERS.tier3;
  if (M.TIER2_ESCALATION_SIGNALS.some((s) => r.includes(s))) return M.TICKET_TIERS.tier2;
  if (M.TIER2_QUESTION_SIGNALS.some((s) => q.includes(s))) return M.TICKET_TIERS.tier2;

  return M.TICKET_TIERS.tier1;
}

/** Issue category classification (design §5.1). First matching category wins. */
function classifyIssueCategory(questionText) {
  const q = String(questionText || '').toLowerCase();
  for (const { category, keywords } of M.ISSUE_CATEGORY_PATTERNS) {
    if (keywords.some((k) => q.includes(k))) return category;
  }
  return M.ISSUE_CATEGORIES.other;
}

/** Resolution complexity classification (design §6.1 classifyComplexity). */
function classifyComplexity(questionText) {
  const q = String(questionText || '').toLowerCase();
  if (M.COMPLEXITY_SIGNALS.complex.some((s) => q.includes(s))) return M.RESOLUTION_COMPLEXITY.complex;
  if (M.COMPLEXITY_SIGNALS.moderate.some((s) => q.includes(s))) return M.RESOLUTION_COMPLEXITY.moderate;
  return M.RESOLUTION_COMPLEXITY.simple;
}

module.exports = { classifyTier, classifyIssueCategory, classifyComplexity };
