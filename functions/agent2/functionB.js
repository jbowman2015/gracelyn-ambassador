'use strict';

/**
 * Function B: Approval and Track Routing (design §6.2). Triggered by the
 * Make.com Zoho Flow on Status = Approved (Phase 1) or by the application
 * pipeline directly (Phase 2, to run the auto-approve check).
 *
 * B1  — read APPROVAL_MODE.
 * B2a — Phase 1 (MANUAL): no action until the coordinator has already set
 *       Ambassador_Status = Approved; then fall through to B3.
 * B2b — Phase 2 (AUTO): run the five auto-approve criteria. All pass → set
 *       Approved + Auto_Approved audit fields, fall through to B3. Any
 *       failure → exception queue, alert the coordinator, stop.
 * B2c — VIP_Prospect_Origin always overrides AUTO: routes to the exception
 *       queue for personal review, never auto-approved. (Only gates the AUTO
 *       branch — a coordinator's manual approval in Phase 1 is already a
 *       human decision, so B2c does not re-block B2a.)
 * B3   — branch on VIP_Flag.
 * B4-Standard / B4-VIP — send the approval welcome email; VIP additionally
 *       gets a personalized paragraph, a HeyGen video job, and a relationship
 *       manager notification.
 * B5   — write Approved_Date (design's Approval_Date), which the compliance
 *       reminder schedule (Function C) is keyed from.
 */

const M = require('./manifest');
const { AMBASSADORS_FIELDS: AF, AMBASSADOR_STATUS: STATUS } = M;
const defaultZoho = require('./zoho');
const defaultMail = require('./mail');
const defaultWorkdrive = require('./workdrive');
const defaultClaude = require('./claude');
const defaultHeygen = require('./heygen');
const defaultWebhooks = require('./webhooks');
const defaultAlerts = require('./alerts');
const { dateStr } = require('./dates');
const { runAutoApproveCriteria } = require('./autoApprove');
const { buildEmailB, buildEmailBVip } = require('./emails');

async function routeToExceptionQueue({ record, moduleApiName, reason, zoho, alerts, deps, today }) {
  try {
    await zoho.updateRecord(moduleApiName, record.id, {
      [AF.needsExceptionReview]: true,
      [AF.exceptionReason]: reason,
    });
  } catch (err) {
    await alerts.sendAlert({
      errorType: 'exception queue write failure', detail: err.message,
      action: 'Manually flag this application for review.', ambassador: record[AF.email], date: today,
    }, { deps });
  }
  await alerts.sendAlert({
    errorType: 'auto-approve routed to exception queue', detail: reason,
    action: 'Review the application in the Coordinator Approval Queue and approve, decline, or hold.',
    ambassador: record[AF.email], date: today,
  }, { deps });
}

async function sendVipWelcome({ record, deps, workdrive, claude, heygen, mail, webhooks, alerts, moduleApiName, zoho, today }) {
  const ambassador = {
    firstName: record[AF.firstName], roleCategory: record[AF.roleCategory],
    audienceTrack: record[AF.audienceTrack], audienceEstimate: null,
  };
  let paragraph = '';
  try {
    const folder08 = M.getEnv('WORKDRIVE_FOLDER_08_ID');
    const voiceGuidelines = folder08 ? await workdrive.readVoiceGuidelines(folder08) : '';
    paragraph = await claude.generateVIPParagraph({ ambassador, voiceGuidelines });
  } catch (err) {
    await alerts.sendAlert({
      errorType: 'VIP personalization generation failure', detail: err.message,
      action: 'Send Email B-VIP with a manually written personalization paragraph.', ambassador: record[AF.email], date: today,
    }, { deps });
    paragraph = `We are excited to welcome you and learn more about your work in ${ambassador.roleCategory || 'your community'}.`;
  }

  try {
    const { subject, content } = buildEmailBVip({ firstName: ambassador.firstName }, paragraph);
    await mail.sendMail({ to: record[AF.email], subject, content });
  } catch (err) {
    await alerts.sendAlert({
      errorType: 'Email B-VIP send failure', detail: err.message,
      action: 'Resend the VIP welcome email manually.', ambassador: record[AF.email], date: today,
    }, { deps });
  }

  try {
    const { jobId } = await heygen.submitVipWelcomeVideo({
      firstName: ambassador.firstName,
      script: `A personal welcome from Dr. Flippen to ${ambassador.firstName}, our newest Gracelyn ambassador.`,
    });
    await zoho.updateRecord(moduleApiName, record.id, { [AF.vipHeyGenJobId]: jobId });
  } catch (err) {
    await alerts.sendAlert({
      errorType: 'HeyGen video submission failure', detail: err.message,
      action: 'VIP relationship manager should send a personal video message directly.', ambassador: record[AF.email], date: today,
    }, { deps });
  }

  const vipWebhook = M.getEnv('MAKE_VIP_MANAGER_NOTIFY_WEBHOOK_URL');
  const res = await webhooks.fireWebhook(vipWebhook, {
    type: 'vip_approval', ambassadorId: record.id, firstName: ambassador.firstName,
    email: record[AF.email], roleCategory: ambassador.roleCategory, audienceTrack: ambassador.audienceTrack,
  }, { retryDelayMs: 30000, deps });
  if (!res.ok) {
    await alerts.sendAlert({
      errorType: 'VIP relationship manager notification failure', detail: res.error || 'non-200',
      action: 'Notify the VIP relationship manager manually of this new approval.', ambassador: record[AF.email], date: today,
    }, { deps });
  }
}

