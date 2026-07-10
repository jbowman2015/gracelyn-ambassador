# Agent 3 — Deploy reference

The exact environment variables the `agent3` function needs, pre-staged for the
Week 2 deploy. Known non-secret values are filled in; **secrets are placeholders —
never commit real values** (see repo convention in `CLAUDE.md` and `.env.example`).

## Environment variables

| Variable | Set to | Notes |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | `<secret>` | Claude API key. **Required.** Highest token usage agent in the system — every email is generated fresh. |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-20250514` | Default; override only if a design doc says so. |
| `ZOHO_CRM_CLIENT_ID` / `_SECRET` / `_REFRESH_TOKEN` | `<secret>` | CRM OAuth. **Required.** Needs `ZohoCRM.settings.READ` + record scopes on Ambassadors, Referrals, and Tasks. |
| `ZOHO_MAIL_CLIENT_ID` / `_SECRET` / `_REFRESH_TOKEN` | `<secret>` | Zoho Mail OAuth. **Required.** Sends every sprint + standard-cycle email. |
| `AMBASSADOR_MAIL_FROM_ADDRESS` | `ambassadors@gracelyn.edu` | Default; the Zoho Mail account owning this address must exist under the OAuth token. |
| `ZOHO_WORKDRIVE_CLIENT_ID` / `_SECRET` / `_REFRESH_TOKEN` | `<secret>` | WorkDrive OAuth. **Required.** |
| `WORKDRIVE_FOLDER_05_ID` | `<folder id>` | Story file buffer (design §5.3). **Required.** |
| `WORKDRIVE_FOLDER_08_ID` | `<folder id>` | Brand assets + `update_brief.txt` for the Week 4 email. **Required.** |
| `HEYGEN_API_KEY` / `HEYGEN_TEMPLATE_ID` / `HEYGEN_FLIPPEN_AVATAR_ID` | `<secret>` | Milestone recognition videos only. Optional — milestone email still sends if unset. |
| `AMBASSADORS_MODULE_API_NAME` | `Ambassadors` | ✅ Confirmed live 2026-07-10 — the existing custom module. |
| `REFERRALS_MODULE_API_NAME` | `Referrals` | ✅ Confirmed live 2026-07-10 — no new Referrals fields were needed. |
| `SPRINT_GRADUATION_DAYS` | `28` | Default. Do not set below 21. |
| `NON_REFERRAL_DAYS_THRESHOLD` | `90` | Default. Measured from sprint graduation, not original activation. |
| `DORMANT_DAYS_THRESHOLD` | `30` | Default. |
| `VIP_POPULATION_THRESHOLD` | `10000` | Default. |
| `VIP_HIGH_PCT_SMALL` / `VIP_STD_PCT_SMALL` | `2.5` / `5` | Default. |
| `VIP_HIGH_PCT_LARGE` / `VIP_STD_PCT_LARGE` | `0.5` / `2.5` | Default. |
| `STORY_BUFFER_MINIMUM` | `4` | Default. Alerts Parmeet below this. |
| `WEEKLY_BATCH_SIZE` | `100` | Default. |
| `MAKE_AGENT3_WEBHOOK_URL` | `<url>` | Referral stage-change trigger source (Scenario 5). Optional. |
| `MAKE_AGENT3_ERROR_WEBHOOK` | `<url>` | Optional — POSTs Parmeet alert emails for delivery. Falls back to sending via Zoho Mail directly. |
| `PARMEET_ALERT_EMAIL` | `<email>` | Receives all Agent 3 error alerts. **Required.** |
| `VIP_MANAGER_EMAIL` | `<email>` | High VIP personal outreach CRM tasks assigned here. **Required.** |

Canonical names are the source of truth in `functions/agent3/manifest.js`. Full
program-wide list: `.env.example`.

## CRM reconciliation (completed live 2026-07-10)

The `Ambassadors` and `Referrals` custom modules already existed (created ahead
of Agent 2/Agent 3's build). Sixteen new fields were created live on
`Ambassadors` for this agent — see `functions/agent3/manifest.js`
`AMBASSADOR_FIELDS` for the full reconciled map. Two diverge from the design
doc's field name because Zoho's 25-char field-label limit forced a shorter
label (Zoho derives `api_name` from the label):

- design doc `Activation_Sprint_Start_Date` → live **`Sprint_Start_Date`**
- design doc `Alternative_Track_Entry_Date` → live **`Alt_Track_Entry_Date`**

No new fields were needed on `Referrals`: `Ambassador` (lookup), `Referral_Stage`
(already includes `Applied` and `Enrolled`), `Application_Date`,
`Enrollment_Date`, `Created_Time`, and `Modified_Time` cover everything this
agent reads.

`Ambassador_Role_Category`, `Motivation_Tag`, and `VIP_Prospect_Origin` are
Agent 2's fields and do not exist yet (Agent 2 is unbuilt). Agent 3 reads them
defensively — empty/false rather than halting — until Agent 2 creates them.

## How to set them + deploy

**Recommended — Catalyst Console** (keeps secrets out of the repo entirely):
1. Catalyst Console → project **Ambassador-Scaling-Project** → Configurations →
   Environment Variables → add the values above.
2. From the repo: `cd functions/agent3 && npm install`
3. `catalyst deploy` (deploys the targets in `catalyst.json`: `agent5A`, `agent0`,
   `agent3`, `cliqSummaryFunction`).

**Alternative — `catalyst-config.json`** (per `CLAUDE.md`): put the values in this
function's `catalyst-config.json` `env_variables` **locally**, `catalyst deploy`, then
immediately `git checkout functions/agent3/catalyst-config.json` so secrets never get
committed. The committed file must stay `"env_variables": {}`.

## After deploy — Job Scheduling (all times CST)

| Route | Cadence |
| --- | --- |
| `POST /activate` | Agent 2 activation webhook (real-time) |
| `POST /sprint-advance` | Monday 8:00 AM |
| `POST /weekly-cycle` | Monday 9:00 AM |
| `POST /milestones` | Daily 7:00 AM |
| `POST /referral-stage-change` | Zoho Flow webhook (real-time) |
| `POST /dormant-detect` | Daily 7:30 AM |
| `POST /monthly-non-referral` | First Monday of month, 6:00 AM |
| `POST /monthly-vip-recalc` | First Monday of month, 6:30 AM |
| `POST /monthly-vip-supplemental` | First Monday of month, 7:00 AM |

Sprint advancement (8:00 AM) must run before the weekly cycle (9:00 AM) — this
is a hard sequencing requirement (design §2.2) to prevent a sprint ambassador
from ever receiving both emails in the same Monday window.

- **Gate:** Agent 5A is the go/no-go gate; it verifies the live CRM fields and
  halts + alerts on any divergence.
- **Smoke check:** `GET /health` → `{ ok: true, agent: '3' }`.
