'use strict';

/**
 * Shared helpers used across Agent 3's pipeline modules (sprint.js, weekly.js,
 * dormant.js, monthly.js, milestones.js): CRM record <-> plain-object mapping
 * and the design's repeated "send, retry once after 60s, alert on second
 * failure" pattern (design §10).
 */

const M = require('./manifest');

/** Map a raw Ambassadors CRM record to a plain camelCase object. */
function recordToAmbassador(rec) {
  const F = M.AMBASSADOR_FIELDS;
  return {
    id: rec.id,
    firstName: rec[F.firstName] || '',
    lastName: rec[F.lastName] || '',
    email: rec[F.email] || '',
    referralCode: rec[F.referralCode] || '',
    referralLink: rec[F.referralLink] || '',
    ambassadorStatus: rec[F.ambassadorStatus] || '',
    complianceComplete: !!rec[F.complianceComplete],
    roleCategory: rec[F.roleCategory] || '',
    motivationTag: rec[F.motivationTag] || '',
    vipProspectOrigin: !!rec[F.vipProspectOrigin],
    activationSprintWeek: Number(rec[F.activationSprintWeek]) || 0,
    sprintStartDate: rec[F.sprintStartDate] || null,
    sprintReferralSubmitted: !!rec[F.sprintReferralSubmitted],
    contentWeekPosition: Number(rec[F.contentWeekPosition]) || 1,
    engagementTrack: rec[F.engagementTrack] || '',
    daysSinceLastReferral: Number(rec[F.daysSinceLastReferral]) || 0,
    alternativeTrackEntryDate: rec[F.alternativeTrackEntryDate] || null,
    alternativeTrackMonth: Number(rec[F.alternativeTrackMonth]) || 0,
    reEngagementAttempt: Number(rec[F.reEngagementAttempt]) || 0,
    escalatedToHuman: !!rec[F.escalatedToHuman],
    vipScore: Number(rec[F.vipScore]) || 0,
    vipTier: rec[F.vipTier] || M.VIP_TIER_VALUES.notVip,
    vipTierPrevious: rec[F.vipTierPrevious] || M.VIP_TIER_VALUES.notVip,
    vipTierUpgradeDate: rec[F.vipTierUpgradeDate] || null,
    lastEngagementDate: rec[F.lastEngagementDate] || null,
    lastStoryFileUsed: rec[F.lastStoryFileUsed] || '',
  };
}

/** Build a CRM write payload from a partial plain-object patch. */
function ambassadorPatch(patch) {
  const F = M.AMBASSADOR_FIELDS;
  const out = {};
  for (const [key, value] of Object.entries(patch)) {
    if (!F[key]) throw new Error(`ambassadorPatch: unknown field key "${key}"`);
    out[F[key]] = value;
  }
  return out;
}

/**
 * Send an email with the design's one-retry-after-60s policy. Returns
 * { ok, attempts }. Alerts Parmeet only after both attempts fail.
 */
async function sendWithRetry({ mail, alerts, to, subject, html, text, ambassadorName, errorType, action, ctx, deps }) {
  let res = await mail.sendEmail({ to, subject, html, text });
  if (res.ok) return { ok: true, attempts: 1 };
  if (ctx.retryDelayMs !== 0) await new Promise((r) => setTimeout(r, ctx.retryDelayMs != null ? ctx.retryDelayMs : 60000));
  res = await mail.sendEmail({ to, subject, html, text });
  if (res.ok) return { ok: true, attempts: 2 };
  await alerts.sendAlert({
    errorType: errorType || 'email send failure', detail: res.error || 'unknown',
    action: action || 'Review the Zoho Mail send log and retry manually.',
    ambassador: ambassadorName, runType: ctx.runType, date: ctx.date, timeCst: ctx.timeCst,
  }, { deps });
  return { ok: false, attempts: 2 };
}

module.exports = { recordToAmbassador, ambassadorPatch, sendWithRetry };
