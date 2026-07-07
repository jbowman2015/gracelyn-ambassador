# Instruction to Claude Code — Pull CRM field and module API names from Zoho directly

> **Where to place this:** Insert as a standalone section near the top of the System Architecture v3.0 and the Pre-Build Checklist v2.0, and paste it into every Claude Code session before it writes any CRM read/write logic. It applies to all agents that touch Zoho CRM.

---

## Authority rule

**Zoho CRM is the single source of truth for every module and field API name. The names written in these documents are a human-transcribed cross-check, not the authority.** Whenever the documents and the live Zoho org disagree, the value returned by Zoho's metadata API wins. Do not hardcode a field or module API name from a document without confirming it against Zoho first.

This exists because Zoho assigns API names itself when a field or module is created. It may lowercase, append a number (`Referral_Link1`), or otherwise diverge from what was typed in the UI. A single transcription error propagates into every CRM call for that field and fails silently.

---

## What to do

Before writing CRM logic for any agent, and again at deploy time, fetch the real API names directly from Zoho:

**Modules** — get the confirmed module API names:
```
GET https://www.zohoapis.com/crm/v6/settings/modules
```
Read `api_name` for each module (Ambassadors, Prospects, Support Tickets, Referrals, Activity Log, Ad Campaign Log, Social Post Log). Use these to populate `AMBASSADORS_MODULE_API_NAME`, `PROSPECTS_MODULE_API_NAME`, `SUPPORT_TICKETS_MODULE_API_NAME`, etc. — do not assume the label equals the API name.

**Fields** — for each module, get the confirmed field API names:
```
GET https://www.zohoapis.com/crm/v6/settings/fields?module={module_api_name}
```
Read the `api_name` (and `data_type`) for every field. Build your CRM calls against these values, not against the names in the docs.

Use the org's current Zoho API version (v6 shown; confirm with Parmeet if the org is on v2/v3). Authenticate with the standard Zoho OAuth refresh flow already used everywhere in this system. The metadata calls require a settings read scope — request `ZohoCRM.settings.READ` (or the narrower `ZohoCRM.settings.fields.READ` / `ZohoCRM.settings.modules.READ`) in addition to the module scopes already listed for each agent.

---

## Preferred build pattern

Do not scatter metadata calls through the codebase. Instead:

1. Write one small helper that fetches modules + fields metadata and produces a **verified name map** (label → confirmed `api_name`, plus `data_type`).
2. At build/deploy time, generate a constants file (or Catalyst environment values) from that map. All agents reference the constants, never a literal string typed from a document.
3. **Cross-check against the documents and fail loudly on any mismatch.** For every field an agent uses, compare the doc's expected API name to Zoho's actual `api_name`. If they differ, halt and report the exact field, the doc name, and the Zoho name. A mismatch is a setup error to surface, not something to silently paper over.

This turns the current "record every API name exactly by hand and hope" step into an automatic, verified reconciliation.

---

## Fold this into Agent 5A

Agent 5A is already the go/no-go validation gate. Extend it to:

- Pull modules + fields metadata for all seven CRM modules.
- Confirm every field name each agent depends on actually exists in Zoho with the expected `data_type` (in particular, verify `Bank_Account_Routing` and `Bank_Account_Number` are **encrypted** field types).
- Confirm the three silent-failure coordination fields exist and match: the nine Support Tickets SLA fields, `Escalation_Timestamp`, and the story-file `ROLE_CATEGORY` convention.
- Report any missing field, type mismatch, or name divergence before any production agent deploys.

If 5A can pull and confirm field names live, no developer ever has to trust a transcribed name again.

---

## Scope note — what this does and does not fix

This makes Zoho authoritative for **CRM module and field API names** only. It does **not** resolve third-party credential variable-name conflicts (e.g. `ANTHROPIC_API_KEY` vs `CLAUDE_API_KEY`, or `OPENAI_ASSISTANT_ID` vs `OPENAI_AMBASSADOR_ASSISTANT_ID`), because those are Catalyst environment variable names, not Zoho metadata. Pick one canonical string for each of those by hand and use it consistently across every agent and the 5A validation list.
