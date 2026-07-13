# Agent 5 — Ambassador Support

The ambassador's first point of contact for support questions submitted
through the WordPress portal chat widget: verifies the ambassador's identity,
queries the OpenAI ambassador knowledge base, classifies the resolution tier,
writes a Support Ticket to CRM, and fires an escalation webhook for Tier 2 and
above. Built against `docs/design/Gracelyn_Agent_5_Support_v2.md`.

## What it does (design §4)

1. Validates the incoming payload (`session_token`, `message_text` present,
   message under 2,000 characters).
2. Refreshes the CRM, Mail, and WorkDrive OAuth tokens.
3. Verifies the WordPress portal session and extracts the ambassador's email.
4. Reads the Ambassador CRM record by email; if not `Active`, returns a
   support-contact message and writes a minimal ticket (no escalation).
5. Reads the two brand asset files from WorkDrive Folder 08 (continues with
   empty strings + a Parmeet alert if missing).
6. Creates or continues an OpenAI Assistants API thread.
7. Submits the message, polls the run to completion (2s interval / 15
   attempts default), and reads the assistant's response.
8. Classifies the tier (`classify.js`) — VIP always overrides to VIP Priority;
   otherwise Tier 3 (complex-matter signals in the question), Tier 2
   (escalation signals in the response, or "speak to a person" in the
   question), else Tier 1.
9. Writes the Support Ticket CRM record with the nine SLA-relevant fields
   Agent 4 also depends on (all seven Agent 5 writes; `SLA_Breached` and
   `Resolution_SLA_Breached` are never touched — Agent 4 owns those
   exclusively).
10. For Tier 2+/VIP: fires the Make.com escalation webhook (one retry after
    30s); if both attempts fail, sends a fallback email directly to the
    support coordinator via Zoho Mail and alerts Parmeet.
11. Returns `{ success, response, thread_id, ticket_id }` to WordPress.

## CRM reconciliation (confirmed live 2026-07-10)

Per `docs/planning/ClaudeCode_Zoho_API_Names_Instruction.md`, both modules were
pulled live before any code was written:

- **Support Tickets** — existing custom module **`Support_Tickets`**
  (`CustomModule42`). All nine SLA fields Agent 4 also depends on
  (Coordination #2) were **already present, with api_names, data types, and
  picklist values matching `functions/agent5A/manifest.js` `CRM_FIELDS.supportTickets`
  exactly** — no fields created, no divergence. `Ticket_Tier` picklist values
  (`Tier 1`/`Tier 2`/`Tier 3`/`VIP Priority`), `Issue_Category`
  (`Payment`/`Compliance`/`Referral Tracking`/`Portal Access`/`Recruiting`/`Other`),
  `Resolution_Complexity` (`Simple`/`Moderate`/`Complex`), and `Resolution_Status`
  (`Resolved`/`Escalated`/`Failed`) all match the design doc's controlled
  vocabularies. Coordination #3 (`escalation_timestamp` webhook field ==
  `Escalation_Timestamp` CRM field, exactly) is satisfied by construction: both
  are written from the same generated ISO timestamp in `pipeline.js`.
