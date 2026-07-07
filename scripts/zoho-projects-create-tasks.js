#!/usr/bin/env node
/**
 * Ambassador Scaling Project — Zoho Projects task creator
 *
 * Usage:
 *   ZOHO_CLIENT_ID=... ZOHO_CLIENT_SECRET=... ZOHO_REFRESH_TOKEN=... \
 *   ZOHO_PORTAL_ID=... ZOHO_PROJECT_ID=... \
 *   node scripts/zoho-projects-create-tasks.js
 *
 * ZOHO_PORTAL_ID  — found in Zoho Projects URL: /portal/<PORTAL_ID>/projects/...
 * ZOHO_PROJECT_ID — found in Zoho Projects URL: .../projects/<PROJECT_ID>/...
 *
 * The script:
 *   1. Fetches a fresh Zoho access token
 *   2. Optionally auto-discovers the first portal + project if IDs not supplied
 *   3. Creates task lists (milestones) per week then creates every task under them
 *   4. Prints a summary of created / failed tasks
 *
 * Scope needed: ZohoProjects.tasks.CREATE ZohoProjects.portals.READ
 * (add these to the same OAuth client already used for CRM)
 */

'use strict';

const https = require('https');
const querystring = require('querystring');

// ─── helpers ──────────────────────────────────────────────────────────────────

function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function exchangeCodeForTokens(code) {
  const body = querystring.stringify({
    grant_type: 'authorization_code',
    client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
    redirect_uri: process.env.ZOHO_REDIRECT_URI || 'https://www.zoho.com/books',
    code,
  });
  const res = await httpsRequest({
    hostname: 'accounts.zoho.com',
    path: '/oauth/v2/token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
    },
  }, body);
  if (!res.body.access_token) {
    throw new Error(`Code exchange failed: ${JSON.stringify(res.body)}`);
  }
  console.log('\n─────────────────────────────────────────');
  console.log('SAVE THIS REFRESH TOKEN — add it to Catalyst env as ZOHO_REFRESH_TOKEN:');
  console.log(res.body.refresh_token);
  console.log('─────────────────────────────────────────\n');
  return res.body.access_token;
}

async function getAccessToken() {
  // If an auth code is provided, exchange it for tokens (one-time setup)
  if (process.env.ZOHO_AUTH_CODE) {
    return exchangeCodeForTokens(process.env.ZOHO_AUTH_CODE);
  }
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
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
    },
  }, body);
  if (!res.body.access_token) {
    throw new Error(`Token exchange failed: ${JSON.stringify(res.body)}`);
  }
  return res.body.access_token;
}

async function zohoGet(token, path) {
  const res = await httpsRequest({
    hostname: 'projectsapi.zoho.com',
    path,
    method: 'GET',
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  });
  return res;
}

async function zohoPost(token, path, formData) {
  const body = querystring.stringify(formData);
  const res = await httpsRequest({
    hostname: 'projectsapi.zoho.com',
    path,
    method: 'POST',
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
    },
  }, body);
  return res;
}

// ─── task data ────────────────────────────────────────────────────────────────

