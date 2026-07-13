'use strict';

/**
 * Agent 6 tests — no network, no deps, no secrets.
 * Run: node __tests__/agent6.test.js
 *
 * Covers filename generation + duplicate suffixing, header assembly/parsing,
 * intake slot validation (design §5, §7), buffer counting + alert evaluation
 * (design §6), the daily job with injected fakes, and a live cross-check that
 * Coordination Point #1 (the ROLE_CATEGORY header + role vocabulary) still
 * matches Agent 3's manifest byte-for-byte.
 */

const assert = require('assert');
const M = require('../manifest');
const { sanitizeTitle, resolveTargetMonday, buildFilename, buildUniqueFilename } = require('../filename');
const { buildFileContent, parseRoleCategory, isValidRoleCategory } = require('../storyFile');
const { processSubmission, buildConfirmationSummary } = require('../intake');
const { computeBufferCounts, evaluateBuffer, buildAlertEmail } = require('../buffer');
const { runBufferCheck, mondayOfWeek } = require('../job');

let passed = 0;
const cases = [];
const test = (name, fn) => cases.push([name, fn]);

// ─── Coordination Point #1: cross-check against Agent 3's manifest ───────────
test('ROLE_CATEGORY header + vocabulary match Agent 3 exactly', () => {
  const agent3M = require('../../agent3/manifest');
  assert.strictEqual(M.ROLE_CATEGORY_HEADER, agent3M.ROLE_CATEGORY_HEADER);
  assert.strictEqual(M.ROLE_CATEGORY_ANY, agent3M.ROLE_CATEGORY_ANY);
  assert.deepStrictEqual(M.ROLE_CATEGORIES, agent3M.ROLE_CATEGORIES);
});

// ─── filename.js ──────────────────────────────────────────────────────────────
test('sanitizeTitle — standard title', () => {
  assert.strictEqual(
    sanitizeTitle('Maria Transforms Her Classroom in South Texas'),
    'maria-transforms-her-classroom-in-south-texas',
  );
});

test('sanitizeTitle — special characters removed, spaces hyphenated', () => {
  assert.strictEqual(
    sanitizeTitle("It's a New Day: Hope for Teachers & Kids"),
    'its-a-new-day-hope-for-teachers-kids',
  );
});

test('sanitizeTitle — truncates to 80 characters', () => {
  const long = 'x'.repeat(120);
  assert.strictEqual(sanitizeTitle(long).length, 80);
});

test('buildFilename — full example from design §4.1', () => {
  assert.strictEqual(
    buildFilename('Maria Transforms Her Classroom in South Texas', '2026-06-02'),
    'Story_2026-06-02_maria-transforms-her-classroom-in-south-texas.txt',
  );
});

test('resolveTargetMonday — mid-week date resolves to that week\'s Monday', () => {
  assert.strictEqual(resolveTargetMonday('2026-06-04'), '2026-06-01'); // Thursday -> Monday
  assert.strictEqual(resolveTargetMonday('2026-06-01'), '2026-06-01'); // already Monday
  assert.strictEqual(resolveTargetMonday('2026-06-07'), '2026-06-01'); // Sunday -> prior Monday
});

test('buildUniqueFilename — duplicate gets _v2, then _v3', () => {
  const first = buildUniqueFilename('Maria Transforms Her Classroom', '2026-06-02', []);
  assert.strictEqual(first.duplicate, false);
  const second = buildUniqueFilename('Maria Transforms Her Classroom', '2026-06-02', [first.filename]);
  assert.strictEqual(second.duplicate, true);
  assert.ok(second.filename.includes('_v2'), second.filename);
  const third = buildUniqueFilename('Maria Transforms Her Classroom', '2026-06-02', [first.filename, second.filename]);
  assert.ok(third.filename.includes('_v3'), third.filename);
});

