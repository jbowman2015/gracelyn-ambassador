'use strict';

/**
 * Agent 1A core orchestration — deliberately Express-free so it can be
 * required by __tests__ without pulling in the `express` dependency (mirrors
 * functions/agent5A's split between validators.js/zoho.js and index.js).
 * index.js is the thin Express wrapper around runAgent1A().
 *
 * Real network calls (zoho, mail, workdrive, personalize, reconcile, webhook)
 * and the retry delay (wait) are all injected via `deps` so this can be
 * exercised with fakes in tests — no network, no deps, no secrets, no real
 * 30-second sleeps required locally.
 */

const criteria = require('./criteria');
const sequencing = require('./sequencing');
const templates = require('./templates');
const { buildSubjectLine } = require('./subject');
const { buildRunSummary } = require('./run-summary');
const { buildAlertEmail, CONSECUTIVE_CLAUDE_FAILURE_THRESHOLD, CONSECUTIVE_MAIL_FAILURE_THRESHOLD } = require('./alerts');
const { withRetryOnce } = require('./retry');
const { wait, RETRY_DELAY_MS } = require('./wait');
const reconcile = require('./reconcile');

const zoho = require('./zoho');
const mail = require('./mail');
const workdrive = require('./workdrive');
const personalize = require('./personalize');
const webhook = require('./webhook');

const DEFAULT_DEPS = { zoho, mail, workdrive, personalize, reconcile, webhook, wait };

function contactFromProspectRecord(rec) {
  return {
    id: rec.id,
    firstName: rec.Name || 'Friend',
    lastName: rec.Last_Name || '',
    email: rec.Email,
    organization: rec.Company_Name || '',
    roleCategory: rec.Role_Category || 'educator',
    motivationHyp: rec.Motivation_Tag || 'Unknown',
    channelSource: rec.Channel_Source || '',
  };
}

/**
 * Sends one sequence email to one contact and updates its CRM record
 * immediately (design doc §6/§7: never batch — a mid-run failure must not
 * cause duplicate sends on retry). Mail send and the post-send CRM update
 * each retry once after a delay (§7) before being reported as failed.
 */
async function sendSequenceEmail(contact, population, seq, assets, deps, today, crmModuleApi) {
  const tmpl = templates.selectTemplate(population, seq);
  if (!tmpl.body || !tmpl.subject) {
    return {
      sent: false, contactId: contact.id, personalizationFailed: false, mailFailed: false,
      reason: `Template env vars ${tmpl.subjectKey}/${tmpl.bodyKey} not set`,
    };
  }

  let personalizedBody = tmpl.body;
  let personalizationFailed = false;
  try {
    const result = await deps.personalize.personalizeEmail(contact, tmpl.body, assets);
    personalizedBody = result.body;
    personalizationFailed = !result.personalized;
  } catch {
    // personalizeEmail is designed not to throw, but guard anyway — fall back to template.
    personalizationFailed = true;
  }
  const subject = buildSubjectLine(tmpl.subject, contact.firstName);

  try {
    await withRetryOnce(() => deps.mail.sendRecruitingEmail(contact.email, subject, personalizedBody), deps.wait, RETRY_DELAY_MS);
  } catch (err) {
    return {
      sent: false, contactId: contact.id, personalizationFailed, mailFailed: true,
      reason: `Mail send failed after retry: ${err.message}`,
    };
  }

  const record = seq === 1
    ? sequencing.markEmail1Sent(contact.id, today)
    : sequencing.markEmail2Sent(contact.id, today);
  try {
    await withRetryOnce(() => deps.zoho.crmUpdateRecord(crmModuleApi, record), deps.wait, RETRY_DELAY_MS);
  } catch (err) {
    return {
      sent: true, contactId: contact.id, crmUpdateFailed: true, personalizationFailed, mailFailed: false,
      reason: `CRM update failed after retry: ${err.message}`,
    };
  }
  return { sent: true, contactId: contact.id, personalizationFailed, mailFailed: false };
}

