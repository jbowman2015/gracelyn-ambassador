'use strict';

/**
 * Shared Zoho Projects helper — token, task lookup, status update, comments.
 * Required env vars: ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN
 * Optional:         ZOHO_PORTAL_ID (default: gracelynuniversity)
 *                   ZOHO_PROJECT_ID (default: 1776658000000715069)
 */

const https = require('https');
const querystring = require('querystring');

const PORTAL_ID  = process.env.ZOHO_PORTAL_ID  || 'gracelynuniversity';
const PROJECT_ID = process.env.ZOHO_PROJECT_ID  || '1776658000000715069';

let _token = null;

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
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

async function zohoGet(token, path) {
  return httpsRequest({
    hostname: 'projectsapi.zoho.com',
    path,
    method: 'GET',
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  });
}

async function zohoPost(token, path, formData) {
  const body = querystring.stringify(formData);
  return httpsRequest({
    hostname: 'projectsapi.zoho.com',
    path,
    method: 'POST',
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
    },
  }, body);
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function getToken() {
  if (_token) return _token;
  const body = querystring.stringify({
    grant_type: 'refresh_token',
    client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
    refresh_token: process.env.ZOHO_REFRESH_TOKEN,
  });
  const res = await httpsRequest({
    hostname: 'accounts.zoho.com',
    path: '/oauth/v2/token',
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
  }, body);
  if (!res.body.access_token) throw new Error(`Token failed: ${JSON.stringify(res.body)}`);
  _token = res.body.access_token;
  return _token;
}

// ─── Task lookup ──────────────────────────────────────────────────────────────

let _taskCache = null;

async function getAllTasks() {
  if (_taskCache) return _taskCache;
  const token = await getToken();
  const tasks = [];
  // Fetch from all three project task lists
  const tlIds = [
    '1776658000006206015', // Week 1
    '1776658000006207022', // Week 2
    '1776658000006207024', // Standing Items
  ];
  for (const tlId of tlIds) {
    const res = await zohoGet(token, `/restapi/portal/${PORTAL_ID}/projects/${PROJECT_ID}/tasklists/${tlId}/tasks/`);
    if (res.body.tasks) tasks.push(...res.body.tasks);
  }
  _taskCache = tasks;
  return tasks;
}

/**
 * Find a task by partial name match (case-insensitive).
 * Returns the first match.
 */
async function findTask(nameFragment) {
  const tasks = await getAllTasks();
  const lower = nameFragment.toLowerCase();
  return tasks.find((t) => t.name.toLowerCase().includes(lower)) || null;
}

// ─── Status update ────────────────────────────────────────────────────────────

// This project uses a CUSTOM status workflow, not Zoho's generic four statuses.
// IDs confirmed live from actual task data on 2026-07-09 (there is no plain
// "Completed"/"Closed" status in use yet — "Tested and Deployed - Monitoring"
// is this project's done-state). If Zoho Projects reports an unrecognized
// status name back, re-derive IDs from a fresh task fetch rather than guessing.
const STATUS_MAP = {
  'open':        { name: 'Open',                            id: '1776658000000016068' },
  'inprogress':  { name: 'In Progress',                      id: '1776658000000031001' },
  'inreview':    { name: 'In Review',                        id: '1776658000000031003' },
  'completed':   { name: 'Tested and Deployed - Monitoring', id: '1776658000006156006' },
  'deployed':    { name: 'Tested and Deployed - Monitoring', id: '1776658000006156006' },
};

function resolveStatus(input) {
  const key = input.toLowerCase().replace(/[\s-_]/g, '');
  if (STATUS_MAP[key]) return STATUS_MAP[key];
  // Fuzzy fallback
  for (const [k, v] of Object.entries(STATUS_MAP)) {
    if (k.includes(key) || key.includes(k)) return v;
  }
  return null;
}

/**
 * Update a task's status.
 * @param {string} taskId   — Zoho task id_string
 * @param {string} status   — 'open' | 'inprogress' | 'inreview' | 'completed'
 */
async function updateTaskStatus(taskId, status) {
  const token = await getToken();
  const s = resolveStatus(status);
  if (!s) throw new Error(`Unknown status: ${status}. Use: open, inprogress, inreview, completed`);
  const res = await httpsRequest({
    hostname: 'projectsapi.zoho.com',
    path: `/restapi/portal/${PORTAL_ID}/projects/${PROJECT_ID}/tasks/${taskId}/`,
    method: 'POST',
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    // IMPORTANT: the param is `custom_status`, NOT `status_id`. Zoho silently
    // ignores an unrecognized param and 200s without changing anything — this
    // caused a status update to appear to succeed while doing nothing.
  }, querystring.stringify({ custom_status: s.id }));
  const updated = res.body && res.body.tasks && res.body.tasks[0];
  if (updated && updated.status && updated.status.name !== s.name) {
    throw new Error(`Status update did not take: expected "${s.name}", Zoho reports "${updated.status.name}". A workflow/blueprint rule may be blocking this transition.`);
  }
  return res.body;
}

// ─── Comments ─────────────────────────────────────────────────────────────────

/**
 * Add a comment to a task.
 * @param {string} taskId  — Zoho task id_string
 * @param {string} content — comment text
 */
async function addTaskComment(taskId, content) {
  const token = await getToken();
  const res = await zohoPost(token,
    `/restapi/portal/${PORTAL_ID}/projects/${PROJECT_ID}/tasks/${taskId}/comments/`,
    { content }
  );
  return res.body;
}

// ─── High-level: update by name ───────────────────────────────────────────────

/**
 * Find a task by name fragment, update its status, and add a comment.
 * This is the main entry point for Claude Code to call after completing work.
 *
 * @param {string} nameFragment  — partial task name to search for
 * @param {string} status        — new status
 * @param {string} comment       — what was done (will be posted as a task comment)
 */
async function updateTask(nameFragment, status, comment) {
  const task = await findTask(nameFragment);
  if (!task) {
    console.warn(`Task not found matching: "${nameFragment}"`);
    return { ok: false, error: 'not found' };
  }
  const [statusRes, commentRes] = await Promise.all([
    updateTaskStatus(task.id_string, status),
    comment ? addTaskComment(task.id_string, comment) : Promise.resolve(null),
  ]);
  const ok = !statusRes.error;
  console.log(`${ok ? '✓' : '✗'} "${task.name}" → ${status}${comment ? ' + comment' : ''}`);
  return { ok, task: task.name, taskId: task.id_string };
}

module.exports = { getToken, getAllTasks, findTask, updateTaskStatus, addTaskComment, updateTask, PORTAL_ID, PROJECT_ID };
