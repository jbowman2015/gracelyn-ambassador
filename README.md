# Gracelyn University — Ambassador Scaling Program

Automated AI agent system to scale the Gracelyn University Ambassador Program toward
100,000 ambassadors. Eleven Zoho Catalyst functions handle recruiting, onboarding,
engagement, compliance, support, and payouts. Target go-live: **July 18, 2026**.

> Separate from the Gracelyn Student Success Coach project. This repo is Ambassador-only.

## Layout

| Path | What |
|---|---|
| `functions/` | Catalyst Advanced I/O agent functions (deployed per `catalyst.json`) |
| `functions/agent5A/` | **Agent 5A** — go/no-go setup validation gate (built) |
| `functions/cliqSummaryFunction/` | Daily Zoho Projects → Cliq status summary (built) |
| `scripts/` | Zoho Projects task automation + Cliq daily-summary helpers |
| `docs/design/` | Locked per-agent design documents (the spec for each agent) |
| `docs/planning/` | Project plan, infrastructure runbook, master reference sheet, Zoho API-names rule |
| `docs/brand/` | Voice/copy/motivation/program-description brand assets |

## The 11 agents

`5A` Setup Validation · `0` Research & Intelligence · `1A` Database Email ·
`1B` Social Outreach · `1C` Paid Ads · `1D` Lead Capture · `2` Onboarding ·
`3` Engagement · `4` Compliance Oversight · `5` Support · `6` Story Intake

Build order and dependencies are in `docs/planning/Ambassador_Scaling_Project_Plan.md`.

## Getting started

1. Set environment variables in the Catalyst Console (see `.env.example`; canonical
   names are validated by `functions/agent5A/manifest.js`).
2. Deploy: `catalyst deploy` (targets are listed in `catalyst.json`).
3. Run **Agent 5A** — it reports exactly which credential, field, or policy value is
   still missing. Nothing else deploys to production until 5A returns `GO`.

See `CLAUDE.md` for conventions, the AI strategy, and the three coordination points.

## Security

Secrets live only in Catalyst environment variables — never in the repo. Ambassador
and prospect PII must never be committed. See `.gitignore`.