async function markUnresponsiveContact(contact, deps, crmModuleApi) {
  try {
    await withRetryOnce(() => deps.zoho.crmUpdateRecord(crmModuleApi, sequencing.markUnresponsive(contact.id)), deps.wait, RETRY_DELAY_MS);
    return { updated: true, contactId: contact.id };
  } catch (err) {
    return { updated: false, contactId: contact.id, reason: err.message };
  }
}

function recordOutcome(results, outcome) {
  if (outcome.sent) {
    results.sent.push(outcome.contactId);
    if (outcome.crmUpdateFailed) results.crmUpdateFailures.push({ contactId: outcome.contactId, reason: outcome.reason });
  } else {
    results.failed.push({ contactId: outcome.contactId, reason: outcome.reason });
  }
}

/** Tracks consecutive-failure streaks for the >10 Claude / >20 mail alert thresholds (§7). */
function makeFailureCounters() {
  return { claudeConsecutive: 0, mailConsecutive: 0, claudeBreached: false, mailBreached: false };
}
function trackFailureCounters(counters, outcome) {
  if (outcome.personalizationFailed) {
    counters.claudeConsecutive += 1;
    if (counters.claudeConsecutive > CONSECUTIVE_CLAUDE_FAILURE_THRESHOLD) counters.claudeBreached = true;
  } else {
    counters.claudeConsecutive = 0;
  }
  if (outcome.mailFailed) {
    counters.mailConsecutive += 1;
    if (counters.mailConsecutive > CONSECUTIVE_MAIL_FAILURE_THRESHOLD) counters.mailBreached = true;
  } else {
    counters.mailConsecutive = 0;
  }
}

function workdriveMissingAll() {
  return workdrive.BRAND_ASSET_FILES.slice();
}

/** Best-effort alert send — never lets an alert-delivery failure break the run. */
async function trySendAlert(deps, alertArgs) {
  const { subject, body } = buildAlertEmail(alertArgs);
  try {
    await deps.mail.sendAlertEmail(subject, body);
    return true;
  } catch {
    return false;
  }
}

/**
 * Core orchestration, deps-injected for testability. `today` is a Date,
 * injected so date-window logic (7-day / 14-day marks) is deterministic in
 * tests — Date.now() is never called directly here.
 */
