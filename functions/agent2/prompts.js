'use strict';

/**
 * Claude prompts (design §7). Transcribed verbatim.
 */

// §7.1 — Motivation Classification (Function D1). Returns exactly one tag.
function buildMotivationClassifierPrompt() {
  return `Classify the ambassador's motivation from their onboarding responses. Return exactly one of these six tags and nothing else: Professional Growth │ Mission Impact │ Kingdom Calling │ Problem Solver │ Community Recognition │ Unknown No punctuation. No explanation. One tag only.`;
}

const VALID_MOTIVATION_TAGS = [
  'Professional Growth', 'Mission Impact', 'Kingdom Calling',
  'Problem Solver', 'Community Recognition', 'Unknown',
];

function validateMotivationTag(response) {
  const tag = (response || '').trim();
  return VALID_MOTIVATION_TAGS.includes(tag) ? tag : 'Unknown';
}

// §7.2 — VIP Personalization Paragraph (Function B4-VIP welcome email).
function buildVIPPersonalizationPrompt(voiceGuidelines) {
  return `Write one short paragraph (2-3 sentences) personalizing a VIP welcome email for a Gracelyn ambassador. Reference their specific role and community. Use Gracelyn voice guidelines. No em dashes. No commission. Always say referral fee. VOICE GUIDELINES: ${voiceGuidelines}`;
}

function buildVIPPersonalizationUser(ambassador) {
  return 'Name: ' + ambassador.firstName +
    ' │ Role: ' + ambassador.roleCategory +
    ' │ Audience: ' + ambassador.audienceTrack +
    ' │ Community size: ' + (ambassador.audienceEstimate || 'unknown');
}

module.exports = {
  buildMotivationClassifierPrompt,
  VALID_MOTIVATION_TAGS,
  validateMotivationTag,
  buildVIPPersonalizationPrompt,
  buildVIPPersonalizationUser,
};
