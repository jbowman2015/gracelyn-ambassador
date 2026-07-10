# Agent 6 — Deploy reference

The exact environment variables the `agent6` function needs, pre-staged for
the Week 2 deploy. **Secrets are placeholders — never commit real values**
(see repo convention in `CLAUDE.md` and `.env.example`).

## Environment variables

| Variable | Set to | Notes |
| --- | --- | --- |
| `ZOHO_WORKDRIVE_CLIENT_ID` | `<secret>` | WorkDrive OAuth. **Required.** Read-only (Folder 05 scan). |
| `ZOHO_WORKDRIVE_CLIENT_SECRET` | `<secret>` | **Required.** |
| `ZOHO_WORKDRIVE_REFRESH_TOKEN` | `<secret>` | **Required.** |
| `WORKDRIVE_FOLDER_05_ID` | `<folder id>` | **Required.** Must be the exact same folder id Agent 3 uses — confirm with the Agent 3 developer and Parmeet before setting. |
| `ZOHO_MAIL_CLIENT_ID` | `<secret>` | Mail OAuth. **Required.** Buffer alert emails only. |
| `ZOHO_MAIL_CLIENT_SECRET` | `<secret>` | **Required.** |
| `ZOHO_MAIL_REFRESH_TOKEN` | `<secret>` | **Required.** |
| `AMBASSADOR_MAIL_FROM_ADDRESS` | `ambassadors@gracelyn.edu` | Default; same address Agent 3 sends from. |
| `ZOHO_CRM_CLIENT_ID` | `<secret>` | **Optional.** Enables used-file exclusion in the buffer count (design §6). Needs Ambassadors read scope. |
| `ZOHO_CRM_CLIENT_SECRET` | `<secret>` | Optional. |
| `ZOHO_CRM_REFRESH_TOKEN` | `<secret>` | Optional. |
| `AMBASSADORS_MODULE_API_NAME` | `Ambassadors` | ✅ Confirmed live by the Agent 3 session (2026-07-10). |
| `STORY_BUFFER_MINIMUM` | `4` | Default. Parmeet may adjust without developer help. |
| `PARMEET_ALERT_EMAIL` | `<email>` | **Required.** Buffer alerts + Flow error notifications. |
| `STORY_INTAKE_FORM_URL` | `<url>` | **Required.** Included in every buffer alert. |
| `MAKE_BUFFER_ALERT_WEBHOOK` | `<url>` | Optional — buffer alert routing scenario. |
| `ZOHO_FLOW_ID` | `<id>` | Optional — documentation only; the Flow runs outside Catalyst. |

Canonical names are the source of truth in `functions/agent6/manifest.js`. Full
program-wide list: `.env.example`.

## Before deploying — confirm these first

1. **`WORKDRIVE_FOLDER_05_ID` matches Agent 3's value exactly.** If they
   diverge, Agent 6 counts a buffer nobody uses and Agent 3 reads from an
   empty folder — both fail silently. See `README.md` "Coordination gaps."
2. **The Zoho Forms Role Category dropdown uses the reconciled six-category
   vocabulary + `Any`** (not the design doc v2's stale five values) — see
   `README.md` for the full list. Parmeet configures this in Zoho Forms; it
   is not something this Catalyst function enforces.
3. **The Zoho Flow's Deluge script matches `filename.js` / `storyFile.js` /
   `intake.js`** — run the design doc §8.2 critical integration test with the
   Agent 3 developer present before relying on Agent 3's story selection.

## How to set them + deploy

**Recommended — Catalyst Console** (keeps secrets out of the repo entirely):
1. Catalyst Console → project **Ambassador-Scaling-Project** → Configurations →
   Environment Variables → add the values above.
2. From the repo: `cd functions/agent6 && npm install`
3. `catalyst deploy` (deploys the targets in `catalyst.json`).

**Alternative — `catalyst-config.json`** (per `CLAUDE.md`): put the values in
this function's `catalyst-config.json` `env_variables` **locally**,
`catalyst deploy`, then immediately `git checkout functions/agent6/catalyst-config.json`
so secrets never get committed. The committed file must stay
`"env_variables": {}`.

## After deploy

- **Job Scheduling:** configure the buffer-monitoring job in the Catalyst
  Console (Job Scheduling) to `POST /buffer-check` daily at **5:30 AM CST**
  (design §6) — before Agent 3's Monday 9:00 AM CST cycle.
- **Smoke check:** `GET /health` → `{ ok: true, agent: '6' }`.
- **Zoho Flow:** the story intake Flow itself is built and owned in Zoho One
  by Parmeet's team (design §5) — it is not part of this Catalyst deploy.