async function runAgent1A(payload, deps = DEFAULT_DEPS, today = new Date()) {
  const mode = sequencing.classifyRunMode(payload);
  if (!mode.ok) return { statusCode: 400, body: { success: false, error: mode.error } };

  // Step 2: refresh all OAuth tokens up front. Any failure aborts the entire
  // run — no emails sent (design doc §7, row 1). Make.com alerts Parmeet on
  // the resulting non-200 status (§6.1/§6.2 Step 3) — no separate alert needed.
  try {
    await Promise.all([
      deps.zoho.getCrmToken(),
      deps.mail.getMailToken(),
      deps.workdrive.getWorkdriveToken(),
    ]);
  } catch (err) {
    return { statusCode: 502, body: { success: false, error: `OAuth token refresh failed — run aborted: ${err.message}` } };
  }

  // Step 3: brand assets. Missing files degrade personalization, never abort
  // — but §7 requires a direct alert (a 200 response won't trigger Make's
  // error-only condition), sent after the run so it isn't itself a fatal path.
  let assets = {};
  let missingAssets = [];
  try {
    const result = await deps.workdrive.readAllBrandAssets();
    assets = result.assets;
    missingAssets = result.missing;
  } catch {
    missingAssets = workdriveMissingAll();
    assets = {};
  }

  // Resolve the Prospects module live (never hardcode — see reconcile.js).
  let resolved;
  try {
    resolved = await deps.reconcile.resolveModules();
  } catch (err) {
    return { statusCode: 502, body: { success: false, error: `CRM module resolution failed — run aborted: ${err.message}` } };
  }
  const prospectsApi = resolved.resolved.prospects;
  if (!prospectsApi) {
    return { statusCode: 502, body: { success: false, error: 'Prospects module (Ambassador_Leads) could not be resolved in Zoho — run aborted.' } };
  }

  // Pre-flight: confirm every field Agent 1A depends on actually exists
  // before querying or writing anything (VIP suppression + duplicate-send
  // prevention both depend on these fields being present).
  let fieldsCheck;
  try {
    fieldsCheck = await deps.reconcile.checkProspectFields(prospectsApi);
  } catch (err) {
    return { statusCode: 502, body: { success: false, error: `CRM field verification failed — run aborted: ${err.message}` } };
  }
  if (!fieldsCheck.ok) {
    return {
      statusCode: 502,
      body: {
        success: false,
        error: 'Prospects module is missing required fields — run aborted.',
        missingExistingFields: fieldsCheck.missingExisting,
        missingNewFields: fieldsCheck.missingNew,
      },
    };
  }

  const results = { sent: [], failed: [], crmUpdateFailures: [], unresponsiveMarked: [], skippedPopulations: [] };
  const counters = makeFailureCounters();

  if (mode.triggerType === 'agent0_complete') {
    let prospects = [];
    try {
      prospects = await withRetryOnce(
        () => deps.zoho.crmSearch(prospectsApi, criteria.newProspectsCriteria(), criteria.PROSPECT_SEARCH_FIELDS),
        deps.wait, RETRY_DELAY_MS
      );
    } catch (err) {
      return { statusCode: 502, body: { success: false, error: `Prospect query failed after retry — run aborted: ${err.message}` } };
    }
    for (const rec of prospects) {
      const contact = contactFromProspectRecord(rec);
      const outcome = await sendSequenceEmail(contact, 'prospect', 1, assets, deps, today, prospectsApi);
      recordOutcome(results, outcome);
      trackFailureCounters(counters, outcome);
    }
    // Para DB / Student-Alumni populations: NOT YET IMPLEMENTED. Neither
    // module is confirmed in Zoho as of this build (Master Reference Sheet
    // §4) so there is intentionally no query/send code path for them yet —
    // this is a known gap, not just a runtime skip. See DEPLOY.md.
    if (!resolved.resolved.paraDb) results.skippedPopulations.push('paraDb');
    if (!resolved.resolved.studentAlumni) results.skippedPopulations.push('studentAlumni');
  } else if (mode.triggerType === 'followup_schedule') {
    let contacts = [];
    try {
      contacts = await withRetryOnce(
        () => deps.zoho.crmSearch(prospectsApi, criteria.followUpCriteria(today), criteria.PROSPECT_SEARCH_FIELDS),
        deps.wait, RETRY_DELAY_MS
      );
    } catch (err) {
      return { statusCode: 502, body: { success: false, error: `Follow-up query failed after retry — run aborted: ${err.message}` } };
    }
    for (const rec of contacts) {
      const contact = contactFromProspectRecord(rec);
      const outcome = await sendSequenceEmail(contact, 'prospect', 2, assets, deps, today, prospectsApi);
      recordOutcome(results, outcome);
      trackFailureCounters(counters, outcome);
    }
  } else if (mode.triggerType === 'unresponsive_mark') {
    let contacts = [];
    try {
      contacts = await withRetryOnce(
        () => deps.zoho.crmSearch(prospectsApi, criteria.unresponsiveCriteria(today), criteria.PROSPECT_SEARCH_FIELDS),
        deps.wait, RETRY_DELAY_MS
      );
    } catch (err) {
      return { statusCode: 502, body: { success: false, error: `Unresponsive query failed after retry — run aborted: ${err.message}` } };
    }
    for (const rec of contacts) {
      const contact = contactFromProspectRecord(rec);
      const outcome = await markUnresponsiveContact(contact, deps, prospectsApi);
      results.unresponsiveMarked.push(outcome);
    }
  } else if (mode.triggerType === 'lead_capture_new_contact') {
    const { prospect_crm_id: prospectCrmId, role_category: roleCategory } = mode.payload;
    let rec;
    try {
      rec = await withRetryOnce(
        () => deps.zoho.crmGetRecord(prospectsApi, prospectCrmId, criteria.PROSPECT_SEARCH_FIELDS),
        deps.wait, RETRY_DELAY_MS
      );
    } catch (err) {
      return { statusCode: 502, body: { success: false, error: `Lead capture record lookup failed after retry: ${err.message}` } };
    }
    const contact = { ...contactFromProspectRecord(rec), roleCategory: roleCategory || rec.Role_Category };
    const outcome = await sendSequenceEmail(contact, 'prospect', 1, assets, deps, today, prospectsApi);
    recordOutcome(results, outcome);
    trackFailureCounters(counters, outcome);
  }

  // Non-aborting conditions that still require a direct Parmeet alert (§7) —
  // a 200 response won't trip Make.com's error-only alert condition.
  const alertReasons = [];
  if (missingAssets.length) alertReasons.push(`Missing WorkDrive Folder 08 brand asset file(s): ${missingAssets.join(', ')}`);
  if (counters.claudeBreached) alertReasons.push(`More than ${CONSECUTIVE_CLAUDE_FAILURE_THRESHOLD} consecutive Claude personalization failures/deviations — falling back to unmodified templates.`);
  if (counters.mailBreached) alertReasons.push(`More than ${CONSECUTIVE_MAIL_FAILURE_THRESHOLD} consecutive mail send failures — possible account issue.`);
  if (results.crmUpdateFailures.length) alertReasons.push(`${results.crmUpdateFailures.length} contact(s) sent an email but their CRM record could not be updated — needs manual fix.`);

  if (alertReasons.length) {
    await trySendAlert(deps, {
      failureType: 'Run Completed With Warnings',
      runDate: today.toISOString(),
      triggerType: mode.triggerType,
      failedStep: 'Steps 3/5/6/7 — brand assets, personalization, mail send, or CRM update',
      errorDetails: alertReasons.join(' | '),
      emailsSentBeforeFailure: results.sent.length,
      contactsNeedingManualUpdate: results.crmUpdateFailures.map((f) => f.contactId),
      recommendedAction: 'Review the Agent 1A run summary and the listed Ambassador_Leads records.',
    });
  }

  const summary = buildRunSummary({
    triggeredAt: mode.payload.triggered_at || today.toISOString(),
    runType: mode.triggerType,
    emailsSent: results.sent.length,
    emailsFailed: results.failed.length,
    contactsProcessed: results.sent.length + results.failed.length + results.unresponsiveMarked.length,
    prospectSent: results.sent.length,
    // Para DB querying isn't implemented yet (see skippedPopulations above),
    // so the test-segment cap is never actually in effect — false is the
    // honest value until that population is wired up.
    testSegmentActive: false,
    status: results.failed.length ? 'Partial' : 'Complete',
    crmUpdateFailures: results.crmUpdateFailures,
  });

  // Step 8: deliver the coordinator run summary. Retries once internally;
  // a second failure gets its own alert with the full summary text (§7).
  const delivery = await deps.webhook.postRunSummary(summary, deps.wait);
  if (!delivery.delivered) {
    await trySendAlert(deps, {
      failureType: 'Run Summary Webhook Delivery Failed',
      runDate: today.toISOString(),
      triggerType: mode.triggerType,
      failedStep: 'Step 8 — POST run summary to MAKE_COORDINATOR_SUMMARY_WEBHOOK_URL',
      errorDetails: `${delivery.reason || 'unknown'} | Full summary: ${JSON.stringify(summary)}`,
      emailsSentBeforeFailure: results.sent.length,
      contactsNeedingManualUpdate: results.crmUpdateFailures.map((f) => f.contactId),
      recommendedAction: 'Check MAKE_COORDINATOR_SUMMARY_WEBHOOK_URL and Make.com Scenario 3 configuration.',
    });
  }

  return {
    statusCode: 200,
    body: {
      success: true,
      runType: mode.triggerType,
      missingBrandAssets: missingAssets,
      moduleDivergences: resolved.divergences,
      skippedPopulations: results.skippedPopulations,
      summaryWebhookDelivered: delivery.delivered,
      summary,
    },
  };
}

module.exports = {
  DEFAULT_DEPS, runAgent1A, contactFromProspectRecord, sendSequenceEmail, markUnresponsiveContact,
  makeFailureCounters, trackFailureCounters,
};
