'use strict';

/**
 * Agent 3 — Engagement (Catalyst Advanced I/O).
 *
 * The heartbeat of the ambassador program: the 30-Day Activation Sprint,
 * weekly engagement cycle (Standard + Alternative tracks), daily dormant
 * detection, daily milestone detection, real-time referral notifications,
 * and the monthly non-referral check + dynamic VIP tier system.
 *
 * Routes:
 *   POST /activate                 → Agent 2 activation webhook (real-time)
 *   POST /sprint-advance            → Monday 8:00 AM CST scheduled job
 *   POST /weekly-cycle              → Monday 9:00 AM CST scheduled job
 *   POST /milestones                → Daily 7:00 AM CST scheduled job
 *   POST /referral-stage-change     → Zoho Flow webhook (real-time)
 *   POST /dormant-detect            → Daily 7:30 AM CST scheduled job
 *   POST /monthly-non-referral      → First Monday 6:00 AM CST scheduled job
 *   POST /monthly-vip-recalc        → First Monday 6:30 AM CST scheduled job
 *   POST /monthly-vip-supplemental  → First Monday 7:00 AM CST scheduled job
 *   GET  /health                    → liveness
 */

const express = require('express');
const { initializeAmbassador, sprintAdvancementJob } = require('./sprint');
const { weeklyEngagementCycle } = require('./weekly');
const { dormantDetectionJob } = require('./dormant');
const { referralStageChangeWebhook, milestoneDetectionJob } = require('./milestones');
const { monthlyNonReferralCheck, monthlyVipRecalculation, monthlyVipSupplemental } = require('./monthly');

const app = express();
app.use(express.json({ limit: '2mb' }));

function handle(fn) {
  return async (req, res) => {
    try {
      const summary = await fn(req.body || {});
      res.json({ success: !summary.halted, ...summary });
    } catch (err) {
      console.error('[Agent3]', err);
      res.status(500).json({ success: false, error: err.message });
    }
  };
}

app.post('/activate', handle(initializeAmbassador));
app.post('/sprint-advance', handle(sprintAdvancementJob));
app.post('/weekly-cycle', handle(weeklyEngagementCycle));
app.post('/milestones', handle(milestoneDetectionJob));
app.post('/referral-stage-change', handle(referralStageChangeWebhook));
app.post('/dormant-detect', handle(dormantDetectionJob));
app.post('/monthly-non-referral', handle(monthlyNonReferralCheck));
app.post('/monthly-vip-recalc', handle(monthlyVipRecalculation));
app.post('/monthly-vip-supplemental', handle(monthlyVipSupplemental));

app.get('/health', (req, res) => res.json({ ok: true, agent: '3', role: 'engagement' }));

module.exports = app;