// ─── storyFile.js ─────────────────────────────────────────────────────────────
test('buildFileContent — all five header lines present, in order, separators correct', () => {
  const content = buildFileContent({
    title: 'Maria Transforms Her Classroom in South Texas',
    roleCategory: 'K12 Educator',
    targetDate: '2026-06-02',
    submitterName: 'Parmeet Kaur',
    submittedAt: '2026-05-13T14:23:00Z',
    content: 'Maria had been teaching fourth grade...',
  });
  const lines = content.split('\n');
  assert.strictEqual(lines[0], 'STORY TITLE: Maria Transforms Her Classroom in South Texas');
  assert.strictEqual(lines[1], 'ROLE_CATEGORY: K12 Educator');
  assert.strictEqual(lines[2], 'TARGET WEEK: 2026-06-02');
  assert.strictEqual(lines[3], 'SUBMITTED BY: Parmeet Kaur');
  assert.strictEqual(lines[4], 'SUBMITTED AT: 2026-05-13T14:23:00Z');
  assert.strictEqual(lines[5], '---');
  assert.strictEqual(lines[6], '');
  assert.ok(content.trimEnd().endsWith('---'));
});

test('parseRoleCategory — reads Early Childhood and Any correctly', () => {
  const ec = buildFileContent({ title: 't', roleCategory: 'Early Childhood', targetDate: '2026-06-02', submitterName: 'P', submittedAt: 'now', content: 'body' });
  assert.strictEqual(parseRoleCategory(ec), 'Early Childhood');
  const any = buildFileContent({ title: 't', roleCategory: 'Any', targetDate: '2026-06-02', submitterName: 'P', submittedAt: 'now', content: 'body' });
  assert.strictEqual(parseRoleCategory(any), 'Any');
});

test('parseRoleCategory — falls back to Any when header missing', () => {
  assert.strictEqual(parseRoleCategory('no header here'), 'Any');
});

test('isValidRoleCategory — accepts all six categories + Any, rejects garbage', () => {
  for (const cat of M.ROLE_CATEGORIES) assert.ok(isValidRoleCategory(cat), cat);
  assert.ok(isValidRoleCategory('Any'));
  assert.ok(!isValidRoleCategory('Not A Category'));
});

// ─── intake.js ────────────────────────────────────────────────────────────────
function validStory(overrides = {}) {
  return { title: 'A Story', roleCategory: 'K12 Educator', targetWeek: '2026-06-02', content: 'body text', ...overrides };
}

test('processSubmission — missing submitter email halts, no stories processed', () => {
  const result = processSubmission({ submitterName: 'P', stories: [validStory()] }, { today: '2026-05-01', submittedAt: 'now' });
  assert.strictEqual(result.halted, true);
  assert.strictEqual(result.saved.length, 0);
});

test('processSubmission — empty story slot skipped, others processed', () => {
  const result = processSubmission(
    { submitterName: 'P', submitterEmail: 'p@x.com', stories: [validStory(), { title: '', roleCategory: '', targetWeek: '', content: '' }, validStory({ title: 'Third' })] },
    { today: '2026-05-01', submittedAt: 'now' },
  );
  assert.strictEqual(result.saved.length, 2);
  assert.strictEqual(result.skipped.length, 1);
  assert.strictEqual(result.skipped[0].slot, 2);
});

test('processSubmission — content present but title missing is invalid, not silently dropped', () => {
  const result = processSubmission(
    { submitterName: 'P', submitterEmail: 'p@x.com', stories: [validStory({ title: '' })] },
    { today: '2026-05-01', submittedAt: 'now' },
  );
  assert.strictEqual(result.saved.length, 0);
  assert.strictEqual(result.invalid.length, 1);
  assert.ok(/title/.test(result.invalid[0].reason));
});

test('processSubmission — content present but missing Role Category is invalid', () => {
  const result = processSubmission(
    { submitterName: 'P', submitterEmail: 'p@x.com', stories: [validStory({ roleCategory: '' })] },
    { today: '2026-05-01', submittedAt: 'now' },
  );
  assert.strictEqual(result.invalid.length, 1);
  assert.ok(/Role Category/.test(result.invalid[0].reason));
});

test('processSubmission — past target week saved with a warning, not rejected', () => {
  const result = processSubmission(
    { submitterName: 'P', submitterEmail: 'p@x.com', stories: [validStory({ targetWeek: '2020-01-06' })] },
    { today: '2026-05-01', submittedAt: 'now' },
  );
  assert.strictEqual(result.saved.length, 1);
  assert.strictEqual(result.saved[0].pastDateWarning, true);
});

