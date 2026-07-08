'use strict';

/**
 * Google Ads API client (design §1.3, §3.2, §4 Job B/E).
 *
 * OAuth 2.0 refresh-token flow; GOOGLE_ADS_API_VERSION is env-configurable
 * (design note: Parmeet updates it without a code deploy when Google
 * deprecates a version). `dateStr` / `dateFrom`/`dateTo` are passed in by the
 * caller so this module stays pure and testable.
 */

const https = require('https');
const qs = require('querystring');
const M = require('./manifest');

const ACCOUNTS_HOST = 'oauth2.googleapis.com';
const API_HOST = 'googleads.googleapis.com';

function apiVersion() { return M.getEnv('GOOGLE_ADS_API_VERSION') || 'v16'; }

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
async function getGoogleAdsToken() {
  if (_token) return _token;
  const body = qs.stringify({
    client_id: M.getEnv('GOOGLE_ADS_CLIENT_ID'),
    client_secret: M.getEnv('GOOGLE_ADS_CLIENT_SECRET'),
    refresh_token: M.getEnv('GOOGLE_ADS_REFRESH_TOKEN'),
    grant_type: 'refresh_token',
  });
  const res = await request({
    hostname: ACCOUNTS_HOST,
    path: '/token',
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
  }, body);
  if (!res.body || !res.body.access_token) {
    throw new Error(`Google Ads token refresh failed: ${typeof res.body === 'string' ? res.body : JSON.stringify(res.body)}`);
  }
  _token = res.body.access_token;
  return _token;
}
function resetToken() { _token = null; }

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    'developer-token': M.getEnv('GOOGLE_ADS_DEVELOPER_TOKEN'),
    'login-customer-id': M.getEnv('GOOGLE_ADS_CUSTOMER_ID'),
    'Content-Type': 'application/json',
  };
}

async function gaqlSearch(query, token) {
  const body = JSON.stringify({ query });
  const customerId = M.getEnv('GOOGLE_ADS_CUSTOMER_ID');
  const res = await request({
    hostname: API_HOST,
    path: `/${apiVersion()}/customers/${encodeURIComponent(customerId)}/googleAds:search`,
    method: 'POST',
    headers: { ...headers(token), 'Content-Length': Buffer.byteLength(body) },
  }, body);
  if (res.body && res.body.error) throw new Error(`Google Ads query failed: ${JSON.stringify(res.body.error)}`);
  if (res.status !== 200) throw new Error(`Google Ads HTTP ${res.status}: ${JSON.stringify(res.body).slice(0, 200)}`);
  return res.body.results || [];
}

async function mutateCampaigns(operations, token) {
  const body = JSON.stringify({ operations });
  const customerId = M.getEnv('GOOGLE_ADS_CUSTOMER_ID');
  const res = await request({
    hostname: API_HOST,
    path: `/${apiVersion()}/customers/${encodeURIComponent(customerId)}/campaigns:mutate`,
    method: 'POST',
    headers: { ...headers(token), 'Content-Length': Buffer.byteLength(body) },
  }, body);
  if (res.body && res.body.error) throw new Error(`Google Ads mutate failed: ${JSON.stringify(res.body.error)}`);
  if (res.status !== 200) throw new Error(`Google Ads HTTP ${res.status}: ${JSON.stringify(res.body).slice(0, 200)}`);
  return res.body;
}

/** Step A2 — prior-day spend across enabled campaigns. cost_micros -> USD. */
async function getGoogleDailySpend(dateStr, token) {
  const query = [
    'SELECT campaign.name, campaign.status,',
    'metrics.cost_micros, metrics.impressions,',
    'metrics.clicks, metrics.average_cpc',
    'FROM campaign',
    `WHERE segments.date = ${JSON.stringify(dateStr)}`,
    'AND campaign.status = ENABLED',
  ].join(' ');
  const rows = await gaqlSearch(query, token);
  const totalSpendMicros = rows.reduce((sum, r) => sum + parseInt((r.metrics && r.metrics.costMicros) || (r.metrics && r.metrics.cost_micros) || 0, 10), 0);
  const totalSpend = totalSpendMicros / 1_000_000;
  const threshold = parseFloat(M.getEnv('GOOGLE_DAILY_SPEND_THRESHOLD'));
  return { date: dateStr, totalSpend: Math.round(totalSpend * 100) / 100, threshold, overThreshold: totalSpend > threshold, campaigns: rows };
}

/** Job E — weekly performance across the review window. */
async function getGoogleWeeklyPerformance(dateFrom, dateTo, token) {
  const query = [
    'SELECT campaign.name, campaign.status,',
    'metrics.cost_micros, metrics.impressions,',
    'metrics.clicks, metrics.average_cpc,',
    'metrics.conversions',
    'FROM campaign',
    `WHERE segments.date BETWEEN ${JSON.stringify(dateFrom)} AND ${JSON.stringify(dateTo)}`,
    'AND campaign.status = ENABLED',
  ].join(' ');
  return gaqlSearch(query, token);
}

/** Kill switch Step B3 — pause every enabled campaign. Returns paused campaign IDs. */
async function pauseAllGoogleCampaigns(token) {
  const query = 'SELECT campaign.id, campaign.name FROM campaign WHERE campaign.status = ENABLED';
  const rows = await gaqlSearch(query, token);
  if (!rows.length) return { pausedIds: [], failed: [] };
  const operations = rows.map((r) => ({ updateMask: 'status', update: { resourceName: r.campaign.resourceName, status: 'PAUSED' } }));
  try {
    await mutateCampaigns(operations, token);
    return { pausedIds: rows.map((r) => r.campaign.id), failed: [] };
  } catch (err) {
    return { pausedIds: [], failed: rows.map((r) => ({ id: r.campaign.id, error: err.message })) };
  }
}

/** Job D — resume previously paused campaigns by ID. */
async function resumeGoogleCampaigns(ids, token) {
  if (!ids.length) return { resumed: [], failed: [] };
  const customerId = M.getEnv('GOOGLE_ADS_CUSTOMER_ID');
  const operations = ids.map((id) => ({ updateMask: 'status', update: { resourceName: `customers/${customerId}/campaigns/${id}`, status: 'ENABLED' } }));
  try {
    await mutateCampaigns(operations, token);
    return { resumed: ids, failed: [] };
  } catch (err) {
    return { resumed: [], failed: ids.map((id) => ({ id, error: err.message })) };
  }
}

module.exports = {
  getGoogleAdsToken, resetToken, gaqlSearch, mutateCampaigns,
  getGoogleDailySpend, getGoogleWeeklyPerformance, pauseAllGoogleCampaigns, resumeGoogleCampaigns,
};
