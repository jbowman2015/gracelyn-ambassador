'use strict';

/**
 * File content assembly + parsing — JS port of the Zoho Flow Deluge function
 * in the design doc §5.2 (`buildFileContent`) and the header contract in §4.
 * Header line order and literal labels must match exactly what Agent 3's
 * parseRoleCategory() expects (Coordination Point #1).
 */

const M = require('./manifest');

/**
 * Assemble the file content exactly per design §4/§5.2:
 *   5 header lines, `---`, blank line, body, `\n---`.
 */
function buildFileContent({ title, roleCategory, targetDate, submitterName, submittedAt, content }) {
  const header =
    `STORY TITLE: ${title}\n` +
    `${M.ROLE_CATEGORY_HEADER}: ${roleCategory}\n` +
    `TARGET WEEK: ${targetDate}\n` +
    `SUBMITTED BY: ${submitterName}\n` +
    `SUBMITTED AT: ${submittedAt}\n` +
    `${M.FILE_SEPARATOR}\n\n`;
  return `${header}${content}\n${M.FILE_SEPARATOR}`;
}

/**
 * Extract the ROLE_CATEGORY header value from a story file's content — a copy
 * of Agent 3's parseRoleCategory() regex (functions/agent3/story.js) kept here
 * only so Agent 6's own tests can confirm its output is Agent-3-readable
 * (design §8.1 "Agent 3 reads role category from header"). Agent 6 does not
 * call this at intake time.
 */
function parseRoleCategory(fileContent) {
  const re = new RegExp(`^${M.ROLE_CATEGORY_HEADER}:\\s*(.+)$`, 'm');
  const match = String(fileContent || '').match(re);
  return match ? match[1].trim() : M.ROLE_CATEGORY_ANY;
}

/** True if `roleCategory` is one of the six controlled categories or "Any". */
function isValidRoleCategory(roleCategory) {
  return M.FORM_ROLE_CATEGORY_VALUES.includes(roleCategory);
}

module.exports = { buildFileContent, parseRoleCategory, isValidRoleCategory };
