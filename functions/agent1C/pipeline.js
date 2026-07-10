'use strict';

/**
 * Agent 1C run cycle — the five jobs from design §4, with the §7 failure
 * handling. The kill switch (checkSpendConfirmation) is the most important
 * function in this agent; build/read it first (design §4 intro).
 *
 * Every external module is injectable via `deps` so each job runs offline in
 * tests: deps.zoho, deps.zohoMail, deps.meta, deps.google, deps.claude,
 * deps.webhooks, deps.alerts, deps.now.
 */

const M = require('./manifest');
const defaultZoho = require('./zoho');
const defaultZohoMail = require('./zohoMail');
const defaultMeta = require('./metaAds');
const defaultGoogle = require('./googleAds');
const defaultClaude = require('./claude');
const defaultWebhooks = require('./webhooks');
const defaultAlerts = require('./alerts');

// ─── date helpers (CST) ────────────────────────────────────────────────────────
function dateStr(now) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}
function timeCst(now) {
  try {
    return `${new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: '2-digit', minute: '2-digit', hour12: false }).format(now)} CST`;
  } catch {
    return `${now.toISOString().slice(11, 16)} UTC`;
  }
}
function yesterdayStr(now) {
  const y = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return dateStr(y);
}
function daysAgoStr(now, n) {
  return dateStr(new Date(now.getTime() - n * 24 * 60 * 60 * 1000));
}

function resolveDeps(input) {
  const d = input.deps || {};
  return {
    zoho: d.zoho || defaultZoho,
    zohoMail: d.zohoMail || defaultZohoMail,
    meta: d.meta || defaultMeta,
    google: d.google || defaultGoogle,
    claude: d.claude || defaultClaude,
    webhooks: d.webhooks || defaultWebhooks,
    alerts: d.alerts || defaultAlerts,
    now: (d.now && d.now()) || new Date(),
  };
}

/** Find (and resolve) the live Ad Campaign Log module api_name, verifying the fields this agent writes. */
async function resolveLogModule(zoho, summary, alerts, ctx) {
  const resolved = await zoho.resolveModuleApiName(M.AD_CAMPAIGN_LOG_MODULE);
  if (resolved.divergence) {
    summary.errors.push(`Module name divergence: ${resolved.divergence}`);
    await alerts.sendAlert({ ...ctx, failureType: 'CRM module divergence', errorDetails: resolved.divergence,
      financialImpact: 'None yet — configuration issue.', recommendedAction: 'Reconcile AD_CAMPAIGN_LOG_MODULE_API_NAME with the live Zoho api_name.' });
  }
  const { missing } = await zoho.verifyFields(resolved.apiName, Object.values(M.LOG_FIELDS));
  if (missing.length) {
    summary.errors.push(`Missing Ad Campaign Log fields in Zoho: ${missing.join(', ')}`);
    await alerts.sendAlert({ ...ctx, failureType: 'CRM field divergence', errorDetails: `Fields missing on "${resolved.apiName}": ${missing.join(', ')}`,
      financialImpact: 'None yet — configuration issue.', recommendedAction: 'Create the missing Ad Campaign Log fields in Zoho (or run Agent 5A).' });
  }
  return resolved.apiName;
}

/** Find today's (or a given date's) spend-confirmation log record. Returns { confirmed, confirmedAt, record }. */
async function findConfirmationRecord(zoho, moduleApi, dateForQuery) {
  const F = M.LOG_FIELDS;
  const records = await zoho.searchByCriteria(
    moduleApi,
    `((${F.logDate}:equals:${dateForQuery})and(${F.logType}:equals:${M.LOG_TYPES.spendConfirmation}))`,
  );
  const record = records[0] || null;
  return { confirmed: !!(record && record[F.confirmed] === true), confirmedAt: (record && record[F.confirmedAt]) || null, record };
}

