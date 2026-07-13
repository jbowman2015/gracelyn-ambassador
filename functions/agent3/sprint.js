'use strict';

/**
 * 30-Day Activation Sprint (design §4): activation initialization and the
 * Monday 8:00 AM CST advancement/graduation job. Every external module is
 * injectable via `deps` so the whole flow runs offline in tests.
 */

const M = require('./manifest');
const dates = require('./dates');
const { recordToAmbassador, ambassadorPatch, sendWithRetry } = require('./common');
const defaultZoho = require('./zoho');
const defaultMail = require('./mail');
const defaultClaude = require('./claude');
const defaultAlerts = require('./alerts');
const prompts = require('./prompts');

function resolveDeps(input) {
  const d = input.deps || {};
  return {
    zoho: d.zoho || defaultZoho,
    mail: d.mail || defaultMail,
    claude: d.claude || defaultClaude,
    alerts: d.alerts || defaultAlerts,
    now: (d.now && d.now()) || new Date(),
  };
}

async function moduleAndVerify(zoho, alerts, ctx) {
  const resolved = await zoho.resolveModuleApiName(M.AMBASSADORS_MODULE);
  const moduleApi = resolved.apiName;
  if (resolved.divergence) {
    await alerts.sendAlert({
      errorType: 'module name divergence', detail: resolved.divergence,
      action: 'Reconcile AMBASSADORS_MODULE_API_NAME with the live Zoho api_name.',
      runType: ctx.runType, date: ctx.date, timeCst: ctx.timeCst,
    }, { deps: ctx.deps });
  }
  const required = [
    M.AMBASSADOR_FIELDS.activationSprintWeek, M.AMBASSADOR_FIELDS.sprintStartDate,
    M.AMBASSADOR_FIELDS.sprintReferralSubmitted, M.AMBASSADOR_FIELDS.contentWeekPosition,
    M.AMBASSADOR_FIELDS.engagementTrack, M.AMBASSADOR_FIELDS.daysSinceLastReferral,
  ];
  const optional = [M.AMBASSADOR_FIELDS.roleCategory, M.AMBASSADOR_FIELDS.motivationTag, M.AMBASSADOR_FIELDS.vipProspectOrigin];
  const { missing, missingOptional } = await zoho.verifyFields(moduleApi, required, optional);
  return { moduleApi, missing, missingOptional, divergence: resolved.divergence };
}

/**
 * Fire on Agent 2's activation webhook. Initializes the sprint fields and
 * sends the Week 1 email immediately (design §2.2 "real-time").
 *
 * @param {object} input  { ambassador: { id, firstName, email, referralLink,
 *   roleCategory, motivationTag } } — Agent 2's payload. `ambassadorId` alone
 *   also works; the record is fetched live.
 */
