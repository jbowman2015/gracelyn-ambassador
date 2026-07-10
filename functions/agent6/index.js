'use strict';

/**
 * Agent 6 — Story Content Intake (Catalyst Advanced I/O).
 *
 * Agent 6's story pipeline (Zoho Forms -> Zoho Flow -> WorkDrive Folder 05)
 * is a native Zoho Flow (design §5) — Catalyst does not run it. The one
 * Catalyst function is the daily buffer-monitoring job (design §6).
 * `filename.js`, `storyFile.js`, and `intake.js` are the tested JS spec the
 * Flow's Deluge script must match; they are not routed here for that reason.
 *
 * Routes:
 *   POST /buffer-check  → Daily 5:30 AM CST scheduled job
 *   GET  /health         → liveness
 */

const express = require('express');
const { runBufferCheck } = require('./job');

const app = express();
app.use(express.json({ limit: '1mb' }));

app.post('/buffer-check', async (req, res) => {
  try {
    const summary = await runBufferCheck({});
    res.json({ success: !summary.halted, ...summary });
  } catch (err) {
    console.error('[Agent6]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/health', (req, res) => res.json({ ok: true, agent: '6', role: 'story-content-intake' }));

module.exports = app;
