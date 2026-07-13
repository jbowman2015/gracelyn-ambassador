'use strict';

/**
 * Agent 1B — Social Outreach Agent (Recruiting) for the Ambassador Scaling
 * Program. Posts prescribed recruiting content on a weekly schedule,
 * monitors educator/mission-aligned communities for prospecting signals, and
 * supports the VIP Prospect Pipeline with warm-follow engagement alerts. See
 * docs/design/Gracelyn_Agent_1B_Social_Outreach_v2.md for the full spec.
 *
 * Routes:
 *   POST /run     → { trigger_type: 'post_cycle' | 'intelligence_cycle', ... }
 *   GET  /health  → liveness
 *
 * This file is a thin Express wrapper — all orchestration logic lives in
 * orchestrate.js, which has no Express dependency so __tests__ can require it
 * directly with no network, no deps, no secrets.
 */

const express = require('express');
const { runAgent1B, DEFAULT_DEPS } = require('./orchestrate');

const app = express();
app.use(express.json());

app.post('/run', async (req, res) => {
  try {
    const result = await runAgent1B(req.body, DEFAULT_DEPS, new Date());
    res.status(result.statusCode).json(result.body);
  } catch (err) {
    console.error('[Agent1B]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/health', (req, res) => res.json({ ok: true, agent: '1B', role: 'social-outreach-recruiting' }));

module.exports = app;
