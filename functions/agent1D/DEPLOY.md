# Agent 1D — Deploy reference

Environment variables the `agent1D` function needs. Secrets are placeholders
— never commit real values (see `CLAUDE.md` and repo `.env.example`).

## Environment variables

| Variable | Set to | Notes |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | `<secret>` | Claude API key. **Required.** |
| `ZOHO_CRM_CLIENT_ID` / `_CLIENT_SECRET` / `_REFRESH_TOKEN` | `<secret>` | Scopes: `ZohoCRM.modules.READ/CREATE/UPDATE` + `ZohoCRM.settings.READ`. **Required.** |
| `ZOHO_FORMS_CLIENT_ID` / `_CLIENT_SECRET` / `_REFRESH_TOKEN` | `<secret>` | Nightly cleanup only. **Required** for the cleanup job; the real-time path never calls it. |
| `ZOHO_WORKDRIVE_CLIENT_ID` / `_CLIENT_SECRET` / `_REFRESH_TOKEN` | `<secret>` | **Required.** |
| `WORKDRIVE_FOLDER_06_ID` | `<folder id>` | Lead magnets root. **Required.** Subfolders: `k12-educator`, `early-childhood`, `faith-community`, `youth-serving` — must exist before launch (design §9). |
| `WORKDRIVE_FOLDER_08_ID` | `<folder id>` | Brand assets — same folder Agent 0/1A read. **Required.** |
| `ZOHO_MAIL_CLIENT_ID` / `_CLIENT_SECRET` / `_REFRESH_TOKEN` | `<secret>` | **Required.** |
| `AMBASSADOR_MAIL_ACCOUNT_ID` | `<account id>` | Zoho Mail account for `ambassadors@gracelyn.edu`. **Required.** |
| `AMBASSADOR_MAIL_FROM_ADDRESS` | `ambassadors@gracelyn.edu` | Plain text sends only. **Required.** |
| `PROSPECTS_MODULE_API_NAME` | `Ambassador_Leads` | ✅ Confirmed live by Agent 0/1A 2026-07-07. Still resolved live at runtime. |
| `LEAD_MAGNET_MAP` | `<JSON>` | `lead_magnet_id` → WorkDrive relative path. **Required.** Minimum viable launch: one entry per audience track. Parmeet edits without code. |
| `LEAD_CAPTURE_FORM_IDS` | `<JSON array>` | One entry per audience-track form. **Required** for nightly cleanup. See the form-addressing caveat in `forms.js`/README. |
| `AGENT1D_DELIVERY_EMAIL_SUBJECT` | `<template>` | e.g. `Your [RESOURCE_NAME] from Gracelyn University`. **Required.** |
| `AGENT1D_LEAD_MAGNET_LINK_MIN_DAYS` | `7` | Optional; defaults to 7 (design §4 Step 4 minimum). |
| `MAKE_AGENT1A_FROM_1D_WEBHOOK_URL` | `<url>` | Scenario 2 — Agent 1A handoff. Optional until Week 2, but no lead reaches Agent 1A without it. |
| `MAKE_AGENT1D_ERROR_WEBHOOK` | `<url>` | Scenario 4 — error alert routing to Parmeet. Optional; alerts still log if unset. |
| `PARMEET_ALERT_EMAIL` | `<email>` | Passed in every error webhook payload. **Required.** |

## Parmeet pre-build tasks (design §9) — confirm before first deploy

1. WorkDrive Folder 06 subfolders exist for all four tracks, with at least
   one lead magnet file per track.
2. One Zoho Form per audience track, each with hidden fields `lead_magnet_id`,
   `utm_source`, `utm_campaign` and visible fields `first_name`, `email`,
   `role_category`, `state`.
3. ✅ `Audience_Track`, `Lead_Magnets_Downloaded`, `UTM_Source`, `UTM_Campaign`
   created live on Ambassador_Leads 2026-07-08. `Audience_Track` is **text**,
   not picklist — "Youth Serving Professional" (26 chars) exceeds Zoho's
   25-char picklist-option limit, the same wall Agent 0 hit with
   `Role_Category`. `Lead_Magnets_Downloaded` is textarea (small/2000 chars);
   `UTM_Source`/`UTM_Campaign` are text (100 chars). See `manifest.js`
   divergence notes #5 and #8.
4. ⚠️ **Open decision needed:** the design doc's `state` form field has no
   plain-text home on Ambassador_Leads. The only state-like field is
   `Location_State_Province` — a global dependent picklist (3900+ values
   across every country). A raw value like `"TX"` won't match any option.
   Agent 1D currently parses/validates `state` but does **not** write it to
   CRM (see `manifest.js` divergence #6). Decide: (a) add a plain free-text
   State field, or (b) map form state values onto the picklist's option set —
   then wire the write back into `pipeline.js` Step 5a.
5. `ambassadors@gracelyn.edu` verified and authorized for Zoho Mail API sending.

## How to set them + deploy

**Recommended — Catalyst Console:**
1. Catalyst Console → project **Ambassador-Scaling-Project** → Configurations
   → Environment Variables → add the values above.
2. `cd functions/agent1D && npm install`
3. `catalyst deploy` (deploys the targets in `catalyst.json`).

**Alternative — `catalyst-config.json`:** put values in this function's
`catalyst-config.json` `env_variables` locally, `catalyst deploy`, then
immediately `git checkout functions/agent1D/catalyst-config.json` so secrets
never get committed.

## After deploy

- **Job Scheduling:** configure the nightly cleanup (`POST /cleanup`) at
  2:00 AM CST in Catalyst Console Job Scheduling.
- **Make.com:** Scenario 1 (real-time form webhook) posts to `POST /webhook`.
  Scenario 2 (Agent 1A handoff) and Scenario 4 (error routing) are the
  `MAKE_*` URLs above — coordinate the exact payload shape with whoever builds
  Agent 1A's inbound webhook handler.
- **Smoke check:** `GET /health` → `{ ok: true, agent: '1D' }`.
- **Open items:** the exact `LEAD_CAPTURE_FORM_IDS` addressing shape needs
  Parmeet/dev confirmation (see `forms.js`); the four new CRM fields need live
  creation and reconciliation before the Section 9 integration test can pass.
