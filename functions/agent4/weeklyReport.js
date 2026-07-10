'use strict';

/**
 * Weekly coordinator report (design §6, Monday 6:00/6:15 AM CST — combined
 * per §7 Scenario 2). Six sections: Referral Fee Summary, SLA Performance,
 * Ambassador Health, VIP Program Status, System Health, Content Compliance.
 *
 * Content Compliance has no persistence layer anywhere in this program (the
 * Tuesday audit runs standalone and doesn't write violations to a queryable
 * store), so this section reports from `input.contentComplianceHistory` when
 * the caller supplies it (e.g. accumulated Tuesday contentComplianceAudit
 * summaries) and otherwise says so plainly rather than fabricating zeros.
 */

const M = require('./manifest');
const dates = require('./dates');
const { resolveContext } = require('./context');
const queries = require('./queries');
const { notifyCoordinator } = require('./coordinator');
const analytics = require('./analytics');
const { computeWeeklySlaSummary } = require('./sla');

const defaultZoho = require('./zoho');
const defaultAlerts = require('./alerts');

function resolveDeps(input) {
  const d = input.deps || {};
  return {
    zoho: d.zoho || defaultZoho, alerts: d.alerts || defaultAlerts,
    analytics: d.analytics || analytics, now: (d.now && d.now()) || new Date(),
  };
}

function computeReferralFeeSummary(referrals, sinceIso) {
  const F = M.REFERRAL_FIELDS;
  const eligible = referrals.filter((r) => r[F.commissionStatus] === M.COMMISSION_STATUS_VALUES.eligible);
  const paidAll = referrals.filter((r) => r[F.commissionStatus] === M.COMMISSION_STATUS_VALUES.paid);
  const paidThisWeek = paidAll.filter((r) => r[F.paymentDate] && r[F.paymentDate] >= sinceIso.slice(0, 10));
  const monthStart = sinceIso.slice(0, 7) + '-01';
  const paidThisMonth = paidAll.filter((r) => r[F.paymentDate] && r[F.paymentDate] >= monthStart);
  const sum = (arr) => arr.reduce((total, r) => total + (Number(r[F.commissionAmount]) || 0), 0);

  const byLevel = (arr) => ({
    undergraduate: sum(arr.filter((r) => r[F.programLevel] === M.PROGRAM_LEVEL_VALUES.undergraduate)),
    graduate: sum(arr.filter((r) => r[F.programLevel] === M.PROGRAM_LEVEL_VALUES.graduate)),
  });

  return {
    eligibleCount: eligible.length,
    eligibleTotal: sum(eligible),
    paidThisWeekTotal: sum(paidThisWeek),
    paidThisMonthTotal: sum(paidThisMonth),
    cumulativePaidTotal: sum(paidAll),
    paidThisWeekByLevel: byLevel(paidThisWeek),
  };
}

function computeAmbassadorHealth(ambassadors, sinceIso) {
  const F = M.AMBASSADOR_FIELDS;
  const active = ambassadors.filter((r) => r[F.ambassadorStatus] === M.AMBASSADOR_STATUS_VALUES.active);
  const newActivations = active.filter((r) => r[F.approvedDate] && r[F.approvedDate] >= sinceIso.slice(0, 10));
  const byTrack = (track) => ambassadors.filter((r) => r[F.engagementTrack] === track).length;
  const escalatedThisWeek = ambassadors.filter((r) => r[F.escalatedToHuman] && r.Modified_Time && r.Modified_Time >= sinceIso);

  return {
    totalActive: active.length,
    newActivations: newActivations.length,
    standardTrack: byTrack(M.ENGAGEMENT_TRACK_VALUES.standard),
    alternativeTrack: byTrack(M.ENGAGEMENT_TRACK_VALUES.alternative),
    dormantTrack: byTrack(M.ENGAGEMENT_TRACK_VALUES.dormant),
    escalatedThisWeek: escalatedThisWeek.length,
  };
}

function computeVipProgramStatus(ambassadors) {
  const F = M.AMBASSADOR_FIELDS;
  const highVip = ambassadors.filter((r) => r[F.vipTier] === M.VIP_TIER_VALUES.highVip);
  const standardVip = ambassadors.filter((r) => r[F.vipTier] === M.VIP_TIER_VALUES.standardVip);
  const highVipInactive30d = highVip.filter((r) => (r[F.daysSinceLastReferral] || 0) >= 30);
  const upgradesThisQuarter = ambassadors.filter((r) => r[F.vipTierUpgradeDate]).length;

  return {
    highVipCount: highVip.length,
    standardVipCount: standardVip.length,
    upgradesThisQuarter,
    highVipInactive30dCount: highVipInactive30d.length,
  };
}

