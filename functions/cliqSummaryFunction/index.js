'use strict';

/**
 * Catalyst Advanced I/O function — Ambassador Scaling Project Cliq Daily Summary
 * Triggered by Job Schedule: cron 0 4 * * * (10PM CST = 4AM UTC)
 *
 * Required env vars (set in Catalyst Console → Configurations → Environment Variables):
 *   ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN  (Projects task fetch only)
 *   ZOHO_CLIQ_WEBHOOK_TOKEN  (Cliq incoming-webhook zapikey — posts the summary)
 *   ZOHO_CLIQ_CHANNEL  (default: ambassadorscalingprojectjessica)
 *   ZOHO_PORTAL_ID     (default: gracelynuniversity)
 *   ZOHO_PROJECT_ID    (default: 1776658000000715069)
 *
 * Cliq posting uses an incoming-webhook zapikey (no OAuth scope needed) —
 * OAuth is used only to read Zoho Projects tasks.
 */

const express  = require('express');
const https    = require('https');
const qs       = require('querystring');

const { buildSummary } = require('./summary');

const app = express();
app.use(express.json());

const CLIQ_CHANNEL       = process.env.ZOHO_CLIQ_CHANNEL || 'ambassadorscalingprojectjessica';
const CLIQ_WEBHOOK_TOKEN = process.env.ZOHO_CLIQ_WEBHOOK_TOKEN || '';
const PORTAL_ID          = process.env.ZOHO_PORTAL_ID  || 'gracelynuniversity';
const PROJECT_ID         = process.env.ZOHO_PROJECT_ID || '1776658000000715069';

const TASKLIST_IDS = [
  '1776658000006206015', // Week 1
  '1776658000006207022', // Week 2
  '1776658000006207024', // Standing Items
];

// ─── HTTP helper ──────────────────────────────────────────────────────────────

function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function getToken() {
  const body = qs.stringify({
    grant_type:    'refresh_token',
    client_id:     process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
    refresh_token: process.env.ZOHO_REFRESH_TOKEN,
  });
  const res = await httpsRequest({
    hostname: 'accounts.zoho.com',
    path:     '/oauth/v2/token',
    method:   'POST',
    headers:  { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
  }, body);
  if (!res.body.access_token) throw new Error(`Token failed: ${JSON.stringify(res.body)}`);
  return res.body.access_token;
}

// ─── Fetch tasks ──────────────────────────────────────────────────────────────

async function getAllTasks(token) {
  const tasks = [];
  for (const tlId of TASKLIST_IDS) {
    const res = await httpsRequest({
      hostname: 'projectsapi.zoho.com',
      path:     `/restapi/portal/${PORTAL_ID}/projects/${PROJECT_ID}/tasklists/${tlId}/tasks/`,
      method:   'GET',
      headers:  { Authorization: `Zoho-oauthtoken ${token}` },
    });
    if (res.body.tasks) tasks.push(...res.body.tasks);
  }
  return tasks;
}

// ─── Post to Cliq ─────────────────────────────────────────────────────────────

async function postToCliq(message) {
  const body = JSON.stringify({ text: message });
  return httpsRequest({
    hostname: 'cliq.zoho.com',
    path:     `/api/v2/channelsbyname/${CLIQ_CHANNEL}/message?zapikey=${CLIQ_WEBHOOK_TOKEN}`,
    method:   'POST',
    headers: {
      'Content-Type':   'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  }, body);
}

// ─── Route (called by Job Schedule) ──────────────────────────────────────────

app.post('/daily-summary', async (req, res) => {
  try {
    const token = await getToken();
    const tasks = await getAllTasks(token);
    const message = buildSummary(tasks);
    const result = await postToCliq(message);

    if (result.status === 200 || result.status === 201 || result.status === 204) {
      res.json({ success: true, tasks: tasks.length });
    } else {
      res.status(500).json({ success: false, cliqStatus: result.status, body: result.body });
    }
  } catch (err) {
    console.error('[Cliq Summary]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = app;
