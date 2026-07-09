# ⚠️ Deploying this function — read before running `catalyst deploy`

`catalyst-config.json`'s `env_variables` block is **pushed to Catalyst on every
deploy and REPLACES whatever is currently set there** — it does not merge. If you
deploy while that block is `{}` (the committed, safe-to-push state), it **wipes
the real secrets in Catalyst**, breaking the function silently until the next
deploy with real values. This has already happened once (Zoho `invalid_client`
failures on the nightly Cliq summary).

## Safe deploy sequence — follow every time

1. Fill in `env_variables` with the real values (get them from wherever you
   store them — do not invent placeholders):
   `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`,
   `ZOHO_CLIQ_WEBHOOK_TOKEN`, `ZOHO_CLIQ_CHANNEL`
2. `catalyst deploy`
3. **Verify it worked before doing anything else:**
   ```bash
   curl -X POST "<function URL>/daily-summary"
   ```
   Expect `{"success":true,"tasks":N}`. If you get `invalid_client` or any
   OAuth error, the env vars are wrong — fix and redeploy before proceeding.
4. Only after step 3 confirms success: `git checkout functions/cliqSummaryFunction/catalyst-config.json`
   to restore the safe `{}` state before committing anything.

**Never run `catalyst deploy` for this function while `env_variables` is `{}`** —
that step 4 file must only exist in that state between deploys, never during one.
