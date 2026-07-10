'use strict';

/**
 * Daily dormant detection (design §2.2, 7:30 AM CST; §5.1 Dormant track).
 * Sprint ambassadors (Activation_Sprint_Week > 0) are excluded — the sprint's
 * own win-back approach (Week 3 coaching, Week 4 goal-setting) is the first
 * re-engagement attempt during that period (design §4.2).
 *
 * Day 30: re-engagement attempt 1. Day 45: attempt 2. Day 60: escalate to the
 * coordinator with no further automated contact.
 */

const M = require('./manifest');
const dates = require('./dates');
const { recordToAmbassador, ambassadorPatch, sendWithRetry } = require('./common');
const prompts = require('./prompts');
const { moduleAndVerify } = require('./sprint');

const defaultZoho = require('./zoho');
const defaultMail = require('./mail');
const defaultClaude = require('./claude');
const defaultAlerts = require('./alerts');

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

async function dormantDetectionJob(input = {}) {
  const deps = resolveDeps(input);
  const { zoho, mail, claude, alerts, now } = deps;
  const today = dates.dateStr(now);
  const runCtx = { runType: 'scheduled', date: today, timeCst: dates.timeCst(now), deps: input.deps };

  const summary = { checked: 0, movedToDormant: 0, attempt1: 0, attempt2: 0, escalated: 0, halted: null, errors: [] };

  let moduleApi;
  try {
    const v = await moduleAndVerify(zoho, alerts, runCtx);
    moduleApi = v.moduleApi;
    if (v.missing.length) { summary.halted = `Missing required CRM fields: ${v.missing.join(', ')}`; return summary; }
  } catch (err) {
    summary.halted = `module resolution: ${err.message}`;
    return summary;
  }

  const F = M.AMBASSADOR_FIELDS;
  const threshold = dates.addDaysStr(today, -M.dormantDaysThreshold());

  let records;
  try {
    const criteria = `(${F.activationSprintWeek}:equals:0)and(${F.lastEngagementDate}:less_equal:${threshold})`;
    records = await zoho.fetchAllRecords(moduleApi, { criteria });
  } catch (err) {
    summary.halted = `dormant query: ${err.message}`;
    return summary;
  }

  for (const rec of records) {
    const amb = recordToAmbassador(rec);
    if (amb.activationSprintWeek > 0) continue; // belt-and-suspenders on the non-negotiable exclusion
    summary.checked += 1;

    const daysSince = amb.lastEngagementDate ? dates.daysBetween(amb.lastEngagementDate, today) : 0;
    const patch = {};
    if (amb.engagementTrack !== M.ENGAGEMENT_TRACK_VALUES.dormant) {
      patch.engagementTrack = M.ENGAGEMENT_TRACK_VALUES.dormant;
      summary.movedToDormant += 1;
    }

    let attemptToSend = 0;
    if (daysSince >= 60 && !amb.escalatedToHuman) {
      patch.escalatedToHuman = true;
      summary.escalated += 1;
      await alerts.sendAlert({
        errorType: 'dormant ambassador escalated', detail: `${amb.firstName} (${amb.id}) reached Day 60 dormant with no re-engagement.`,
        action: 'Coordinator follow-up required. No further automated contact will be sent.',
        ambassador: amb.firstName, runType: runCtx.runType, date: runCtx.date, timeCst: runCtx.timeCst,
      }, { deps: input.deps });
    } else if (daysSince >= 45 && amb.reEngagementAttempt < 2) {
      attemptToSend = 2;
    } else if (daysSince >= 30 && amb.reEngagementAttempt < 1) {
      attemptToSend = 1;
    }

    if (attemptToSend) {
      const user = prompts.buildDormantReEngagementPrompt(amb, attemptToSend);
      try {
        const body = await claude.generateEmail({ system: prompts.buildStandardSystemPrompt('', ''), user, maxTokens: 300 });
        const res = await sendWithRetry({
          mail, alerts, to: amb.email, subject: 'Checking in', text: body, ambassadorName: amb.firstName,
          errorType: 'dormant re-engagement email failure', action: 'Ambassador marked for next cycle retry.',
          ctx: runCtx, deps: input.deps,
        });
        if (res.ok) {
          patch.reEngagementAttempt = attemptToSend;
          if (attemptToSend === 1) summary.attempt1 += 1; else summary.attempt2 += 1;
        }
      } catch (err) {
        summary.errors.push(`Claude generation failed for ${amb.id}: ${err.message}`);
      }
    }

    if (Object.keys(patch).length) {
      try { await zoho.updateRecord(moduleApi, amb.id, ambassadorPatch(patch)); }
      catch (err) { summary.errors.push(`CRM update failed for ${amb.id}: ${err.message}`); }
    }
  }

  return summary;
}

module.exports = { dormantDetectionJob };
