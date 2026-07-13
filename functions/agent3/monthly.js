'use strict';

/**
 * First-Monday-of-month jobs (design §2.2, §6): non-referral track check
 * (6:00 AM CST), VIP recalculation (6:30 AM CST), VIP supplemental (7:00 AM
 * CST). All three exclude sprint ambassadors from the population they act on
 * except VIP recalculation, which explicitly includes sprint graduates and
 * ambassadors still mid-sprint (design §8 Scenario 8).
 */

const M = require('./manifest');
const dates = require('./dates');
const { recordToAmbassador, ambassadorPatch, sendWithRetry } = require('./common');
const prompts = require('./prompts');
const scoring = require('./scoring');
const referrals = require('./referrals');
const { moduleAndVerify } = require('./sprint');
const { fireWebhook } = require('./webhooks');

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
    fireWebhook: d.fireWebhook || fireWebhook,
    now: (d.now && d.now()) || new Date(),
  };
}

/**
 * First Monday of month, 6:00 AM CST. Moves zero-referral Standard ambassadors
 * to Alternative once NON_REFERRAL_DAYS_THRESHOLD days have elapsed *since
 * sprint graduation* (Sprint_Start_Date + SPRINT_GRADUATION_DAYS), not since
 * original activation (design §5.4 NOTE).
 */
async function monthlyNonReferralCheck(input = {}) {
  const deps = resolveDeps(input);
  const { zoho, alerts, now } = deps;
  const today = dates.dateStr(now);
  const ctx = { runType: 'scheduled', date: today, timeCst: dates.timeCst(now), deps: input.deps };
  const summary = { checked: 0, movedToAlternative: 0, halted: null, errors: [] };

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

  const F = M.AMBASSADOR_FIELDS;
  let records;
  try {
    const criteria = `(${F.engagementTrack}:equals:${M.ENGAGEMENT_TRACK_VALUES.standard})and(${F.activationSprintWeek}:equals:0)`;
    records = await zoho.fetchAllRecords(moduleApi, { criteria });
  } catch (err) {
    summary.halted = `standard track query: ${err.message}`;
    return summary;
  }

  const graduationDays = M.sprintGraduationDays();
  const threshold = M.nonReferralDaysThreshold();

  for (const rec of records) {
    const amb = recordToAmbassador(rec);
    if (!amb.sprintStartDate) continue;
    const graduationDate = dates.addDaysStr(amb.sprintStartDate, graduationDays);
    const daysSinceGraduation = dates.daysBetween(graduationDate, today);
    if (daysSinceGraduation < threshold) continue;
    summary.checked += 1;

    let referralCount = 0;
    try {
      const RF = M.REFERRAL_FIELDS;
      const criteria = `(${RF.ambassadorLookup}:equals:${amb.id})`;
      const recs = await zoho.fetchAllRecords(referralsModuleApi, { criteria });
      referralCount = recs.length;
    } catch (err) {
      summary.errors.push(`referral count failed for ${amb.id}: ${err.message}`);
      continue;
    }
    if (referralCount > 0) continue;

    try {
      await zoho.updateRecord(moduleApi, amb.id, ambassadorPatch({
        engagementTrack: M.ENGAGEMENT_TRACK_VALUES.alternative,
        alternativeTrackEntryDate: today,
        alternativeTrackMonth: 1,
      }));
      summary.movedToAlternative += 1;
    } catch (err) {
      summary.errors.push(`CRM update failed for ${amb.id}: ${err.message}`);
    }
  }

  return summary;
}

/**
 * First Monday of month, 6:30 AM CST. Scores every ambassador with an
 * initialized Engagement_Track (sprint graduates and mid-sprint ambassadors
 * included) and assigns VIP tiers population-relatively (design §6, §6.2).
 *
 * Engagement-rate and prior-consecutive-quarter inputs are not yet backed by
 * a CRM field (no email open/click tracking field exists on Ambassadors and
 * VIP_Tier_Previous only stores one prior quarter). `input.engagementRates`
 * (Map<ambassadorId, pct>) and `input.consecutiveVipQuarters`
 * (Map<ambassadorId, count>) let a caller (or test) supply real values; both
 * default conservatively (50% engagement, 0 consecutive quarters) otherwise.
 */