// Dates are 2026 values.  Format Zoho expects: MM-DD-YYYY
const TASKS = [
  // ── Week 1: Everything starts at once (Jul 7–11) ──
  {
    list: 'Week 1 — Build (Jul 7–11)',
    name: 'Open Wise Business account + fund initial balance + enable API',
    due: '07-07-2026',
    owner: 'Dr. Flippen',
    priority: 'High',
    notes: 'Blocking for international payments. Capture WISE_API_TOKEN and WISE_PROFILE_ID in Catalyst env.',
  },
  {
    list: 'Week 1 — Build (Jul 7–11)',
    name: 'Open Tremendous account + enable API',
    due: '07-07-2026',
    owner: 'Dr. Flippen',
    priority: 'High',
    notes: 'Blocking for international fallback. Capture TREMENDOUS_API_KEY and TREMENDOUS_FUNDING_SOURCE_ID.',
  },
  {
    list: 'Week 1 — Build (Jul 7–11)',
    name: 'Confirm PayPal Business Payouts API active',
    due: '07-07-2026',
    owner: 'Dr. Flippen',
    priority: 'High',
    notes: 'Capture PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in Catalyst env.',
  },
  {
    list: 'Week 1 — Build (Jul 7–11)',
    name: 'Content audit — identify gaps vs. three content needs',
    due: '07-07-2026',
    owner: 'Blaine',
    priority: 'High',
    notes: 'Run audit so Claude can start drafting missing lead magnets the same day.',
  },
  {
    list: 'Week 1 — Build (Jul 7–11)',
    name: 'Start CRM field build — Ambassadors module (+39 fields)',
    due: '07-07-2026',
    owner: 'Parmeet',
    priority: 'High',
    notes: 'Longest task; blocks almost every agent. Record every API name exactly as Zoho assigns it — never rename after developers reference it.',
  },
  {
    list: 'Week 1 — Build (Jul 7–11)',
    name: 'Start CRM field build — Prospects module (+20 fields)',
    due: '07-07-2026',
    owner: 'Parmeet',
    priority: 'High',
    notes: 'Record every API name as Zoho assigns it.',
  },
  {
    list: 'Week 1 — Build (Jul 7–11)',
    name: 'Start CRM field build — Support Tickets module (+12 fields)',
    due: '07-07-2026',
    owner: 'Parmeet',
    priority: 'High',
    notes: 'Include 9 SLA fields and Escalation_Timestamp. Cross-agent coordination point for Agents 4 & 5.',
  },
  {
    list: 'Week 1 — Build (Jul 7–11)',
    name: 'Claude Code: write and review Agent 5A (go/no-go validation gate)',
    due: '07-07-2026',
    owner: 'Claude Code',
    priority: 'High',
    notes: 'Must run before any other agent deploys. Validates all CRM module/field API names via Zoho metadata API.',
  },
  {
    list: 'Week 1 — Build (Jul 7–11)',
    name: 'Claude Code: write and review Agent 0 (Research & Intelligence)',
    due: '07-07-2026',
    owner: 'Claude Code',
    priority: 'High',
    notes: 'Feeds all other agents; VIP Prospect scoring.',
  },
  {
    list: 'Week 1 — Build (Jul 7–11)',
    name: 'Draft missing lead magnets (two likely-missing pieces for Agent 1D)',
    due: '07-08-2026',
    owner: 'Claude (content)',
    priority: 'High',
    notes: 'Must be complete before Agent 1D can activate.',
  },
  {
    list: 'Week 1 — Build (Jul 7–11)',
    name: 'Draft 4 Folder 08 brand asset files',
    due: '07-08-2026',
    owner: 'Claude (content)',
    priority: 'Medium',
    notes: 'WorkDrive Folder 08 — brand assets for ambassador engagement.',
  },
  {
    list: 'Week 1 — Build (Jul 7–11)',
    name: 'Reformat Agent 5 knowledge base',
    due: '07-09-2026',
    owner: 'Claude (content)',
    priority: 'Medium',
    notes: 'Knowledge base loaded into OpenAI assistant (OPENAI_AMBASSADOR_ASSISTANT_ID) by Parmeet in Week 2.',
  },
  {
    list: 'Week 1 — Build (Jul 7–11)',
    name: 'Create WorkDrive folders 06, 08, 09 — record folder IDs',
    due: '07-08-2026',
    owner: 'Parmeet',
    priority: 'High',
    notes: 'Capture WORKDRIVE_FOLDER_06_ID, WORKDRIVE_FOLDER_08_ID, WORKDRIVE_FOLDER_09_ID in Master Reference Sheet.',
  },
  {
    list: 'Week 1 — Build (Jul 7–11)',
    name: 'Begin building 8 Zoho Forms',
    due: '07-08-2026',
    owner: 'Parmeet',
    priority: 'High',
    notes: 'Forms reference CRM fields — build after CRM field build is underway. Record form IDs.',
  },
  {
    list: 'Week 1 — Build (Jul 7–11)',
    name: 'Claude Code: write and review Agents 1A–1D (Recruiting)',
    due: '07-10-2026',
    owner: 'Claude Code',
    priority: 'High',
    notes: 'Agent 1A: database email. 1B: social outreach. 1C: paid ads. 1D: lead capture.',
  },
  {
    list: 'Week 1 — Build (Jul 7–11)',
    name: 'Claude Code: write and review Agent 2 (Onboarding — most complex)',
    due: '07-10-2026',
    owner: 'Claude Code',
    priority: 'High',
    notes: 'Combined compliance form, win-back, Phase 2 auto-approve.',
  },
  {
    list: 'Week 1 — Build (Jul 7–11)',
    name: 'Confirm 5 sensitive policy environment variables',
    due: '07-09-2026',
    owner: 'Dr. Flippen',
    priority: 'High',
    notes: 'These gate Agent 1C ad spend, approval mode, payout limits, and compliance thresholds.',
  },
  {
    list: 'Week 1 — Build (Jul 7–11)',
    name: 'Configure 10 Zoho Flows',
    due: '07-11-2026',
    owner: 'Parmeet',
    priority: 'High',
    notes: 'Reference forms and CRM — build after both are in place.',
  },
  {
    list: 'Week 1 — Build (Jul 7–11)',
    name: 'Finish all 8 Zoho Forms',
    due: '07-11-2026',
    owner: 'Parmeet',
    priority: 'High',
    notes: 'Record all form IDs in Master Reference Sheet.',
  },
  {
    list: 'Week 1 — Build (Jul 7–11)',
    name: 'Claude Code: write and review Agent 3 (Engagement)',
    due: '07-11-2026',
    owner: 'Claude Code',
    priority: 'High',
    notes: 'Weekly cycle, story-by-role-category, dynamic VIP tiers. Confirm ROLE_CATEGORY header matches Agent 6.',
  },
  {
    list: 'Week 1 — Build (Jul 7–11)',
    name: 'Claude Code: write and review Agent 4 (Compliance Oversight)',
    due: '07-11-2026',
    owner: 'Claude Code',
    priority: 'High',
    notes: 'SLA tracking, VIP audit, reporting. Confirm 9 SLA field API names match Agent 5.',
  },
  {
    list: 'Week 1 — Build (Jul 7–11)',
    name: 'Claude Code: write and review Agent 5 (Ambassador Support)',
    due: '07-11-2026',
    owner: 'Claude Code',
    priority: 'High',
    notes: 'Portal chat, escalation webhook. Confirm Escalation_Timestamp identity matches Agent 4.',
  },
  {
    list: 'Week 1 — Build (Jul 7–11)',
    name: 'Claude Code: write and review Agent 6 (Story Content Intake)',
    due: '07-11-2026',
    owner: 'Claude Code',
    priority: 'High',
    notes: 'Feeds Agent 3. Confirm ROLE_CATEGORY header convention.',
  },
  {
    list: 'Week 1 — Build (Jul 7–11)',
    name: 'Write Make.com scenario specs',
    due: '07-11-2026',
    owner: 'Claude (content)',
    priority: 'Medium',
    notes: 'Specs used by Parmeet to build 17 Make.com scenarios in Week 2.',
  },
  {
    list: 'Week 1 — Build (Jul 7–11)',
    name: 'Write WordPress change specs',
    due: '07-11-2026',
    owner: 'Claude (content)',
    priority: 'Medium',
    notes: 'Conservative approach required — Parmeet must be present during WordPress changes.',
  },
  {
    list: 'Week 1 — Build (Jul 7–11)',
    name: 'Confirm 3 cross-agent coordination points',
    due: '07-11-2026',
    owner: 'Blaine + Parmeet',
    priority: 'High',
    notes: '(1) ROLE_CATEGORY header — Agents 3↔6. (2) 9 SLA field API names — Agents 4↔5. (3) Escalation_Timestamp identity — Agents 4↔5.',
  },
  // ── Week 1 gate ──
  {
    list: 'Week 1 — Build (Jul 7–11)',
    name: 'GATE: All content approved + all CRM/Forms/Flows built + all 11 functions written',
    due: '07-11-2026',
    owner: 'Blaine',
    priority: 'High',
    notes: 'End-of-week gate. Nothing moves to Week 2 until this is confirmed.',
  },

  // ── Week 2: Deploy, test, launch (Jul 14–18) ──
  {
    list: 'Week 2 — Deploy & Launch (Jul 14–18)',
    name: 'Build all Make.com scenarios (17 webhooks)',
    due: '07-14-2026',
    owner: 'Parmeet',
    priority: 'High',
    notes: 'Record all MAKE_*_WEBHOOK_URL values in Master Reference Sheet and Catalyst env.',
  },
  {
    list: 'Week 2 — Deploy & Launch (Jul 14–18)',
    name: 'Load Agent 5 knowledge base into OpenAI assistant',
    due: '07-14-2026',
    owner: 'Parmeet',
    priority: 'High',
    notes: 'Use OPENAI_AMBASSADOR_ASSISTANT_ID (not OPENAI_ASSISTANT_ID — canonical name per Master Reference Sheet).',
  },
  {
    list: 'Week 2 — Deploy & Launch (Jul 14–18)',
    name: 'WordPress portal changes — Parmeet present, review first',
    due: '07-15-2026',
    owner: 'Parmeet + Claude Code',
    priority: 'High',
    notes: 'Most conservative task in the build. Live student site — Parmeet must be present for every change.',
  },
  {
    list: 'Week 2 — Deploy & Launch (Jul 14–18)',
    name: 'Deploy all 11 Catalyst functions to production',
    due: '07-15-2026',
    owner: 'Parmeet',
    priority: 'High',
    notes: 'run: catalyst deploy. Configure Signals and Job Scheduling per CATALYST_SETUP.md after deploy.',
  },
  {
    list: 'Week 2 — Deploy & Launch (Jul 14–18)',
    name: 'Run Agent 5A — go/no-go validation gate',
    due: '07-16-2026',
    owner: 'Parmeet + Blaine',
    priority: 'High',
    notes: 'CRITICAL GATE. Must pass clean before any agent runs live. Validates all CRM field API names, encrypted field types, SLA fields, and coordination fields.',
  },
  {
    list: 'Week 2 — Deploy & Launch (Jul 14–18)',
    name: 'End-to-end test with a real form submission',
    due: '07-17-2026',
    owner: 'Parmeet + Blaine',
    priority: 'High',
    notes: 'Full pipeline test: form submit → agent trigger → CRM write → communication send.',
  },
  {
    list: 'Week 2 — Deploy & Launch (Jul 14–18)',
    name: 'Debug failures — paste error logs to Claude Code',
    due: '07-17-2026',
    owner: 'Claude Code',
    priority: 'High',
    notes: 'Paste Catalyst function logs into Claude Code session for diagnosis.',
  },
  {
    list: 'Week 2 — Deploy & Launch (Jul 14–18)',
    name: 'Activate first ambassador cohort (APPROVAL_MODE=MANUAL)',
    due: '07-18-2026',
    owner: 'Dr. Flippen + Parmeet',
    priority: 'High',
    notes: 'Start with APPROVAL_MODE=MANUAL for first cohort. Confirm engagement cycle fires correctly.',
  },
  {
    list: 'Week 2 — Deploy & Launch (Jul 14–18)',
    name: 'SYSTEM LIVE — Ambassador Scaling Program go-live',
    due: '07-18-2026',
    owner: 'Dr. Flippen + Blaine + Parmeet',
    priority: 'High',
    notes: 'Target go-live date. All 11 agents active, first cohort enrolled, engagement cycle running.',
  },

  // ── Standing / ongoing ──
  {
    list: 'Standing Items',
    name: 'Resolve env variable naming conflicts (5 canonical names)',
    due: '07-07-2026',
    owner: 'Blaine',
    priority: 'High',
    notes: 'Per Master Reference Sheet §1: ANTHROPIC_API_KEY (not CLAUDE_API_KEY), OPENAI_AMBASSADOR_ASSISTANT_ID (not OPENAI_ASSISTANT_ID), HEYGEN_FLIPPEN_AVATAR_ID (not HEYGEN_AVATAR_ID), META_ADS_ACCESS_TOKEN (not META_ACCESS_TOKEN), decide combined vs split ad spend threshold.',
  },
  {
    list: 'Standing Items',
    name: 'Record all confirmed values in Ambassador_Master_Reference_Sheet',
    due: '07-18-2026',
    owner: 'Parmeet',
    priority: 'Medium',
    notes: 'Every folder ID, form ID, webhook URL, and API name must be written into the Master Reference Sheet as it is created. Never rename anything after Claude Code has referenced it.',
  },
  {
    list: 'Standing Items',
    name: 'Wise / Tremendous verification — monitor external clock',
    due: '07-10-2026',
    owner: 'Dr. Flippen',
    priority: 'High',
    notes: '1–3 business day verification window. If not cleared by Jul 10, launch on PayPal only and add international routing as fast-follow.',
  },
];

