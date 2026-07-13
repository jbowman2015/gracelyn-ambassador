'use strict';

/**
 * Agent 5 chat pipeline (design §4, steps 1-11) with the §10 failure handling.
 *
 * Every external module is injectable via `deps` so the whole turn runs offline
 * in tests: { zoho, workdrive, wordpress, openai, webhooks, mail, alerts, now }.
 *
 * `input` (from index.js): { session_token, message_text, thread_id,
 * ambassadorsModuleApiName, supportTicketsModuleApiName }.
 */

const M = require('./manifest');
const { AMBASSADOR_FIELDS: AF, SUPPORT_TICKET_FIELDS: TF } = M;
const classify = require('./classify');
const { buildEscalationPayload } = require('./escalation');
const defaultZoho = require('./zoho');
const defaultWorkdrive = require('./workdrive');
const defaultWordpress = require('./wordpress');
const defaultOpenai = require('./openai');
const defaultWebhooks = require('./webhooks');
const defaultMail = require('./mail');
const defaultAlerts = require('./alerts');

function isTrue(v) { return v === true || v === 'true'; }

function fullName(record) {
  const first = record[AF.firstName] || '';
  const last = record[AF.lastName] || '';
  return [first, last].filter(Boolean).join(' ').trim();
}

function buildTicketName(ambassadorLabel, tier, nowIso) {
  const label = ambassadorLabel || 'Unknown Ambassador';
  const raw = `${label} — ${tier} — ${nowIso.slice(0, 10)}`;
  return raw.length > 120 ? raw.slice(0, 120) : raw;
}

function validatePayload(input) {
  const sessionToken = input.session_token;
  const messageText = input.message_text;
  if (!sessionToken || !String(sessionToken).trim()) return 'session_token is required.';
  if (!messageText || !String(messageText).trim()) return 'message_text is required.';
  if (String(messageText).length > M.MAX_MESSAGE_LENGTH) {
    return `message_text exceeds ${M.MAX_MESSAGE_LENGTH} characters.`;
  }
  return null;
}