function formatWeeklyReportBody(report) {
  const lines = [`Weekly coordinator report — week ending ${report.date}`, ''];

  lines.push('REFERRAL FEE SUMMARY');
  lines.push(`  Eligible awaiting payment: ${report.referralFee.eligibleCount} ($${report.referralFee.eligibleTotal})`);
  lines.push(`  Paid this week: $${report.referralFee.paidThisWeekTotal} (Undergrad $${report.referralFee.paidThisWeekByLevel.undergraduate}, Grad $${report.referralFee.paidThisWeekByLevel.graduate})`);
  lines.push(`  Paid this month: $${report.referralFee.paidThisMonthTotal}`);
  lines.push(`  Cumulative paid to date: $${report.referralFee.cumulativePaidTotal}`, '');

  lines.push('SLA PERFORMANCE');
  if (report.sla.halted) {
    lines.push(`  ${report.sla.halted}`);
  } else {
    lines.push(`  Total escalated this week: ${report.sla.totalEscalated}`);
    lines.push(`  Average first response time: ${report.sla.avgFirstResponseHours != null ? report.sla.avgFirstResponseHours.toFixed(1) + 'h' : 'n/a'}`);
    lines.push(`  Breach count / rate: ${report.sla.totalBreaches} / ${report.sla.breachRatePct.toFixed(1)}%${report.sla.breachRateExceedsThreshold ? ' — EXCEEDS THRESHOLD, coordinator capacity review recommended' : ''}`);
    lines.push(`  Open tickets older than 48h: ${report.sla.openOlderThan48h}`);
    lines.push(`  Longest open ticket age: ${report.sla.longestOpenHours.toFixed(1)}h`);
  }
  lines.push('');

  lines.push('AMBASSADOR HEALTH');
  lines.push(`  Total active: ${report.ambassadorHealth.totalActive}`);
  lines.push(`  New activations this week: ${report.ambassadorHealth.newActivations}`);
  lines.push(`  Standard / Alternative / Dormant track: ${report.ambassadorHealth.standardTrack} / ${report.ambassadorHealth.alternativeTrack} / ${report.ambassadorHealth.dormantTrack}`);
  lines.push(`  Escalated to human this week: ${report.ambassadorHealth.escalatedThisWeek}`, '');

  lines.push('VIP PROGRAM STATUS');
  lines.push(`  High VIP: ${report.vipStatus.highVipCount}. Standard VIP: ${report.vipStatus.standardVipCount}.`);
  lines.push(`  Tier upgrades this quarter: ${report.vipStatus.upgradesThisQuarter}`);
  lines.push(`  High VIP with no referral in 30 days: ${report.vipStatus.highVipInactive30dCount}`, '');

  lines.push('SYSTEM HEALTH');
  lines.push(`  ${report.systemHealthNote}`, '');

  lines.push('CONTENT COMPLIANCE');
  if (report.contentCompliance.available) {
    lines.push(`  Em dash violations: ${report.contentCompliance.emDashCount}`);
    lines.push(`  Commission language violations: ${report.contentCompliance.commissionCount}`);
    lines.push(`  Items added to escalation queue: ${report.contentCompliance.queuedCount}`);
  } else {
    lines.push(`  ${report.contentCompliance.note}`);
  }

  return lines.join('\n');
}

function summarizeContentComplianceHistory(history) {
  if (!Array.isArray(history) || !history.length) {
    return { available: false, note: 'No content compliance history supplied this run — see contentCompliance.js header for why no persistence layer exists yet.' };
  }
  let emDashCount = 0, commissionCount = 0, queuedCount = 0;
  for (const run of history) {
    for (const v of run.violations || []) {
      queuedCount += 1;
      for (const x of v.violations || []) {
        if (x.type === 'em_dash') emDashCount += 1;
        if (x.type === 'commission_language') commissionCount += 1;
      }
    }
  }
  return { available: true, emDashCount, commissionCount, queuedCount };
}

async function weeklyReport(input = {}) {
  const deps = resolveDeps(input);
  const { zoho, alerts, now } = deps;
  const runCtx = { runType: 'scheduled', date: dates.dateStr(now), timeCst: dates.timeCst(now), deps: input.deps };
  const sinceIso = input.sinceIso || dates.addDaysStr(runCtx.date, -7) + 'T00:00:00.000Z';
  const report = {
    date: runCtx.date, halted: null,
    systemHealthNote: 'Not yet instrumented — no CRM/Analytics source for agent error counts, failed automations, or token usage exists yet.',
  };

  let ctx;
  try {
    ctx = await resolveContext(zoho, alerts, runCtx);
    if (ctx.missingFields.length) { report.halted = `Missing required CRM fields: ${ctx.missingFields.join(', ')}`; return report; }
  } catch (err) {
    report.halted = `module resolution: ${err.message}`;
    return report;
  }

  try {
    const [referrals, ambassadors] = await Promise.all([
      zoho.fetchAllRecords(ctx.referralsModuleApiName, {}),
      queries.fetchAllAmbassadors(zoho, ctx.ambassadorsModuleApiName),
    ]);
    report.referralFee = computeReferralFeeSummary(referrals, sinceIso);
    report.ambassadorHealth = computeAmbassadorHealth(ambassadors, sinceIso);
    report.vipStatus = computeVipProgramStatus(ambassadors);
  } catch (err) {
    report.halted = `weekly report data query: ${err.message}`;
    await alerts.sendAlert({ errorType: 'weekly report generation failure', detail: err.message, action: 'Send partial report with whatever data was successfully compiled. Note missing sections.', ...runCtx });
    return report;
  }

  report.sla = await computeWeeklySlaSummary({ sinceIso, deps: input.deps });
  report.contentCompliance = summarizeContentComplianceHistory(input.contentComplianceHistory);

  const analyticsResult = await deps.analytics.writeSummary({ type: 'weekly_report', ...report }, { deps: input.deps });
  report.analyticsWrite = analyticsResult;
  if (!analyticsResult.ok) {
    await alerts.sendAlert({ errorType: 'Zoho Analytics write failed', detail: analyticsResult.reason, action: 'Weekly report emailed to coordinator directly as a text summary (fallback already applied).', ...runCtx });
  }

  const body = formatWeeklyReportBody(report);
  const emailResult = await notifyCoordinator({ subject: `[Agent 4] Weekly report — ${report.date}`, text: body }, { deps: input.deps });
  if (!emailResult.ok) {
    await alerts.sendAlert({ errorType: 'weekly report delivery failed', detail: emailResult.error, action: 'Coordinator did not receive the weekly report. Manual check required.', ...runCtx });
  }

  return report;
}

module.exports = {
  weeklyReport, formatWeeklyReportBody,
  computeReferralFeeSummary, computeAmbassadorHealth, computeVipProgramStatus,
  summarizeContentComplianceHistory,
};
