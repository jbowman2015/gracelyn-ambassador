# Agent 0 — Research & Intelligence

The intelligence layer that makes every other agent smarter. It profiles
prospects, scores each for mission alignment and the VIP Prospect threshold,
generates briefing documents for high-value influencers, and reports gaps for
future enrichment decisions. **No recruiting agent messages a prospect without
Agent 0 data behind it.** Built against
`docs/design/Gracelyn_Agent_0_Research_Intelligence_v2__1_.docx`.

## What it does (run cycle, design §6)

1. **Token refresh** — Zoho CRM + WorkDrive OAuth. Failure halts + alerts.
2. **Brand assets** — reads voice guidelines + mission statement from WorkDrive
   Folder 08. Either missing halts + alerts.
3. **Audience config** — parses `AGENT0_AUDIENCE_CONFIG` (Jessica edits, no code).
4. **Existing prospects** — resolves the Prospects module api_name **live** from
   Zoho, verifies the fields Agent 0 writes exist, and builds a dedup index keyed
   on `Social_Profile_URL`.
5–8. **Discovery → profile → Claude assessment → VIP scoring.** Audience reach
   (0-40) is computed in code from follower count; Claude scores org influence
   (0-30) and mission alignment (0-30). Total ≥ threshold (default 60) ⇒ VIP.
9. **VIP briefing** (VIP only) — Claude writes a plain-text briefing in Gracelyn
   voice, saved to Folder 09 as `VIP_Brief_[Name]_[YYYY-MM-DD].txt`, then the VIP
   notification webhook fires. Retries once, then alerts (VIP flag is never dropped).
10. **CRM upsert** — keyed on `Social_Profile_URL`; updates rather than duplicates.
11. **Standard routing** — non-VIP with an email are counted for the recruiting
    trigger. **VIP prospects are never routed to recruiting agents.**
12. **Gap report** — `Agent0_Gap_Report_[YYYY-MM-DD].txt` to Folder 07.
13. **Recruiting trigger** — consolidated Make.com webhook with per-role counts.

## Discovery input

Agent 0's tool table routes social listening through Make.com / Ayrshare
("No direct API call from Agent 0 code") and gives it no web-search credential.
So discovered prospects are delivered **into** the function:

- **Weekly** (`POST /run`): `{ "rawProspects": [ { socialProfileUrl, firstName,
  lastName, email, organization, channelSource, followerCount, profileText,
  recentContent } ] }`
- **On-demand** (`POST /on-demand`): `{ "prospectUrl": "https://…", "prospect": { … } }`

`buildRawProspects` in `pipeline.js` is the seam where a real research provider
would plug in.

## Routes

```
POST /run         weekly cycle (or ON_DEMAND when body.mode is set)
POST /on-demand   single-URL run (Make.com Scenario 4)
GET  /health      liveness
```

## Scoring (design §3.1)

| Dimension | Points | Source |
| --- | --- | --- |
| Audience Reach | 0-40 | computed from follower/subscriber count |
| Organizational Influence | 0-30 | Claude assessment |
| Mission Alignment | 0-30 | Claude assessment |
| **VIP threshold** | **≥ 60** | `VIP_PROSPECT_SCORE_THRESHOLD` |

## CRM name authority

Per `docs/planning/ClaudeCode_Zoho_API_Names_Instruction.md`, Zoho is
authoritative for module + field api_names. Agent 0 resolves the module
api_name live (`resolveModuleApiName`) and cross-checks every field it writes
against Zoho's fields metadata (`verifyFields`), surfacing any divergence to the
admin instead of failing silently. It reuses the metadata-helper pattern from
`functions/agent5A/zoho.js`.

> **CRM reconciliation (completed live 2026-07-07):** the Prospects module is the
> existing **`Ambassador_Leads`** custom module. Agent 0's fields were reconciled and
> the missing ones created live:
> - **Mapped to existing (no new field):** `First_Name` → **`Name`** (label "First
>   Name"); `Organization` → **`Company_Name`**. `manifest.js` maps to these to avoid
>   duplicate name/company columns.
> - **Created on `Ambassador_Leads` (13):** `Social_Profile_URL` (URL, dedup key),
>   `Channel_Source`, `Contact_Found`, `Gap_Type`, `Role_Category` (text),
>   `Motivation_Tag`, `Mission_Alignment_Score`, `Org_Influence_Score`, `VIP_Prospect`,
>   `VIP_Prospect_Score`, **`VIP_Pipeline_Stage`** (label "VIP Pipeline Stage"),
>   `Prospect_Declined_Date`, and `Outreach_Status` (picklist: Standard, VIP Pipeline).
>
> Before a live run, set `PROSPECTS_MODULE_API_NAME` to `Ambassador_Leads`. Agent 5A is
> the gate for this; Agent 0 verifies the fields live and alerts Jessica at Step 4.

## Environment variables

Canonical names (aliases accepted for design-doc spellings):

- **AI:** `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (default `claude-sonnet-4-20250514`)
- **Zoho:** `ZOHO_CRM_*` trio, `ZOHO_WORKDRIVE_*` trio
- **WorkDrive folders:** `WORKDRIVE_FOLDER_07_ID` / `_08_ID` / `_09_ID`
  (aliases `WORKDRIVE_FOLDER_07`/`08`/`09`)
- **Behaviour:** `AGENT0_AUDIENCE_CONFIG`, `VIP_PROSPECT_SCORE_THRESHOLD` (60),
  `AGENT0_RUN_MODE` (WEEKLY | ON_DEMAND), `PROSPECTS_MODULE_API_NAME`
- **Make.com:** `MAKE_VIP_NOTIFY_WEBHOOK_URL` (alias `MAKE_VIP_NOTIFICATION_WEBHOOK`),
  `MAKE_AGENT0_COMPLETE_WEBHOOK_URL` (alias `MAKE_RECRUITING_TRIGGER_WEBHOOK`)
- **Alerts:** `ADMIN_ALERT_EMAIL` = `jessica.bowman@gracelyn.edu`
  (aliases `JESSICA_ALERT_EMAIL`, `PARMEET_ALERT_EMAIL`), `VIP_MANAGER_EMAIL`,
  optional `MAKE_ADMIN_ALERT_WEBHOOK_URL`
- **Phase 2 (dormant):** `APOLLO_API_KEY`, `HUNTER_API_KEY`

> The design doc's admin/alert role ("Parmeet") is **Jessica**
> (`jessica.bowman@gracelyn.edu`). Alert emails, the §9.1 template, and the gap
> report all name Jessica.

## Local test

```bash
node __tests__/agent0.test.js   # no network, no deps, no secrets
```

Covers scoring bands + threshold, Claude parse safe-defaults, §7 prompt voice
rules, dedup skip, VIP briefing + Folder 09 upload, VIP suppression of
recruiting, gap report, missing-brand-asset halt, and missing-CRM-field surfacing.

## Files

- `manifest.js` — env-var spec, Prospects field names, scoring bands, vocabularies.
- `scoring.js` — pure VIP Prospect scoring.
- `prompts.js` — the two §7 Claude system prompts (verbatim).
- `claude.js` — Anthropic Messages client + tolerant JSON parsing.
- `zoho.js` — live CRM metadata + records (dedup, upsert), reusing the 5A pattern.
- `workdrive.js` — brand-asset read + briefing/gap-report writes.
- `webhooks.js` — Make.com delivery with one-retry.
- `alerts.js` — §9.1 admin alert formatting + delivery.
- `pipeline.js` — the run cycle (steps 1-13) with §9 error handling.
- `index.js` — Express app.