async function handleChatMessage(input = {}, options = {}) {
  const deps = options.deps || input.deps || {};
  const zoho = deps.zoho || defaultZoho;
  const workdrive = deps.workdrive || defaultWorkdrive;
  const wordpress = deps.wordpress || defaultWordpress;
  const openai = deps.openai || defaultOpenai;
  const webhooks = deps.webhooks || defaultWebhooks;
  const mail = deps.mail || defaultMail;
  const alerts = deps.alerts || defaultAlerts;
  const now = (deps.now && deps.now()) || new Date();

  const ambassadorsModuleApiName = input.ambassadorsModuleApiName;
  const supportTicketsModuleApiName = input.supportTicketsModuleApiName;

  // ── Step 1: validate payload ────────────────────────────────────────────────
  const validationError = validatePayload(input);
  if (validationError) return { success: false, error: validationError };

  // ── Step 2: refresh all OAuth tokens ────────────────────────────────────────
  try {
    zoho.resetToken();
    workdrive.resetToken();
    mail.resetToken();
    await zoho.getCrmToken();
    await workdrive.getWorkDriveToken();
    await mail.getMailToken();
  } catch (err) {
    await alerts.sendAlert({
      errorType: 'token refresh failure', detail: err.message,
      action: 'Re-check the Zoho CRM, Mail, and WorkDrive OAuth credentials in Catalyst.',
    }, { deps });
    return { ...M.FALLBACK_RESPONSE };
  }

  // ── Step 3: verify WordPress session ────────────────────────────────────────
  let email;
  try {
    const session = await wordpress.verifySession(input.session_token);
    if (!session.valid) return { ...M.NOT_VERIFIED_RESPONSE };
    email = session.email;
  } catch (err) {
    return { ...M.NOT_VERIFIED_RESPONSE };
  }

  // ── Step 4: read ambassador CRM record ──────────────────────────────────────
  let record;
  try {
    record = await zoho.findOneByField(ambassadorsModuleApiName, AF.email, email);
  } catch (err) {
    await alerts.sendAlert({
      errorType: 'CRM ambassador lookup failure', detail: err.message,
      action: 'Confirm the Ambassadors module and AF.email field are reachable.', ambassador: email,
    }, { deps });
    return { ...M.FALLBACK_RESPONSE };
  }

  const isActive = !!record && record[AF.status] === M.AMBASSADOR_ACTIVE_STATUS;
  if (!isActive) {
    const minimalTicket = {
      [TF.name]: buildTicketName(email, M.TICKET_TIERS.tier2, now.toISOString()),
      [TF.questionText]: input.message_text,
      [TF.issueCategory]: M.ISSUE_CATEGORIES.other,
      [TF.resolutionStatus]: M.RESOLUTION_STATUS.escalated,
      [TF.ambassadorVipStatus]: false,
    };
    if (record && record.id) minimalTicket[TF.ambassadorId] = { id: record.id };
    try {
      await zoho.createRecord(supportTicketsModuleApiName, minimalTicket);
    } catch (err) {
      await alerts.sendAlert({
        errorType: 'CRM ticket creation failure (inactive ambassador)', detail: err.message,
        action: `Create the ticket manually. Question: ${input.message_text}`, ambassador: email,
      }, { deps });
    }
    return { ...M.NOT_ACTIVE_RESPONSE };
  }

  const ambassador = {
    id: record.id,
    name: fullName(record) || email,
    email,
    isVip: isTrue(record[AF.vipFlag]),
  };

  // ── Step 5: read support brand assets (non-fatal) ───────────────────────────
  let brand = { copyRules: '', programDescriptions: '' };
  try {
    const folder08 = M.getEnv('WORKDRIVE_FOLDER_08_ID');
    if (!folder08) throw new Error('WORKDRIVE_FOLDER_08_ID is not set');
    brand = await workdrive.readBrandAssets(folder08, M.BRAND_ASSETS);
  } catch (err) {
    await alerts.sendAlert({
      errorType: 'asset missing', detail: err.message,
      action: 'Confirm ambassador_copy_rules.txt and ambassador_program_descriptions.txt exist in WorkDrive Folder 08.',
      ambassador: email,
    }, { deps });
  }
  const additionalInstructions = [brand.copyRules, brand.programDescriptions].filter(Boolean).join('\n\n');

  // ── Steps 6-7: OpenAI thread + run ──────────────────────────────────────────
  const turn = await openai.runAssistantTurn({
    threadId: input.thread_id, message: input.message_text, additionalInstructions, deps,
  });

  const issueCategory = classify.classifyIssueCategory(input.message_text);
  const resolutionComplexity = classify.classifyComplexity(input.message_text);

  if (!turn.ok) {
    const tier = ambassador.isVip ? M.TICKET_TIERS.vip : M.TICKET_TIERS.tier2;
    const alertMeta = {
      thread_error: { errorType: 'OpenAI thread creation failure', action: 'Investigate the OpenAI API failure.' },
      run_timeout: { errorType: 'OpenAI run timeout', action: `Investigate the stalled run. Thread: ${turn.threadId}` },
      run_failed: { errorType: 'OpenAI run failure', action: `Investigate the failed run. Thread: ${turn.threadId}, Run: ${turn.runId || 'n/a'}` },
    }[turn.reason] || { errorType: 'OpenAI failure', action: 'Investigate the OpenAI API failure.' };
    await alerts.sendAlert({ ...alertMeta, detail: turn.error, ambassador: email }, { deps });

    const escalationTimestamp = now.toISOString();
    const ticketRecord = {
      [TF.name]: buildTicketName(ambassador.name, tier, escalationTimestamp),
      [TF.ambassadorId]: { id: ambassador.id },
      [TF.questionText]: input.message_text,
      [TF.ticketTier]: tier,
      [TF.issueCategory]: issueCategory,
      [TF.ambassadorVipStatus]: ambassador.isVip,
      [TF.resolutionComplexity]: resolutionComplexity,
      [TF.resolutionStatus]: M.RESOLUTION_STATUS.escalated,
      [TF.escalationTimestamp]: escalationTimestamp,
    };
    let ticketId = null;
    try {
      const res = await zoho.createRecord(supportTicketsModuleApiName, ticketRecord);
      ticketId = res.id;
    } catch (err) {
      await alerts.sendAlert({
        errorType: 'CRM ticket creation failure', detail: err.message,
        action: `Create the ticket manually. Question: ${input.message_text}`, ambassador: email,
      }, { deps });
    }
    await fireEscalation({
      ticketId, ambassador, questionText: input.message_text, tier, issueCategory,
      resolutionComplexity, escalationTimestamp, webhooks, mail, alerts, deps,
    });
    return { ...M.FALLBACK_RESPONSE };
  }

  // ── Step 8: classify tier ────────────────────────────────────────────────────
  const tier = classify.classifyTier({
    isVip: ambassador.isVip, questionText: input.message_text, responseText: turn.responseText,
  });
  const isEscalated = tier !== M.TICKET_TIERS.tier1;
  const timestamp = now.toISOString();

  // ── Step 9: write Support Ticket ────────────────────────────────────────────
  const ticketRecord = {
    [TF.name]: buildTicketName(ambassador.name, tier, timestamp),
    [TF.ambassadorId]: { id: ambassador.id },
    [TF.questionText]: input.message_text,
    [TF.ticketTier]: tier,
    [TF.issueCategory]: issueCategory,
    [TF.ambassadorVipStatus]: ambassador.isVip,
    [TF.resolutionComplexity]: resolutionComplexity,
    [TF.resolutionStatus]: isEscalated ? M.RESOLUTION_STATUS.escalated : M.RESOLUTION_STATUS.resolved,
  };
  if (isEscalated) ticketRecord[TF.escalationTimestamp] = timestamp;
  else ticketRecord[TF.resolutionTimestamp] = timestamp;

  let ticketId = null;
  try {
    const res = await zoho.createRecord(supportTicketsModuleApiName, ticketRecord);
    ticketId = res.id;
  } catch (err) {
    await alerts.sendAlert({
      errorType: 'CRM ticket creation failure', detail: err.message,
      action: `Create the ticket manually. Question: ${input.message_text}. Email: ${email}`, ambassador: email,
    }, { deps });
  }

  // ── Step 10: fire escalation webhook (Tier 2+) ──────────────────────────────
  if (isEscalated) {
    await fireEscalation({
      ticketId, ambassador, questionText: input.message_text, tier, issueCategory,
      resolutionComplexity, escalationTimestamp: timestamp, webhooks, mail, alerts, deps,
    });
  }

  // ── Step 11: return response to WordPress ───────────────────────────────────
  return { success: true, response: turn.responseText, thread_id: turn.threadId, ticket_id: ticketId };
}

