'use strict';

/**
 * Claude prompt for the lead magnet delivery email opening sentence (design
 * §5.1). Transcribed from the design doc, with the audience-track tone
 * framing (§5) folded into the system prompt so the sentence matches the
 * track's motivation frame, not just a generic "thanks for downloading".
 */

const M = require('./manifest');

function buildOpeningPrompt(firstName, roleCategory, audienceTrack, leadMagnetName) {
  const framing = M.DELIVERY_FRAMING[audienceTrack];
  const toneLine = framing ? `Tone and framing for this audience track: ${framing.tone}` : '';

  const system = [
    'You write personalized opening sentences for lead magnet delivery emails sent by Gracelyn University.',
    'Each sentence must:',
    '- Address the person by first name',
    '- Acknowledge what they are receiving',
    '- Connect the resource to the work they do',
    '- Be warm and specific, not generic',
    '- Contain no em dashes',
    '- Be exactly one sentence',
    toneLine,
    'Return the sentence only. No preamble. No punctuation beyond the sentence itself.',
  ].filter(Boolean).join('\n');

  const user = [
    `First name: ${firstName}`,
    `Role category: ${roleCategory}`,
    `Audience track: ${audienceTrack}`,
    `Resource name: ${leadMagnetName}`,
    'Write one personalized opening sentence for the delivery email.',
  ].join('\n');

  return { system, user };
}

module.exports = { buildOpeningPrompt };
