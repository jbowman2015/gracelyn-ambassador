'use strict';

/**
 * Zoho Analytics helper — writes one flattened row per checkpoint/report run
 * to the coordinator dashboard table (workspace "Ambassador Program
 * Dashboards", table Coordinator_Dashboard_Log — both created live
 * 2026-07-13, resolving HARD STOP #2). When the workspace/view/credentials
 * aren't configured, `writeSummary` returns { ok: false, reason: 'not
 * configured' } rather than throwing, and callers fall back to the design's
 * own §8 failure-table recipe (email the coordinator the data directly as
 * text; the checkpoint and weekly report jobs already do this
 * unconditionally, so no data is lost either way).
 *
 * checkpoint.js/weeklyReport.js pass a nested summary object (arrays of
 * fraud items, applications, etc., or for weekly reports nested
 * referralFee/ambassadorHealth/vipStatus/sla/contentCompliance objects) —
 * Zoho Analytics tables take flat rows, so `buildRow` reduces each array to
 * a count column and stores the full nested detail in Payload_JSON for
 * drill-down. Table columns: Log_Date, Report_Type, Halted,
 * Kill_Switch_Event_Count, Fraud_Item_Count,
 * Applications_Awaiting_Approval_Count, Exception_Review_Count,
 * Eligibility_Item_Count, Dormant_Escalation_Count, SLA_Breach_Count,
 * System_Health_Note, Payload_JSON.
 */

const https = require('https');
const qs = require('querystring');
const M = require('./manifest');

const ACCOUNTS_HOST = process.env.ZOHO_ACCOUNTS_HOST || 'accounts.zoho.com';
const ANALYTICS_HOST = process.env.ZOHO_ANALYTICS_API_HOST || 'analyticsapi.zoho.com';

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        let parsed = data;
        try { parsed = JSON.parse(data); } catch { /* leave as string */ }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

let _token = null;
async function getAnalyticsToken() {
  if (_token) return _token;
  const body = qs.stringify({
    grant_type: 'refresh_token',
    client_id: process.env.ZOHO_ANALYTICS_CLIENT_ID,
    client_secret: process.env.ZOHO_ANALYTICS_CLIENT_SECRET,
    refresh_token: process.env.ZOHO_ANALYTICS_REFRESH_TOKEN,
  });
  const res = await request({
    hostname: ACCOUNTS_HOST,
    path: '/oauth/v2/token',
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
  }, body);
  if (!res.body || !res.body.access_token) {
    throw new Error(`Analytics token failed: ${typeof res.body === 'string' ? res.body : JSON.stringify(res.body)}`);
  }
  _token = res.body.access_token;
  return _token;
}

function resetToken() { _token = null; }

function isConfigured() {
  return !!(
    process.env.ZOHO_ANALYTICS_CLIENT_ID &&
    process.env.ZOHO_ANALYTICS_REFRESH_TOKEN &&
    M.getEnv('ZOHO_ANALYTICS_WORKSPACE_ID') &&
    M.getEnv('ZOHO_ANALYTICS_COORDINATOR_VIEW_ID')
  );
}

/** Flatten a daily_checkpoint or weekly_report summary into one table row. */
function buildRow(summary) {
  return {
    Log_Date: summary.date || '',
    Report_Type: summary.type || '',
    Halted: summary.halted || '',
    Kill_Switch_Event_Count: String((summary.killSwitchEvents || []).length),
    Fraud_Item_Count: String((summary.fraudItems || []).length),
    Applications_Awaiting_Approval_Count: String((summary.applicationsAwaitingApproval || []).length),
    Exception_Review_Count: String((summary.exceptionReviewItems || []).length),
    Eligibility_Item_Count: String((summary.eligibilityItems || []).length),
    Dormant_Escalation_Count: String((summary.dormantEscalations || []).length),
    SLA_Breach_Count: String((summary.slaBreaches || []).length),
    System_Health_Note: summary.systemHealthNote || '',
    Payload_JSON: JSON.stringify(summary),
  };
}

/**
 * Write a flattened summary row to the coordinator dashboard table. Never
 * throws — returns { ok, reason? }. `deps.request`/`deps.getAnalyticsToken`
 * are injectable for tests.
 */
async function writeSummary(summary, { deps = {} } = {}) {
  if (!isConfigured()) return { ok: false, reason: 'not configured (ZOHO_ANALYTICS_* env vars unset)' };
  try {
    const doRequest = deps.request || request;
    const token = deps.getAnalyticsToken ? await deps.getAnalyticsToken() : await getAnalyticsToken();
    const workspaceId = M.getEnv('ZOHO_ANALYTICS_WORKSPACE_ID');
    const viewId = M.getEnv('ZOHO_ANALYTICS_COORDINATOR_VIEW_ID');
    const config = JSON.stringify({ columns: buildRow(summary), dateFormat: 'yyyy-MM-dd' });
    const payload = `CONFIG=${encodeURIComponent(config)}`;
    const res = await doRequest({
      hostname: ANALYTICS_HOST,
      path: `/restapi/v2/workspaces/${encodeURIComponent(workspaceId)}/views/${encodeURIComponent(viewId)}/rows`,
      method: 'POST',
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, payload);
    const ok = res.status >= 200 && res.status < 300 && res.body && res.body.status !== 'failure';
    return { ok, reason: ok ? null : `HTTP ${res.status}: ${typeof res.body === 'string' ? res.body : JSON.stringify(res.body)}` };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

module.exports = { getAnalyticsToken, resetToken, isConfigured, writeSummary, buildRow };
