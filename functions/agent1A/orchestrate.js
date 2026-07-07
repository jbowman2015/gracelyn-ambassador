'use strict';

/**
 * Agent 1A core orchestration — deliberately Express-free so it can be
 * required by __tests__ without pulling in the `express` dependency (mirrors
 * functions/agent5A's split between validators.js/zoho.js and index.js).
 * index.js is the thin Express wrapper around runAgent1A().
 *
 * Real network calls (zoho, mail, workdrive, personalize, reconcile) are
 * injected via `deps` so this can be exercised with fakes in tests — no
 * network, no deps, no secrets required locally.
 */

const criteria = require('./criteria');
const sequencing = require('./sequencing');
const templates = require('./templates');
const { buildSubjectLine } = require('./subject');
const { buildRunSummary } = require('./run-summary');
const reconcile = require('./reconcile');

const zoho = require('./zoho');
const mail = require('./mail');
const workdrive = require('./workdrive');
const personalize = require('./personalize');

const DEFAULT_DEPS = { zoho, mail, workdrive, personalize, reconcile };

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
 * cause duplicate sends on retry).
 */
async function sendSequenceEmail(contact, population, seq, assets, deps, today, crmModuleApi) {
  const tmpl = templates.selectTemplate(population, seq);
  if (!tmpl.body || !tmpl.subject) {
    return { sent: false, contactId: contact.id, reason: `Template env vars ${tmpl.subjectKey}/${tmpl.bodyKey} not set` };
  }

  let personalizedBody = tmpl.body;
  try {
    const result = await deps.personalize.personalizeEmail(contact, tmpl.body, assets);
    personalizedBody = result.body;
  } catch {
    // personalizeEmail is designed not to throw, but guard anyway — fall back to template.
  }
  const subject = buildSubjectLine(tmpl.subject, contact.firstName);

  try {
    await deps.mail.sendRecruitingEmail(contact.email, subject, personalizedBody);
  } catch (err) {
    return { sent: false, contactId: contact.id, reason: `Mail send failed: ${err.message}` };
  }

  const record = seq === 1
    ? sequencing.markEmail1Sent(contact.id, today)
    : sequencing.markEmail2Sent(contact.id, today);
  try {
    await deps.zoho.crmUpdateRecord(crmModuleApi, record);
  } catch (err) {
    return { sent: true, contactId: contact.id, crmUpdateFailed: true, reason: `CRM update failed after send: ${err.message}` };
  }
  return { sent: true, contactId: contact.id };
}

async function markUnresponsiveContact(contact, deps, crmModuleApi) {
  try {
    await deps.zoho.crmUpdateRecord(crmModuleApi, sequencing.markUnresponsive(contact.id));
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

function workdriveMissingAll() {
  return workdrive.BRAND_ASSET_FILES.slice();
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
  // run — no emails sent (design doc §7, row 1).
  try {
    await Promise.all([
      deps.zoho.getCrmToken(),
      deps.mail.getMailToken(),
      deps.workdrive.getWorkdriveToken(),
    ]);
  } catch (err) {
    return { statusCode: 502, body: { success: false, error: `OAuth token refresh failed — run aborted: ${err.message}` } };
  }

  // Step 3: brand assets. Missing files degrade personalization, never abort.
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

  const results = { sent: [], failed: [], crmUpdateFailures: [], unresponsiveMarked: [] };

  if (mode.triggerType === 'agent0_complete') {
    let prospects = [];
    try {
      prospects = await deps.zoho.crmSearch(prospectsApi, criteria.newProspectsCriteria(), criteria.PROSPECT_SEARCH_FIELDS);
    } catch (err) {
      return { statusCode: 502, body: { success: false, error: `Prospect query failed — run aborted: ${err.message}` } };
    }
    for (const rec of prospects) {
      const contact = contactFromProspectRecord(rec);
      const outcome = await sendSequenceEmail(contact, 'prospect', 1, assets, deps, today, prospectsApi);
      recordOutcome(results, outcome);
    }
    // Para DB / Student-Alumni populations: only run if their modules resolved
    // live. Neither is confirmed in Zoho as of this build (Master Reference
    // Sheet §4) — skipping is expected, not an error.
    results.skippedPopulations = results.skippedPopulations || [];
    if (!resolved.resolved.paraDb) results.skippedPopulations.push('paraDb');
    if (!resolved.resolved.studentAlumni) results.skippedPopulations.push('studentAlumni');
  } else if (mode.triggerType === 'followup_schedule') {
    let contacts = [];
    try {
      contacts = await deps.zoho.crmSearch(prospectsApi, criteria.followUpCriteria(today), criteria.PROSPECT_SEARCH_FIELDS);
    } catch (err) {
      return { statusCode: 502, body: { success: false, error: `Follow-up query failed — run aborted: ${err.message}` } };
    }
    for (const rec of contacts) {
      const contact = contactFromProspectRecord(rec);
      const outcome = await sendSequenceEmail(contact, 'prospect', 2, assets, deps, today, prospectsApi);
      recordOutcome(results, outcome);
    }
  } else if (mode.triggerType === 'unresponsive_mark') {
    let contacts = [];
    try {
      contacts = await deps.zoho.crmSearch(prospectsApi, criteria.unresponsiveCriteria(today), criteria.PROSPECT_SEARCH_FIELDS);
    } catch (err) {
      return { statusCode: 502, body: { success: false, error: `Unresponsive query failed — run aborted: ${err.message}` } };
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
      rec = await deps.zoho.crmGetRecord(prospectsApi, prospectCrmId, criteria.PROSPECT_SEARCH_FIELDS);
    } catch (err) {
      return { statusCode: 502, body: { success: false, error: `Lead capture record lookup failed: ${err.message}` } };
    }
    const contact = { ...contactFromProspectRecord(rec), roleCategory: roleCategory || rec.Role_Category };
    const outcome = await sendSequenceEmail(contact, 'prospect', 1, assets, deps, today, prospectsApi);
    recordOutcome(results, outcome);
  }

  const summary = buildRunSummary({
    triggeredAt: mode.payload.triggered_at || today.toISOString(),
    runType: mode.triggerType,
    emailsSent: results.sent.length,
    emailsFailed: results.failed.length,
    contactsProcessed: results.sent.length + results.failed.length + results.unresponsiveMarked.length,
    prospectSent: results.sent.length,
    testSegmentActive: true,
    status: results.failed.length ? 'Partial' : 'Complete',
    crmUpdateFailures: results.crmUpdateFailures,
  });

  return {
    statusCode: 200,
    body: {
      success: true,
      runType: mode.triggerType,
      missingBrandAssets: missingAssets,
      moduleDivergences: resolved.divergences,
      skippedPopulations: results.skippedPopulations || [],
      summary,
    },
  };
}

module.exports = { DEFAULT_DEPS, runAgent1A, contactFromProspectRecord, sendSequenceEmail, markUnresponsiveContact };