/** Step 10 helper — fire the Make.com escalation webhook, with the fallback email on double failure. */
async function fireEscalation({ ticketId, ambassador, questionText, tier, issueCategory, resolutionComplexity, escalationTimestamp, webhooks, mail, alerts, deps }) {
  const payload = buildEscalationPayload({ ticketId, ambassador, questionText, tier, issueCategory, resolutionComplexity, escalationTimestamp });
  const url = M.getEnv('MAKE_ESCALATION_WEBHOOK_URL');
  const res = await webhooks.fireWebhook(url, payload, { retryDelayMs: M.WEBHOOK_RETRY_DELAY_MS, deps });
  if (res.ok) return res;

  const coordinator = M.getEnv('SUPPORT_COORDINATOR_EMAIL');
  try {
    await mail.sendMail({
      to: coordinator,
      subject: `Ambassador Support Ticket — ${ambassador.name} — ${ticketId || 'no ticket id'}`,
      content: [
        `Escalation webhook delivery failed (${res.error || 'non-200'}) — sending this ticket directly.`,
        '',
        `Ambassador: ${ambassador.name} (${ambassador.email})`,
        `Tier: ${tier}`,
        `Issue category: ${issueCategory}`,
        `Resolution complexity: ${resolutionComplexity}`,
        `Ticket ID: ${ticketId || 'n/a'}`,
        `Escalation timestamp: ${escalationTimestamp}`,
        '',
        `Question: ${questionText}`,
      ].join('\n'),
    });
  } catch (err) {
    await alerts.sendAlert({
      errorType: 'fallback escalation email failure', detail: err.message,
      action: 'Notify the support coordinator manually — both the webhook and the fallback email failed.',
      ambassador: ambassador.email,
    }, { deps });
  }
  await alerts.sendAlert({
    errorType: 'escalation webhook failure', detail: res.error || 'non-200 after retry',
    action: 'Confirm the Make.com escalation scenario is reachable. Fallback email sent to the coordinator.',
    ambassador: ambassador.email,
  }, { deps });
  return res;
}

module.exports = { handleChatMessage, validatePayload, buildTicketName, fullName };