// ─── main ──────────────────────────────────────────────────────────────────────

async function getPortalAndProject(token) {
  const portalId = process.env.ZOHO_PORTAL_ID;
  const projectId = process.env.ZOHO_PROJECT_ID;
  if (portalId && projectId) return { portalId, projectId };

  console.log('ZOHO_PORTAL_ID / ZOHO_PROJECT_ID not set — auto-discovering...');
  const portalsRes = await zohoGet(token, '/restapi/portals/');
  if (!portalsRes.body.portals || !portalsRes.body.portals.length) {
    throw new Error(`No portals found. Response: ${JSON.stringify(portalsRes.body)}`);
  }
  const portal = portalsRes.body.portals[0];
  const pid = portal.id_string;
  console.log(`Using portal: "${portal.name}" (${pid})`);

  const projectsRes = await zohoGet(token, `/restapi/portal/${pid}/projects/`);
  if (!projectsRes.body.projects || !projectsRes.body.projects.length) {
    throw new Error(`No projects found in portal ${pid}. Create the project in Zoho Projects first.`);
  }
  const project = projectsRes.body.projects[0];
  const projId = project.id_string;
  console.log(`Using project: "${project.name}" (${projId})`);
  console.log(`\nTip: set ZOHO_PORTAL_ID=${pid} ZOHO_PROJECT_ID=${projId} to skip auto-discovery next run.\n`);
  return { portalId: pid, projectId: projId };
}