// ════════════════════════════════════════════════════════════════════════════
// Job A: compileDailySpend (design §4, 7:50 AM CST daily)
// ════════════════════════════════════════════════════════════════════════════
async function compileDailySpend(input = {}) {
  const { zoho, meta, google, webhooks, alerts, now } = resolveDeps(input);
  const today = dateStr(now);
  const yesterday = yesterdayStr(now);
  const summary = { date: yesterday, errors: [], halted: null };
  const alertCtx = { jobType: 'compileDailySpend', date: today, runDateTime: `${today} ${timeCst(now)}` };

  // Step A1: refresh all tokens. Abort + alert if any fail (design: "Abort the job... if any token refresh fails").
  let googleToken;
  try {
    zoho.resetCrmToken(); zoho.resetAnalyticsToken(); zoho.resetWorkDriveToken(); google.resetToken();
    await zoho.getCrmToken(); await zoho.getAnalyticsToken();
    googleToken = await google.getGoogleAdsToken();
  } catch (err) {
    await alerts.sendAlert({ ...alertCtx, failureType: 'token refresh failure', failedStep: 'Step A1: Refresh All Tokens',
      errorDetails: err.message, financialImpact: 'Campaigns continue running; dashboard will show no data today.',
      recommendedAction: 'Re-check the Zoho CRM/Analytics and Google Ads OAuth credentials in Catalyst.' });
    summary.halted = `Step A1 token refresh: ${err.message}`;
    return summary;
  }

  // Step A2: prior-day spend, both platforms in parallel. Partial failure is non-fatal (safe default 0).
  const [metaRes, googleRes] = await Promise.allSettled([meta.getMetaDailySpend(yesterday), google.getGoogleDailySpend(yesterday, googleToken)]);
  const metaData = metaRes.status === 'fulfilled' ? metaRes.value
    : { totalSpend: 0, threshold: parseFloat(M.getEnv('META_DAILY_SPEND_THRESHOLD')), overThreshold: false, error: metaRes.reason.message };
  const googleData = googleRes.status === 'fulfilled' ? googleRes.value
    : { totalSpend: 0, threshold: parseFloat(M.getEnv('GOOGLE_DAILY_SPEND_THRESHOLD')), overThreshold: false, error: googleRes.reason.message };
  if (metaData.error) {
    summary.errors.push(`Meta spend read failed: ${metaData.error}`);
    await alerts.sendAlert({ ...alertCtx, failureType: 'Meta Ads token/read failure', failedStep: 'Step A2: Read Prior-Day Spend',
      errorDetails: metaData.error, financialImpact: 'Meta spend shown as $0 in dashboard; Google campaigns unaffected.',
      recommendedAction: 'Check Meta Ads token validity and expiry.' });
  }
  if (googleData.error) {
    summary.errors.push(`Google spend read failed: ${googleData.error}`);
    await alerts.sendAlert({ ...alertCtx, failureType: 'Google Ads token/read failure', failedStep: 'Step A2: Read Prior-Day Spend',
      errorDetails: googleData.error, financialImpact: 'Google spend shown as $0 in dashboard; Meta campaigns unaffected.',
      recommendedAction: 'Check Google Ads token validity.' });
  }
  const combinedSpend = (metaData.totalSpend || 0) + (googleData.totalSpend || 0);

  const spendSummary = {
    date: yesterday, metaSpend: metaData.totalSpend, metaThreshold: metaData.threshold, metaOverThreshold: !!metaData.overThreshold,
    googleSpend: googleData.totalSpend, googleThreshold: googleData.threshold, googleOverThreshold: !!googleData.overThreshold, combinedSpend,
  };
  Object.assign(summary, spendSummary);

  // Step A3: write daily spend log to CRM (retry once).
  let logRecordId = null;
  try {
    const moduleApi = await resolveLogModule(zoho, summary, alerts, alertCtx);
    const F = M.LOG_FIELDS;
    const record = {
      [F.logDate]: yesterday, [F.logType]: M.LOG_TYPES.spendConfirmation,
      [F.metaSpend]: metaData.totalSpend, [F.metaThreshold]: metaData.threshold, [F.metaOverThreshold]: !!metaData.overThreshold, [F.metaError]: metaData.error || null,
      [F.googleSpend]: googleData.totalSpend, [F.googleThreshold]: googleData.threshold, [F.googleOverThreshold]: !!googleData.overThreshold, [F.googleError]: googleData.error || null,
      [F.combinedSpend]: combinedSpend, [F.confirmed]: false, [F.confirmedAt]: null, [F.killSwitchFired]: false, [F.killSwitchAt]: null,
    };
    try {
      const res = await zoho.createRecord(moduleApi, record);
      logRecordId = res.id;
    } catch (err1) {
      const res = await zoho.createRecord(moduleApi, record); // one retry
      logRecordId = res.id;
    }
  } catch (err) {
    summary.errors.push(`CRM daily spend log write failed: ${err.message}`);
    await alerts.sendAlert({ ...alertCtx, failureType: 'CRM daily spend log write failure', failedStep: 'Step A3: Write Daily Spend Log to CRM',
      errorDetails: err.message, financialImpact: 'Campaigns continue running.', campaignIds: 'N/A',
      recommendedAction: `Manually log today's spend. Meta $${metaData.totalSpend}, Google $${googleData.totalSpend}, combined $${combinedSpend}.` });
  }
  summary.logRecordId = logRecordId;

  // Step A4: push to Zoho Analytics coordinator dashboard (retry once).
  try {
    const row = { Date: yesterday, Meta_Spend: metaData.totalSpend, Meta_Threshold: metaData.threshold, Meta_Over_Threshold: !!metaData.overThreshold,
      Google_Spend: googleData.totalSpend, Google_Threshold: googleData.threshold, Google_Over_Threshold: !!googleData.overThreshold,
      Combined_Spend: combinedSpend, Confirmed: false, Kill_Switch_Fired: false };
    try {
      await zoho.updateAnalyticsDashboard(row);
    } catch (err1) {
      await zoho.updateAnalyticsDashboard(row); // one retry
    }
    summary.dashboardUpdated = true;
  } catch (err) {
    summary.dashboardUpdated = false;
    summary.errors.push(`Analytics dashboard update failed: ${err.message}`);
    // §7 fallback: spend data still reaches the coordinator via the alert email body (below).
  }

  // Step A5: daily spend alert email (retry once, then Zoho Mail fallback — see alerts.sendSpendAlert).
  const alertResult = await alerts.sendSpendAlert(spendSummary, logRecordId, { deps: input.deps || {}, retryDelayMs: input.fastRetry ? 0 : 30000 });
  summary.spendAlert = alertResult;
  if (!alertResult.delivered) {
    summary.errors.push('Spend alert delivery failed on webhook and Zoho Mail fallback.');
  }

  return summary;
}

