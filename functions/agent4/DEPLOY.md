# Agent 4 — Deploy reference

The exact environment variables the `agent4` function needs, pre-staged for the
Week 2 deploy. Known non-secret values are filled in; **secrets are placeholders —
never commit real values** (see repo convention in `CLAUDE.md` and `.env.example`).

## Environment variables

| Variable | Set to | Notes |
| --- | --- | --- |
| `ZOHO_CRM_CLIENT_ID` / `_SECRET` / `_REFRESH_TOKEN` | `<secret>` | CRM OAuth. **Required.** Needs `ZohoCRM.settings.READ` + `ZohoCRM.modules.READ`/`UPDATE` on Ambassadors, Referrals, Support_Tickets. |
| `ZOHO_MAIL_CLIENT_ID` / `_SECRET` / `_REFRESH_TOKEN` | `<secret>` | Zoho Mail OAuth. **Required.** Sends the daily checkpoint, weekly report, and SLA/compliance alerts. |
| `AGENT4_MAIL_FROM_ADDRESS` | `compliance@gracelyn.edu` | Placeholder — confirm with Parmeet. The Zoho Mail account owning this address must exist under the OAuth token. |
| `ZOHO_WORKDRIVE_CLIENT_ID` / `_SECRET` / `_REFRESH_TOKEN` | `<secret>` | WorkDrive OAuth. **Required.** Reads `ambassador_copy_rules.txt`. |
| `WORKDRIVE_FOLDER_08_ID` | `<folder id>` | Brand assets + copy rules. **Required.** |
| `ZOHO_ANALYTICS_CLIENT_ID` / `_SECRET` / `_REFRESH_TOKEN` / `ZOHO_ANALYTICS_WORKSPACE_ID` | `<secret>` / `<workspace id>` | Optional. **HARD STOP #2 (dashboard accessibility) was not confirmed as of this build.** When unset, the checkpoint and weekly report still send in full by email — `analytics.js` degrades to a no-op rather than failing the run. |
| `AMBASSADORS_MODULE_API_NAME` | `Ambassadors` | ✅ Confirmed live. |
| `REFERRALS_MODULE_API_NAME` | `Referrals` | ✅ Confirmed live. |
| `SUPPORT_TICKETS_MODULE_API_NAME` | `Support_Tickets` | ✅ Created live this session (see CRM reconciliation below — **HARD STOP #1 resolved**). |
| `ACTIVITY_LOG_MODULE_API_NAME` | *(leave blank)* | This module does not exist. `Escalated_To_Human` is read from `Ambassadors` instead — see reconciliation notes. |
| `AD_CAMPAIGN_LOG_MODULE_API_NAME` | *(leave blank until Agent 1C is built)* | Module doesn't exist yet. Checkpoint's "Ad spend alert" section reports "not yet available" until this resolves. |
| `SLA_TIER2_FIRST_RESPONSE_HOURS` | `24` | Default. Parmeet-adjustable. |
| `SLA_VIP_FIRST_RESPONSE_HOURS` | `4` | Default (Tier 3 + VIP Priority). |
| `SLA_TIER2_RESOLUTION_HOURS` | `72` | Default. |
| `SLA_VIP_RESOLUTION_HOURS` | `24` | Default (Tier 3 + VIP Priority). |
| `SLA_WEEKLY_BREACH_RATE_THRESHOLD_PCT` | `10` | Default (design §4.1). |
| `SLA_AVG_FIRST_RESPONSE_TARGET_HOURS` | `12` | Default (design §4.1). |
| `VIP_AUDIT_TOLERANCE_PCT` | `10` | Default. **Same env var as Agent 3** — do not duplicate with a different name. |
| `VIP_POPULATION_THRESHOLD` | `10000` | Default. Same as Agent 3. |
| `VIP_HIGH_PCT_SMALL` / `VIP_STD_PCT_SMALL` | `2.5` / `5` | Default. Same as Agent 3. |
| `VIP_HIGH_PCT_LARGE` / `VIP_STD_PCT_LARGE` | `0.5` / `2.5` | Default. Same as Agent 3. |
| `MAKE_AGENT4_SLA_BREACH_WEBHOOK` | `<url>` | Scenario 4. Optional — falls back to direct coordinator email. |
| `MAKE_AGENT4_COMPLIANCE_WEBHOOK` | `<url>` | Scenario 5. Optional — falls back to direct coordinator email. |
| `MAKE_AGENT3_RECALC_COMPLETE_WEBHOOK` | `<url>` | Informational — Agent 3 fires this to Make.com Scenario 3, which POSTs `/vip-audit` here. **HARD STOP #3 — URL not yet confirmed.** No code in this function reads this var directly. |
| `SUPPORT_COORDINATOR_EMAIL` | `<email>` | Canonical (alias: `COORDINATOR_EMAIL`, the design doc's name). **Required.** |
| `PARMEET_ALERT_EMAIL` | `<email>` | **Required.** |
| `VIP_MANAGER_EMAIL` | `<email>` | **Required.** CC'd on VIP breach escalations. |

Canonical names are the source of truth in `functions/agent4/manifest.js`. Full
program-wide list: `.env.example`.

## CRM reconciliation (completed live 2026-07-10)

**HARD STOP item (1)** — "the Support Tickets CRM module exists with all SLA
timestamp fields" — was **not** met when this build started (confirmed via
`GET /crm/v6/settings/modules`: only `Cases`/`Solutions` existed, no Support
Tickets). Per user direction, this session created the module live:

- Module: `Support_Tickets` (label "Support Tickets"), profiles: Administrator + Standard.
- 12 fields created (field labels given as plain words, no underscores — Zoho
  generated every `api_name` below from the label):

| Field label | Live `api_name` | Type |
| --- | --- | --- |
| Ambassador ID | `Ambassador_ID` | lookup → Ambassadors |
| Question Text | `Question_Text` | textarea |
| Ticket Tier | `Ticket_Tier` | picklist: Tier 1, Tier 2, Tier 3, VIP Priority |
| Issue Category | `Issue_Category` | picklist: Payment, Compliance, Referral Tracking, Portal Access, Recruiting, Other |
| Ambassador VIP Status | `Ambassador_VIP_Status` | boolean |
| Resolution Complexity | `Resolution_Complexity` | picklist: Simple, Moderate, Complex |
| Resolution Status | `Resolution_Status` | picklist: Resolved, Escalated, Failed |
| Escalation Timestamp | `Escalation_Timestamp` | datetime |
| First Response Timestamp | `First_Response_Timestamp` | datetime |
| Resolution Timestamp | `Resolution_Timestamp` | datetime |
| SLA Breached | `SLA_Breached` | boolean |
| Resolution SLA Breached | `Resolution_SLA_Breached` | boolean |

Every generated `api_name` matches `functions/agent5A/manifest.js`
`SLA_COORDINATION_FIELDS`/`CRM_FIELDS.supportTickets` exactly — **Coordination
#2 has zero divergence**, and `Escalation_Timestamp` matches **Coordination #3**
exactly by construction. Agent 5, when built, should reuse these same names —
do not create the module or fields again.

**HARD STOP items (2) and (3)** — the Zoho Analytics dashboard and Agent 3's
recalculation-completion webhook URL — were **not** confirmed this session.
Both degrade gracefully rather than blocking: see `analytics.js` and the
`/vip-audit` route notes above.

Three real divergences from the design doc, reconciled against the live
`Ambassadors` / `Referrals` modules:

1. Design doc `Disqualification_Flag` → live **`Fraud_Flag`** (boolean, Ambassadors). No separate self-referral/household-match/duplicate-referral sub-flags exist.
2. Design doc's "Zoho CRM: Activity Log" module (for `Escalated_To_Human`) does not exist. Agent 3 writes `Escalated_To_Human` directly on **`Ambassadors`** — read from there instead.
3. Design doc `Referral_Fee_Status` → live **`Commission_Status`** (Referrals; module renamed from Commissions, this field's api_name wasn't).

`Referral_Stage` (includes `Eligible`) and the suspension trigger
(`Ambassador_Status` = `Suspended`) both matched the design doc's intent with
no rename needed. See `functions/agent4/manifest.js` header for the full
reconciliation write-up.

## How to set them + deploy

**Recommended — Catalyst Console** (keeps secrets out of the repo entirely):
1. Catalyst Console → project **Ambassador-Scaling-Project** → Configurations →
   Environment Variables → add the values above.
2. From the repo: `cd functions/agent4 && npm install`
3. `catalyst deploy` (deploys the targets in `catalyst.json`).

**Alternative — `catalyst-config.json`** (per `CLAUDE.md`): put the values in this
function's `catalyst-config.json` `env_variables` **locally**, `catalyst deploy`, then
immediately `git checkout functions/agent4/catalyst-config.json` so secrets never get
committed. The committed file must stay `"env_variables": {}`.

## After deploy — Job Scheduling (all times CST)

| Route | Cadence |
| --- | --- |
| `POST /fraud-check` | Daily 6:00 AM |
| `POST /eligibility-check` | Daily 6:15 AM |
| `POST /sla-monitor` | Daily 6:30 AM |
| `POST /checkpoint` | Daily 7:00 AM |
| `POST /weekly-report` | Monday 6:00/6:15 AM (combined) |
| `POST /vip-audit` | Make.com Scenario 3, triggered by Agent 3's completion webhook |
| `POST /content-compliance` | Weekly Tuesday 8:00 AM — requires `samples` in the request body (see `contentCompliance.js` header; no live content-log source exists yet) |

- **Gate:** Agent 5A is the go/no-go gate; it verifies the live CRM fields and
  halts + alerts on any divergence.
- **Smoke check:** `GET /health` → `{ ok: true, agent: '4' }`.
