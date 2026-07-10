# Agent 1C — Paid Advertising

Manages Gracelyn's paid ambassador recruiting campaigns on Meta (Facebook/Instagram)
and Google Ads: daily spend compilation, a hard **kill switch** that pauses every
campaign if the coordinator hasn't confirmed spend by 10:00 AM CST, coordinator
confirmation, campaign restart, and weekly performance/audience review. Built
against `docs/design/Gracelyn_Agent_1C_Paid_Advertising_v1.md`.

> **KILL SWITCH: non-negotiable.** If the coordinator does not confirm daily spend
> by 10:00 AM CST, `checkSpendConfirmation` pauses every active campaign on both
> platforms immediately — no warning first. Campaigns never resume automatically;
> only a deliberate coordinator restart (with confirmed spend) resumes them.

## The five jobs (design §4)

| Job | Trigger | Time (CST) |
| --- | --- | --- |
| `compileDailySpend` | Catalyst scheduled job | Daily, 7:50 AM |
| `checkSpendConfirmation` (**kill switch**) | Catalyst scheduled job | Daily, 10:00 AM |
| `recordConfirmation` | Make.com Scenario 2 webhook | On coordinator Confirm click |
| `resumeCampaigns` | Make.com Scenario 3 webhook | On coordinator Restart click |
| `weeklyPerformanceReview` | Catalyst scheduled job | Monday, 6:00 AM |
| `weeklyAudienceRefresh` | Make.com Scenario 4 (Agent 0 trigger) | Monday, after Agent 0 |

## Routes

```
POST /compileDailySpend
POST /checkSpendConfirmation   ← THE KILL SWITCH
POST /recordConfirmation       { log_record_id, confirmed_at }
POST /resumeCampaigns          { log_record_id, paused_meta_ids, paused_google_ids }
POST /weeklyPerformanceReview
POST /weeklyAudienceRefresh    { trigger_type: 'agent0_complete' }
GET  /health
```

## CRM name authority — a cross-agent coordination point found and fixed

Per `docs/planning/ClaudeCode_Zoho_API_Names_Instruction.md`, Zoho is
authoritative for module + field api_names. `zoho.js` resolves both CRM modules
live (`resolveModuleApiName`) and cross-checks every field before use
(`verifyFields`), surfacing any divergence via an alert instead of failing
silently.

**Divergence found while building this agent:** the Agent 1C design doc's
Prospects read fields (`Ambassador_Role_Category`, `Motivation_Hypothesis`,
`VIP_Score`) do not match what Agent 0 actually created on the shared
`Ambassador_Leads` module during its live reconciliation (2026-07-07):
`Role_Category`, `Motivation_Tag`, `VIP_Prospect_Score`. `manifest.js`
`PROSPECT_READ_FIELDS` uses Agent 0's live names — the doc's names are stale.
This is exactly the kind of silent-failure risk the coordination-points section
of `CLAUDE.md` calls out; `weeklyAudienceRefresh` still runs `verifyFields`
against these at run time and alerts on any further drift.

## Environment variables

Canonical names (aliases accepted for design-doc spellings) — full detail in
`manifest.js` `ENV_SPEC`:

- **AI:** `ANTHROPIC_API_KEY` (alias `CLAUDE_API_KEY`), `ANTHROPIC_MODEL`
  (default `claude-sonnet-4-20250514`)
- **Zoho:** `ZOHO_CRM_*` trio, `ZOHO_ANALYTICS_*` trio,
  `ZOHO_WORKDRIVE_*` trio (alias `WORKDRIVE_*`), `WORKDRIVE_FOLDER_08_ID`
- **Meta Ads:** `META_ADS_ACCESS_TOKEN` (real spend authority), `META_AD_ACCOUNT_ID`
- **Google Ads:** `GOOGLE_ADS_CLIENT_ID`/`_SECRET`/`_REFRESH_TOKEN`,
  `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CUSTOMER_ID`, `GOOGLE_ADS_API_VERSION` (v16)