// ════════════════════════════════════════════════════════════════════════════
// Job B: checkSpendConfirmation — THE KILL SWITCH (design §4, 10:00 AM CST daily)
// ════════════════════════════════════════════════════════════════════════════
async function checkSpendConfirmation(input = {}) {
  const { zoho, meta, google, alerts, now } = resolveDeps(input);
  const today = dateStr(now);
  const summary = { date: today, confirmed: null, killSwitchFired: false, errors: [], halted: null };
  const alertCtx = { jobType: 'checkSpendConfirmation', date: today, runDateTime: `${today} ${timeCst(now)}` };

  // Step B1: refresh tokens. Never skip the pause attempt due to a token failure.
  let googleToken = null;
  let tokenErr = null;
  try {
    zoho.resetCrmToken(); google.resetToken();
    await zoho.getCrmToken();
    googleToken = await google.getGoogleAdsToken();
  } catch (err) {
    tokenErr = err.message;
    await alerts.sendAlert({ ...alertCtx, failureType: 'token refresh failure', failedStep: 'Step B1: Refresh Tokens',
      errorDetails: err.message, financialImpact: 'Attempting campaign pause with cached credentials regardless.',
      recommendedAction: 'Re-check credentials immediately — this is the kill switch job.' });
  }

  // Step B2: check confirmation.
  let moduleApi;
  let confirmation;
  try {
    moduleApi = await resolveLogModule(zoho, summary, alerts, alertCtx);
    confirmation = await findConfirmationRecord(zoho, moduleApi, today);
  } catch (err) {
    summary.errors.push(`Confirmation check failed: ${err.message}`);
    await alerts.sendAlert({ ...alertCtx, failureType: 'CRM confirmation check failure', failedStep: 'Step B2: Check Confirmation Status',
      errorDetails: err.message, financialImpact: 'Cannot confirm spend was approved — proceeding to pause as a safety default.',
      recommendedAction: 'Investigate CRM connectivity immediately.' });
    confirmation = { confirmed: false, confirmedAt: null, record: null };
  }
  summary.confirmed = confirmation.confirmed;

  if (confirmation.confirmed) {
    return summary; // Campaigns continue running. Nothing further to do.
  }

  // Step B3: pause all campaigns on both platforms — non-negotiable, no warning first.
  const metaResult = await meta.pauseAllMetaCampaigns();
  let metaFinal = metaResult;
  if (metaResult.failed.length) {
    await new Promise((r) => setTimeout(r, input.fastRetry ? 0 : 30000));
    const retryFailed = [];
    for (const f of metaResult.failed) {
      try { await meta.metaPost(f.id, { status: 'PAUSED' }); metaFinal.pausedIds.push(f.id); } catch (err) { retryFailed.push({ id: f.id, error: err.message }); }
    }
    metaFinal = { pausedIds: metaFinal.pausedIds, failed: retryFailed };
  }
  if (metaFinal.failed.length) {
    await alerts.sendAlert({ ...alertCtx, failureType: 'Meta campaign pause failure', failedStep: 'Step B3: Pause All Campaigns',
      errorDetails: JSON.stringify(metaFinal.failed), financialImpact: 'Some Meta campaigns may still be spending.',
      campaignIds: metaFinal.failed.map((f) => f.id).join(', '), recommendedAction: 'Pause these Meta campaign IDs manually in Ads Manager immediately.' });
  }

  let googleFinal = { pausedIds: [], failed: [] };
  if (googleToken) {
    googleFinal = await google.pauseAllGoogleCampaigns(googleToken);
    if (googleFinal.failed.length) {
      await new Promise((r) => setTimeout(r, input.fastRetry ? 0 : 30000));
      const retry = await google.pauseAllGoogleCampaigns(googleToken);
      googleFinal = retry.pausedIds.length ? retry : googleFinal;
    }
    if (googleFinal.failed.length) {
      await alerts.sendAlert({ ...alertCtx, failureType: 'Google campaign pause failure', failedStep: 'Step B3: Pause All Campaigns',
        errorDetails: JSON.stringify(googleFinal.failed), financialImpact: 'Some Google campaigns may still be spending.',
        campaignIds: googleFinal.failed.map((f) => f.id).join(', '), recommendedAction: 'Pause these Google campaign IDs manually in Google Ads console immediately.' });
    }
  } else if (tokenErr) {
    summary.errors.push('Google campaigns not paused: no Google Ads token available.');
  }

  summary.pausedMetaIds = metaFinal.pausedIds;
  summary.pausedGoogleIds = googleFinal.pausedIds;
  summary.killSwitchFired = true;

  // Step B4: log the kill switch event and alert.
  const firedAt = now.toISOString();
  const F = M.LOG_FIELDS;
  try {
    if (confirmation.record && confirmation.record.id) {
      await zoho.updateRecord(moduleApi, confirmation.record.id, {
        [F.killSwitchFired]: true, [F.killSwitchAt]: firedAt,
        [F.pausedMetaIds]: JSON.stringify(metaFinal.pausedIds), [F.pausedGoogleIds]: JSON.stringify(googleFinal.pausedIds),
      });
      summary.logRecordId = confirmation.record.id;
    } else {
      // No spend-confirmation record exists for today (e.g. compileDailySpend did not run) — create one so there's a CRM trail.
      const rec = await zoho.createRecord(moduleApi, {
        [F.logDate]: today, [F.logType]: M.LOG_TYPES.spendConfirmation, [F.confirmed]: false,
        [F.killSwitchFired]: true, [F.killSwitchAt]: firedAt,
        [F.pausedMetaIds]: JSON.stringify(metaFinal.pausedIds), [F.pausedGoogleIds]: JSON.stringify(googleFinal.pausedIds),
      });
      summary.logRecordId = rec.id;
      summary.errors.push('No spend-confirmation record existed for today; created one during kill switch logging.');
    }
  } catch (err) {
    summary.errors.push(`Kill switch CRM log failed: ${err.message}`);
  }

  await alerts.sendKillSwitchAlert({ spendDate: today, pausedCount: metaFinal.pausedIds.length + googleFinal.pausedIds.length, firedAt }, { deps: input.deps || {} });

  return summary;
}

