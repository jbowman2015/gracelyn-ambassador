'use strict';

/**
 * Function D: Activation (design §6.4). Triggered by the Make.com Zoho Flow on
 * Compliance_Complete = true.
 *
 * D1 — classify motivation from the Part 3 discovery responses.
 * D2 — generate 30-day welcome-kit share links for the ambassador's Audience_Track
 *      (all files for VIP).
 * D4 — upgrade the WordPress role BEFORE sending Email D — this is the gate
 *      that makes the referral link visible in the portal, and per design §10
 *      Email D must never fire before it is confirmed. Executed here ahead of
 *      D3 for that reason, even though the design doc numbers it after.
 * D3 — send Email D (or D-VIP), only once D4 has succeeded.
 * D5 — notify Agent 3 with the activation payload.
 * D6 — notify the VIP relationship manager (VIP only).
 * D7 — write the compliance form version audit field.
 */

const M = require('./manifest');
const { AMBASSADORS_FIELDS: AF } = M;
const defaultZoho = require('./zoho');
const defaultMail = require('./mail');
const defaultWorkdrive = require('./workdrive');
const defaultClaude = require('./claude');
const defaultWordpress = require('./wordpress');
const defaultWebhooks = require('./webhooks');
const defaultAlerts = require('./alerts');
const { dateStr } = require('./dates');
const { buildEmailD, buildEmailDVip } = require('./emails');

const COMPLIANCE_FORM_VERSION = 'Combined_v2.0';

async function runFunctionD(input = {}, deps = {}) {
  const zoho = deps.zoho || defaultZoho;
  const mail = deps.mail || defaultMail;
  const workdrive = deps.workdrive || defaultWorkdrive;
  const claude = deps.claude || defaultClaude;
  const wordpress = deps.wordpress || defaultWordpress;
  const webhooks = deps.webhooks || defaultWebhooks;
  const alerts = deps.alerts || defaultAlerts;
  const now = (deps.now && deps.now()) || new Date();
  const today = dateStr(now);
  const moduleApiName = input.ambassadorsModuleApiName;

  const record = input.record || await zoho.getRecord(moduleApiName, input.ambassadorId);
  if (!record) return { ok: false, halted: 'D: no Ambassador CRM record found.' };

  const email = record[AF.email];
  const firstName = record[AF.firstName];
  const isVip = record[AF.vipFlag] === true || record[AF.vipFlag] === 'true';
  const isVipProspectOrigin = record[AF.vipProspectOrigin] === true || record[AF.vipProspectOrigin] === 'true';

  // D1 — motivation classification.
  let motivationTag = 'Unknown';
  try {
    const discovery = record[AF.motivationDiscoveryResponse] || '';
    const result = await claude.classifyMotivation(discovery);
    motivationTag = result.tag;
    await zoho.updateRecord(moduleApiName, record.id, { [AF.motivationTag]: motivationTag });
    if (result.needsReview) {
      await alerts.sendAlert({
        errorType: 'motivation classification fell back to Unknown', detail: result.apiError || 'invalid tag after retry',
        action: 'Review the discovery responses and set Motivation_Tag manually if appropriate.', ambassador: email, date: today,
      }, { deps });
    }
  } catch (err) {
    await alerts.sendAlert({ errorType: 'motivation classification failure', detail: err.message,
      action: 'Motivation_Tag left as Unknown; set manually if needed.', ambassador: email, date: today }, { deps });
  }

  // D2 — welcome kit share links.
  let kit = { links: [], failures: [] };
  try {
    const folder03 = M.getEnv('WORKDRIVE_FOLDER_03_ID');
    if (folder03) {
      kit = await workdrive.generateWelcomeKitLinks(folder03, { audienceTrack: record[AF.audienceTrack], vip: isVip });
    }
  } catch (err) {
    await alerts.sendAlert({ errorType: 'welcome kit link generation failure', detail: err.message,
      action: 'Send the welcome kit files manually.', ambassador: email, date: today }, { deps });
  }
  if (kit.failures.length) {
    await alerts.sendAlert({
      errorType: 'welcome kit link generation — partial failure',
      detail: kit.failures.map((f) => `${f.name}: ${f.error}`).join('; '),
      action: 'Follow up with the failed file(s) directly.', ambassador: email, date: today,
    }, { deps });
  }

  // D4 — WordPress role upgrade, gating D3.
  const wpResult = await wordpress.upgradeToActive(record[AF.wordpressUserId]);
  if (!wpResult.ok) {
    await alerts.sendAlert({
      errorType: 'WordPress role upgrade failure', detail: wpResult.error || `HTTP ${wpResult.status}`,
      action: 'Upgrade the WordPress role manually before Email D is sent. The referral link must not be shared until portal access is confirmed.',
      ambassador: email, date: today,
    }, { deps });
    return { ok: false, halted: 'D4: WordPress role upgrade not confirmed — Email D withheld.', motivationTag };
  }

  // D3 — Email D / D-VIP, only after D4 succeeds.
  try {
    const { subject, content } = isVip ? buildEmailDVip({ firstName }, kit) : buildEmailD({ firstName }, kit);
    await mail.sendMail({ to: email, subject, content });
  } catch (err) {
    await alerts.sendAlert({ errorType: 'Email D send failure', detail: err.message,
      action: 'Resend the activation email manually — WordPress role upgrade already confirmed.', ambassador: email, date: today }, { deps });
  }

  // D5 — notify Agent 3.
  const agent3Url = M.getEnv('MAKE_AGENT3_WEBHOOK_URL');
  const agent3Res = await webhooks.fireWebhook(agent3Url, {
    type: 'agent2_activation',
    ambassador_id: record.id, email, first_name: firstName,
    role_category: record[AF.roleCategory], audience_track: record[AF.audienceTrack],
    motivation_tag: motivationTag, vip_flag: isVip, vip_prospect_origin: isVipProspectOrigin,
  }, { retryDelayMs: 15000, deps });
  if (!agent3Res.ok) {
    await alerts.sendAlert({
      errorType: 'Agent 3 activation webhook failure', detail: agent3Res.error || 'non-200',
      action: 'High priority — this ambassador will not enter the engagement cycle until resolved. Re-fire the webhook manually.',
      ambassador: email, date: today,
    }, { deps });
  }

  // D6 — VIP relationship manager co-creation notification.
  if (isVip) {
    const vipUrl = M.getEnv('MAKE_VIP_MANAGER_NOTIFY_WEBHOOK_URL');
    const vipRes = await webhooks.fireWebhook(vipUrl, {
      type: 'vip_activation_co_creation', ambassador_id: record.id, email, first_name: firstName,
    }, { retryDelayMs: 0, deps });
    if (!vipRes.ok) {
      await alerts.sendAlert({ errorType: 'VIP co-creation notification failure', detail: vipRes.error || 'non-200',
        action: 'Notify the VIP relationship manager manually for co-creation follow-up.', ambassador: email, date: today }, { deps });
    }
  }

  // D7 — compliance form version audit trail.
  try {
    await zoho.updateRecord(moduleApiName, record.id, { [AF.lastComplianceFormVersion]: COMPLIANCE_FORM_VERSION });
  } catch (err) {
    await alerts.sendAlert({ errorType: 'Compliance form version write failure', detail: err.message,
      action: 'Set the compliance form version audit field manually.', ambassador: email, date: today }, { deps });
  }

  return { ok: true, motivationTag, welcomeKitLinks: kit.links.length, vip: isVip };
}

module.exports = { runFunctionD, COMPLIANCE_FORM_VERSION };
