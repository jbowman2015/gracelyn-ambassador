'use strict';

/**
 * Referral stage-change webhook (real-time) and daily milestone detection
 * (design §2.2, 7:00 AM CST). Milestones fire at the 1st, 5th, and 10th
 * confirmed (Enrolled) referral.
 */

const M = require('./manifest');
const dates = require('./dates');
const { recordToAmbassador, ambassadorPatch, sendWithRetry } = require('./common');
const prompts = require('./prompts');
const referrals = require('./referrals');
const { moduleAndVerify } = require('./sprint');

const defaultZoho = require('./zoho');
const defaultMail = require('./mail');
const defaultClaude = require('./claude');
const defaultAlerts = require('./alerts');
const defaultHeygen = require('./heygen');

const MILESTONE_NUMBERS = [1, 5, 10];

function resolveDeps(input) {
  const d = input.deps || {};
  return {
    zoho: d.zoho || defaultZoho,
    mail: d.mail || defaultMail,
    claude: d.claude || defaultClaude,
    alerts: d.alerts || defaultAlerts,
    heygen: d.heygen || defaultHeygen,
    now: (d.now && d.now()) || new Date(),
  };
}

/**
 * Real-time Zoho Flow webhook on Referral stage change. Sends Email E
 * (Applied) or Email F (Enrolled); sets Sprint_Referral_Submitted when the
 * ambassador is mid-sprint; returns an Alternative-track ambassador to
 * Standard immediately on a new referral (design §5.4 NOTE, §10).
 *
 * @param {object} input { ambassadorId, referralStage: 'Applied'|'Enrolled' }
 */
async function referralStageChangeWebhook(input = {}) {
  const deps = resolveDeps(input);
  const { zoho, mail, claude, alerts, now } = deps;
  const today = dates.dateStr(now);
  const ctx = { runType: 'real-time', date: today, timeCst: dates.timeCst(now), deps: input.deps };

  const summary = { emailSent: false, sprintFlagSet: false, returnedToStandard: false, halted: null, errors: [] };

  let moduleApi;
  try {
    const v = await moduleAndVerify(zoho, alerts, ctx);
    moduleApi = v.moduleApi;
    if (v.missing.length) { summary.halted = `Missing required CRM fields: ${v.missing.join(', ')}`; return summary; }
  } catch (err) {
    summary.halted = `module resolution: ${err.message}`;
    return summary;
  }

  let record;
  try {
    record = await zoho.getRecordById(moduleApi, input.ambassadorId);
  } catch (err) {
    summary.halted = `ambassador lookup: ${err.message}`;
    await alerts.sendAlert({
      errorType: 'ambassador lookup failure', detail: err.message,
      action: 'Confirm the Zoho Flow webhook sent a valid ambassador id.', runType: ctx.runType, date: ctx.date, timeCst: ctx.timeCst,
    }, { deps: input.deps });
    return summary;
  }
  const amb = recordToAmbassador(record);

  const user = prompts.buildReferralNotificationPrompt(amb, input.referralStage);
  try {
    const body = await claude.generateEmail({ system: prompts.buildStandardSystemPrompt('', ''), user, maxTokens: 250 });
    const subject = input.referralStage === 'Enrolled' ? 'Great news about your referral' : 'Your referral applied';
    const res = await sendWithRetry({
      mail, alerts, to: amb.email, subject, text: body, ambassadorName: amb.firstName,
      errorType: 'referral notification email failure', action: 'Retry sending the notification manually.', ctx, deps: input.deps,
    });
    summary.emailSent = res.ok;
  } catch (err) {
    summary.errors.push(`Claude generation failed: ${err.message}`);
  }

  const patch = {};
  if (amb.activationSprintWeek > 0 && !amb.sprintReferralSubmitted) {
    patch.sprintReferralSubmitted = true;
    summary.sprintFlagSet = true;
  }
  if (input.referralStage === 'Applied' && amb.engagementTrack === M.ENGAGEMENT_TRACK_VALUES.alternative) {
    patch.engagementTrack = M.ENGAGEMENT_TRACK_VALUES.standard;
    patch.contentWeekPosition = 1;
    summary.returnedToStandard = true;
  }
  if (Object.keys(patch).length) {
    try { await zoho.updateRecord(moduleApi, amb.id, ambassadorPatch(patch)); }
    catch (err) { summary.errors.push(`CRM update failed: ${err.message}`); }
  }

  return summary;
}

