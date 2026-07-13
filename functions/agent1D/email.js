'use strict';

/**
 * Pure delivery-email builders (design §4 Step 7, §5). Kept separate from
 * mail.js so the format can be unit-tested with no network.
 */

const M = require('./manifest');

/** Substitutes [RESOURCE_NAME] in the subject-line template (design §12). */
function buildSubject(template, resourceName) {
  const t = template || 'Your resource from Gracelyn University';
  return t.replace(/\[RESOURCE_NAME\]/g, resourceName || 'your resource');
}

/**
 * Plain-text body: personalized opening, download link (or fallback
 * message), a one-line description, and the track's closing line.
 */
function buildBody({ openingSentence, downloadUrl, resourceName, audienceTrack }) {
  const framing = M.DELIVERY_FRAMING[audienceTrack];
  const closing = framing ? framing.closing : 'Thank you for the work you do.';
  const linkLine = downloadUrl
    ? `Download your resource here: ${downloadUrl}`
    : M.FALLBACK_LEAD_MAGNET_MESSAGE;
  const descriptionLine = resourceName
    ? `Inside you will find: ${resourceName.replace(/[-_]/g, ' ')}.`
    : '';

  const lines = [openingSentence, '', linkLine];
  if (descriptionLine) lines.push(descriptionLine);
  lines.push('', closing, '', 'Gracelyn University Ambassador Program');
  return lines.join('\n');
}

module.exports = { buildSubject, buildBody };
