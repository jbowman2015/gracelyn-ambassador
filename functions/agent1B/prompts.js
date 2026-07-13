'use strict';

/**
 * Claude prompt builder for caption generation (design doc §7.1). Pure —
 * unit-testable without network, mirrors functions/agent0/prompts.js's split
 * from claude.js.
 */

/** Verbatim from design doc §7.1, with copyRules/voiceGuidelines interpolated. */
function buildCaptionSystemPrompt(copyRules, voiceGuidelines) {
  return `You generate platform-native social media captions for Gracelyn University ` +
    `ambassador recruiting content. Platform requirements: LinkedIn: Professional tone. ` +
    `3-4 sentences. No hashtags in body. 3-5 relevant hashtags at end on a new line. ` +
    `Facebook: Warm and conversational. 2-3 sentences. 2-3 hashtags at end. Instagram: ` +
    `Hook-first. 2-3 sentences. 5-8 hashtags. Emojis acceptable.\n\n` +
    `COPY RULES (follow all without exception):\n${copyRules}\n\n` +
    `VOICE GUIDELINES:\n${voiceGuidelines}\n\n` +
    `Return valid JSON only. No preamble. No markdown fences.\n` +
    `{\n  "linkedin": "<LinkedIn caption>",\n  "facebook": "<Facebook caption>",\n  "instagram": "<Instagram caption>"\n}`;
}

function buildCaptionUserPrompt(assetDescription) {
  return `Generate the three platform captions for this approved social content asset:\n\n${assetDescription}`;
}

module.exports = { buildCaptionSystemPrompt, buildCaptionUserPrompt };