- **Policy (split, per CLAUDE.md):** `META_DAILY_SPEND_THRESHOLD`,
  `GOOGLE_DAILY_SPEND_THRESHOLD` — hard caps, not guidelines
- **CRM modules:** `PROSPECTS_MODULE_API_NAME`, `AD_CAMPAIGN_LOG_MODULE_API_NAME`
- **Make.com:** `MAKE_SPEND_ALERT_WEBHOOK_URL`, `MAKE_KILL_SWITCH_ALERT_WEBHOOK_URL`,
  optional `MAKE_ADMIN_ALERT_WEBHOOK_URL`
- **Alerts:** `ADMIN_ALERT_EMAIL` (Jessica — same canonical name Agent 0 uses;
  aliases `JESSICA_ALERT_EMAIL`, `PARMEET_ALERT_EMAIL`), `COORDINATOR_ALERT_EMAIL`
  (Ambassador Program Coordinator, Parmeet Kaur), `DR_FLIPPEN_EMAIL`
- **Fallback (optional):** `ZOHO_MAIL_*` trio + `AMBASSADOR_MAIL_ACCOUNT_ID` — direct-send
  path used only if the spend-alert webhook fails twice (design §7)

> **Alert routing reconciliation:** the design doc's developer-alert role
> ("Parmeet") reuses Agent 0's already-established `ADMIN_ALERT_EMAIL` canonical
> name rather than reintroducing `PARMEET_ALERT_EMAIL` as a second competing
> name. The Ambassador Program Coordinator (also named Parmeet Kaur, per Master
> Reference Sheet §6 — a distinct, separate role that confirms daily spend) is
> `COORDINATOR_ALERT_EMAIL`. `DR_FLIPPEN_EMAIL` is unaffected.
>
> **Spend threshold reconciliation:** CLAUDE.md resolved the combined-vs-split
> conflict in the Master Reference Sheet in favor of split
> `META_DAILY_SPEND_THRESHOLD` + `GOOGLE_DAILY_SPEND_THRESHOLD` (matches the
> design doc's code). The alternate combined `AGENT1C_DAILY_SPEND_THRESHOLD` is
> not used.

## Local test

```bash
node __tests__/agent1C.test.js   # no network, no deps, no secrets
```

18 cases: env alias resolution, the §7.1 alert template, webhook retry, the
spend-alert Zoho Mail fallback, the kill switch (confirmed vs not confirmed),
pause-failure retry + alert, restart rejection without confirmation, weekly CPC
flagging, and Claude 3rd-consecutive-failure alerting.

## Files

- `manifest.js` — env-var spec, Ad Campaign Log + Prospects field names, policy.
- `zoho.js` — CRM metadata/records, Analytics dashboard push, WorkDrive read.
- `zohoMail.js` — §7 direct-send fallback for the spend alert.
- `metaAds.js` — Meta Ads client (spend, pause/resume, weekly performance).
- `googleAds.js` — Google Ads client (OAuth, GAQL, mutate pause/resume).
- `claude.js` — the §5.1 weekly audience recommendation call.
- `webhooks.js` — Make.com delivery with one-retry.
- `alerts.js` — §7.1 alert formatting, spend alert + kill switch alert delivery.
- `pipeline.js` — the five jobs with §7 error handling.
- `index.js` — Express app.

## Known scope notes

- **"3 consecutive weekly failures"** for the Claude recommendation (design §7)
  is tracked via a `consecutiveFailures` counter passed into
  `weeklyAudienceRefresh` by the caller — this Catalyst function is stateless
  per invocation, so true cross-invocation persistence would need a small
  counter record in CRM. Flagged here rather than silently assumed.
- **Weekly performance CPC flags** (design Step E4) are written to the
  `Performance_Flags` field on the CRM record for Parmeet's review during the
  CRM audit; the design doc's `MAKE_COORDINATOR_SUMMARY_WEBHOOK_URL` is not in
  the Master Reference Sheet's webhook list, so no webhook name was invented for
  it — confirm the intended channel with Parmeet before go-live.
