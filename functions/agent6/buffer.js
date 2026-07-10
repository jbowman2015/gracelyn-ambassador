'use strict';

/**
 * Buffer monitoring — design §6. Counts available (not-yet-used) story files
 * in Folder 05, overall and per role category, and decides whether to alert.
 * Pure logic, injectable for offline tests; `index.js` wires it to WorkDrive
 * + CRM + Mail for the daily 5:30 AM CST Catalyst job.
 */

const { parseRoleCategory } = require('./storyFile');
const M = require('./manifest');

/**
 * `files` is [{ name, content }] for every Story_*.txt in Folder 05.
 * `usedFilenames` is the Set of names to exclude (design §6 "used file
 * exclusion"). Returns { total, byCategory: { [category]: count } }.
 */
function computeBufferCounts(files, usedFilenames = new Set()) {
  const byCategory = {};
  for (const cat of M.BUFFER_CATEGORIES) byCategory[cat] = 0;

  let total = 0;
  for (const file of files) {
    if (usedFilenames.has(file.name)) continue;
    total += 1;
    const cat = parseRoleCategory(file.content);
    if (Object.prototype.hasOwnProperty.call(byCategory, cat)) byCategory[cat] += 1;
    else byCategory[cat] = (byCategory[cat] || 0) + 1; // unrecognized tag — still counted, surfaced separately
  }
  return { total, byCategory };
}

/**
 * Decide whether the buffer warrants an alert (design §6):
 *   - total available below STORY_BUFFER_MINIMUM, and/or
 *   - any of the six controlled categories (or Any) has zero files.
 */
function evaluateBuffer(counts, minimum = M.storyBufferMinimum()) {
  const belowMinimum = counts.total < minimum;
  const categoryGaps = M.BUFFER_CATEGORIES.filter((cat) => (counts.byCategory[cat] || 0) === 0);
  const unrecognizedCategories = Object.keys(counts.byCategory).filter((cat) => !M.BUFFER_CATEGORIES.includes(cat));
  return { shouldAlert: belowMinimum || categoryGaps.length > 0, belowMinimum, categoryGaps, unrecognizedCategories };
}

/** Buffer alert email content (design §6 "Alert content"). */
function buildAlertEmail({ counts, evaluation, minimum, usedThisWeekCount, formUrl, usedFileExclusionApplied }) {
  const lines = [
    `Total available story count: ${counts.total} (minimum: ${minimum})`,
    `Stories used this week: ${usedThisWeekCount}${usedFileExclusionApplied ? '' : ' (used-file exclusion unavailable — see note below)'}`,
    '',
    'By role category:',
    ...M.BUFFER_CATEGORIES.map((cat) => `  - ${cat}: ${counts.byCategory[cat] || 0}${evaluation.categoryGaps.includes(cat) ? ' — GAP' : ''}`),
    '',
    `Submit new stories: ${formUrl}`,
  ];
  if (!usedFileExclusionApplied) {
    lines.push('', 'Note: CRM read for used-file exclusion was unavailable this run; counts include all files in Folder 05 regardless of use.');
  }
  const subject = evaluation.belowMinimum
    ? `[Agent 6] Story buffer below minimum (${counts.total}/${minimum})`
    : '[Agent 6] Story category gap warning';
  return { subject, text: lines.join('\n') };
}

module.exports = { computeBufferCounts, evaluateBuffer, buildAlertEmail };
