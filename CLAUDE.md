# CLAUDE.md — Gracelyn University Ambassador Scaling Program

## ⚠️ Reading docs — do NOT bulk-read `docs/`
The full `docs/` tree is ~175k tokens. Reading it all at once will fill the
context window in a single session. **Build one agent per session, and read only
that agent's minimal doc set:**
- `docs/design/Gracelyn_Agent_<N>_*.md` — that agent's spec (Markdown/plain text)
- `docs/planning/Ambassador_Master_Reference_Sheet.md` — field/env/module names
- `docs/planning/ClaudeCode_Zoho_API_Names_Instruction.md` — the CRM-names rule
- Only pull `Gracelyn_Ambassador_System_Architecture_v3.md` or another agent's doc if
  a specific cross-agent coordination point requires it — never the whole folder.

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

## ⚙️ Keep Zoho Projects updated as you work (required)
This build is tracked as tasks in Zoho Projects (portal `gracelynuniversity`,
project `1776658000000715069`). **As you work each task, push status + a comment
to Zoho Projects** using the helper in `scripts/` — do not leave the board stale:

- **When you start** a task → set it `inprogress` with a short comment on what you're doing.
- **When you finish** → set it `completed` with a comment describing what was done.

```bash
node scripts/zoho-projects-update.js --task "Agent 0" --status inprogress \
  --comment "Started Agent 0 — writing prospect profiling + VIP scoring."
node scripts/zoho-projects-update.js --task "Agent 0" --status completed \
  --comment "Agent 0 written, tested (N passing), and reviewed against the design doc."
node scripts/zoho-projects-update.js --list   # see all tasks + current status
```

`--task` matches on a fragment of the task name; statuses: `open | inprogress |
completed | onhold`. Requires the `ZOHO_*` OAuth env vars. The nightly 10 PM CST
Cliq summary (`cliqSummaryFunction`) reflects these status changes automatically.

> ⚠️ Not yet live-verified: confirm the status-update + comment write path works
> on one task early (it currently only has read access confirmed). If a write
> errors, paste the error back and fix before relying on it.

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

## ⚠️ Deploying — `env_variables` REPLACES, does not merge (read each function's DEPLOY.md)
`catalyst-config.json`'s `env_variables` block is pushed on every `catalyst deploy`
and **overwrites** whatever is currently set in Catalyst — it is not a merge. The
committed, safe-to-push state is `{}`. Deploying while it's still `{}` **wipes the
real secrets** and breaks the function silently (this already happened once — the
nightly Cliq summary went down with a Zoho `invalid_client` error after a deploy
ran with a scrubbed config). Before running `catalyst deploy` for any function,
read that function's `DEPLOY.md` and follow its fill-in → deploy → verify →
scrub sequence exactly. Never skip the verification curl in step 3.

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

## Running & deploying
```bash
cd functions/<agent> && npm install && catalyst functions:serve   # local
catalyst deploy                                                    # deploy targets in catalyst.json
```
After deploy, configure Job Scheduling in the Catalyst Console per each agent's design doc.

## Current status
- ✅ Agent 5A (validation gate) — built, tested, deploy-targeted
- ✅ cliqSummaryFunction — daily Zoho Projects → Cliq summary (10 PM CST job)
- ✅ Agent 0 (Research & Intelligence) — built, tested, 13 CRM fields created live on `Ambassador_Leads`
- ✅ Agent 3 (Engagement) — built, tested, 16 CRM fields created live on `Ambassadors` (sprint + engagement + VIP tier)
- ✅ Agent 2 (Onboarding) — built, tested, 23 CRM fields created live on `Ambassadors` (compliance/win-back/auto-approve/VIP)
- ✅ Agent 4 (Compliance Oversight) — built, tested, `Support_Tickets` module + 12 fields created live (HARD STOP #1 resolved; Coordination #2/#3 confirmed zero-divergence)
- ✅ Agent 5 (Ambassador Support) — built, tested; concurrent build with Agent 4 — found `Support_Tickets` and all 9 SLA fields already created live by that session, matching Agent 5's expected field names exactly (no divergence, no duplicate fields created)
- ✅ Agent 6 (Story Content Intake) — built, tested; daily buffer-monitoring Catalyst job only (story intake itself is a native Zoho Flow, not deployed code)
- ✅ Agent 1B (Social Outreach) — built, tested, 1 new CRM field (`High_Engagement_Flag`) + `Social_Post_Logs` module created live on `Ambassador_Leads`
- ✅ Agent 1C (Paid Advertising) — built, tested, kill switch verified; Ad Campaign Log module still needs to be created live by Parmeet before go-live
- ⬜ Agents 1A, 1D — to build against `docs/design/`

> **Building the next agent?** Use `docs/planning/Agent_Build_Playbook.md` — it has the
> order/status checklist, the shared "Standard Build Rules", and a ready-to-paste session
> prompt for each remaining agent. One agent per session.
