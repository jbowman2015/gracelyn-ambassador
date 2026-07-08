'use strict';

/**
 * Agent 1C — Paid Advertising (Catalyst Advanced I/O).
 *
 * Manages Meta and Google ambassador recruiting ad campaigns: daily spend
 * compilation, the 10:00 AM CST kill switch (pauses everything if the
 * coordinator has not confirmed spend), coordinator confirmation, campaign
 * restart, and weekly performance/audience review.
 *
 * Routes:
 *   POST /compileDailySpend     → Catalyst scheduled job, 7:50 AM CST daily.
 *   POST /checkSpendConfirmation→ Catalyst scheduled job, 10:00 AM CST daily. THE KILL SWITCH.
 *   POST /recordConfirmation    → Make.com Scenario 2 (coordinator clicks Confirm).
 *   POST /resumeCampaigns       → Make.com Scenario 3 (coordinator clicks Restart Campaigns).
 *   POST /weeklyPerformanceReview → Catalyst scheduled job, Monday 6:00 AM CST.
 *   POST /weeklyAudienceRefresh → Make.com Scenario 4 (Agent 0 weekly-complete trigger).
 *   GET  /health                → liveness.
 */

const express = require('express');
const pipeline = require('./pipeline');

const app = express();
app.use(express.json({ limit: '2mb' }));

function handle(fn) {
  return async (req, res) => {
    try {
      const result = await fn(req.body || {});
      res.json({ success: !(result && result.halted), ...result });
    } catch (err) {
      console.error('[Agent1C]', err);
      res.status(500).json({ success: false, error: err.message });
    }
  };
}

app.post('/compileDailySpend', handle(() => pipeline.compileDailySpend({})));
app.post('/checkSpendConfirmation', handle(() => pipeline.checkSpendConfirmation({})));
app.post('/recordConfirmation', handle((body) => pipeline.recordConfirmation(body)));
app.post('/resumeCampaigns', handle((body) => pipeline.resumeCampaigns(body)));
app.post('/weeklyPerformanceReview', handle(() => pipeline.weeklyPerformanceReview({})));
app.post('/weeklyAudienceRefresh', handle((body) => pipeline.weeklyAudienceRefresh(body)));

app.get('/health', (req, res) => res.json({ ok: true, agent: '1C', role: 'paid-advertising' }));

module.exports = app;