async function monthlyVipRecalculation(input = {}) {
  const deps = resolveDeps(input);
  const { zoho, mail, claude, alerts, now } = deps;
  const today = dates.dateStr(now);
  const ctx = { runType: 'scheduled', date: today, timeCst: dates.timeCst(now), deps: input.deps };
  const summary = { scored: 0, upgraded: 0, population: 0, halted: null, errors: [], recalcCompleteWebhook: null };

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

  const F = M.AMBASSADOR_FIELDS;
  let records;
  try {
    const criteria = `(${F.engagementTrack}:starts_with:)`; // any non-empty Engagement_Track
    records = await zoho.fetchAllRecords(moduleApi, { criteria });
  } catch (err) {
    // Fall back to an unfiltered fetch — some test doubles / small orgs won't support starts_with:''
    try { records = await zoho.fetchAllRecords(moduleApi, {}); }
    catch (err2) { summary.halted = `population query: ${err2.message}`; return summary; }
  }
  records = records.filter((r) => r[F.engagementTrack]);
  summary.population = records.length;

  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const engagementRates = input.engagementRates || new Map();
  const consecutiveVipQuarters = input.consecutiveVipQuarters || new Map();

  const scored = [];
  for (const rec of records) {
    const amb = recordToAmbassador(rec);
    let referralCount90d = 0;
    try {
      const recent = await referrals.fetchReferralsSince(zoho, referralsModuleApi, ninetyDaysAgo);
      const grouped = referrals.groupByAmbassador(recent);
      referralCount90d = (grouped.get(amb.id) || []).length;
    } catch (err) {
      summary.errors.push(`referral lookup failed for ${amb.id}: ${err.message}`);
    }
    const tenureMonths = amb.sprintStartDate ? dates.monthsBetween(amb.sprintStartDate, today) : 0;
    const score = scoring.computeVipScore({
      referralCount90d,
      engagementRatePct: engagementRates.has(amb.id) ? engagementRates.get(amb.id) : 50,
      tenureMonths,
      consecutivePriorVipQuarters: consecutiveVipQuarters.get(amb.id) || 0,
    });
    scored.push({ id: amb.id, amb, total: score.total });
  }

  const tiered = scoring.assignVipTiers(scored);
  for (const entry of tiered) {
    summary.scored += 1;
    const amb = entry.amb;
    const isUpgrade = tierRank(entry.tier) > tierRank(amb.vipTier);
    const patch = {
      vipScore: entry.total,
      vipTier: entry.tier,
      vipTierPrevious: amb.vipTier,
    };
    if (isUpgrade) patch.vipTierUpgradeDate = today;

    try {
      await zoho.updateRecord(moduleApi, amb.id, ambassadorPatch(patch));
    } catch (err) {
      summary.errors.push(`CRM update failed for ${amb.id}: ${err.message}`);
      continue;
    }

    if (isUpgrade) {
      summary.upgraded += 1;
      try {
        const body = await claude.generateEmail({
          system: prompts.buildStandardSystemPrompt('', ''), user: prompts.buildVipTierUpgradePrompt(amb, entry.tier), maxTokens: 300,
        });
        await sendWithRetry({
          mail, alerts, to: amb.email, subject: 'A quick note just for you', text: body, ambassadorName: amb.firstName,
          errorType: 'VIP upgrade email failure', action: 'Retry sending manually.', ctx, deps: input.deps,
        });
      } catch (err) {
        summary.errors.push(`VIP upgrade email generation failed for ${amb.id}: ${err.message}`);
      }
    }
  }

  // Design §5: signal Agent 4's post-recalculation audit via Make.com Scenario 3
  // (functions/agent4/vipAudit.js reads population/scoredCount/upgradedCount from
  // this payload — welcomeMessagesSent/outreachTasksCreated are not available yet
  // at this point in the run, so Agent 4's audit treats those two checks as "not
  // independently verifiable" rather than a failure when omitted). Never blocks
  // or fails the recalculation itself — fireWebhook never throws and no-ops when
  // MAKE_AGENT3_RECALC_COMPLETE_WEBHOOK is unset.
  const recalcWebhookUrl = M.getEnv('MAKE_AGENT3_RECALC_COMPLETE_WEBHOOK');
  if (recalcWebhookUrl) {
    const result = await deps.fireWebhook(recalcWebhookUrl, {
      type: 'vip_recalculation_complete', date: today,
      population: summary.population, scoredCount: summary.scored, upgradedCount: summary.upgraded,
    }, { deps: input.deps });
    summary.recalcCompleteWebhook = result;
    if (!result.ok) {
      await alerts.sendAlert({
        errorType: 'VIP recalculation completion webhook failed', detail: result.error || `HTTP ${result.status}`,
        action: "Agent 4's post-recalculation audit will not run automatically. Trigger /vip-audit manually.",
        runType: ctx.runType, date: ctx.date, timeCst: ctx.timeCst,
      }, { deps: input.deps });
    }
  }

  return summary;
}

