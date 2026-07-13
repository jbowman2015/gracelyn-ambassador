'use strict';

/**
 * Active-ambassador threshold alerts (design §2.3, §4, §9). Catalyst daily
 * check. Fires the approaching-threshold alert once the active count reaches
 * ACTIVE_AMBASSADOR_THRESHOLD_ALERT (800) and the decision-required alert once
 * it reaches ACTIVE_AMBASSADOR_THRESHOLD_AUTO (1000). Never flips APPROVAL_MODE
 * — that is always Parmeet's action.
 *
 * The design doc gives no CRM field for "already alerted at this threshold," so
 * this fires on every daily run while the count remains at/above a threshold —
 * an intentional escalating nag consistent with "Coordinator Decision
 * Required" framing, not a bug. If it proves noisy in practice, a dedup field
 * can be added later.
 */

const M = require('./manifest');
const { AMBASSADORS_FIELDS: AF, AMBASSADOR_STATUS: STATUS } = M;
const defaultZoho = require('./zoho');
const defaultAlerts = require('./alerts');
const { dateStr } = require('./dates');

async function countActiveAmbassadors(moduleApiName, zoho) {
  const records = await zoho.fetchAllByConditions(moduleApiName, [
    { field: AF.status, operator: 'equals', value: STATUS.active },
  ], { fields: ['id'] });
  return records.length;
}

async function runThresholdCheck(input = {}, deps = {}) {
  const zoho = deps.zoho || defaultZoho;
  const alerts = deps.alerts || defaultAlerts;
  const now = (deps.now && deps.now()) || new Date();
  const today = dateStr(now);
  const moduleApiName = input.ambassadorsModuleApiName;

  const alertThreshold = Number(M.getEnv('ACTIVE_AMBASSADOR_THRESHOLD_ALERT')) || M.DEFAULT_ACTIVE_AMBASSADOR_THRESHOLD_ALERT;
  const autoThreshold = Number(M.getEnv('ACTIVE_AMBASSADOR_THRESHOLD_AUTO')) || M.DEFAULT_ACTIVE_AMBASSADOR_THRESHOLD_AUTO;

  let count;
  try {
    count = await countActiveAmbassadors(moduleApiName, zoho);
  } catch (err) {
    await alerts.sendAlert({ errorType: 'active ambassador count query failure', detail: err.message,
      action: 'Re-run the threshold check once the CRM query succeeds.', date: today }, { deps });
    return { ok: false, halted: err.message };
  }

  const fired = [];
  if (count >= autoThreshold) {
    await alerts.sendAlert({
      errorType: 'Phase 2 auto-approve threshold reached', detail: `Active ambassador count is ${count} (threshold ${autoThreshold}).`,
      action: 'Coordinator decision required: flip APPROVAL_MODE to AUTO, or acknowledge the manual approval load and continue with Phase 1.',
      date: today,
    }, { deps });
    fired.push('auto_threshold');
  } else if (count >= alertThreshold) {
    await alerts.sendAlert({
      errorType: 'auto-approve threshold approaching', detail: `Active ambassador count is ${count} (alert threshold ${alertThreshold}, auto threshold ${autoThreshold}).`,
      action: 'No action required yet. Prepare for the Phase 2 decision as the count approaches 1,000.',
      date: today,
    }, { deps });
    fired.push('approaching_threshold');
  }

  return { ok: true, count, alertThreshold, autoThreshold, fired };
}

module.exports = { runThresholdCheck, countActiveAmbassadors };
