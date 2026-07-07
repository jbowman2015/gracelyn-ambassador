'use strict';

/**
 * Structure-deviation guard (design doc §5, WARNING box): Claude may only
 * rewrite the opening sentence and one contextual detail. The three-layer
 * structure (mission hook, social proof, simple ask) — i.e. the template's
 * paragraph breaks — must survive untouched. Pure function, no network.
 */

function countParagraphs(text) {
  return String(text || '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean).length;
}

/**
 * Returns true if `personalized` deviates from `template` structurally enough
 * that it should be discarded in favor of the unmodified template (design doc:
 * "Output missing required paragraphs or adds new ones").
 */
function deviatesFromTemplate(template, personalized) {
  if (!personalized || typeof personalized !== 'string' || !personalized.trim()) return true;
  const templateParagraphs = countParagraphs(template);
  const gotParagraphs = countParagraphs(personalized);
  if (gotParagraphs !== templateParagraphs) return true;

  const templateLen = String(template || '').length;
  const gotLen = personalized.length;
  if (templateLen > 0) {
    const ratio = gotLen / templateLen;
    if (ratio < 0.4 || ratio > 2.5) return true;
  }
  return false;
}

module.exports = { countParagraphs, deviatesFromTemplate };