function tierRank(tier) {
  if (tier === M.VIP_TIER_VALUES.highVip) return 2;
  if (tier === M.VIP_TIER_VALUES.standardVip) return 1;
  return 0;
}

/**
 * First Monday of month, 7:00 AM CST (design §6.3). Automated check-in to
 * every Standard VIP and High VIP ambassador; High VIP ambassadors with no
 * referral in the past 30 days are queued as CRM tasks for the VIP
 * Relationship Manager.
 */
async function monthlyVipSupplemental(input = {}) {
  const deps = resolveDeps(input);
  const { zoho, mail, claude, alerts, now } = deps;
  const today = dates.dateStr(now);
  const ctx = { runType: 'scheduled', date: today, timeCst: dates.timeCst(now), deps: input.deps };
  const summary = { checkInsSent: 0, outreachTasksCreated: 0, halted: null, errors: [] };

  let moduleApi;
  try {
    const v = await moduleAndVerify(zoho, alerts, ctx);
    moduleApi = v.moduleApi;
    if (v.missing.length) { summary.halted = `Missing required CRM fields: ${v.missing.join(', ')}`; return summary; }
  } catch (err) {
    summary.halted = `module resolution: ${err.message}`;
    return summary;
  }

  const F = M.AMBASSADOR_FIELDS;
  let allVip;
  try {
    const criteria = `(${F.vipTier}:equals:${M.VIP_TIER_VALUES.standardVip})or(${F.vipTier}:equals:${M.VIP_TIER_VALUES.highVip})`;
    allVip = await zoho.fetchAllRecords(moduleApi, { criteria });
  } catch (err) {
    summary.halted = `VIP query: ${err.message}`;
    return summary;
  }

  for (const rec of allVip) {
    const amb = recordToAmbassador(rec);
    try {
      const body = await claude.generateEmail({
        system: prompts.buildStandardSystemPrompt('', ''), user: prompts.buildVipCheckInPrompt(amb), maxTokens: 300,
      });
      const res = await sendWithRetry({
        mail, alerts, to: amb.email, subject: 'Checking in with you', text: body, ambassadorName: amb.firstName,
        errorType: 'VIP check-in email failure', action: 'Retry sending manually.', ctx, deps: input.deps,
      });
      if (res.ok) summary.checkInsSent += 1;
    } catch (err) {
      summary.errors.push(`VIP check-in generation failed for ${amb.id}: ${err.message}`);
    }
  }

  const highVipInactive = allVip
    .map(recordToAmbassador)
    .filter((amb) => amb.vipTier === M.VIP_TIER_VALUES.highVip && amb.daysSinceLastReferral >= 30);

  const vipManagerEmail = M.getEnv('VIP_MANAGER_EMAIL');
  for (const amb of highVipInactive) {
    try {
      await zoho.createTask({
        subject: `Personal outreach: ${amb.firstName} ${amb.lastName} (High VIP)`,
        assignedToEmail: vipManagerEmail,
        dueDate: dates.nextFridayStr(today),
        description: `High VIP ambassador. Score: ${amb.vipScore}. Days since last referral: ${amb.daysSinceLastReferral}.`,
      });
      summary.outreachTasksCreated += 1;
    } catch (err) {
      summary.errors.push(`CRM task creation failed for ${amb.id}: ${err.message}`);
    }
  }

  return summary;
}

module.exports = { monthlyNonReferralCheck, monthlyVipRecalculation, monthlyVipSupplemental, tierRank };
