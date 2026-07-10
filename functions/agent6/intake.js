'use strict';

/**
 * Story intake processing — JS port of the Zoho Flow's step sequence (design
 * doc §5, Steps 1-5, and the §7 failure-scenario table). This is the tested
 * reference implementation the Flow's Deluge script must match; it is not
 * wired to an HTTP route because Agent 6's production intake path is the
 * native Zoho Flow, not Catalyst (design §5). Keeping it here lets the Flow
 * be validated against a known-correct spec before Parmeet builds it, and
 * gives Agent 6 the "no network" local test coverage the design doc's §8.1
 * testing protocol calls for.
 */

const { sanitizeTitle, resolveTargetMonday, buildUniqueFilename } = require('./filename');
const { buildFileContent, isValidRoleCategory } = require('./storyFile');
const M = require('./manifest');

/**
 * Process one story slot (design §5 Step 3 + 3a-3e). Returns:
 *   { status: 'saved', filename, content, duplicate, pastDateWarning } |
 *   { status: 'skipped', reason } |
 *   { status: 'invalid', reason }
 * `existingFilenames` is mutated (the newly saved name is added) so later
 * slots in the same batch see it for duplicate detection.
 */
function processStorySlot(slot, { submitterName, submittedAt, today, existingFilenames }) {
  const content = (slot.content || '').trim();
  if (!content) return { status: 'skipped', reason: 'empty content' };

  if (!slot.title || !slot.title.trim()) {
    return { status: 'invalid', reason: 'missing title' };
  }
  if (!slot.roleCategory || !isValidRoleCategory(slot.roleCategory)) {
    return { status: 'invalid', reason: 'missing or invalid Role Category' };
  }
  if (!slot.targetWeek) {
    return { status: 'invalid', reason: 'missing target week' };
  }

  const targetDate = resolveTargetMonday(slot.targetWeek);
  const pastDateWarning = targetDate < today;

  const { filename, duplicate } = buildUniqueFilename(slot.title, targetDate, existingFilenames);
  existingFilenames.add(filename);

  const fileContent = buildFileContent({
    title: slot.title.trim(),
    roleCategory: slot.roleCategory,
    targetDate,
    submitterName,
    submittedAt,
    content,
  });

  return { status: 'saved', filename, content: fileContent, duplicate, pastDateWarning, targetDate };
}

/**
 * Process a full form submission (design §5 Steps 1-5). `submission` is
 * { submitterName, submitterEmail, stories: [{ title, roleCategory,
 * targetWeek, content }, ...] } (up to 5). `existingFilenames` is the set of
 * filenames already in Folder 05 (design §3c dedup check); `today` is
 * YYYY-MM-DD.
 *
 * Never throws for per-slot problems — those are collected into `invalid`/
 * `skipped` for the confirmation email (design §5 Step 5, §7). Only a
 * missing submitter name/email halts the whole submission (design §5 Step 2).
 */
function processSubmission(submission, { existingFilenames = [], today, submittedAt } = {}) {
  const submitterName = submission && submission.submitterName;
  const submitterEmail = submission && submission.submitterEmail;
  if (!submitterName || !submitterEmail) {
    return { halted: true, reason: 'missing submitter name or email', saved: [], skipped: [], invalid: [] };
  }

  const stories = (submission.stories || []).slice(0, M.MAX_STORIES_PER_SUBMISSION);
  const seen = new Set(existingFilenames);
  const saved = [];
  const skipped = [];
  const invalid = [];

  stories.forEach((slot, index) => {
    const result = processStorySlot(slot, { submitterName, submittedAt, today, existingFilenames: seen });
    if (result.status === 'saved') saved.push({ slot: index + 1, ...result });
    else if (result.status === 'skipped') skipped.push({ slot: index + 1, reason: result.reason });
    else invalid.push({ slot: index + 1, reason: result.reason });
  });

  return { halted: false, saved, skipped, invalid };
}

/** Confirmation email summary (design §5 Step 5). */
function buildConfirmationSummary(result) {
  if (result.halted) {
    return { subject: 'Story intake — submission not processed', lines: [`Not processed: ${result.reason}.`] };
  }
  const lines = [`${result.saved.length} stor${result.saved.length === 1 ? 'y' : 'ies'} saved.`];
  for (const s of result.saved) {
    let line = `  - ${s.filename}`;
    if (s.duplicate) line += ' (duplicate title — suffix applied)';
    if (s.pastDateWarning) line += ' (target week already passed)';
    lines.push(line);
  }
  for (const s of result.skipped) lines.push(`  - Slot ${s.slot} skipped: ${s.reason}`);
  for (const s of result.invalid) lines.push(`  - Slot ${s.slot} invalid: ${s.reason}`);
  return { subject: `Story intake — ${result.saved.length} saved`, lines };
}

module.exports = { processStorySlot, processSubmission, buildConfirmationSummary };