async function initializeAmbassador(input = {}) {
  const deps = resolveDeps(input);
  const { zoho, mail, claude, alerts, now } = deps;
  const today = dates.dateStr(now);
  const ctx = { runType: 'real-time', date: today, timeCst: dates.timeCst(now), deps: input.deps };

  const summary = { ambassadorId: null, initialized: false, emailSent: false, halted: null, errors: [] };

  let moduleApi;
  try {
    const v = await moduleAndVerify(zoho, alerts, ctx);
    moduleApi = v.moduleApi;
    if (v.missing.length) {
      await alerts.sendAlert({
        errorType: 'CRM field divergence', detail: `Missing sprint fields on Ambassadors: ${v.missing.join(', ')}`,
        action: 'Create the missing Agent 3 sprint fields in Zoho.', runType: ctx.runType, date: ctx.date, timeCst: ctx.timeCst,
      }, { deps: input.deps });
      summary.halted = `Missing required CRM fields: ${v.missing.join(', ')}`;
      return summary;
    }
  } catch (err) {
    await alerts.sendAlert({
      errorType: 'CRM metadata failure', detail: err.message,
      action: 'Confirm the Ambassadors module exists and AMBASSADORS_MODULE_API_NAME is set.',
      runType: ctx.runType, date: ctx.date, timeCst: ctx.timeCst,
    }, { deps: input.deps });
    summary.halted = `module resolution: ${err.message}`;
    return summary;
  }

  let record;
  try {
    record = input.ambassador && input.ambassador.id ? input.ambassador : await zoho.getRecordById(moduleApi, input.ambassadorId);
  } catch (err) {
    await alerts.sendAlert({
      errorType: 'ambassador lookup failure', detail: err.message,
      action: 'Confirm the activation webhook included a valid ambassador id.',
      runType: ctx.runType, date: ctx.date, timeCst: ctx.timeCst,
    }, { deps: input.deps });
    summary.halted = `ambassador lookup: ${err.message}`;
    return summary;
  }

  const amb = record.id ? recordToAmbassador(record) : { ...record };
  amb.id = amb.id || input.ambassadorId;
  summary.ambassadorId = amb.id;

  const patch = ambassadorPatch({
    activationSprintWeek: 1,
    sprintStartDate: today,
    sprintReferralSubmitted: false,
    contentWeekPosition: 1,
    engagementTrack: M.ENGAGEMENT_TRACK_VALUES.sprint,
    daysSinceLastReferral: 0,
  });

  try {
    await zoho.updateRecord(moduleApi, amb.id, patch);
    summary.initialized = true;
  } catch (err) {
    summary.errors.push(`CRM init failed: ${err.message}`);
    await alerts.sendAlert({
      errorType: 'CRM upsert failure', detail: err.message,
      action: 'Sprint fields were not initialized. Retry the activation webhook.',
      ambassador: amb.firstName, runType: ctx.runType, date: ctx.date, timeCst: ctx.timeCst,
    }, { deps: input.deps });
    summary.halted = `sprint init: ${err.message}`;
    return summary;
  }

  const emailResult = await sendSprintEmail(1, amb, { claude, mail, alerts, ctx, deps: input.deps });
  summary.emailSent = emailResult.ok;
  if (!emailResult.ok) summary.errors.push('Sprint Week 1 email failed after retry.');

  return summary;
}

/** Build and send the sprint email for a given week (1-4) or the graduation email (week=0). */
async function sendSprintEmail(week, amb, { claude, mail, alerts, ctx, deps }) {
  const system = prompts.buildSprintSystemPrompt('', '');
  let user;
  let subject;
  if (week === 1) { user = prompts.buildSprintWeek1Prompt(amb); subject = 'Welcome to the ambassador community'; }
  else if (week === 2) { user = prompts.buildSprintWeek2Prompt(amb); subject = 'One person, one conversation'; }
  else if (week === 3) { user = prompts.buildSprintWeek3Prompt(amb); subject = 'Your first month, week 3'; }
  else if (week === 4) { user = prompts.buildSprintWeek4Prompt(amb); subject = 'Your first 90 days'; }
  else { user = prompts.buildSprintGraduationPrompt(amb); subject = 'One month in'; }

  let body;
  try {
    body = await claude.generateEmail({ system, user, maxTokens: 400 });
  } catch (err) {
    await alerts.sendAlert({
      errorType: 'Claude generation failure', detail: err.message,
      action: 'Sprint email not sent. Will retry on the next scheduled run.',
      ambassador: amb.firstName, runType: ctx.runType, date: ctx.date, timeCst: ctx.timeCst,
    }, { deps });
    return { ok: false };
  }

  const result = await sendWithRetry({
    mail, alerts, to: amb.email, subject, text: body, ambassadorName: amb.firstName,
    errorType: `Sprint Week ${week || 'graduation'} email failure`,
    action: 'Retry once; if it fails again the next scheduled job will attempt a resend.',
    ctx, deps,
  });
  return result;
}

/**
 * Monday 8:00 AM CST job: advance ambassadors at sprint weeks 1-3 to the next
 * week (sending that week's email), and graduate ambassadors at week 4 once
 * SPRINT_GRADUATION_DAYS have elapsed since Sprint_Start_Date (design §4.2,
 * §8 Scenario 2). Combines the design's two run-cycle rows (advancement +
 * Day 30 graduation) into one job since both fire at the same trigger.
 */
