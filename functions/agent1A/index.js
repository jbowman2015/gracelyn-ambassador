'use strict';

/**
 * Agent 1A — Database and Email Agent (Recruiting) for the Ambassador
 * Scaling Program. Sends personalized outbound email sequences to Agent 0
 * prospects, the paraprofessional database, and current students/alumni.
 * See docs/design/Gracelyn_Agent_1A_Database_Email_v1.md for the full spec.
 *
 * Routes:
 *   POST /run     → handles all four trigger_type run modes (design doc §4)
 *   GET  /health  → liveness
 *
 * This file is a thin Express wrapper — all orchestration logic lives in
 * orchestrate.js, which has no Express dependency so __tests__ can require it
 * directly with no network, no deps, no secrets.
 */

const express = require('express');
const { runAgent1A, DEFAULT_DEPS } = require('./orchestrate');

const app = express();
app.use(express.json());

app.post('/run', async (req, res) => {
  try {
    const result = await runAgent1A(req.body, DEFAULT_DEPS, new Date());
    res.status(result.statusCode).json(result.body);
  } catch (err) {
    console.error('[Agent1A]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/health', (req, res) => res.json({ ok: true, agent: '1A', role: 'database-and-email-recruiting' }));

module.exports = app;
