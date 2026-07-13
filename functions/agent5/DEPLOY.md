# Agent 5 — Deploy reference

The exact environment variables the `agent5` function needs, pre-staged for the
Week 2 deploy. Known non-secret values are filled in; **secrets are placeholders —
never commit real values** (see repo convention in `CLAUDE.md` and `.env.example`).

## Hard stops before deploying (design §1)

Do not deploy live traffic until Parmeet has confirmed:

1. **The existing OpenAI website chat configuration** — whether Agent 5 extends
   that same assistant or uses a distinct one, and which API key/assistant ID to
   use. `OPENAI_AMBASSADOR_ASSISTANT_ID` below is a placeholder pending that answer.
2. **The knowledge base is complete and reviewed** by Parmeet and Dr. Flippen
   (design §8). An incomplete knowledge base produces incorrect answers — do not
   activate Agent 5 for any ambassador until sign-off is received.
3. **The WordPress session-verification endpoint.** The design doc does not name
   a concrete REST endpoint for verifying a portal session token — `wordpress.js`
   calls a configurable path (`WORDPRESS_SESSION_VERIFY_PATH`, default
   `/wp-json/gracelyn/v1/verify-session`) expecting `{ valid, email, role }`.
   Confirm the real endpoint (or have one built) with Parmeet before deploying.

## Environment variables

| Variable | Set to | Notes |
| --- | --- | --- |
| `OPENAI_API_KEY` | `<secret>` | **Required.** Confirm with Parmeet whether this is the same key as the existing website chat or a new one (hard stop 1). |
| `OPENAI_AMBASSADOR_ASSISTANT_ID` | `<secret>` | **Required.** Canonical name — do NOT use `OPENAI_ASSISTANT_ID`. Alias accepted read-only. |
| `OPENAI_POLL_INTERVAL_MS` | `2000` | Default. |
| `OPENAI_POLL_MAX_ATTEMPTS` | `15` | Default — 30s max poll window. |
| `ZOHO_CRM_CLIENT_ID` | `<secret>` | CRM OAuth. **Required.** Needs `ZohoCRM.settings.READ` + record scopes. |
| `ZOHO_CRM_CLIENT_SECRET` | `<secret>` | **Required.** |
| `ZOHO_CRM_REFRESH_TOKEN` | `<secret>` | **Required.** |
| `ZOHO_MAIL_CLIENT_ID` | `<secret>` | Mail OAuth. **Required.** Needs `ZohoMail.messages.CREATE`. Used only for the fallback escalation email. |
| `ZOHO_MAIL_CLIENT_SECRET` | `<secret>` | **Required.** |
| `ZOHO_MAIL_REFRESH_TOKEN` | `<secret>` | **Required.** |
| `ZOHO_MAIL_ACCOUNT_ID` | `<secret>` | **Required.** Not in the design doc's env table — the Zoho Mail send API needs it (same gap Agent 2 flagged). |
| `AMBASSADOR_MAIL_FROM_ADDRESS` | `ambassadors@gracelyn.edu` | Default. Canonical name shared with Agent 2 + Agent 3 (JP1-T349) — not `ZOHO_MAIL_FROM_ADDRESS`. |
| `ZOHO_WORKDRIVE_CLIENT_ID` | `<secret>` | WorkDrive OAuth. **Required.** |
| `ZOHO_WORKDRIVE_CLIENT_SECRET` | `<secret>` | **Required.** |
| `ZOHO_WORKDRIVE_REFRESH_TOKEN` | `<secret>` | **Required.** |
| `WORKDRIVE_FOLDER_08_ID` | `<folder id>` | Brand assets: `ambassador_copy_rules.txt`, `ambassador_program_descriptions.txt`. **Required.** |
| `WORDPRESS_API_BASE_URL` | `<url>` | **Required.** Alias `WORDPRESS_SITE_URL`. |
| `WP_ADMIN_USER` | `<secret>` | **Required.** Alias `WORDPRESS_APP_USERNAME`. Confirm whether this is a dedicated `wp-agent5` user (design §1) or shared. |
| `WP_ADMIN_APP_PASSWORD` | `<secret>` | **Required.** Application password, not the login password. Alias `WORDPRESS_APP_PASSWORD`. |
| `WORDPRESS_SESSION_VERIFY_PATH` | `/wp-json/gracelyn/v1/verify-session` | Default. Confirm the real endpoint with Parmeet (hard stop 3). |
| `AMBASSADORS_MODULE_API_NAME` | `Ambassadors` | ✅ Confirmed live 2026-07-10 (`CustomModule37`). |
| `SUPPORT_TICKETS_MODULE_API_NAME` | `Support_Tickets` | ✅ Confirmed live 2026-07-10 (`CustomModule42`) — all nine SLA fields already present, matching Agent 4's expected names exactly (Coordination #2). Must match Agent 4 exactly. |
| `MAKE_ESCALATION_WEBHOOK_URL` | `<url>` | **Required.** Scenario 1 — escalation routing (design §9). |
| `SUPPORT_COORDINATOR_EMAIL` | `<email>` | **Required.** Standard-path escalation email + fallback-email recipient. |
| `VIP_MANAGER_EMAIL` | `<email>` | **Required.** Alias `VIP_RELATIONSHIP_MANAGER_EMAIL`. VIP escalation copy (Make.com side, design §9). |
| `PARMEET_ALERT_EMAIL` | `<email>` | **Required.** Receives all Agent 5 error alerts, sent directly via Zoho Mail. |

Canonical names are the source of truth in `functions/agent5/manifest.js`
(design-doc alias spellings are still accepted read-only). Full program-wide
list: `.env.example`.

## How to set them + deploy

**Recommended — Catalyst Console** (keeps secrets out of the repo entirely):
1. Catalyst Console → project **Ambassador-Scaling-Project** → Configurations →
   Environment Variables → add the values above.
2. From the repo: `cd functions/agent5 && npm install`
3. `catalyst deploy` (deploys the targets in `catalyst.json`: `agent5A`,
   `agent0`, `agent2`, `agent3`, `agent5`, `cliqSummaryFunction`).

**Alternative — `catalyst-config.json`** (per `CLAUDE.md`): put the values in
this function's `catalyst-config.json` `env_variables` **locally**,
`catalyst deploy`, then immediately
`git checkout functions/agent5/catalyst-config.json` so secrets never get
committed. The committed file must stay `"env_variables": {}`.

## After deploy

- **Make.com:** wire Scenario 1 (design §9) to `MAKE_ESCALATION_WEBHOOK_URL` —
  router on `is_urgent`, urgent path CCs `VIP_MANAGER_EMAIL` when `is_vip`, error
  path alerts `PARMEET_ALERT_EMAIL`.
- **WordPress:** wire the portal chat widget to `POST /chat` with
  `{ session_token, message_text, thread_id? }`.
- **Gate:** Agent 5A is the go/no-go gate; it verifies the live CRM fields and
  halts + alerts on any divergence. This build already confirmed Support_Tickets
  (all nine SLA fields) and the Ambassadors read fields live — no new fields
  were created.
- **Smoke check:** `GET /health` → `{ ok: true, agent: '5' }`.
