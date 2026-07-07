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

// ─── Date helpers (America/Chicago aware) ─────────────────────────────────────

const CT = 'America/Chicago';

// "YYYY-MM-DD" for a given epoch (ms) in Central time
function ctDateStr(epochMs) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CT, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(epochMs));
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// ─── Summary builder ──────────────────────────────────────────────────────────

function buildSummary(tasks) {
  const now      = Date.now();
  const todayStr = ctDateStr(now);
  const tmrwStr  = ctDateStr(now + 24 * 60 * 60 * 1000);
  const today    = new Date().toLocaleDateString('en-US', { timeZone: CT, weekday: 'long', month: 'long', day: 'numeric' });

  const byStatus = { completed: [], inprogress: [], open: [], onhold: [], overdue: [] };

  for (const t of tasks) {
    const s = (t.status?.name || '').toLowerCase().replace(/\s/g, '');
    const done = t.completed === true || t.status?.type === 'closed' || s.includes('complete');
    if (done)                        byStatus.completed.push(t);
    else if (s.includes('progress')) byStatus.inprogress.push(t);
    else if (s.includes('hold'))     byStatus.onhold.push(t);
    else if (t.end_date_long && t.end_date_long < now) byStatus.overdue.push(t);
    else                             byStatus.open.push(t);
  }

  // Completed today — finished tasks last updated on today's Central-time date
  const completedToday = byStatus.completed.filter(
    (t) => t.last_updated_time_long && ctDateStr(t.last_updated_time_long) === todayStr
  );

  // Next steps for tomorrow — unfinished work starting or due tomorrow,
  // falling back to the soonest-due unfinished tasks if nothing is dated tomorrow.
  const active = [...byStatus.overdue, ...byStatus.inprogress, ...byStatus.open, ...byStatus.onhold];
  const dueOrStartCT = (t) => {
    const days = [];
    if (t.end_date_long)   days.push(ctDateStr(t.end_date_long));
    if (t.start_date_long) days.push(ctDateStr(t.start_date_long));
    return days;
  };
  let tomorrow = active.filter((t) => dueOrStartCT(t).includes(tmrwStr));
  if (!tomorrow.length) {
    tomorrow = active
      .filter((t) => t.end_date_long)
      .sort((a, b) => a.end_date_long - b.end_date_long)
      .slice(0, 5);
  }

  const pct = tasks.length ? Math.round((byStatus.completed.length / tasks.length) * 100) : 0;
  const bar = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));

  const line = (t) => {
    const due = t.end_date ? ` _(due ${t.end_date})_` : '';
    return `  • ${t.name}${due}\n`;
  };

  let msg = `📋 *Ambassador Scaling Project — Daily Update*\n`;
  msg += `${today}\n`;
  msg += `─────────────────────────────\n`;
  msg += `Progress: ${bar} ${pct}% (${byStatus.completed.length}/${tasks.length} tasks complete)\n\n`;

  // ── What got done today ──
  msg += `✅ *Completed Today (${completedToday.length})*\n`;
  if (completedToday.length) {
    completedToday.forEach((t) => { msg += `  • ${t.name}\n`; });
  } else {
    msg += `  • No tasks marked complete today\n`;
  }
  msg += '\n';

  if (byStatus.overdue.length) {
    msg += `🔴 *Overdue (${byStatus.overdue.length})*\n`;
    byStatus.overdue.forEach((t) => { msg += line(t); });
    msg += '\n';
  }
  if (byStatus.inprogress.length) {
    msg += `🟡 *In Progress (${byStatus.inprogress.length})*\n`;
    byStatus.inprogress.forEach((t) => { msg += line(t); });
    msg += '\n';
  }

  // ── What's next: tomorrow's steps ──
  msg += `➡️ *Next Steps — Tomorrow (${tomorrow.length})*\n`;
  if (tomorrow.length) {
    tomorrow.forEach((t) => { msg += line(t); });
  } else {
    msg += `  • Nothing scheduled — all caught up\n`;
  }
  msg += '\n';

  msg += `─────────────────────────────\n`;
  msg += `📊 ${byStatus.completed.length} done · ${byStatus.inprogress.length} in progress · ${byStatus.open.length + byStatus.onhold.length} not started · ${byStatus.overdue.length} overdue\n`;
  msg += `🎯 Go-live: July 18, 2026`;
  return msg;
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
