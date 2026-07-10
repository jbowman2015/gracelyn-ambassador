'use strict';

/**
 * Filename generation — JS port of the Zoho Flow Deluge functions in the
 * design doc §5.1 (`sanitizeTitle`, `buildFilename`) plus §3b (target Monday)
 * and §3c (duplicate suffixing). This is the tested specification the Flow's
 * Deluge script must match; Catalyst does not run this at intake time
 * (design §5 — the Flow handles story processing natively).
 */

const M = require('./manifest');

/** Lowercase, strip anything but [a-z0-9 -], collapse whitespace to hyphens, truncate to 80. */
function sanitizeTitle(rawTitle) {
  const lower = String(rawTitle || '').toLowerCase();
  const noSpecial = lower.replace(/[^a-z0-9\s-]/g, '');
  const hyphenated = noSpecial.replace(/\s+/g, '-');
  return hyphenated.length > M.MAX_SANITIZED_TITLE_LENGTH
    ? hyphenated.slice(0, M.MAX_SANITIZED_TITLE_LENGTH)
    : hyphenated;
}

/** Find the Monday of the week containing `dateInput` (or the date itself if already Monday). */
function resolveTargetMonday(dateInput) {
  const d = dateInput instanceof Date ? new Date(dateInput.getTime()) : new Date(`${dateInput}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid target week date: ${dateInput}`);
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diffToMonday);
  return d.toISOString().slice(0, 10);
}

function buildFilename(title, targetDate) {
  const sanitized = sanitizeTitle(title);
  return `${M.STORY_FILE_PREFIX}${targetDate}_${sanitized}${M.STORY_FILE_SUFFIX}`;
}

/**
 * Append _v2 / _v3 (design §3c) to the sanitized title until the filename is
 * not in `existingNames`. Throws if v2 and v3 both collide (doc only
 * specifies these two fallback suffixes).
 */
function buildUniqueFilename(title, targetDate, existingNames) {
  const existing = new Set(existingNames || []);
  const sanitized = sanitizeTitle(title);
  const base = `${M.STORY_FILE_PREFIX}${targetDate}_${sanitized}${M.STORY_FILE_SUFFIX}`;
  if (!existing.has(base)) return { filename: base, duplicate: false, suffix: null };
  // Append the suffix to the already-sanitized title (not the raw title) —
  // sanitizeTitle strips underscores, so re-sanitizing "title_v2" would eat
  // the separator the design doc's duplicate-suffix rule (§3c) relies on.
  for (const suffix of ['_v2', '_v3']) {
    const candidate = `${M.STORY_FILE_PREFIX}${targetDate}_${sanitized}${suffix}${M.STORY_FILE_SUFFIX}`;
    if (!existing.has(candidate)) return { filename: candidate, duplicate: true, suffix };
  }
  throw new Error(`Duplicate filename for "${title}" (${targetDate}) persists through _v2/_v3.`);
}

module.exports = { sanitizeTitle, resolveTargetMonday, buildFilename, buildUniqueFilename };
