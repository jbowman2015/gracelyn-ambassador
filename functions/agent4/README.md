# Agent 4 — Compliance Oversight

The compliance and oversight layer that runs across the entire ambassador
program: fraud monitoring, eligibility queue, support SLA tracking, VIP
recalculation audit, and daily/weekly reporting. Built against
`docs/design/Gracelyn_Agent_4_Compliance_Oversight_v2.md` (v2.0). Reads what
the blueprint and other agents already built — it does not rebuild fraud
detection, eligibility calculation, or VIP scoring (design §2.1).

## Daily jobs (design §2.3)

| Job (file) | Time (CST) | What it does |
| --- | --- | --- |
| `fraud.js` | 6:00 AM | Surfaces every `Fraud_Flag = true` Ambassador to the coordinator. |
| `eligibility.js` | 6:15 AM | Surfaces Referrals at `Referral_Stage = Eligible` for payment confirmation. |
| `sla.js` | 6:30 AM | Evaluates open Support Tickets against first-response/resolution SLA thresholds; writes `SLA_Breached`/`Resolution_SLA_Breached`; alerts coordinator (+ Parmeet for Tier 3/VIP Priority). |
| `checkpoint.js` | 7:00 AM | Compiles fraud, eligibility, SLA, auto-approve exceptions, and dormant escalations into one coordinator email + best-effort Analytics write. |

## Weekly / triggered jobs

| Job (file) | Cadence | What it does |
| --- | --- | --- |
| `weeklyReport.js` | Monday 6:00/6:15 AM | Six sections: Referral Fee Summary, SLA Performance, Ambassador Health, VIP Program Status, System Health, Content Compliance. |
| `vipAudit.js` | Make.com Scenario 3 (post Agent 3 recalculation) | Runs all six audit checks from design §5.1. |
| `contentCompliance.js` | Tuesday 8:00 AM | Scans sampled ambassador-facing email content for em dashes and commission language. |

## No live data source yet — degrades honestly, never fabricates

Several design-doc data sources don't exist in the live org yet. Rather than
silently reporting zeros, each of these surfaces the gap explicitly:

- **Ad Campaign Log** (ad spend alert): Agent 1C is unbuilt. Checkpoint reports "not yet available."
- **System health** (agent error counts, token usage): not instrumented anywhere in this program yet.
- **Kill switch events**: no CRM field/module tracks this. Section always exists (empty by default); would render first per design's protocol if ever populated.
- **Content compliance samples**: Agent 3 sends via Zoho Mail without persisting generated body text anywhere queryable — no "Activity Log" module exists. `contentComplianceAudit` requires `samples` to be passed explicitly (e.g. from a future Make.com scenario reading Zoho Mail's sent items); without it, the run halts and alerts rather than reporting a false "zero violations."
- **VIP audit checks #4/#5/#6**: partially depend on Agent 3's own run summary (`scoredCount`, `upgradedCount`, `welcomeMessagesSent`, `outreachTasksCreated`) passed in the `/vip-audit` payload — see `vipAudit.js` header for exactly what's independently re-queried from CRM vs. taken on trust from the payload.
- **Zoho Analytics dashboard** (HARD STOP #2): not confirmed accessible this session. `analytics.js` no-ops when unconfigured; the checkpoint/weekly report still send in full by email regardless (this is the same fallback the design doc's own §8 failure table specifies).

## CRM module created this session

The `Support_Tickets` custom module (HARD STOP #1) did not exist in the live
org — only `Cases`/`Solutions` did. This session created it plus its 12
fields; every generated `api_name` matches `functions/agent5A/manifest.js`'s
already-reconciled `SLA_COORDINATION_FIELDS` exactly (Coordination #2), and
`Escalation_Timestamp` satisfies Coordination #3 by construction. Full field
table + the three real design-doc/live-field divergences (`Fraud_Flag`,
`Escalated_To_Human` on Ambassadors not a separate Activity Log, and
`Commission_Status` for the fee-status concept) are in `DEPLOY.md` and the
`manifest.js` header.

## Testing

```
cd functions/agent4 && npm install && npm test
```

`__tests__/agent4.test.js` runs with no network/deps/secrets (does not import
`index.js`, which needs `express`) — 30 cases covering SLA breach evaluation
(Tier 2 vs Tier 3/VIP thresholds, no-breach, the already-breached guard), the
weekly SLA summary, all six VIP audit checks (pass, anomaly, the "zero is
expected" outreach caveat, the reinterpreted single-select consistency
check), content compliance scanning, fraud/eligibility item building, weekly
report section math, and CRM context divergence surfacing.

## Running & deploying

```
cd functions/agent4 && npm install && catalyst functions:serve   # local
catalyst deploy                                                   # deploy targets in catalyst.json
```

See `DEPLOY.md` for the full environment variable list and the fill-in →
deploy → verify → scrub sequence (per `CLAUDE.md`'s deploy guardrail).
