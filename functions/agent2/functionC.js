'use strict';

/**
 * Function C: Compliance Reminders and Win-Back (design §6.3). Two entry
 * points:
 *
 *   runDailyComplianceSweep() — Catalyst scheduled job, 8:30 AM CST daily.
 *     C1/C2/C3 — send the day 2/7/14 reminder tier, 5-day minimum gap enforced.
 *     C4       — day 15+ with no completion: win-back email + survey, and
 *                standard reminders stop for those ambassadors from this point.
 *     C6       — day 75+, win-back already sent, still incomplete: dormant
 *                transition + final reactivation email (design's "no response
 *                after Day 75 closes the application record" is NOT
 *                implemented — the design doc gives no explicit trigger timing
 *                for that closure, so it is left as a manual coordinator
 *                decision rather than guessed at).
 *
 *   routeWinBackSurveyResponse() — Make.com webhook on a new win-back survey
 *     submission (C5). Writes the response, fires the matching reply path.
 */

const M = require('./manifest');
const { AMBASSADORS_FIELDS: AF, AMBASSADOR_STATUS: STATUS, WIN_BACK_RESPONSES } = M;
const defaultZoho = require('./zoho');
const defaultMail = require('./mail');
const defaultWebhooks = require('./webhooks');
const defaultAlerts = require('./alerts');
const { dateStr, daysSince, reminderTier, isWinBackDue, isDormantDue } = require('./dates');
const { buildEmailC, buildWinBackEmail, buildWinBackResponsePath, buildDormantReactivationEmail } = require('./emails');

async function sendOrAlert(mail, alerts, deps, today, ambassadorEmail, errorType, { to, subject, content }) {
  try {
    await mail.sendMail({ to, subject, content });
    return true;
  } catch (err) {
    await alerts.sendAlert({ errorType, detail: err.message, action: 'Resend this email manually.', ambassador: ambassadorEmail, date: today }, { deps });
    return false;
  }
}

async function runDailyComplianceSweep(input = {}, deps = {}) {
  const zoho = deps.zoho || defaultZoho;
  const mail = deps.mail || defaultMail;
  const alerts = deps.alerts || defaultAlerts;
  const now = (deps.now && deps.now()) || new Date();
  const today = dateStr(now);
  const moduleApiName = input.ambassadorsModuleApiName;

  const summary = { remindersSent: { day2: 0, day7: 0, day14: 0 }, winBackSent: 0, dormantSet: 0, errors: [] };

  // C1 — compliance-incomplete, not yet win-back'd.
  let incomplete = [];
  try {
    incomplete = await zoho.fetchAllByConditions(moduleApiName, [
      { field: AF.status, operator: 'equals', value: STATUS.approved },
      { field: AF.complianceComplete, operator: 'equals', value: 'false' },
      { field: AF.winBackSent, operator: 'equals', value: 'false' },
    ]);
  } catch (err) {
    await alerts.sendAlert({ errorType: 'daily compliance sweep — query failure', detail: err.message,
      action: 'Re-run the daily compliance check once the CRM query succeeds.', date: today }, { deps });
    return { ok: false, halted: `C1 query: ${err.message}` };
  }

  for (const record of incomplete) {
    const daysSinceApproval = daysSince(record[AF.approvalDate], now);
    const email = record[AF.email];

    if (isWinBackDue(daysSinceApproval, record[AF.winBackSent])) {
      const { subject, content } = buildWinBackEmail({ firstName: record[AF.firstName] });
      await sendOrAlert(mail, alerts, deps, today, email, 'Win-back email send failure', { to: email, subject, content });
      try {
        await zoho.updateRecord(moduleApiName, record.id, { [AF.winBackSent]: true });
        summary.winBackSent += 1;
      } catch (err) {
        summary.errors.push(`Win_Back_Sent write failed for ${email}: ${err.message}`);
        await alerts.sendAlert({ errorType: 'Win_Back_Sent write failure', detail: err.message,
          action: 'Set Win_Back_Sent manually to avoid a duplicate win-back email tomorrow.', ambassador: email, date: today }, { deps });
      }
      continue; // C4: win-back replaces the standard reminder this run.
    }

    const tier = reminderTier(daysSinceApproval, record[AF.lastReminderSentDate], now);
    if (!tier) continue;
    const { subject, content } = buildEmailC({ firstName: record[AF.firstName] }, tier);
    await sendOrAlert(mail, alerts, deps, today, email, `Email C (${tier}) send failure`, { to: email, subject, content });
    try {
      await zoho.updateRecord(moduleApiName, record.id, { [AF.lastReminderSentDate]: today });
      summary.remindersSent[tier] += 1;
    } catch (err) {
      summary.errors.push(`Last_Reminder_Sent_Date write failed for ${email}: ${err.message}`);
    }
  }

  // C6 — dormant compliance (day 75+, win-back already sent).
  let dormantCandidates = [];
  try {
    dormantCandidates = await zoho.fetchAllByConditions(moduleApiName, [
      { field: AF.status, operator: 'equals', value: STATUS.approved },
      { field: AF.complianceComplete, operator: 'equals', value: 'false' },
      { field: AF.winBackSent, operator: 'equals', value: 'true' },
      { field: AF.dormantCompliance, operator: 'equals', value: 'false' },
    ]);
  } catch (err) {
    summary.errors.push(`C6 query failed: ${err.message}`);
    dormantCandidates = [];
  }

  for (const record of dormantCandidates) {
    const daysSinceApproval = daysSince(record[AF.approvalDate], now);
    if (!isDormantDue(daysSinceApproval, record[AF.winBackSent], record[AF.dormantCompliance])) continue;
    const email = record[AF.email];
    const { subject, content } = buildDormantReactivationEmail({ firstName: record[AF.firstName] });
    await sendOrAlert(mail, alerts, deps, today, email, 'Dormant reactivation email send failure', { to: email, subject, content });
    try {
      await zoho.updateRecord(moduleApiName, record.id, { [AF.dormantCompliance]: true });
      summary.dormantSet += 1;
    } catch (err) {
      summary.errors.push(`Dormant_Compliance write failed for ${email}: ${err.message}`);
    }
  }

  return { ok: true, ...summary };
}

