'use strict';

/**
 * Story selection by role category (design §5.3, Steps 1-5).
 *
 * Coordination Point #1: the `ROLE_CATEGORY` header is the second line of
 * every story file in WorkDrive Folder 05, written by Agent 6's intake form.
 * This module is the Agent 3 half of that contract — `parseRoleCategory`
 * must keep reading the exact same label Agent 6 writes.
 */

const M = require('./manifest');

/** Extract the ROLE_CATEGORY header value from a story file's content. */
function parseRoleCategory(fileContent) {
  const re = new RegExp(`^${M.ROLE_CATEGORY_HEADER}:\\s*(.+)$`, 'm');
  const match = String(fileContent || '').match(re);
  return match ? match[1].trim() : M.ROLE_CATEGORY_ANY;
}

/**
 * Select the story file to use for a Week 2 standard-cycle email (design §5.3).
 *   Step 1-2: filter by role category, take the most recent match.
 *   Step 3: fall back to any file tagged "Any".
 *   Step 3 (cont.): fall back to the most recent file regardless of category.
 *   Step 4: empty buffer -> null (caller uses a Claude-generated placeholder + alerts).
 *
 * `files` is newest-first (as returned by workdrive.listStoryFiles). `readContent`
 * is injected so tests can run without network.
 */
async function selectStory(roleCategory, files, readContent) {
  if (!files || !files.length) return null;

  let anyMatch = null;
  for (const file of files) {
    const content = await readContent(file.id);
    const cat = parseRoleCategory(content);
    if (cat === roleCategory) return { file, content, matchedOn: 'role_category' };
    if (!anyMatch && cat === M.ROLE_CATEGORY_ANY) anyMatch = { file, content, matchedOn: 'any' };
  }
  if (anyMatch) return anyMatch;

  const fallback = files[0];
  const content = await readContent(fallback.id);
  return { file: fallback, content, matchedOn: 'most_recent_fallback' };
}

module.exports = { parseRoleCategory, selectStory };
