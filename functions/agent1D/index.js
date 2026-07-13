'use strict';

/**
 * Agent 1D — Lead Capture (Catalyst Advanced I/O).
 *
 * Routes:
 *   POST /webhook  → Make.com Scenario 1 real-time form submission trigger.
 *                    Body: { first_name, email, role_category, state,
 *                            lead_magnet_id, utm_source, utm_campaign }
 *   POST /cleanup  → Catalyst Job Schedule, nightly 2:00 AM CST
 *                    (Make.com Scenario 3 equivalent).
 *   GET  /health   → liveness.
 *
 * See docs/design/Gracelyn_Agent_1D_Lead_Capture_v2.md for the full spec.
 */

const express = require('express');
const { processSubmission } = require('./pipeline');
const { runNightlyCleanup } = require('./cleanup');

const app = express();
app.use(express.json());

app.post('/webhook', async (req, res) => {
  try {
    const result = await processSubmission(req.body || {});
    res.status(result.success ? 200 : (result.halted ? 422 : 500)).json(result);
  } catch (err) {
    console.error('[Agent1D]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/cleanup', async (req, res) => {
  try {
    const summary = await runNightlyCleanup();
    res.json({ success: !summary.halted, ...summary });
  } catch (err) {
    console.error('[Agent1D]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/health', (req, res) => res.json({ ok: true, agent: '1D', role: 'lead-capture' }));

module.exports = app;
