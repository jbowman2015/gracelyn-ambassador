'use strict';

/**
 * Meta Ads API client (design §1.2, §3.1, §4 Job B/E).
 *
 * Uses a long-lived access token (no OAuth refresh flow) per the design doc.
 * `dateStr` / `dateFrom`/`dateTo` are passed in by the caller (pipeline.js) so
 * this module stays pure and testable — it never computes "today" itself.
 */

const https = require('https');
const M = require('./manifest');

const API_BASE_HOST = 'graph.facebook.com';
const API_VERSION = process.env.META_ADS_API_VERSION || 'v19.0';

function request(options) {
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
    req.end();
  });
}

function postRequest(path, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname: API_BASE_HOST, path: `/${API_VERSION}/${path}`, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        let parsed = data;
        try { parsed = JSON.parse(data); } catch { /* leave as string */ }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function adAccount() { return `act_${M.getEnv('META_AD_ACCOUNT_ID')}`; }

async function metaGet(endpoint, params = {}) {
  const url = new URL(`https://${API_BASE_HOST}/${API_VERSION}/${endpoint}`);
  url.searchParams.set('access_token', M.getEnv('META_ADS_ACCESS_TOKEN'));
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await request({ hostname: url.hostname, path: url.pathname + url.search, method: 'GET' });
  if (res.body && res.body.error) throw new Error(`Meta API error: ${JSON.stringify(res.body.error)}`);
  if (res.status !== 200) throw new Error(`Meta API HTTP ${res.status}: ${JSON.stringify(res.body).slice(0, 200)}`);
  return res.body;
}

async function metaPost(endpoint, body = {}) {
  const res = await postRequest(endpoint, { ...body, access_token: M.getEnv('META_ADS_ACCESS_TOKEN') });
  if (res.body && res.body.error) throw new Error(`Meta API error: ${JSON.stringify(res.body.error)}`);
  if (res.status !== 200) throw new Error(`Meta API HTTP ${res.status}: ${JSON.stringify(res.body).slice(0, 200)}`);
  return res.body;
}

/** Step A2 — prior-day spend across all active campaigns. */
async function getMetaDailySpend(dateStr) {
  const data = await metaGet(`${adAccount()}/insights`, {
    fields: 'campaign_name,spend,impressions,clicks,cpc,ctr',
    time_range: JSON.stringify({ since: dateStr, until: dateStr }),
    level: 'campaign',
  });
  const campaigns = data.data || [];
  const totalSpend = campaigns.reduce((sum, c) => sum + parseFloat(c.spend || 0), 0);
  const threshold = parseFloat(M.getEnv('META_DAILY_SPEND_THRESHOLD'));
  return {
    date: dateStr,
    totalSpend: Math.round(totalSpend * 100) / 100,
    threshold,
    overThreshold: totalSpend > threshold,
    campaigns,
  };
}

/** Job E — weekly performance across the review window. */
async function getMetaWeeklyPerformance(dateFrom, dateTo) {
  const data = await metaGet(`${adAccount()}/insights`, {
    fields: 'campaign_name,spend,impressions,clicks,cpc,ctr,actions',
    time_range: JSON.stringify({ since: dateFrom, until: dateTo }),
    level: 'campaign',
  });
  return data.data || [];
}

/** Kill switch Step B3 — pause every active campaign. Returns paused campaign IDs. */
async function pauseAllMetaCampaigns() {
  const campaigns = await metaGet(`${adAccount()}/campaigns`, {
    fields: 'id,name,status',
    filtering: JSON.stringify([{ field: 'effective_status', operator: 'IN', value: ['ACTIVE'] }]),
  });
  const pausedIds = [];
  const failed = [];
  for (const campaign of (campaigns.data || [])) {
    try {
      await metaPost(`${campaign.id}`, { status: 'PAUSED' });
      pausedIds.push(campaign.id);
    } catch (err) {
      failed.push({ id: campaign.id, error: err.message });
    }
  }
  return { pausedIds, failed };
}

/** Job D — resume previously paused campaigns by ID. */
async function resumeMetaCampaigns(ids) {
  const resumed = [];
  const failed = [];
  for (const id of ids) {
    try {
      await metaPost(`${id}`, { status: 'ACTIVE' });
      resumed.push(id);
    } catch (err) {
      failed.push({ id, error: err.message });
    }
  }
  return { resumed, failed };
}

module.exports = { metaGet, metaPost, getMetaDailySpend, getMetaWeeklyPerformance, pauseAllMetaCampaigns, resumeMetaCampaigns };