async function runFunctionB(input = {}, deps = {}) {
  const zoho = deps.zoho || defaultZoho;
  const mail = deps.mail || defaultMail;
  const workdrive = deps.workdrive || defaultWorkdrive;
  const claude = deps.claude || defaultClaude;
  const heygen = deps.heygen || defaultHeygen;
  const webhooks = deps.webhooks || defaultWebhooks;
  const alerts = deps.alerts || defaultAlerts;
  const now = (deps.now && deps.now()) || new Date();
  const today = dateStr(now);
  const moduleApiName = input.ambassadorsModuleApiName;

  const record = input.record || await zoho.getRecord(moduleApiName, input.ambassadorId);
  if (!record) return { ok: false, halted: 'B: no Ambassador CRM record found.' };

  const approvalMode = (M.getEnv('APPROVAL_MODE') || 'MANUAL').toUpperCase();

  // B1/B2a — Phase 1: no action until Status is already Approved.
  if (approvalMode === 'MANUAL') {
    if (record[AF.status] !== STATUS.approved) {
      return { ok: true, action: 'waiting_for_manual_approval' };
    }
  } else {
    // B2c — VIP_Prospect_Origin always overrides auto-approve.
    if (record[AF.vipProspectOrigin] === true || record[AF.vipProspectOrigin] === 'true') {
      await routeToExceptionQueue({
        record, moduleApiName, zoho, alerts, deps, today,
        reason: 'VIP_Prospect_Origin = true — always routes to human review, never auto-approved.',
      });
      return { ok: true, action: 'exception_queue', reason: 'vip_prospect_origin' };
    }

    // B2b — Phase 2: run the five criteria.
    const check = await runAutoApproveCriteria(record, moduleApiName, zoho);
    if (!check.allPass) {
      await routeToExceptionQueue({
        record, moduleApiName, zoho, alerts, deps, today,
        reason: check.failures.map((f) => f.reason).join(' '),
      });
      return { ok: true, action: 'exception_queue', failures: check.failures };
    }

    try {
      await zoho.updateRecord(moduleApiName, record.id, {
        [AF.status]: STATUS.approved,
        [AF.autoApproved]: true,
        [AF.autoApproveTimestamp]: now.toISOString(),
        [AF.autoApproveCriteriaVersion]: M.getEnv('AUTO_APPROVE_CRITERIA_VERSION') || M.DEFAULT_AUTO_APPROVE_CRITERIA_VERSION,
      });
      record[AF.status] = STATUS.approved;
    } catch (err) {
      await alerts.sendAlert({
        errorType: 'auto-approve write failure', detail: err.message,
        action: 'Approve this application manually — auto-approve criteria passed but the CRM write failed.',
        ambassador: record[AF.email], date: today,
      }, { deps });
      return { ok: false, halted: `B2b write: ${err.message}` };
    }
  }

  // B3/B4 — track routing.
  const isVip = record[AF.vipFlag] === true || record[AF.vipFlag] === 'true';
  if (isVip) {
    await sendVipWelcome({ record, deps, workdrive, claude, heygen, mail, webhooks, alerts, moduleApiName, zoho, today });
  } else {
    try {
      const { subject, content } = buildEmailB({ firstName: record[AF.firstName] });
      await mail.sendMail({ to: record[AF.email], subject, content });
    } catch (err) {
      await alerts.sendAlert({
        errorType: 'Email B send failure', detail: err.message,
        action: 'Resend the approval welcome email manually.', ambassador: record[AF.email], date: today,
      }, { deps });
    }
  }

  // B5 — start the compliance reminder schedule.
  try {
    await zoho.updateRecord(moduleApiName, record.id, { [AF.approvalDate]: today });
  } catch (err) {
    await alerts.sendAlert({
      errorType: 'Approval_Date write failure', detail: err.message,
      action: 'Set Approved_Date by hand so the compliance reminder schedule starts correctly.',
      ambassador: record[AF.email], date: today,
    }, { deps });
  }

  return { ok: true, action: 'approved', track: isVip ? 'vip' : 'standard' };
}

module.exports = { runFunctionB, routeToExceptionQueue };
