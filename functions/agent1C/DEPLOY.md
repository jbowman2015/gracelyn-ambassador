# Agent 1C — Deploy reference

The exact environment variables the `agent1C` function needs, pre-staged for the
Week 2 deploy. **Secrets are placeholders — never commit real values** (see
`CLAUDE.md` and `.env.example`). The Meta and Google Ads credentials carry real
financial authority — obtain them from Parmeet, never generate your own.

## Environment variables

| Variable | Set to | Notes |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | `<secret>` | Claude API key. **Required.** |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-20250514` | Default; override only if a design doc says so. |
| `ZOHO_CRM_CLIENT_ID` / `_SECRET` / `_REFRESH_TOKEN` | `<secret>` | **Required.** Needs `ZohoCRM.settings.READ` + record scopes on Ad Campaign Log + Prospects. |
| `ZOHO_ANALYTICS_CLIENT_ID` / `_SECRET` / `_REFRESH_TOKEN` | `<secret>` | **Required.** Coordinator dashboard push. |
| `AMBASSADOR_ANALYTICS_WORKSPACE_ID` | `<workspace id>` | **Required.** |
| `AMBASSADOR_ANALYTICS_DAILY_SPEND_VIEW` | `DailySpendLog` | Default. |
| `ZOHO_WORKDRIVE_CLIENT_ID` / `_SECRET` / `_REFRESH_TOKEN` | `<secret>` | **Required.** |
| `WORKDRIVE_FOLDER_08_ID` | `<folder id>` | Brand assets (ad copy rules + voice guidelines). **Required.** |
| `META_ADS_ACCESS_TOKEN` | `<secret>` | Long-lived (60 days). **Real spend authority.** Alert Parmeet within 7 days of expiry. |
| `META_AD_ACCOUNT_ID` | `<account id>` | **Required.** Use a **test** account for development. |
| `GOOGLE_ADS_CLIENT_ID` / `_SECRET` / `_REFRESH_TOKEN` | `<secret>` | **Required.** |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | `<secret>` | **Required.** |
| `GOOGLE_ADS_CUSTOMER_ID` | `<customer id>` | **Required.** Use a **test** account for development. |
| `GOOGLE_ADS_API_VERSION` | `v16` | Default; bump without a deploy if Google deprecates it. |
| `META_DAILY_SPEND_THRESHOLD` | `<USD>` | Dr. Flippen sets. **Required.** Hard cap. |
| `GOOGLE_DAILY_SPEND_THRESHOLD` | `<USD>` | Dr. Flippen sets. **Required.** Hard cap. |
| `PROSPECTS_MODULE_API_NAME` | `Ambassador_Leads` | ✅ Confirmed live by Agent 0 (2026-07-07). |
| `AD_CAMPAIGN_LOG_MODULE_API_NAME` | `Ad_Campaign_Logs` | ✅ Created live 2026-07-13 (25 fields, matches `manifest.js` `LOG_FIELDS` exactly — zero divergence). Note: Zoho auto-generated the **plural** api_name from the module label — it is `Ad_Campaign_Logs`, not `Ad_Campaign_Log`. |
| `MAKE_SPEND_ALERT_WEBHOOK_URL` | `<url>` | Scenario 1 — daily spend alert. |
| `MAKE_KILL_SWITCH_ALERT_WEBHOOK_URL` | `<url>` | Scenario 3 — kill switch fired. |
| `MAKE_ADMIN_ALERT_WEBHOOK_URL` | `<url>` | Optional — delivers §7.1 admin alert emails. |
| `ADMIN_ALERT_EMAIL` | `jessica.bowman@gracelyn.edu` | **Required.** Developer/admin alerts (same canonical name as Agent 0). |
| `COORDINATOR_ALERT_EMAIL` | `<Parmeet Kaur's email>` | **Required.** Ambassador Program Coordinator — confirms daily spend. |
| `DR_FLIPPEN_EMAIL` | `<email>` | **Required.** Kill switch + threshold breach alerts. |
| `ZOHO_MAIL_CLIENT_ID` / `_SECRET` / `_REFRESH_TOKEN` | `<secret>` | Optional. §7 fallback only (spend alert direct-send). |
| `AMBASSADOR_MAIL_ACCOUNT_ID` | `<account id>` | Optional. Required only if the Zoho Mail fallback is exercised. |

Canonical names are the source of truth in `functions/agent1C/manifest.js` (design-doc
alias spellings still accepted). Full program-wide list: `.env.example`.

## How to set them + deploy

**Recommended — Catalyst Console** (keeps secrets out of the repo entirely):
1. Catalyst Console → project **Ambassador-Scaling-Project** → Configurations →
   Environment Variables → add the values above.
2. From the repo: `cd functions/agent1C && npm install`
3. `catalyst deploy` (deploys every target listed in `catalyst.json` —
   confirm the current list before running; it now also includes `agent2`
   and `agent3` alongside `agent5A`, `agent0`, `agent1C`, `cliqSummaryFunction`).

**Alternative — `catalyst-config.json`** (per `CLAUDE.md`): put the values in this
function's `catalyst-config.json` `env_variables` **locally**, `catalyst deploy`, then
immediately `git checkout functions/agent1C/catalyst-config.json` so secrets never get
committed. The committed file must stay `"env_variables": {}`.

## After deploy — REQUIRED before go-live

- **Job Scheduling (Catalyst Console, all times CST):**
  - `compileDailySpend` → daily 7:50 AM
  - `checkSpendConfirmation` → daily 10:00 AM — **THE KILL SWITCH**
  - `weeklyPerformanceReview` → Monday 6:00 AM
- **Make.com scenarios** (design §6): build all four scenarios and paste their
  webhook URLs into the env vars above before the kill switch integration test.
- **Kill switch integration test (design §8.2) — MANDATORY, with Parmeet present,
  on TEST ad accounts, before any live campaign is under Agent 1C's control.**
  Do not skip this. Verify: spend compiles → alert arrives → confirm withheld →
  10:00 AM pause fires on both platforms → kill switch alert reaches
  coordinator + admin + Dr. Flippen → restart without confirmation is rejected →
  confirm → restart succeeds.
- **Smoke check:** `GET /health` → `{ ok: true, agent: '1C' }`.
