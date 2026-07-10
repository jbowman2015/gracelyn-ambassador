'use strict';

/**
 * Agent 4 — Compliance Oversight (Catalyst Advanced I/O).
 *
 * Fraud monitoring, eligibility queue, support SLA tracking, VIP recalculation
 * oversight, daily checkpoint, and weekly reports (design §2.1).
 *
 * Routes (Catalyst Job Scheduling / Make.com wiring per design §2.3, §7):
 *   POST /fraud-check         Daily 6:00 AM CST.
 *   POST /eligibility-check   Daily 6:15 AM CST.
 *   POST /sla-monitor         Daily 6:30 AM CST.
 *   POST /checkpoint          Daily 7:00 AM CST.
 *   POST /weekly-report       Monday 6:00/6:15 AM CST (combined per §7 Scenario 2).
 *   POST /vip-audit           Make.com Scenario 3 — fired after Agent 3's quarterly
 *                             VIP recalculation completion webhook (HARD STOP #3).
 *   POST /content-compliance  Weekly Tuesday 8:00 AM CST.
 *   GET  /health              Liveness.
 */

const express = require('express');
const { fraudFlagCheck } = require('./fraud');
const { eligibilityQueueCheck } = require('./eligibility');
const { slaMonitoringJob } = require('./sla');
const { dailyCheckpoint } = require('./checkpoint');
const { weeklyReport } = require('./weeklyReport');
const { runVipRecalculationAudit } = require('./vipAudit');
const { contentComplianceAudit } = require('./contentCompliance');

const app = express();
app.use(express.json({ limit: '2mb' }));

function handle(fn) {
  return async (req, res) => {
    try {
      const result = await fn(req.body || {});
      res.json({ success: !result.halted, ...result });
    } catch (err) {
      console.error('[Agent4]', err);
      res.status(500).json({ success: false, error: err.message });
    }
  };
}

app.post('/fraud-check', handle(fraudFlagCheck));
app.post('/eligibility-check', handle(eligibilityQueueCheck));
app.post('/sla-monitor', handle(slaMonitoringJob));
app.post('/checkpoint', handle(dailyCheckpoint));
app.post('/weekly-report', handle(weeklyReport));
app.post('/vip-audit', async (req, res) => {
  try {
    const body = req.body || {};
    const result = await runVipRecalculationAudit(body, {});
    res.json({ success: !result.halted && result.passed !== false, ...result });
  } catch (err) {
    console.error('[Agent4]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});
app.post('/content-compliance', handle(contentComplianceAudit));

app.get('/health', (req, res) => res.json({ ok: true, agent: '4', role: 'compliance-oversight' }));

module.exports = app;