/**
 * Daily 7:00 AM CST job: detect ambassadors whose cumulative Enrolled
 * referral count crossed 1, 5, or 10 via a referral that reached Enrolled in
 * the last 24 hours.
 */
async function milestoneDetectionJob(input = {}) {
  const deps = resolveDeps(input);
  const { zoho, mail, claude, alerts, heygen, now } = deps;
  const today = dates.dateStr(now);
  const ctx = { runType: 'scheduled', date: today, timeCst: dates.timeCst(now), deps: input.deps };

  const summary = { milestonesHit: 0, emailsSent: 0, videosSubmitted: 0, halted: null, errors: [] };

  let moduleApi;
  try {
    const v = await moduleAndVerify(zoho, alerts, ctx);
    moduleApi = v.moduleApi;
    if (v.missing.length) { summary.halted = `Missing required CRM fields: ${v.missing.join(', ')}`; return summary; }
  } catch (err) {
    summary.halted = `module resolution: ${err.message}`;
    return summary;
  }
  const referralsModuleApi = (await zoho.resolveModuleApiName(M.REFERRALS_MODULE)).apiName;
  const F = M.REFERRAL_FIELDS;

  let recentEnrollments;
  try {
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const criteria = `(${F.modifiedTime}:greater_equal:${since})and(${F.referralStage}:equals:${M.REFERRAL_STAGE_VALUES.enrolled})`;
    recentEnrollments = await zoho.fetchAllRecords(referralsModuleApi, { criteria });
  } catch (err) {
    summary.halted = `referral query: ${err.message}`;
    return summary;
  }

  const grouped = referrals.groupByAmbassador(recentEnrollments);
  for (const ambassadorId of grouped.keys()) {
    let allEnrolled;
    try {
      const criteria = `(${F.ambassadorLookup}:equals:${ambassadorId})and(${F.referralStage}:equals:${M.REFERRAL_STAGE_VALUES.enrolled})`;
      allEnrolled = await zoho.fetchAllRecords(referralsModuleApi, { criteria });
    } catch (err) {
      summary.errors.push(`cumulative count failed for ${ambassadorId}: ${err.message}`);
      continue;
    }
    const cumulative = allEnrolled.length;
    if (!MILESTONE_NUMBERS.includes(cumulative)) continue;

    let amb;
    try {
      amb = recordToAmbassador(await zoho.getRecordById(moduleApi, ambassadorId));
    } catch (err) {
      summary.errors.push(`ambassador lookup failed for ${ambassadorId}: ${err.message}`);
      continue;
    }

    summary.milestonesHit += 1;
    const user = prompts.buildMilestonePrompt(amb, cumulative);
    try {
      const body = await claude.generateEmail({ system: prompts.buildStandardSystemPrompt('', ''), user, maxTokens: 250 });
      const res = await sendWithRetry({
        mail, alerts, to: amb.email, subject: `Congratulations on referral #${cumulative}`, text: body,
        ambassadorName: amb.firstName, errorType: 'milestone email failure', action: 'Retry sending manually.',
        ctx, deps: input.deps,
      });
      if (res.ok) summary.emailsSent += 1;
      const video = await heygen.submitMilestoneVideo({ scriptText: body });
      if (video.ok) summary.videosSubmitted += 1;
    } catch (err) {
      summary.errors.push(`milestone generation failed for ${ambassadorId}: ${err.message}`);
    }
  }

  return summary;
}

module.exports = { referralStageChangeWebhook, milestoneDetectionJob, MILESTONE_NUMBERS };