/** C5 — route a win-back survey response to its reply path. */
async function routeWinBackSurveyResponse(input = {}, deps = {}) {
  const zoho = deps.zoho || defaultZoho;
  const mail = deps.mail || defaultMail;
  const webhooks = deps.webhooks || defaultWebhooks;
  const alerts = deps.alerts || defaultAlerts;
  const now = (deps.now && deps.now()) || new Date();
  const today = dateStr(now);
  const moduleApiName = input.ambassadorsModuleApiName;

  const response = input.response;
  if (!Object.values(WIN_BACK_RESPONSES).includes(response)) {
    return { ok: false, halted: `C5: unrecognized win-back response "${response}".` };
  }

  const record = input.record || await zoho.getRecord(moduleApiName, input.ambassadorId);
  if (!record) return { ok: false, halted: 'C5: no Ambassador CRM record found.' };

  try {
    await zoho.updateRecord(moduleApiName, record.id, {
      [AF.winBackSurveyResponse]: response,
      [AF.winBackResponseDate]: today,
    });
  } catch (err) {
    await alerts.sendAlert({ errorType: 'win-back survey response write failure', detail: err.message,
      action: 'Record the survey response manually and route it to the correct path.', ambassador: record[AF.email], date: today }, { deps });
    return { ok: false, halted: `C5 write: ${err.message}` };
  }

  const path = buildWinBackResponsePath(response, { firstName: record[AF.firstName] });
  if (path) {
    await sendOrAlert(mail, alerts, deps, today, record[AF.email], `Win-back response (${response}) send failure`,
      { to: record[AF.email], subject: path.subject, content: path.content });
  }

  if (response === WIN_BACK_RESPONSES.technicalProblem) {
    const url = M.getEnv('MAKE_WINBACK_SURVEY_WEBHOOK');
    const res = await webhooks.fireWebhook(url, {
      type: 'winback_technical_problem', ambassadorId: record.id, email: record[AF.email], firstName: record[AF.firstName],
    }, { retryDelayMs: 0, deps });
    if (!res.ok) {
      await alerts.sendAlert({ errorType: 'coordinator technical-problem notification failure', detail: res.error || 'non-200',
        action: 'Reach out to this ambassador personally — they reported a technical problem.', ambassador: record[AF.email], date: today }, { deps });
    }
  }

  return { ok: true, response, ambassadorId: record.id };
}

module.exports = { runDailyComplianceSweep, routeWinBackSurveyResponse };
