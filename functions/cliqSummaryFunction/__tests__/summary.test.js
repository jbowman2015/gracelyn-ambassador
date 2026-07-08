'use strict';

/**
 * Local test for the Cliq daily-summary builder.
 * Runs with no network, no deps, no secrets:  node __tests__/summary.test.js
 */

const assert = require('assert');
const { stageOf, buildSummary } = require('../summary');

let passed = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); passed++; };

// Fixed "now": 2026-07-08 12:00 CT (17:00 UTC). Tomorrow (CT) = 2026-07-09.
const NOW = Date.UTC(2026, 6, 8, 17, 0, 0);
const DAY = 24 * 60 * 60 * 1000;

// ── stageOf classification ────────────────────────────────────────────────────
ok(stageOf({ status: { name: 'Complete', type: 'closed' } }) === 'completed', 'Complete → completed');
ok(stageOf({ status: { name: 'Closed', type: 'closed' } })   === 'completed', 'Closed → completed');
ok(stageOf({ completed: true, status: { name: 'Open', type: 'open' } }) === 'completed', 'completed flag → completed');
ok(stageOf({ status: { name: 'Tested and Deployed - Monitoring', type: 'open' } }) === 'monitoring', 'deployed → monitoring');
ok(stageOf({ status: { name: 'In Review', type: 'open' } })    === 'inreview',   'In Review → inreview');
ok(stageOf({ status: { name: 'To be Tested', type: 'open' } }) === 'tobetested', 'To be Tested → tobetested');
ok(stageOf({ status: { name: 'In Progress', type: 'open' } })  === 'inprogress', 'In Progress → inprogress');
ok(stageOf({ status: { name: 'Waiting for Response - External', type: 'open' } }) === 'waitingext', 'waiting external');
ok(stageOf({ status: { name: 'Waiting for Response - Internal', type: 'open' } }) === 'waitingint', 'waiting internal');
ok(stageOf({ status: { name: 'On Hold', type: 'open' } })  === 'onhold',  'On Hold → onhold');
ok(stageOf({ status: { name: 'Delayed', type: 'open' } })  === 'delayed', 'Delayed → delayed');
ok(stageOf({ status: { name: 'Open', type: 'open' } })     === 'open',    'Open → open');
ok(stageOf({ status: { name: 'Cancelled', type: 'closed' } }) === 'cancelled', 'Cancelled → cancelled');
ok(stageOf({ status: { name: 'Something New', type: 'open' } }) === 'other', 'unknown → other');
// "To be Tested" must not be mistaken for the deployed/monitoring state.
ok(stageOf({ status: { name: 'Tested and Deployed - Monitoring', type: 'open' } }) !== 'tobetested', 'deployed ≠ to-test');

// ── buildSummary end-to-end ───────────────────────────────────────────────────
const tasks = [
  { name: 'Agent 5A gate',        status: { name: 'Complete', type: 'closed' }, last_updated_time_long: NOW, end_date: '07-05-2026' },
  { name: 'CRM Prospects fields',  status: { name: 'Tested and Deployed - Monitoring', type: 'open' } },
  { name: 'CRM Ambassadors fields', status: { name: 'Tested and Deployed - Monitoring', type: 'open' } },
  { name: 'Agent 0 review',        status: { name: 'In Review', type: 'open' } },
  { name: 'Agent 1A build',        status: { name: 'In Progress', type: 'open' }, end_date: '07-09-2026', end_date_long: NOW + DAY },
  { name: 'Agent 2 spec',          status: { name: 'Open', type: 'open' } },
  { name: 'Support module setup',  status: { name: 'On Hold', type: 'open' } },
  { name: 'Overdue thing',         status: { name: 'In Progress', type: 'open' }, end_date: '07-01-2026', end_date_long: NOW - 3 * DAY },
];

const msg = buildSummary(tasks, NOW);

// Richer lifecycle sections are present (the whole point of the change).
ok(msg.includes('Tested & Deployed — Monitoring'), 'shows the deployed/monitoring stage');
ok(msg.includes('In Review'),   'shows In Review stage');
ok(msg.includes('On Hold'),     'shows On Hold stage');
ok(msg.includes('Not Started'), 'shows Not Started stage');
ok(msg.includes('Where Everything Stands'), 'has the full-pipeline section');

// Delivered = complete (1) + monitoring (2) = 3 of 8 shipped.
ok(msg.includes('(3/8 shipped)'), 'delivered counts complete + monitoring');

// Overdue is surfaced as a priority callout with its live status.
ok(msg.includes('Needs Attention — Overdue (1)'), 'overdue callout present');
ok(msg.includes('Overdue thing'), 'overdue task listed');

// Footer breaks work down by real status, not just done/not-done.
ok(msg.includes('🚀 2 deployed'), 'footer counts deployed');
ok(msg.includes('🔎 1 in review'), 'footer counts in review');
ok(msg.includes('🔴 1 overdue'), 'footer counts overdue');

// Completed-today reflects the closed task updated "today".
ok(msg.includes('Completed Today (1)'), 'completed-today count');

// Tomorrow's next step picks up the task due 07-09.
ok(msg.includes('Agent 1A build'), 'tomorrow next-step surfaced');

console.log(`\n✅ Cliq summary: ${passed} checks passed\n`);
