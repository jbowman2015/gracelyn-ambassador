'use strict';

/**
 * Step 1 (design §4) — parse and validate a form submission payload. Pure,
 * no I/O, so the pipeline and tests share one definition of "valid".
 */

function parseAndValidateSubmission(payload) {
  const p = payload || {};
  const submission = {
    firstName: str(p.first_name),
    email: str(p.email),
    roleCategory: str(p.role_category),
    state: str(p.state),
    leadMagnetId: str(p.lead_magnet_id),
    utmSource: str(p.utm_source),
    utmCampaign: str(p.utm_campaign),
  };

  const errors = [];
  if (!submission.email || !submission.email.includes('@')) {
    errors.push('email is missing or invalid');
  }
  if (!submission.leadMagnetId) {
    errors.push('lead_magnet_id is missing');
  }

  return { valid: errors.length === 0, errors, submission };
}

function str(v) {
  return typeof v === 'string' ? v.trim() : (v == null ? '' : String(v).trim());
}

module.exports = { parseAndValidateSubmission };
