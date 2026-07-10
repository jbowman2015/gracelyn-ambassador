'use strict';

/**
 * Daily buffer-monitoring run (design §6, §7). Wires workdrive.js + zoho.js +
 * mail.js + buffer.js together. `deps` is injectable so `__tests__/` runs
 * with no network (agent0/pipeline.js's pattern).
 */

const M = require('./manifest');
const workdriveDefault = require('./workdrive');
const zohoDefault = require('./zoho');
const mailDefault = require('./mail');
const { computeBufferCounts, evaluateBuffer, buildAlertEmail } = require('./buffer');

function isoDate(d) { return d.toISOString().slice(0, 10); }

function mondayOfWeek(d) {
  const copy = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = copy.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  copy.setUTCDate(copy.getUTCDate() + diffToMonday);
  return isoDate(copy);
}

/**
 * `deps.now()` defaults to real time; tests inject a fixed clock.
 * Returns a run summary — never throws (design §7: a job failure alerts
 * Parmeet and skips that day's buffer alert, it does not crash the schedule).
 */
async function runBufferCheck({ deps = {} } = {}) {
  const workdrive = deps.workdrive || workdriveDefault;
  const zoho = deps.zoho || zohoDefault;
  const mail = deps.mail || mailDefault;
  const now = deps.now ? deps.now() : new Date();

  const folder05Id = M.getEnv('WORKDRIVE_FOLDER_05_ID');
  const alertEmail = M.getEnv('PARMEET_ALERT_EMAIL');
  const formUrl = M.getEnv('STORY_INTAKE_FORM_URL');
  const minimum = M.storyBufferMinimum();

  let files;
  try {
    const storyFiles = await workdrive.listStoryFiles(folder05Id);
    files = await Promise.all(storyFiles.map(async (f) => ({ name: f.name, content: await workdrive.downloadFileText(f.id) })));
  } catch (err) {
    await mail.sendEmail({
      to: alertEmail,
      subject: '[Agent 6 Alert] Buffer monitoring job failed',
      text: `The daily story buffer check could not run: ${err.message}\nNo buffer alert was sent today; Agent 3 is otherwise unaffected.`,
    });
    return { halted: `WorkDrive read failed: ${err.message}`, alertSent: false };
  }

  // Used-file exclusion (design §6) — best-effort; degrades gracefully when
  // CRM credentials are absent (see manifest.js / zoho.js doc-comments).
  let usedFilenames = new Set();
  let usedFileExclusionApplied = false;
  if (M.getEnv('ZOHO_CRM_CLIENT_ID')) {
    try {
      const moduleName = M.getEnv('AMBASSADORS_MODULE_API_NAME') || M.AMBASSADORS_MODULE.label;
      usedFilenames = await zoho.fetchUsedFilenamesThisWeek(moduleName, {
        lastStoryFileUsedField: M.LAST_STORY_FILE_USED_FIELD,
        lastEngagementDateField: M.LAST_ENGAGEMENT_DATE_FIELD,
        weekStart: mondayOfWeek(now),
      });
      usedFileExclusionApplied = true;
    } catch (err) {
      // Non-fatal: fall back to counting every file (surfaced in the alert body).
      usedFileExclusionApplied = false;
    }
  }

  const counts = computeBufferCounts(files, usedFilenames);
  const evaluation = evaluateBuffer(counts, minimum);

  let alertSent = false;
  let alertError = null;
  if (evaluation.shouldAlert) {
    const email = buildAlertEmail({
      counts, evaluation, minimum, formUrl,
      usedThisWeekCount: usedFilenames.size,
      usedFileExclusionApplied,
    });
    const result = await mail.sendEmail({ to: alertEmail, subject: email.subject, text: email.text });
    alertSent = result.ok;
    alertError = result.ok ? null : result.error;
  }

  return { halted: null, counts, evaluation, alertSent, alertError, usedFileExclusionApplied };
}

module.exports = { runBufferCheck, mondayOfWeek };