test('processSubmission — duplicate title in the same batch gets _v2', () => {
  const result = processSubmission(
    { submitterName: 'P', submitterEmail: 'p@x.com', stories: [validStory({ title: 'Same' }), validStory({ title: 'Same' })] },
    { today: '2026-05-01', submittedAt: 'now' },
  );
  assert.strictEqual(result.saved.length, 2);
  assert.strictEqual(result.saved[0].duplicate, false);
  assert.strictEqual(result.saved[1].duplicate, true);
});

test('processSubmission — batch of five valid stories all saved', () => {
  const stories = Array.from({ length: 5 }, (_, i) => validStory({ title: `Story ${i + 1}` }));
  const result = processSubmission({ submitterName: 'P', submitterEmail: 'p@x.com', stories }, { today: '2026-05-01', submittedAt: 'now' });
  assert.strictEqual(result.saved.length, 5);
});

test('buildConfirmationSummary — lists saved, skipped, and invalid slots', () => {
  const result = processSubmission(
    { submitterName: 'P', submitterEmail: 'p@x.com', stories: [validStory(), { title: '', roleCategory: '', targetWeek: '', content: '' }] },
    { today: '2026-05-01', submittedAt: 'now' },
  );
  const summary = buildConfirmationSummary(result);
  assert.ok(summary.lines.some((l) => l.includes('1 story saved')));
  assert.ok(summary.lines.some((l) => l.includes('Slot 2 skipped')));
});

// ─── buffer.js ────────────────────────────────────────────────────────────────
function fileFor(name, roleCategory) {
  return { name, content: buildFileContent({ title: name, roleCategory, targetDate: '2026-06-02', submitterName: 'P', submittedAt: 'now', content: 'body' }) };
}

test('computeBufferCounts — tallies total and per category, excludes used files', () => {
  const files = [
    fileFor('Story_a.txt', 'K12 Educator'),
    fileFor('Story_b.txt', 'K12 Educator'),
    fileFor('Story_c.txt', 'Any'),
    fileFor('Story_used.txt', 'Faith Community'),
  ];
  const counts = computeBufferCounts(files, new Set(['Story_used.txt']));
  assert.strictEqual(counts.total, 3);
  assert.strictEqual(counts.byCategory['K12 Educator'], 2);
  assert.strictEqual(counts.byCategory['Any'], 1);
  assert.strictEqual(counts.byCategory['Faith Community'], 0);
});

test('evaluateBuffer — fires below minimum', () => {
  const counts = computeBufferCounts([fileFor('Story_a.txt', 'K12 Educator')], new Set());
  const evaluation = evaluateBuffer(counts, 4);
  assert.strictEqual(evaluation.shouldAlert, true);
  assert.strictEqual(evaluation.belowMinimum, true);
});

test('evaluateBuffer — per-category zero-count gap fires even when total is above minimum', () => {
  const files = Array.from({ length: 5 }, (_, i) => fileFor(`Story_${i}.txt`, 'K12 Educator'));
  const counts = computeBufferCounts(files, new Set());
  const evaluation = evaluateBuffer(counts, 4);
  assert.strictEqual(evaluation.belowMinimum, false);
  assert.ok(evaluation.categoryGaps.includes('Faith Community'));
  assert.strictEqual(evaluation.shouldAlert, true);
});

test('evaluateBuffer — healthy buffer does not alert', () => {
  const files = M.BUFFER_CATEGORIES.flatMap((cat, i) => [fileFor(`Story_${i}_a.txt`, cat), fileFor(`Story_${i}_b.txt`, cat)]);
  const counts = computeBufferCounts(files, new Set());
  const evaluation = evaluateBuffer(counts, 4);
  assert.strictEqual(evaluation.shouldAlert, false);
});

test('buildAlertEmail — includes total, per-category counts, and the intake form link', () => {
  const counts = computeBufferCounts([fileFor('Story_a.txt', 'K12 Educator')], new Set());
  const evaluation = evaluateBuffer(counts, 4);
  const email = buildAlertEmail({ counts, evaluation, minimum: 4, usedThisWeekCount: 0, formUrl: 'https://forms.zoho.com/intake', usedFileExclusionApplied: true });
  assert.ok(email.text.includes('Total available story count: 1'));
  assert.ok(email.text.includes('https://forms.zoho.com/intake'));
  assert.ok(email.text.includes('K12 Educator'));
});

