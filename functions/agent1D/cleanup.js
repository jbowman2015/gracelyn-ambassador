'use strict';

/**
 * Nightly cleanup — design §7 Scenario 3, 2:00 AM CST. For every configured
 * lead capture form, pull submissions from the past 24 hours, skip any email
 * already present as a Prospect record, and run the rest through the same
 * `processSubmission` pipeline the real-time webhook uses. Sends Parmeet a
 * morning summary of recovered submissions (design §7).
 */

const M = require('./manifest');
const defaultForms = require('./forms');
const defaultZoho = require('./zoho');
const defaultAlerts = require('./alerts');
const { processSubmission } = require('./pipeline');

function parseFormIds() {
  const raw = M.getEnv('LEAD_CAPTURE_FORM_IDS');
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return null; // signal parse failure
  }
}

function isoOneDayAgo(now) {
  return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
}

async function runNightlyCleanup(opts = {}) {
  const deps = opts.deps || {};
  const forms = deps.forms || defaultForms;
  const zoho = deps.zoho || defaultZoho;
  const alerts = deps.alerts || defaultAlerts;
  const now = (deps.now && deps.now()) || new Date();

  const summary = { recovered: 0, checked: 0, formErrors: [], results: [] };

  const formIds = parseFormIds();
  if (formIds === null) {
    await alerts.sendAlert({ errorType: 'LEAD_CAPTURE_FORM_IDS parse error', detail: 'LEAD_CAPTURE_FORM_IDS is not valid JSON.' }, { deps });
    summary.halted = 'LEAD_CAPTURE_FORM_IDS parse error';
    return summary;
  }

  const since = isoOneDayAgo(now);
  const moduleApi = (await zoho.resolveModuleApiName(M.PROSPECTS_MODULE)).apiName;

  for (const formRef of formIds) {
    let records;
    try {
      records = await forms.fetchRecentSubmissions(formRef, since);
    } catch (err) {
      summary.formErrors.push({ formRef, error: err.message });
      await alerts.sendAlert({ errorType: 'Nightly cleanup: form fetch failure', detail: err.message }, { deps });
      continue;
    }

    for (const record of records) {
      summary.checked += 1;
      let existing = null;
      try {
        existing = await zoho.findByDedupKey(moduleApi, M.PROSPECT_FIELDS.dedupKey, record.email);
      } catch (err) {
        summary.formErrors.push({ formRef, email: record.email, error: `dedup check failed: ${err.message}` });
        continue;
      }
      if (existing) continue; // already processed by the real-time trigger

      const res = await processSubmission(record, opts);
      summary.recovered += 1;
      summary.results.push({ email: record.email, success: res.success, halted: res.halted });
    }
  }

  // Morning summary to Parmeet.
  await alerts.sendAlert({
    errorType: 'Nightly cleanup summary',
    detail: `Checked ${summary.checked} submission(s) across ${formIds.length} form(s). Recovered ${summary.recovered} not yet in CRM.`,
  }, { deps });

  return summary;
}

module.exports = { runNightlyCleanup, parseFormIds };
