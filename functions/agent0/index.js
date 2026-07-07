'use strict';

/**
 * Agent 0 — Research & Intelligence (Catalyst Advanced I/O).
 *
 * The intelligence layer that scores prospects, runs the VIP Prospect Pipeline,
 * generates briefings, and reports gaps. No recruiting agent messages a prospect
 * without Agent 0 data behind it.
 *
 * Routes:
 *   POST /run            → weekly run (default) or ON_DEMAND when body.mode set.
 *                          Weekly body: { rawProspects: [...] }
 *                          On-demand body: { mode: "ON_DEMAND", prospectUrl, prospect? }
 *   POST /on-demand      → convenience alias for a single { prospectUrl } run.
 *   GET  /health         → liveness.
 *
 * Trigger wiring:
 *   - Catalyst Job Schedule (Sunday 11:00 PM CST) POSTs /run for the weekly cycle.
 *   - Make.com Scenario 4 POSTs /on-demand with a single profile URL.
 */

const express = require('express');
const { runCycle } = require('./pipeline');

const app = express();
app.use(express.json({ limit: '2mb' }));

app.post('/run', async (req, res) => {
  try {
    const body = req.body || {};
    const summary = await runCycle({
      mode: body.mode,
      rawProspects: body.rawProspects,
      prospectUrl: body.prospectUrl,
      prospect: body.prospect,
    });
    res.json({ success: !summary.halted, ...summary });
  } catch (err) {
    console.error('[Agent0]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/on-demand', async (req, res) => {
  try {
    const body = req.body || {};
    const summary = await runCycle({
      mode: 'ON_DEMAND',
      prospectUrl: body.prospectUrl,
      prospect: body.prospect,
    });
    res.json({ success: !summary.halted, ...summary });
  } catch (err) {
    console.error('[Agent0]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/health', (req, res) => res.json({ ok: true, agent: '0', role: 'research-intelligence' }));

module.exports = app;