async function getOrCreateTaskList(token, portalId, projectId, listName) {
  // Fetch existing task lists
  const res = await zohoGet(token, `/restapi/portal/${portalId}/projects/${projectId}/tasklists/`);
  const lists = (res.body.tasklists || []);
  const existing = lists.find((l) => l.name === listName);
  if (existing) return existing.id_string;

  // Create it
  const createRes = await zohoPost(token, `/restapi/portal/${portalId}/projects/${projectId}/tasklists/`, {
    name: listName,
  });
  const created = createRes.body.tasklists && createRes.body.tasklists[0];
  if (!created) throw new Error(`Failed to create task list "${listName}": ${JSON.stringify(createRes.body)}`);
  console.log(`  Created task list: ${listName}`);
  return created.id_string;
}

async function createTask(token, portalId, projectId, tasklistId, task) {
  const formData = {
    name: task.name,
    end_date: task.due,
    priority: task.priority || 'Medium',
    tasklist_id: tasklistId,
  };
  if (task.notes) formData.notes = task.notes;

  const res = await zohoPost(
    token,
    `/restapi/portal/${portalId}/projects/${projectId}/tasks/`,
    formData
  );
  const created = res.body.tasks && res.body.tasks[0];
  if (!created) {
    return { ok: false, name: task.name, error: JSON.stringify(res.body) };
  }
  return { ok: true, name: task.name, id: created.id_string };
}

