# CLAUDE.md — Gracelyn University Ambassador Scaling Program

## What this project is
An automated AI agent system to scale the Gracelyn University Ambassador Program
toward 100,000 ambassadors. **11 Catalyst functions** ("agents") handle the full
ambassador lifecycle — recruiting, onboarding, engagement, compliance, support,
and payouts — with minimal manual staff intervention. Target go-live: **July 18, 2026**.

> This repo is **only** the Ambassador Scaling Program. It is entirely separate
> from the Gracelyn Student Success Coach project (a different repo). Nothing from
> that project belongs here, and nothing here deploys to its Catalyst project.

## Platform
**Zoho Catalyst** — agents deployed as Catalyst Advanced I/O (Node.js + Express).
- Runtime: Node.js 18 (Catalyst `advancedio`)
- Zoho CRM API **v6** for metadata (`/crm/v6/settings/...`); v8 data APIs where noted
- Scheduling: Catalyst **Job Scheduling** (cron; all times CST)
- Catalyst project: **Ambassador-Scaling-Project** (see `.catalystrc`)

## The 11 agents (build order)
1. **Agent 5A** — Setup Validation (go/no-go gate; runs first, blocks deploy) ✅ built
2. **Agent 0** — Research & Intelligence (VIP prospect scoring; feeds all others)
3. **Agents 1A–1D** — Recruiting: database email, social outreach, paid ads, lead capture
4. **Agent 2** — Onboarding (compliance form, win-back, Phase 2 auto-approve — most complex)
5. **Agent 3** — Engagement (weekly touchpoints, story-by-role-category, dynamic VIP tiers)
6. **Agent 4** — Compliance Oversight (SLA tracking, VIP audit, reporting)
7. **Agent 5** — Ambassador Support (portal chat, escalation webhook)
8. **Agent 6** — Story Content Intake (feeds Agent 3)

Each agent is built against its design doc in `docs/design/` and reviewed before deploy.

## AI strategy (differs from the Student Success project)
This system **does** use external AI: **Anthropic Claude** across agents and
**OpenAI** for the Ambassador Support portal assistant (Agent 5). Model for Claude
calls: `claude-sonnet-4-20250514` unless a design doc says otherwise.

## Source of truth for CRM names
**Zoho CRM is authoritative for every module and field API name.** Never hardcode a
field/module API name from a document — pull it live from Zoho metadata and reconcile.
Agent 5A does this and fails loudly on any divergence. See
`docs/planning/ClaudeCode_Zoho_API_Names_Instruction.md`.

## Environment variables
Canonical names are defined and validated in `functions/agent5A/manifest.js` — that
file is the reconciled source of truth. `.env.example` is generated from it. Resolved
naming conflicts: `ANTHROPIC_API_KEY` (not `CLAUDE_API_KEY`),
`OPENAI_AMBASSADOR_ASSISTANT_ID` (not `OPENAI_ASSISTANT_ID`),
`HEYGEN_FLIPPEN_AVATAR_ID` (not `HEYGEN_AVATAR_ID`),
`META_ADS_ACCESS_TOKEN` (not `META_ACCESS_TOKEN`), and **split** ad-spend thresholds
`META_DAILY_SPEND_THRESHOLD` + `GOOGLE_DAILY_SPEND_THRESHOLD`.

## Three silent-failure coordination points (confirm before writing CRM logic)
1. `ROLE_CATEGORY` header — identical label between Agent 3 and Agent 6, second line of every story file.
2. Nine Support Tickets SLA field API names — identical between Agent 4 and Agent 5.
3. `escalation_timestamp` webhook string == `Escalation_Timestamp` CRM value, exactly.

## Conventions
- Every Catalyst function is Advanced I/O: `index.js` exports an Express `app`,
  with a `catalyst-config.json` (`type: advancedio`, `stack: node18`) + `package.json`.
- Add each new function to `catalyst.json` `targets` (source folder: `functions/`).
- Each function ships a local test runnable with no network/deps/secrets.
- Secrets live only in Catalyst env vars — never in the repo. Set them at deploy
  time in `catalyst-config.json` `env_variables` locally, deploy, then
  `git checkout` the file so they never get committed.

## Repo layout
- `functions/` — Catalyst agent functions (one folder each). Deployed per `catalyst.json`.
- `scripts/` — Zoho Projects + Cliq helpers (project task automation, daily summary).
- `docs/design/` — the locked per-agent design documents (the spec for each agent).
- `docs/planning/` — project plan, infrastructure runbook, master reference sheet, API-names rule.
- `docs/brand/` — voice/copy/motivation/program-description brand assets.

## Keep Zoho Projects updated as you work (required)
Every build session must reflect its progress in Zoho Projects so the nightly
Cliq summary (10 PM CST job) shows live state. When you **start** a task, mark it
`inprogress` with a short comment; when you **finish**, mark it `completed` with a
comment. Use the CLI wrapper (matches the task by name fragment, updates status,
and adds the comment in one call):
```bash
# starting a task
node scripts/zoho-projects-update.js --task "Agent 0" --status inprogress \
  --comment "Started build — pulling live CRM field names from Zoho metadata"
# finishing a task
node scripts/zoho-projects-update.js --task "Agent 0" --status completed \
  --comment "Built + local test passing; deploy-targeted in catalyst.json"
node scripts/zoho-projects-update.js --list   # show all tasks + current status
```
- Statuses: `open` | `inprogress` | `completed` | `onhold` (portal/project IDs and
  status IDs are baked into `scripts/zoho-projects-helper.js`).
- Requires `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN` in the env.
- ⚠️ The Zoho Projects **write path** (status + comment) still needs a one-time live
  verification — only read access has been confirmed so far. Run `--list` first; if
  the write fails, surface it rather than assuming the update landed.

## Running & deploying
```bash
cd functions/<agent> && npm install && catalyst functions:serve   # local
catalyst deploy                                                    # deploy targets in catalyst.json
```
After deploy, configure Job Scheduling in the Catalyst Console per each agent's design doc.

## Current status
- ✅ Agent 5A (validation gate) — built, tested, deploy-targeted
- ✅ cliqSummaryFunction — daily Zoho Projects → Cliq summary (10 PM CST job)
- ⬜ Agents 0, 1A–1D, 2, 3, 4, 5, 6 — to build against `docs/design/`
