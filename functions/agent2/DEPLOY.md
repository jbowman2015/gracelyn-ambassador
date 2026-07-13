# Agent 2 — Deploy reference

The exact environment variables the `agent2` function needs, pre-staged for
the Week 2 deploy. Known non-secret values are filled in; **secrets are
placeholders — never commit real values** (see repo convention in `CLAUDE.md`
and `.env.example`).

## Environment variables

| Variable | Set to | Notes |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | `<secret>` | Claude API key. **Required.** |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-20250514` | Default; override only if a design doc says so. |
| `ZOHO_CRM_CLIENT_ID` | `<secret>` | CRM OAuth. **Required.** Needs `ZohoCRM.settings.READ` + record scopes. |
| `ZOHO_CRM_CLIENT_SECRET` | `<secret>` | **Required.** |
| `ZOHO_CRM_REFRESH_TOKEN` | `<secret>` | **Required.** |
| `ZOHO_MAIL_CLIENT_ID` | `<secret>` | Mail OAuth. **Required.** Needs `ZohoMail.messages.CREATE`. |
| `ZOHO_MAIL_CLIENT_SECRET` | `<secret>` | **Required.** |
| `ZOHO_MAIL_REFRESH_TOKEN` | `<secret>` | **Required.** |
| `ZOHO_MAIL_ACCOUNT_ID` | `<secret>` | **Required.** Not in the design doc's env table — the Zoho Mail send API needs it. Flag for Parmeet. |
| `ZOHO_MAIL_FROM_ADDRESS` | `ambassadors@gracelyn.edu` | Default. |
| `ZOHO_WORKDRIVE_CLIENT_ID` | `<secret>` | WorkDrive OAuth. **Required.** |
| `ZOHO_WORKDRIVE_CLIENT_SECRET` | `<secret>` | **Required.** |
| `ZOHO_WORKDRIVE_REFRESH_TOKEN` | `<secret>` | **Required.** |
| `WORKDRIVE_FOLDER_03_ID` | `<folder id>` | Welcome kits. **Required.** |
| `WORKDRIVE_FOLDER_08_ID` | `<folder id>` | Brand assets (voice guidelines). **Required.** |
| `WORDPRESS_API_BASE_URL` | `<url>` | **Required.** Alias `WORDPRESS_SITE_URL`. |
| `WP_ADMIN_USER` | `<secret>` | **Required.** Alias `WORDPRESS_APP_USERNAME`. Confirm with Parmeet whether this is the shared admin or a dedicated `wp-agent2` user (Master Reference Sheet §1, still open). |
| `WP_ADMIN_APP_PASSWORD` | `<secret>` | **Required.** Application password, not the login password. Alias `WORDPRESS_APP_PASSWORD`. |
| `AMBASSADOR_PORTAL_URL` | `<url>` | Linked in onboarding emails. |
| `HEYGEN_API_KEY` | `<secret>` | **Required.** |
| `HEYGEN_TEMPLATE_ID` | `<template id>` | **Required.** VIP welcome video template. |
| `HEYGEN_FLIPPEN_AVATAR_ID` | `<avatar id>` | **Required.** |
| `APPROVAL_MODE` | `MANUAL` | **Required.** Phase 1 default. Flip to `AUTO` only per Parmeet's active decision at the 1,000-ambassador threshold. |
| `AUTO_APPROVE_CRITERIA_VERSION` | `v2.0` | Default. Bump when the auto-approve criteria change. |
| `ACTIVE_AMBASSADOR_THRESHOLD_ALERT` | `800` | Default. |
| `ACTIVE_AMBASSADOR_THRESHOLD_AUTO` | `1000` | Default. |
| `AMBASSADORS_MODULE_API_NAME` | `Ambassadors` | ✅ Confirmed live 2026-07-10 (`CustomModule37`). |
| `PROSPECTS_MODULE_API_NAME` | `Ambassador_Leads` | ✅ Confirmed live (Agent 0 build 2026-07-07). |
| `COMBINED_FORM_ID` | `<form id>` | **Required.** Zoho Forms combined compliance form. Blocked until Parmeet confirms the form is built (design §1 hard stop). |
| `WINBACK_SURVEY_FORM_ID` | `<form id>` | **Required.** Blocked until Parmeet confirms the form is built. |
| `ZOHO_FORMS_BASE_URL` | `<url>` | Optional. Used with the two `*_FORM_ID` values to build email links. |
| `WINBACK_WALKTHROUGH_VIDEO_URL` | `<url>` | Optional. WorkDrive link for the win-back Response B walkthrough video. |
| `MAKE_AGENT3_WEBHOOK_URL` | `<url>` | Function D5 — Agent 3 activation. Alias `MAKE_AGENT3_ACTIVATION_WEBHOOK`. |
| `MAKE_VIP_MANAGER_NOTIFY_WEBHOOK_URL` | `<url>` | Function B4-VIP + D6. Alias `MAKE_VIP_ACTIVATION_WEBHOOK`. |
| `MAKE_COORDINATOR_QUEUE_WEBHOOK_URL` | `<url>` | Optional — Function A4 coordinator notification. |
| `MAKE_WINBACK_SURVEY_WEBHOOK` | `<url>` | Optional — immediate coordinator notify on a reported technical problem. |
| `MAKE_AGENT2_ERROR_WEBHOOK` | `<url>` | Optional — delivers Agent 2 alert emails. |
| `PARMEET_ALERT_EMAIL` | `<email>` | **Required.** Receives all Agent 2 error + threshold alerts. |
| `VIP_MANAGER_EMAIL` | `<email>` | **Required.** Alias `VIP_RELATIONSHIP_MANAGER_EMAIL`. |
| `SUPPORT_COORDINATOR_EMAIL` | `<email>` | Win-back Response A/D personal follow-up. |

Canonical names are the source of truth in `functions/agent2/manifest.js`
(design-doc alias spellings are still accepted read-only). Full program-wide
list: `.env.example`.

## Hard stop before deploying (design §1)

Do not deploy live traffic until Parmeet has confirmed the **combined
compliance form** and the **win-back survey form** are built and accessible in
Zoho Forms, and set `COMBINED_FORM_ID` / `WINBACK_SURVEY_FORM_ID`. Agent 2
cannot function without both.

## How to set them + deploy

**Recommended — Catalyst Console** (keeps secrets out of the repo entirely):
1. Catalyst Console → project **Ambassador-Scaling-Project** → Configurations →
   Environment Variables → add the values above.
2. From the repo: `cd functions/agent2 && npm install`
3. `catalyst deploy` (deploys the targets in `catalyst.json`: `agent5A`,
   `agent0`, `agent2`, `cliqSummaryFunction`).

**Alternative — `catalyst-config.json`** (per `CLAUDE.md`): put the values in
this function's `catalyst-config.json` `env_variables` **locally**,
`catalyst deploy`, then immediately
`git checkout functions/agent2/catalyst-config.json` so secrets never get
committed. The committed file must stay `"env_variables": {}`.

## After deploy

- **Job Scheduling:** configure two Catalyst jobs in the Console, both CST:
  - Daily 8:30 AM → `POST /compliance-check` (Function C reminder/win-back/dormant sweep).
  - Daily (any time before the coordinator's morning review) → `POST /threshold-check`.
- **Make.com scenarios:** wire Scenarios 1, 2, 4, 5 (design §8) to
  `/application-received`, `/approval`, `/winback-survey-response`, and
  `/activation` respectively. Scenario 6 (HeyGen polling) and Scenario 7
  (threshold alert delivery) are Make.com-side, not Agent 2 routes.
- **Gate:** Agent 5A is the go/no-go gate; extend its Ambassadors field list
  with the 23 fields this build created (see `README.md`) before relying on
  5A's validation for Agent 2.
- **Smoke check:** `GET /health` → `{ ok: true, agent: '2' }`.