async function main() {
  const required = ['ZOHO_CLIENT_ID', 'ZOHO_CLIENT_SECRET'];
  if (!process.env.ZOHO_AUTH_CODE && !process.env.ZOHO_REFRESH_TOKEN) {
    required.push('ZOHO_REFRESH_TOKEN');
  }
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`Missing required env vars: ${missing.join(', ')}`);
    process.exit(1);
  }

  console.log('Getting Zoho access token...');
  const token = await getAccessToken();

  const { portalId, projectId } = await getPortalAndProject(token);

  // Group tasks by list name
  const byList = {};
  for (const t of TASKS) {
    (byList[t.list] = byList[t.list] || []).push(t);
  }

  const results = { created: [], failed: [] };

  for (const [listName, tasks] of Object.entries(byList)) {
    console.log(`\nTask list: "${listName}"`);
    const tasklistId = await getOrCreateTaskList(token, portalId, projectId, listName);

    for (const task of tasks) {
      const result = await createTask(token, portalId, projectId, tasklistId, task);
      if (result.ok) {
        console.log(`  ✓ ${task.name}`);
        results.created.push(task.name);
      } else {
        console.log(`  ✗ ${task.name} — ${result.error}`);
        results.failed.push({ name: task.name, error: result.error });
      }
      // Brief pause to avoid rate limiting
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  console.log('\n─────────────────────────────────────────');
  console.log(`Created: ${results.created.length} tasks`);
  if (results.failed.length) {
    console.log(`Failed:  ${results.failed.length} tasks`);
    for (const f of results.failed) console.log(`  - ${f.name}: ${f.error}`);
  } else {
    console.log('All tasks created successfully.');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