// ─── job.js (daily run, injected fakes) ──────────────────────────────────────
function baseEnv() {
  process.env.WORKDRIVE_FOLDER_05_ID = 'f05';
  process.env.PARMEET_ALERT_EMAIL = 'parmeet@gracelyn.edu';
  process.env.STORY_INTAKE_FORM_URL = 'https://forms.zoho.com/intake';
  process.env.STORY_BUFFER_MINIMUM = '4';
}
function clearEnv() {
  ['WORKDRIVE_FOLDER_05_ID', 'PARMEET_ALERT_EMAIL', 'STORY_INTAKE_FORM_URL', 'STORY_BUFFER_MINIMUM', 'ZOHO_CRM_CLIENT_ID']
    .forEach((k) => delete process.env[k]);
}

function fakeWorkdrive(files) {
  return {
    async listStoryFiles() { return files.map((f) => ({ id: f.name, name: f.name })); },
    async downloadFileText(id) { return files.find((f) => f.name === id).content; },
  };
}

test('runBufferCheck — healthy buffer sends no alert', async () => {
  baseEnv();
  const files = M.BUFFER_CATEGORIES.flatMap((cat, i) => [fileFor(`Story_${i}_a.txt`, cat), fileFor(`Story_${i}_b.txt`, cat)]);
  const sent = [];
  const summary = await runBufferCheck({
    deps: { workdrive: fakeWorkdrive(files), mail: { async sendEmail(m) { sent.push(m); return { ok: true }; } } },
  });
  assert.strictEqual(summary.halted, null);
  assert.strictEqual(summary.alertSent, false);
  assert.strictEqual(sent.length, 0);
  clearEnv();
});

test('runBufferCheck — below-minimum buffer sends an alert', async () => {
  baseEnv();
  const files = [fileFor('Story_a.txt', 'K12 Educator')];
  const sent = [];
  const summary = await runBufferCheck({
    deps: { workdrive: fakeWorkdrive(files), mail: { async sendEmail(m) { sent.push(m); return { ok: true }; } } },
  });
  assert.strictEqual(summary.evaluation.belowMinimum, true);
  assert.strictEqual(summary.alertSent, true);
  assert.strictEqual(sent.length, 1);
  assert.strictEqual(sent[0].to, 'parmeet@gracelyn.edu');
  clearEnv();
});

test('runBufferCheck — WorkDrive failure halts and still attempts a failure alert', async () => {
  baseEnv();
  const sent = [];
  const summary = await runBufferCheck({
    deps: {
      workdrive: { async listStoryFiles() { throw new Error('token expired'); } },
      mail: { async sendEmail(m) { sent.push(m); return { ok: true }; } },
    },
  });
  assert.ok(/token expired/.test(summary.halted));
  assert.strictEqual(sent.length, 1);
  assert.ok(/failed/i.test(sent[0].subject));
  clearEnv();
});

test('runBufferCheck — CRM absent degrades gracefully (no used-file exclusion, still counts)', async () => {
  baseEnv();
  const files = [fileFor('Story_a.txt', 'K12 Educator')];
  const summary = await runBufferCheck({
    deps: { workdrive: fakeWorkdrive(files), mail: { async sendEmail() { return { ok: true }; } } },
  });
  assert.strictEqual(summary.usedFileExclusionApplied, false);
  assert.strictEqual(summary.counts.total, 1);
  clearEnv();
});

test('mondayOfWeek — matches resolveTargetMonday for the same date', () => {
  assert.strictEqual(mondayOfWeek(new Date('2026-06-04T12:00:00Z')), resolveTargetMonday('2026-06-04'));
});

// ─── run ─────────────────────────────────────────────────────────────────────
(async () => {
  console.log('Agent 6 tests\n');
  for (const [name, fn] of cases) {
    try { await fn(); console.log(`  ✓ ${name}`); passed++; }
    catch (err) { console.error(`  ✗ ${name}\n    ${err.stack || err.message}`); process.exitCode = 1; }
  }
  console.log(`\n${passed}/${cases.length} passed${process.exitCode ? ' (with failures)' : ''}`);
})();