// ════════════════════════════════════════════════════════════════════════════
// Job C: recordConfirmation (Make.com Scenario 2, on coordinator action)
// ════════════════════════════════════════════════════════════════════════════
async function recordConfirmation(payload = {}, input = {}) {
  const { zoho, alerts, now } = resolveDeps(input);
  const { log_record_id: logRecordId, confirmed_at: confirmedAt } = payload;
  if (!logRecordId) return { success: false, message: 'log_record_id is required.' };

  try {
    const moduleApi = await zoho.resolveModuleApiName(M.AD_CAMPAIGN_LOG_MODULE).then((r) => r.apiName);
    const F = M.LOG_FIELDS;
    await zoho.updateRecord(moduleApi, logRecordId, { [F.confirmed]: true, [F.confirmedAt]: confirmedAt || now.toISOString() });
    try {
      await zoho.updateAnalyticsDashboard({ Date: dateStr(now), Confirmed: true });
    } catch { /* non-fatal — CRM confirmation is the source of truth the kill switch reads */ }
    return { success: true, message: 'Confirmation recorded. Campaigns continue.' };
  } catch (err) {
    await alerts.sendAlert({
      jobType: 'recordConfirmation', date: dateStr(now), runDateTime: `${dateStr(now)} ${timeCst(now)}`,
      failureType: 'confirmation recording failure', failedStep: 'Job C: recordConfirmation',
      errorDetails: err.message, financialImpact: 'Coordinator believes spend is confirmed; CRM may not reflect it.',
      recommendedAction: 'Coordinator must re-confirm before 10:00 AM CST.',
    }, { deps: input.deps || {} });
    return { success: false, message: err.message };
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Job D: resumeCampaigns (Make.com Scenario 3, coordinator restart action only)
// ════════════════════════════════════════════════════════════════════════════
async function resumeCampaigns(payload = {}, input = {}) {
  const { zoho, meta, google, alerts, now } = resolveDeps(input);
  const today = dateStr(now);

  const moduleApi = await zoho.resolveModuleApiName(M.AD_CAMPAIGN_LOG_MODULE).then((r) => r.apiName);
  const confirmation = await findConfirmationRecord(zoho, moduleApi, today);
  if (!confirmation.confirmed) {
    return { success: false, reason: 'Cannot restart: spend not confirmed for today.' };
  }

  let metaIds = [];
  let googleIds = [];
  try { metaIds = JSON.parse(payload.paused_meta_ids || '[]'); } catch { metaIds = []; }
  try { googleIds = JSON.parse(payload.paused_google_ids || '[]'); } catch { googleIds = []; }

  const metaResumed = await meta.resumeMetaCampaigns(metaIds);
  let googleResumed = { resumed: [], failed: [] };
  if (googleIds.length) {
    const googleToken = await google.getGoogleAdsToken();
    googleResumed = await google.resumeGoogleCampaigns(googleIds, googleToken);
  }

  if (metaResumed.failed.length || googleResumed.failed.length) {
    await alerts.sendAlert({
      jobType: 'resumeCampaigns', date: today, runDateTime: `${today} ${timeCst(now)}`,
      failureType: 'campaign resume failure', failedStep: 'Job D: Campaign Resume',
      errorDetails: JSON.stringify({ meta: metaResumed.failed, google: googleResumed.failed }),
      financialImpact: 'Successfully-resumed campaigns remain active; failed ones remain paused.',
      campaignIds: [...metaResumed.failed.map((f) => f.id), ...googleResumed.failed.map((f) => f.id)].join(', '),
      recommendedAction: 'Manually resume the listed campaign IDs.',
    }, { deps: input.deps || {} });
  }

  try {
    const F = M.LOG_FIELDS;
    if (payload.log_record_id) {
      await zoho.updateRecord(moduleApi, payload.log_record_id, { [F.restarted]: true, [F.restartedAt]: now.toISOString() });
    }
  } catch { /* non-fatal — campaigns already resumed; CRM note is best-effort */ }

  return { success: true, metaResumed: metaResumed.resumed.length, googleResumed: googleResumed.resumed.length };
}

// ════════════════════════════════════════════════════════════════════════════
// Job E: weeklyPerformanceReview (Catalyst scheduled job, Monday 6:00 AM CST)
// ════════════════════════════════════════════════════════════════════════════
async function weeklyPerformanceReview(input = {}) {
  const { zoho, meta, google, alerts, now } = resolveDeps(input);
  const dateTo = dateStr(now);
  const dateFrom = daysAgoStr(now, 7);
  const summary = { reviewPeriodFrom: dateFrom, reviewPeriodTo: dateTo, errors: [] };
  const alertCtx = { jobType: 'weeklyPerformanceReview', date: dateTo, runDateTime: `${dateTo} ${timeCst(now)}` };

  const moduleApi = await resolveLogModule(zoho, summary, alerts, alertCtx);
  const googleToken = await google.getGoogleAdsToken();

  const [metaPerf, googlePerf] = await Promise.allSettled([
    meta.getMetaWeeklyPerformance(dateFrom, dateTo),
    google.getGoogleWeeklyPerformance(dateFrom, dateTo, googleToken),
  ]);
  const metaCampaigns = metaPerf.status === 'fulfilled' ? metaPerf.value : [];
  const googleCampaigns = googlePerf.status === 'fulfilled' ? googlePerf.value : [];
  if (metaPerf.status === 'rejected') summary.errors.push(`Meta weekly performance failed: ${metaPerf.reason.message}`);
  if (googlePerf.status === 'rejected') summary.errors.push(`Google weekly performance failed: ${googlePerf.reason.message}`);

  const metaTotalSpend = metaCampaigns.reduce((s, c) => s + parseFloat(c.spend || 0), 0);
  const googleTotalSpend = googleCampaigns.reduce((s, r) => s + (parseInt((r.metrics && (r.metrics.costMicros || r.metrics.cost_micros)) || 0, 10) / 1_000_000), 0);
  const metaCampaignSlim = metaCampaigns.map((c) => ({ name: c.campaign_name, spend: c.spend, cpc: c.cpc, ctr: c.ctr }));

  // Flag campaigns whose CPC rose >20% vs last week's stored review (design Step E4).
  const flags = [];
  try {
    const priorReviews = await zoho.searchByCriteria(moduleApi, `((${M.LOG_FIELDS.logType}:equals:${M.LOG_TYPES.weeklyPerformanceReview})and(${M.LOG_FIELDS.reviewPeriodTo}:equals:${dateFrom}))`);
    const prior = priorReviews[0];
    if (prior && prior[M.LOG_FIELDS.metaCampaigns]) {
      const priorCampaigns = JSON.parse(prior[M.LOG_FIELDS.metaCampaigns]);
      for (const c of metaCampaignSlim) {
        const match = priorCampaigns.find((p) => p.name === c.name);
        const curCpc = parseFloat(c.cpc || 0);
        const priorCpc = match ? parseFloat(match.cpc || 0) : 0;
        if (priorCpc > 0 && curCpc > priorCpc * (1 + M.WEEKLY_PERFORMANCE_CPC_FLAG_PCT / 100)) {
          flags.push({ name: c.name, priorCpc, currentCpc: curCpc });
        }
      }
    }
  } catch (err) {
    summary.errors.push(`Prior-week comparison failed: ${err.message}`);
  }

  const F = M.LOG_FIELDS;
  try {
    await zoho.createRecord(moduleApi, {
      [F.logDate]: dateTo, [F.logType]: M.LOG_TYPES.weeklyPerformanceReview,
      [F.metaTotalSpend]: Math.round(metaTotalSpend * 100) / 100, [F.googleTotalSpend]: Math.round(googleTotalSpend * 100) / 100,
      [F.reviewPeriodFrom]: dateFrom, [F.reviewPeriodTo]: dateTo,
      [F.metaCampaigns]: JSON.stringify(metaCampaignSlim), [F.performanceFlags]: JSON.stringify(flags),
    });
  } catch (err) {
    summary.errors.push(`Weekly performance CRM write failed: ${err.message}`);
    await alerts.sendAlert({ ...alertCtx, failureType: 'weekly performance CRM write failure', failedStep: 'Job E: weeklyPerformanceReview',
      errorDetails: err.message, financialImpact: 'None — reporting only.', recommendedAction: 'Retry the weekly review manually.' });
  }

  summary.metaCampaigns = metaCampaignSlim.length;
  summary.googleCampaigns = googleCampaigns.length;
  summary.flags = flags;
  return summary;
}

// ════════════════════════════════════════════════════════════════════════════
// weeklyAudienceRefresh (Make.com Scenario 4, triggered by Agent 0 completion)
// ════════════════════════════════════════════════════════════════════════════
async function weeklyAudienceRefresh(payload = {}, input = {}) {
  const { zoho, claude, alerts, now } = resolveDeps(input);
  const today = dateStr(now);
  const alertCtx = { jobType: 'weeklyAudienceRefresh', date: today, runDateTime: `${today} ${timeCst(now)}` };
  const summary = { errors: [] };

  // Read audience segment data from the Prospects module (design §3.4). Field
  // names are Agent 0's LIVE reconciled names, not the design doc's stale ones
  // — see manifest.js PROSPECT_READ_FIELDS.
  let segmentData = [];
  try {
    const prospectsResolved = await zoho.resolveModuleApiName(M.PROSPECTS_MODULE);
    const { missing } = await zoho.verifyFields(prospectsResolved.apiName, Object.values(M.PROSPECT_READ_FIELDS));
    if (missing.length) {
      summary.errors.push(`Missing Prospects fields in Zoho: ${missing.join(', ')}`);
      await alerts.sendAlert({ ...alertCtx, failureType: 'CRM field divergence', failedStep: 'Input 4: Audience Segment Data',
        errorDetails: `Fields missing on "${prospectsResolved.apiName}": ${missing.join(', ')}`,
        financialImpact: 'None — targeting recommendation will be based on incomplete data.',
        recommendedAction: 'Reconcile PROSPECT_READ_FIELDS in agent1C/manifest.js against Zoho (coordinate with Agent 0).' });
    }
    const thirtyDaysAgo = daysAgoStr(now, 30);
    segmentData = await zoho.fetchRecords(prospectsResolved.apiName, { criteria: `(Created_Date:greater_than:${thirtyDaysAgo})`, perPage: 200 });
  } catch (err) {
    summary.errors.push(`Audience segment read failed: ${err.message}`);
  }

  const bySegment = {};
  const F = M.PROSPECT_READ_FIELDS;
  for (const p of segmentData) {
    const key = `${p[F.roleCategory] || 'Unknown'} / ${p[F.motivationTag] || 'Unknown'}`;
    bySegment[key] = (bySegment[key] || 0) + 1;
  }

  // Spend history: last 7 days of Spend Confirmation log records.
  let spendHistory = [];
  try {
    const logModuleApi = await zoho.resolveModuleApiName(M.AD_CAMPAIGN_LOG_MODULE).then((r) => r.apiName);
    const sevenDaysAgo = daysAgoStr(now, 7);
    spendHistory = await zoho.searchByCriteria(logModuleApi, `((${M.LOG_FIELDS.logType}:equals:${M.LOG_TYPES.spendConfirmation})and(${M.LOG_FIELDS.logDate}:greater_than:${sevenDaysAgo}))`);
  } catch (err) {
    summary.errors.push(`Spend history read failed: ${err.message}`);
  }

  try {
    summary.recommendation = await claude.generateAudienceRecommendation(bySegment, spendHistory);
  } catch (err) {
    summary.errors.push(`Claude audience recommendation failed: ${err.message}`);
    const consecutiveFailures = (input.consecutiveFailures || 0) + 1;
    summary.consecutiveFailures = consecutiveFailures;
    if (consecutiveFailures >= 3) {
      await alerts.sendAlert({ ...alertCtx, failureType: 'Claude audience recommendation failure (3rd consecutive week)',
        failedStep: 'Section 5.1: Weekly Audience Recommendation Prompt', errorDetails: err.message,
        financialImpact: 'None — recommendation is advisory only.',
        recommendedAction: 'Investigate the Claude API integration; weekly recommendations have failed 3 weeks running.' });
    }
    summary.recommendation = null;
  }

  summary.segmentCount = segmentData.length;
  summary.bySegment = bySegment;
  return summary;
}

module.exports = {
  compileDailySpend, checkSpendConfirmation, recordConfirmation, resumeCampaigns, weeklyPerformanceReview, weeklyAudienceRefresh,
  dateStr, timeCst, yesterdayStr, daysAgoStr, findConfirmationRecord,
};
