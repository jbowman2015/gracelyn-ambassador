# Agent 5A — Setup Validation (go/no-go gate)

The first thing that runs and the last gate before launch. It confirms every
credential, policy variable, CRM module/field, encryption requirement, and
cross-agent coordination field is actually in place — and reports exactly what
is missing. **Nothing deploys to production until 5A returns verdict `GO`.**

## What it checks

- **Environment variables** — every credential each agent depends on, using the
  canonical names (naming conflicts resolved in `manifest.js`). Make.com webhook
  URLs and Wise/Tremendous are `warn` so the gate can pass in Week 1 before those
  exist; PayPal and the rest are `critical`.
- **Policy thresholds** — presence of all 20 policy vars; value drift from the
  documented defaults is surfaced (⚠️) but does not block.
- **CRM modules** — resolves each module's real `api_name` live from Zoho
  (`GET /crm/v6/settings/modules`), preferring the env override, else matching by
  label; flags any divergence between the env var and Zoho.
- **CRM fields** — confirms every field the agents read/write exists on
  Ambassadors, Prospects, and Support Tickets (`GET /settings/fields`).
- **Encryption** — `Bank_Account_Routing` and `Bank_Account_Number` must be
  Zoho *encrypted* field types (hard fail otherwise — can't be retrofitted).
- **Coordination points** — the nine Support Tickets SLA fields and
  `Escalation_Timestamp` must exist (Agent 4 ↔ Agent 5 silent-failure guards).

## Verdict

`GO` when there are zero **critical** failures; `NO-GO` otherwise. Warnings and
value drift never block — they are listed for follow-up. HTTP is always 200; read
the `verdict` field, not the status code.

## Routes

```
POST /validate          → full JSON report { verdict, totals, blocking, warnings, drift, checks }
POST /validate?text=1   → same, plus a Cliq-ready text summary in .summary
GET  /validate          → JSON summary + text report (browser-friendly)
GET  /health            → liveness
```

## Required env (this function)

Agent 5A only needs the **Zoho CRM OAuth trio** to pull metadata:
`ZOHO_CRM_CLIENT_ID`, `ZOHO_CRM_CLIENT_SECRET`, `ZOHO_CRM_REFRESH_TOKEN`
(the refresh token must include `ZohoCRM.settings.READ`). Everything else it
merely checks for *presence* — those live on the other agents at runtime, but for
a meaningful gate they should be set in the same Catalyst environment.

## Local test

```bash
node __tests__/validate.test.js   # no network, no deps, no secrets
```

Covers: all-present → GO, missing critical → NO-GO, unencrypted bank field →
hard fail, missing SLA coordination field, module resolution by label, and
policy value drift.

## Files

- `manifest.js` — canonical expectations (env vars, modules, fields+types,
  policy, coordination). **This is the reconciled source of truth.**
- `zoho.js` — live CRM metadata fetch (modules + fields).
- `validators.js` — the checks.
- `index.js` — Express app + go/no-go report builder.
