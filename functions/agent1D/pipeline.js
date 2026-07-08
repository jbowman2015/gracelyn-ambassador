'use strict';

/**
 * Agent 1D run pipeline — design §4 Steps 1-8, applied per form submission.
 * Both the real-time webhook route and the nightly cleanup job (cleanup.js)
 * call `processSubmission` for each submission — the design doc requires the
 * exact same steps for both triggers.
 *
 * Every external module is injectable via `opts.deps` so the whole pipeline
 * runs offline in tests. `opts.fastRetry` zeroes the design's real retry
 * delays (30s CRM, 60s handoff webhook) for tests — mirrors functions/agent0's
 * pipeline `input.fastRetry` convention.
 */

const M = require('./manifest');
const { parseAndValidateSubmission } = require('./validate');
const { resolveAudienceTrack } = require('./routing');
const email = require('./email');
const defaultZoho = require('./zoho');
const defaultWorkdrive = require('./workdrive');
const defaultMail = require('./mail');
const defaultClaude = require('./claude');
const defaultWebhooks = require('./webhooks');
const defaultAlerts = require('./alerts');
const { withRetryOnce } = require('./retry');
const { wait, RETRY_DELAY_MS, HANDOFF_RETRY_DELAY_MS } = require('./wait');

function minLinkDays() {
  const n = Number(M.getEnv('AGENT1D_LEAD_MAGNET_LINK_MIN_DAYS'));
  return Number.isFinite(n) && n > 0 ? n : 7;
}

