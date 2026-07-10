'use strict';

/**
 * Function A: Application Received (design §6.1). Triggered by the Make.com
 * Zoho Forms webhook on a new ambassador application.
 *
 * A1 — read the Ambassador CRM record the existing blueprint workflow already
 *      created from the form submission. Halt if it does not exist yet (the
 *      blueprint's own Flow may still be running); the caller retries.
 * A2 — send Email A.
 * A3 — if a matching Prospect exists (from Agent 1A/1B/1D), set
 *      Outreach_Status = Applied. Never create a duplicate Prospect record.
 * A4 — write Approval_Queue_Added_Date = today (Phase 1's coordinator queue is
 *      just a CRM view filtered on Ambassador_Status = Applicant + this date).
 */

const M = require('./manifest');
const { AMBASSADORS_FIELDS: AF, PROSPECT_FIELDS: PF } = M;
const defaultZoho = require('./zoho');
const defaultMail = require('./mail');
const defaultAlerts = require('./alerts');
const { dateStr } = require('./dates');
const { buildEmailA } = require('./emails');

async function runFunctionA(input = {}, deps = {}) {
  const zoho = deps.zoho || defaultZoho;
  const mail = deps.mail || defaultMail;
  const alerts = deps.alerts || defaultAlerts;
  const now = (deps.now && deps.now()) || new Date();
  const today = dateStr(now);

  const ambassadorsModule = input.ambassadorsModuleApiName;
  const prospectsModule = input.prospectsModuleApiName;

  // A1 — read the Ambassador record.
  let record;
  try {
    if (input.ambassadorId) {
      record = await zoho.getRecord(ambassadorsModule, input.ambassadorId);
    } else if (input.email) {
      record = await zoho.findOneByField(ambassadorsModule, AF.email, input.email);
    }
  } catch (err) {
    await alerts.sendAlert({
      errorType: 'application received — CRM read failure', detail: err.message,
      action: 'Retry the webhook once the CRM read succeeds.', ambassador: input.email || input.ambassadorId, date: today,
    }, { deps });
    return { ok: false, halted: `A1 CRM read: ${err.message}` };
  }
  if (!record) {
    return { ok: false, halted: 'A1: no Ambassador CRM record found for this application yet.' };
  }

  const firstName = record[AF.firstName] || '';
  const email = record[AF.email] || input.email;
  const ambassadorId = record.id;

  // A2 — Email A.
  try {
    const { subject, content } = buildEmailA({ firstName });
    await mail.sendMail({ to: email, subject, content });
  } catch (err) {
    await alerts.sendAlert({
      errorType: 'Email A send failure', detail: err.message,
      action: 'Confirm Zoho Mail credentials and resend Email A manually.', ambassador: email, date: today,
    }, { deps });
  }

  // A3 — update matching Prospect (no duplicate creation).
  let prospectUpdated = false;
  if (prospectsModule && email) {
    try {
      const prospect = await zoho.findOneByField(prospectsModule, PF.email, email);
      if (prospect) {
        await zoho.updateRecord(prospectsModule, prospect.id, { [PF.outreachStatus]: 'Applied' });
        prospectUpdated = true;
      }
    } catch (err) {
      await alerts.sendAlert({
        errorType: 'Prospect Outreach_Status update failure', detail: err.message,
        action: 'Reconcile the Prospect record\'s Outreach_Status by hand.', ambassador: email, date: today,
      }, { deps });
    }
  }

  // A4 — approval queue.
  try {
    await zoho.updateRecord(ambassadorsModule, ambassadorId, { [AF.approvalQueueAddedDate]: today });
  } catch (err) {
    await alerts.sendAlert({
      errorType: 'Approval queue write failure', detail: err.message,
      action: 'Set Approval_Queue_Added_Date by hand so this application is not missed.', ambassador: email, date: today,
    }, { deps });
  }

  return { ok: true, ambassadorId, prospectUpdated };
}

module.exports = { runFunctionA };
