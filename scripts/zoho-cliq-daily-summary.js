#!/usr/bin/env node
/**
 * Daily summary — posts Ambassador Scaling Project status to a Zoho Cliq channel.
 *
 * Uses your existing Zoho OAuth credentials (same client ID/secret/refresh token
 * as Zoho Projects). The refresh token must include the ZohoCliq.channels.ALL scope.
 *
 * Required env vars:
 *   ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN
 *
 * Optional env vars (defaults shown):
 *   ZOHO_CLIQ_CHANNEL   — ambassadorscalingprojectjessica
 *   ZOHO_CLIQ_COMPANY   — 745687819
 *
 * If your refresh token does NOT have Cliq scope yet, generate a new one at:
 *   https://api-console.zoho.com → your app → OAuth Playground
 *   Scopes to include: ZohoProjects.portals.READ ZohoProjects.tasks.ALL ZohoCliq.channels.ALL
 *   Then set the new refresh token as ZOHO_REFRESH_TOKEN (or ZOHO_CLIQ_REFRESH_TOKEN to keep separate)
 *
 * Run manually:   node scripts/zoho-cliq-daily-summary.js
 * Scheduled:      Catalyst Job Schedule — cron: 0 4 * * * (10PM CST = 4AM UTC)
 */

'use strict';

const https = require('https');
const querystring = require('querystring');
const { getAllTasks } = require('./zoho-projects-helper');

const CLIQ_CHANNEL = process.env.ZOHO_CLIQ_CHANNEL  || 'ambassadorscalingprojectjessica';
const CLIQ_COMPANY = process.env.ZOHO_CLIQ_COMPANY  || '745687819';

// ─── Cliq OAuth token (separate refresh token if scopes differ) ───────────────

async function getCliqToken() {
  const refreshToken = process.env.ZOHO_CLIQ_REFRESH_TOKEN || process.env.ZOHO_REFRESH_TOKEN;
  const body = querystring.stringify({
    grant_type:    'refresh_token',
    client_id:     process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
    refresh_token: refreshToken,
  });
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'accounts.zoho.com',
      path:     '/oauth/v2/token',
      method:   'POST',
      headers:  { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => {
        const parsed = JSON.parse(d);
        if (!parsed.access_token) return reject(new Error(`Cliq token failed: ${d}`));
        resolve(parsed.access_token);
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── Cliq post ────────────────────────────────────────────────────────────────

async function postToCliq(token, message) {
  const body = JSON.stringify({ text: message });
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'cliq.zoho.com',
      path:     `/company/${CLIQ_COMPANY}/api/v2/channelsbyname/${CLIQ_CHANNEL}/message`,
      method:   'POST',
      headers: {
        Authorization:    `Zoho-oauthtoken ${token}`,
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── Summary builder ──────────────────────────────────────────────────────────

function buildSummary(tasks) {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const byStatus = { completed: [], inprogress: [], open: [], onhold: [], overdue: [] };
  const todayStr = new Date().toISOString().slice(0, 10);

  for (const t of tasks) {
    const statusName = (t.status?.name || '').toLowerCase().replace(/\s/g, '');
    if (statusName.includes('complete')) {
      byStatus.completed.push(t);
    } else if (statusName.includes('progress')) {
      byStatus.inprogress.push(t);
    } else if (statusName.includes('hold')) {
      byStatus.onhold.push(t);
    } else {
      if (t.end_date && t.end_date < todayStr) {
        byStatus.overdue.push(t);
      } else {
        byStatus.open.push(t);
      }
    }
  }

  const pct = tasks.length ? Math.round((byStatus.completed.length / tasks.length) * 100) : 0;
  const bar = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));

  let msg = `📋 *Ambassador Scaling Project — Daily Update*\n`;
  msg += `${today}\n`;
  msg += `─────────────────────────────\n`;
  msg += `Progress: ${bar} ${pct}% (${byStatus.completed.length}/${tasks.length} tasks complete)\n\n`;

  if (byStatus.overdue.length) {
    msg += `🔴 *OVERDUE (${byStatus.overdue.length})*\n`;
    byStatus.overdue.forEach((t) => { msg += `  • ${t.name}\n`; });
    msg += '\n';
  }

  if (byStatus.inprogress.length) {
    msg += `🟡 *In Progress (${byStatus.inprogress.length})*\n`;
    byStatus.inprogress.forEach((t) => { msg += `  • ${t.name}\n`; });
    msg += '\n';
  }

  if (byStatus.completed.length) {
    msg += `✅ *Completed Today / Overall (${byStatus.completed.length})*\n`;
    byStatus.completed.slice(-5).forEach((t) => { msg += `  • ${t.name}\n`; });
    if (byStatus.completed.length > 5) msg += `  • ...and ${byStatus.completed.length - 5} more\n`;
    msg += '\n';
  }

  if (byStatus.open.length) {
    msg += `⬜ *Not Started (${byStatus.open.length})*\n`;
    byStatus.open.slice(0, 5).forEach((t) => { msg += `  • ${t.name}\n`; });
    if (byStatus.open.length > 5) msg += `  • ...and ${byStatus.open.length - 5} more\n`;
    msg += '\n';
  }

  msg += `─────────────────────────────\n`;
  msg += `🎯 Go-live: July 18, 2026`;

  return msg;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const required = ['ZOHO_CLIENT_ID', 'ZOHO_CLIENT_SECRET', 'ZOHO_REFRESH_TOKEN'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) { console.error(`Missing env vars: ${missing.join(', ')}`); process.exit(1); }

  console.log('Fetching tasks...');
  const tasks = await getAllTasks();
  console.log(`${tasks.length} tasks fetched`);

  const message = buildSummary(tasks);
  console.log('\nMessage preview:\n');
  console.log(message);
  console.log('\nPosting to Cliq channel:', CLIQ_CHANNEL);

  const token = await getCliqToken();
  const res = await postToCliq(token, message);
  if (res.status === 200 || res.status === 201) {
    console.log('✓ Posted successfully');
  } else {
    console.error(`✗ Failed (${res.status}):`, res.body);
    process.exit(1);
  }
}

main().catch((err) => { console.error(err.message); process.exit(1); });