/** Returns the parsed LEAD_MAGNET_MAP object, or null if it fails to parse. */
function parseLeadMagnetMap() {
  const raw = M.getEnv('LEAD_MAGNET_MAP');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function processSubmission(payload, opts = {}) {
  const deps = opts.deps || {};
  const zoho = deps.zoho || defaultZoho;
  const workdrive = deps.workdrive || defaultWorkdrive;
  const mail = deps.mail || defaultMail;
  const claude = deps.claude || defaultClaude;
  const webhooks = deps.webhooks || defaultWebhooks;
  const alerts = deps.alerts || defaultAlerts;
  const waitFn = deps.wait || wait;
  const fastRetry = !!opts.fastRetry;

  const result = { success: false, halted: null, errors: [], submission: null };
  const alert = (errorType, detail, extra = {}) =>
    alerts.sendAlert({ errorType, detail, ...extra }, { deps });

  // ── Step 1: receive and validate ────────────────────────────────────────────
  const { valid, errors, submission } = parseAndValidateSubmission(payload);
  result.submission = submission;
  if (!valid) {
    await alert('Invalid form submission', errors.join('; '),
      { email: submission.email, leadMagnetId: submission.leadMagnetId });
    result.halted = 'Step 1 validation';
    result.errors = errors;
    return result;
  }

  // ── Step 2: refresh all OAuth tokens ────────────────────────────────────────
  try {
    zoho.resetToken();
    workdrive.resetToken();
    mail.resetToken();
    await zoho.getCrmToken();
    await workdrive.getWorkDriveToken();
    await mail.getMailToken();
  } catch (err) {
    await alert('Token refresh failure', err.message, { email: submission.email });
    result.halted = 'Step 2 token refresh';
    return result;
  }

  // ── Step 3: resolve audience track ──────────────────────────────────────────
  const audienceTrack = resolveAudienceTrack(submission.leadMagnetId);
  result.audienceTrack = audienceTrack;
  if (audienceTrack === M.AUDIENCE_TRACKS.unknown) {
    await alert('Unrecognized lead_magnet_id prefix',
      `lead_magnet_id "${submission.leadMagnetId}" did not match a known track.`,
      { email: submission.email, leadMagnetId: submission.leadMagnetId });
  }

  // ── Step 4: lead magnet download link ───────────────────────────────────────
  let leadMagnetLink = { url: null, resourceName: null, reason: null };
  const leadMagnetMap = parseLeadMagnetMap();
  if (leadMagnetMap === null) {
    leadMagnetLink.reason = 'LEAD_MAGNET_MAP is not valid JSON';
    await alert('LEAD_MAGNET_MAP parse error', leadMagnetLink.reason, { email: submission.email });
  } else {
    try {
      const folder06 = M.getEnv('WORKDRIVE_FOLDER_06_ID');
      leadMagnetLink = await workdrive.resolveLeadMagnetLink(
        folder06, leadMagnetMap, submission.leadMagnetId, minLinkDays(),
      );
      if (!leadMagnetLink.url) {
        await alert('Lead magnet file not found', leadMagnetLink.reason || 'unknown',
          { email: submission.email, leadMagnetId: submission.leadMagnetId });
      }
    } catch (err) {
      leadMagnetLink = { url: null, resourceName: null, reason: err.message };
      await alert('Lead magnet link generation failure', err.message,
        { email: submission.email, leadMagnetId: submission.leadMagnetId });
    }
  }
  result.leadMagnetLink = leadMagnetLink;

  // ── Step 5: resolve module, verify fields, then dedup by email ─────────────
  let moduleApi;
  try {
    const resolved = await zoho.resolveModuleApiName(M.PROSPECTS_MODULE);
    moduleApi = resolved.apiName;
    if (resolved.divergence) {
      result.errors.push(`Module divergence: ${resolved.divergence}`);
      await alert('CRM module divergence', resolved.divergence, { email: submission.email });
    }
    const writeFields = Object.values(M.PROSPECT_FIELDS);
    const { missing } = await zoho.verifyFields(moduleApi, writeFields);
    if (missing.length) {
      result.errors.push(`Missing Prospects fields: ${missing.join(', ')}`);
      await alert('CRM field divergence', `Fields missing on "${moduleApi}": ${missing.join(', ')}`,
        { email: submission.email });
    }
  } catch (err) {
    await alert('CRM metadata failure', err.message, { email: submission.email });
    result.halted = 'Step 5 module resolution';
    return result;
  }

  let existing = null;
  try {
    existing = await zoho.findByDedupKey(moduleApi, M.PROSPECT_FIELDS.dedupKey, submission.email);
  } catch (err) {
    result.errors.push(`Dedup lookup failed: ${err.message}`);
  }

  const F = M.PROSPECT_FIELDS;
  try {
    if (!existing) {
      // Step 5a — create.
      const record = {
        [F.firstName]: submission.firstName,
        [F.email]: submission.email,
        [F.roleCategory]: submission.roleCategory,
        [F.audienceTrack]: audienceTrack,
        // submission.state is parsed/validated but not sent — Location_State_Province
        // is a global dependent picklist, not a plain field (manifest.js divergence #6).
        [F.leadMagnetsDownloaded]: submission.leadMagnetId,
        [F.outreachStatus]: M.OUTREACH_STATUS_NEW_LEAD_VALUE,
        [F.recruitingSource]: M.RECRUITING_SOURCE_VALUE,
        [F.recruitingChannel]: submission.leadMagnetId,
        [F.utmSource]: submission.utmSource,
        [F.utmCampaign]: submission.utmCampaign,
        [F.contactFound]: true,
      };
      result.crmOp = await withRetryOnce(() => zoho.createRecord(moduleApi, record), waitFn, RETRY_DELAY_MS);
    } else {
      // Step 5b — update. Only touch Lead_Magnets_Downloaded and (conditionally)
      // Audience_Track. Never overwrite Outreach_Status, Recruiting_Source, or UTM fields.
      const priorDownloads = existing[F.leadMagnetsDownloaded];
      const update = {
        [F.leadMagnetsDownloaded]: priorDownloads
          ? `${priorDownloads},${submission.leadMagnetId}`
          : submission.leadMagnetId,
      };
      if (!existing[F.audienceTrack] || existing[F.audienceTrack] === M.AUDIENCE_TRACKS.unknown) {
        update[F.audienceTrack] = audienceTrack;
      }
      result.crmOp = await withRetryOnce(() => zoho.updateRecord(moduleApi, existing.id, update), waitFn, RETRY_DELAY_MS);
    }
  } catch (err) {
    await alert('CRM create/update failure', err.message, { email: submission.email });
    result.halted = 'Step 5 CRM write';
    result.crmError = err.message;
    return result;
  }

  // ── Step 6: Claude opening sentence ─────────────────────────────────────────
  const opening = await claude.generateOpeningSentence({
    firstName: submission.firstName,
    roleCategory: submission.roleCategory,
    audienceTrack,
    leadMagnetName: leadMagnetLink.resourceName || submission.leadMagnetId,
  });
  if (!opening.ok) result.errors.push(`Claude opening sentence failed, fallback used: ${opening.error}`);
  result.opening = opening;

  // ── Step 7: send delivery email ─────────────────────────────────────────────
  try {
    const subject = email.buildSubject(M.getEnv('AGENT1D_DELIVERY_EMAIL_SUBJECT'), leadMagnetLink.resourceName);
    const body = email.buildBody({
      openingSentence: opening.sentence,
      downloadUrl: leadMagnetLink.url,
      resourceName: leadMagnetLink.resourceName,
      audienceTrack,
    });
    await mail.sendMail(submission.email, subject, body);
    result.emailSent = true;
  } catch (err) {
    result.emailSent = false;
    result.errors.push(`Delivery email failed: ${err.message}`);
    await alert('Delivery email send failure', err.message, { email: submission.email });
  }

  // ── Step 8: Agent 1A handoff webhook ────────────────────────────────────────
  const handoffUrl = M.getEnv('MAKE_AGENT1A_FROM_1D_WEBHOOK_URL');
  result.handoffWebhook = await webhooks.fireWebhook(handoffUrl, {
    type: 'lead_capture_new_contact',
    email: submission.email,
    first_name: submission.firstName,
    role_category: submission.roleCategory,
    audience_track: audienceTrack,
    lead_magnet_id: submission.leadMagnetId,
  }, { retryDelayMs: fastRetry ? 0 : HANDOFF_RETRY_DELAY_MS, deps });
  if (!result.handoffWebhook.ok) {
    await alert('Agent 1A handoff webhook failure', result.handoffWebhook.error || 'non-200',
      { email: submission.email, leadMagnetId: submission.leadMagnetId });
  }

  result.success = true;
  return result;
}

module.exports = { processSubmission, parseLeadMagnetMap, minLinkDays };