async function sprintAdvancementJob(input = {}) {
  const deps = resolveDeps(input);
  const { zoho, mail, claude, alerts, now } = deps;
  const today = dates.dateStr(now);
  const ctx = { runType: 'scheduled', date: today, timeCst: dates.timeCst(now), deps: input.deps };

  const summary = { advanced: 0, graduated: 0, skipped: 0, emailsSent: 0, emailsFailed: 0, halted: null, errors: [] };

  let moduleApi;
  try {
    const v = await moduleAndVerify(zoho, alerts, ctx);
    moduleApi = v.moduleApi;
    if (v.missing.length) {
      summary.halted = `Missing required CRM fields: ${v.missing.join(', ')}`;
      await alerts.sendAlert({
        errorType: 'CRM field divergence', detail: summary.halted,
        action: 'Create the missing Agent 3 sprint fields in Zoho.', runType: ctx.runType, date: ctx.date, timeCst: ctx.timeCst,
      }, { deps: input.deps });
      return summary;
    }
  } catch (err) {
    summary.halted = `module resolution: ${err.message}`;
    await alerts.sendAlert({
      errorType: 'CRM metadata failure', detail: err.message,
      action: 'Confirm the Ambassadors module exists and AMBASSADORS_MODULE_API_NAME is set.',
      runType: ctx.runType, date: ctx.date, timeCst: ctx.timeCst,
    }, { deps: input.deps });
    return summary;
  }

  const F = M.AMBASSADOR_FIELDS;
  let records;
  try {
    const criteria = `((${F.activationSprintWeek}:equals:1)or(${F.activationSprintWeek}:equals:2))or((${F.activationSprintWeek}:equals:3)or(${F.activationSprintWeek}:equals:4))`;
    records = await zoho.fetchAllRecords(moduleApi, { criteria });
  } catch (err) {
    summary.halted = `sprint ambassador query: ${err.message}`;
    await alerts.sendAlert({
      errorType: 'CRM query failure', detail: err.message,
      action: 'Sprint advancement did not run. Retry the Monday 8:00 AM job.',
      runType: ctx.runType, date: ctx.date, timeCst: ctx.timeCst,
    }, { deps: input.deps });
    return summary;
  }

  const graduationDays = M.sprintGraduationDays();

  for (const rec of records) {
    const amb = recordToAmbassador(rec);
    if (amb.activationSprintWeek >= 1 && amb.activationSprintWeek <= 3) {
      const nextWeek = amb.activationSprintWeek + 1;
      try {
        await zoho.updateRecord(moduleApi, amb.id, ambassadorPatch({ activationSprintWeek: nextWeek }));
        summary.advanced += 1;
      } catch (err) {
        summary.errors.push(`advance failed for ${amb.id}: ${err.message}`);
        continue;
      }
      const res = await sendSprintEmail(nextWeek, amb, { claude, mail, alerts, ctx, deps: input.deps });
      if (res.ok) summary.emailsSent += 1; else summary.emailsFailed += 1;
    } else if (amb.activationSprintWeek === 4) {
      const elapsed = amb.sprintStartDate ? dates.daysBetween(amb.sprintStartDate, today) : 0;
      if (elapsed < graduationDays) { summary.skipped += 1; continue; }
      try {
        await zoho.updateRecord(moduleApi, amb.id, ambassadorPatch({
          activationSprintWeek: 0,
          engagementTrack: M.ENGAGEMENT_TRACK_VALUES.standard,
          contentWeekPosition: 1,
        }));
        summary.graduated += 1;
      } catch (err) {
        summary.errors.push(`graduation failed for ${amb.id}: ${err.message}`);
        continue;
      }
      const res = await sendSprintEmail(0, amb, { claude, mail, alerts, ctx, deps: input.deps });
      if (res.ok) summary.emailsSent += 1; else summary.emailsFailed += 1;
    }
  }

  if (summary.emailsFailed > 5) {
    await alerts.sendAlert({
      errorType: 'sprint email failure rate elevated', detail: `${summary.emailsFailed} sprint emails failed this run.`,
      action: 'Review the Agent 3 run log for the affected ambassadors.', runType: ctx.runType, date: ctx.date, timeCst: ctx.timeCst,
    }, { deps: input.deps });
  }

  return summary;
}

module.exports = { initializeAmbassador, sprintAdvancementJob, sendSprintEmail, moduleAndVerify };
