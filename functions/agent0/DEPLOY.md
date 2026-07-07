# Agent 0 — Deploy reference

The exact environment variables the `agent0` function needs, pre-staged for the
Week 2 deploy. Known non-secret values are filled in; **secrets are placeholders —
never commit real values** (see repo convention in `CLAUDE.md` and `.env.example`).

## Environment variables

| Variable | Set to | Notes |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | `<secret>` | Claude API key. **Required.** |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-20250514` | Default; override only if a design doc says so. |
| `ZOHO_CRM_CLIENT_ID` | `<secret>` | CRM OAuth. **Required.** Needs `ZohoCRM.settings.READ` + record scopes. |
| `ZOHO_CRM_CLIENT_SECRET` | `<secret>` | **Required.** |
| `ZOHO_CRM_REFRESH_TOKEN` | `<secret>` | **Required.** |
| `ZOHO_WORKDRIVE_CLIENT_ID` | `<secret>` | WorkDrive OAuth. **Required.** |
| `ZOHO_WORKDRIVE_CLIENT_SECRET` | `<secret>` | **Required.** |
| `ZOHO_WORKDRIVE_REFRESH_TOKEN` | `<secret>` | **Required.** |
| `WORKDRIVE_FOLDER_07_ID` | `<folder id>` | Analytics + gap reports. **Required.** |
| `WORKDRIVE_FOLDER_08_ID` | `<folder id>` | Brand assets (voice + mission). **Required.** |
| `WORKDRIVE_FOLDER_09_ID` | `<folder id>` | VIP briefings. **Required.** |
| `AGENT0_AUDIENCE_CONFIG` | `<JSON>` | Audience categories/channels/role priorities. **Required.** Jessica edits without code. |
| `PROSPECTS_MODULE_API_NAME` | `Ambassador_Leads` | ✅ Confirmed live — the existing custom module (13 VIP fields created 2026-07-07). |
| `VIP_PROSPECT_SCORE_THRESHOLD` | `60` | Default. |
| `AGENT0_RUN_MODE` | `WEEKLY` | `WEEKLY` (default) or `ON_DEMAND`. |
| `ADMIN_ALERT_EMAIL` | `jessica.bowman@gracelyn.edu` | Receives all Agent 0 error alerts. **Required.** |
| `VIP_MANAGER_EMAIL` | `<email>` | Receives VIP briefing notifications. **Required.** |
| `MAKE_VIP_NOTIFY_WEBHOOK_URL` | `<url>` | Scenario 2 — VIP notification. Optional. |
| `MAKE_AGENT0_COMPLETE_WEBHOOK_URL` | `<url>` | Scenario 3 — consolidated recruiting trigger. Optional. |
| `MAKE_AGENT0_ONDEMAND_WEBHOOK_URL` | `<url>` | Scenario 4 — on-demand callback. Optional. |
| `MAKE_ADMIN_ALERT_WEBHOOK_URL` | `<url>` | Optional — POSTs alert emails for delivery. |
| `APOLLO_API_KEY` | *(leave blank)* | Phase 2, dormant until Day 60. |
| `HUNTER_API_KEY` | *(leave blank)* | Phase 2, dormant until Day 60. |

Canonical names are the source of truth in `functions/agent0/manifest.js` (design-doc
alias spellings are still accepted read-only). Full program-wide list: `.env.example`.

## How to set them + deploy

**Recommended — Catalyst Console** (keeps secrets out of the repo entirely):
1. Catalyst Console → project **Ambassador-Scaling-Project** → Configurations →
   Environment Variables → add the values above.
2. From the repo: `cd functions/agent0 && npm install`
3. `catalyst deploy` (deploys the targets in `catalyst.json`: `agent5A`, `agent0`,
   `cliqSummaryFunction`).

**Alternative — `catalyst-config.json`** (per `CLAUDE.md`): put the values in this
function's `catalyst-config.json` `env_variables` **locally**, `catalyst deploy`, then
immediately `git checkout functions/agent0/catalyst-config.json` so secrets never get
committed. The committed file must stay `"env_variables": {}`.

## After deploy

- **Job Scheduling:** configure Agent 0's **weekly** run in the Catalyst Console
  (Job Scheduling) to `POST /run` — cadence per the Agent 0 design doc, all times **CST**.
  On-demand runs hit `POST /on-demand` (Make.com Scenario 4).
- **Gate:** Agent 5A is the go/no-go gate; it (and Agent 0 at Step 4) verifies the live
  CRM fields and halts + alerts on any divergence.
- **Smoke check:** `GET /health` → `{ ok: true, agent: '0' }`.