- **Ambassadors** — existing custom module **`Ambassadors`** (`CustomModule37`,
  already reconciled by Agent 2). Agent 5 reads `VIP_Flag`, `Ambassador_Status`
  (design doc's generic "Status" — value `Active`), `Ambassador_Role_Category`
  (design doc: `Role_Category`), `Motivation_Tag`, `Referral_Link`,
  `Referral_Code`, `First_Name`, and `Name` (label "Last Name" — the ambassador's
  full name is `First_Name + ' ' + Name`). No fields created; this is a
  read-only agent on Ambassadors.

The full maps are `functions/agent5/manifest.js` → `SUPPORT_TICKET_FIELDS` /
`AMBASSADOR_FIELDS`. At startup, every `/chat` call resolves both module
api_names live and cross-checks the fields this agent writes (plus the full
nine-field SLA coordination set) against Zoho's fields metadata, alerting
Parmeet on any divergence — see `index.js` → `resolveContext`.

## Routes

```
POST /chat     WordPress portal chat widget — { session_token, message_text, thread_id? }
GET  /health   liveness
```

## Environment variables

Canonical names (aliases accepted for design-doc spellings) — see `DEPLOY.md`
for the full table and the three pre-deploy hard stops.

- **AI:** `OPENAI_API_KEY`, `OPENAI_AMBASSADOR_ASSISTANT_ID` (canonical — not
  `OPENAI_ASSISTANT_ID`), `OPENAI_POLL_INTERVAL_MS` (2000),
  `OPENAI_POLL_MAX_ATTEMPTS` (15)
- **Zoho CRM:** `ZOHO_CRM_*` trio
- **Zoho Mail:** `ZOHO_MAIL_*` trio + `ZOHO_MAIL_ACCOUNT_ID` (not in the design
  doc's env table) + `AMBASSADOR_MAIL_FROM_ADDRESS` — fallback escalation email only
- **Zoho WorkDrive:** `ZOHO_WORKDRIVE_*` trio, `WORKDRIVE_FOLDER_08_ID`
- **WordPress:** `WORDPRESS_API_BASE_URL` (alias `WORDPRESS_SITE_URL`),
  `WP_ADMIN_USER` (alias `WORDPRESS_APP_USERNAME`), `WP_ADMIN_APP_PASSWORD`
  (alias `WORDPRESS_APP_PASSWORD`), `WORDPRESS_SESSION_VERIFY_PATH`
- **CRM modules:** `AMBASSADORS_MODULE_API_NAME`, `SUPPORT_TICKETS_MODULE_API_NAME`
- **Make.com / alerts:** `MAKE_ESCALATION_WEBHOOK_URL`, `SUPPORT_COORDINATOR_EMAIL`,
  `VIP_MANAGER_EMAIL` (alias `VIP_RELATIONSHIP_MANAGER_EMAIL`), `PARMEET_ALERT_EMAIL`

## Known scope decisions / gaps

- **WordPress session verification endpoint is a build-time seam.** The design
  doc's Step 3 says only "call WordPress REST API with session_token" without
  naming a concrete endpoint, and its own §1 hard stop says not to build until
  Parmeet confirms the existing chat/session implementation. `wordpress.js`
  calls a configurable REST path (`WORDPRESS_SESSION_VERIFY_PATH`) expecting
  `{ valid, email, role }` rather than guessing at WordPress internals — confirm
  the real endpoint before deploying (see `DEPLOY.md`).
- **`First_Response_Timestamp` is not written by this build.** Design §7 says
  it's "written by coordinator or Agent 5 when first human response is sent" —
  but the design's Process Steps (§4) only cover ticket creation, with no route
  or trigger described for a subsequent human-response event. The field exists
  live and is verified present; wiring a write path for it is left for a
  follow-up once that trigger is defined (e.g., a Zoho Flow on a coordinator
  reply, similar to Agent 2's Function D pattern).
- **§5.1 vs §11.1 test-table inconsistency on issue-category classification.**
  Design §11.1 names `"Why can't I see my referral link?"` as the Compliance
  classification example, but none of §5.1's Compliance keywords match that
  literal question — only `link` matches, which is a Referral Tracking keyword.
  Implemented §5.1's keyword table faithfully (see `classify.js` /
  `__tests__/agent5.test.js`) rather than special-casing the §11.1 example.
- **VIP override on the OpenAI-failure fallback ticket** is an interpretation:
  design §10's failure table just says "create Tier 2 escalation ticket" for
  OpenAI failures, without mentioning VIP. Since §5's VIP override is
  "regardless of question complexity," `pipeline.js` applies it here too (a VIP
  ambassador's fallback ticket is tier `VIP Priority`, not `Tier 2`) for
  consistency with the rest of the tier logic.

## Local test

```bash
node __tests__/agent5.test.js   # no network, no deps, no secrets
```

25 cases: tier/issue-category/complexity classification, the escalation
payload's ten fields, session-verification gating, the Tier 1/2/3/VIP
ticket-write paths (with the Escalation_Timestamp == webhook
escalation_timestamp exactness check), the OpenAI-timeout fallback ticket, the
inactive-ambassador minimal ticket, webhook-retry-then-fallback-email, and that
`SLA_Breached` / `Resolution_SLA_Breached` are never written.

## Files

- `manifest.js` — env-var spec, live-reconciled Support Tickets/Ambassadors
  field names, controlled vocabularies, classification signal lists, the
  §10.1 fixed response bodies.
- `classify.js` — pure tier / issue-category / resolution-complexity
  classification (design §5, §5.1, §6.1).
- `escalation.js` — the ten-field escalation webhook payload builder (§6.1).
- `zoho.js` — CRM metadata + records (module/field resolution, search, create).
- `mail.js` — Zoho Mail sender (fallback escalation email only).
- `workdrive.js` — brand-asset reader (Folder 08).
- `wordpress.js` — portal session verification (build-time seam; see gaps above).
- `openai.js` — Assistants API v2 client: thread/message/run + poll-to-completion,
  and the high-level `runAssistantTurn` used by the pipeline.
- `webhooks.js` — Make.com delivery with one retry.
- `alerts.js` — Parmeet alert formatting + delivery (direct via Zoho Mail).
- `pipeline.js` — `handleChatMessage`, the full 11-step orchestration.
- `index.js` — Express app; resolves + verifies CRM names live on every request.
