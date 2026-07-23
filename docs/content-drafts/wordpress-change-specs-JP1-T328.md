# WordPress Change Specs — JP1-T328

For Parmeet to implement (this is a spec, not a WordPress change itself — I
don't have WordPress access from this session). Pulled from what
`docs/design/Gracelyn_Agent_2_Onboarding_v2.md` and
`docs/design/Gracelyn_Agent_5_Support_v2.md` actually require of WordPress,
cross-checked against `docs/planning/Ambassador_Master_Reference_Sheet.md`'s
open reconciliation item on WordPress credentials.

## 1. Two application-password users (or one — needs a decision)

Both Agent 2 and Agent 5 need their own WordPress REST API application
password:

| Agent | User | Purpose |
| --- | --- | --- |
| Agent 2 | `wp-agent2` | Upgrade ambassador user role from `ambassador_applicant` to `ambassador_active` on compliance completion (design doc §Function D, step D4). |
| Agent 5 | `wp-agent5` | Verify ambassador session tokens are authenticated and have the `ambassador` role before answering a support question (design doc §4, step 3). |

**Open decision** (flagged in `Ambassador_Master_Reference_Sheet.md`, not yet
resolved): should these be two separate WordPress users, or one shared
service account used by both agents? Two separate users is more auditable
(you can tell which agent made which change in WordPress activity logs) and
follows least-privilege (Agent 5 only needs read/verify, Agent 2 needs
write/role-upgrade). Recommend keeping them separate unless there's a strong
reason not to.

**Action for Parmeet:** create both application passwords in WordPress admin
(Users → your user → Application Passwords), and provide them as
`WORDPRESS_APP_USERNAME` / `WORDPRESS_APP_PASSWORD` per agent (canonical env
var names, see each agent's `manifest.js`). These are application passwords,
not the login password, and should never be the same as anyone's personal
WordPress login.

## 2. Ambassador role upgrade capability (Agent 2)

Per the design doc, this logic is described as already existing ("the
existing Ambassador Program Implementation Blueprint Sections 5.2 through
5.8") — Agent 2 is calling into an existing role-gating system, not building
one from scratch. What needs confirming, not building:

- The `ambassador_applicant` and `ambassador_active` WordPress roles already
  exist and are distinct.
- The portal's referral-link display logic is already gated on role =
  `ambassador_active` (i.e., an applicant genuinely cannot see their referral
  link until upgraded).
- The `wp-agent2` application password has permission to change user roles
  via the REST API (`PATCH /wp/v2/users/{id}` with a `roles` field, or
  whatever the site's role-management plugin exposes — confirm which is in
  use).

**Action for Parmeet:** confirm the above three points are true in the live
site before Agent 2 deploys. If the role-gating logic does NOT already exist
(contradicting the design doc's assumption), that's a bigger, new build and
needs to be flagged back to the developer immediately, not discovered at
integration test time.

## 3. Portal chat widget (Agent 5) — this is genuinely new

Unlike Agent 2's role upgrade, there's no existing chat widget on the
ambassador portal today. This needs to be built:

- A chat widget embedded on the ambassador portal pages (likely the Dashboard
  Home, per the knowledge base draft's portal navigation answers).
- On submit, the widget POSTs to Agent 5's Catalyst function endpoint with:
  `session_token` (the WordPress session cookie/token), `message_text` (the
  ambassador's question, must enforce a 2,000-character client-side limit to
  match Agent 5's server-side validation), and optionally `thread_id` (for
  conversation continuity across messages in the same session).
- The widget renders Agent 5's JSON response: `response` (the answer text),
  and keeps `thread_id` for the next message in the same conversation.
- The widget must only be visible/functional to authenticated ambassadors
  (`ambassador_active` role) — same gating pattern as the referral link.

**Action for Parmeet:** confirm who builds this (a WordPress developer, not
Claude Code — this is front-end WordPress/JS work, not a Catalyst function).
This is the one item on this list that's a real net-new build, not a
configuration/confirmation task, so it likely needs the most lead time before
Week 2's end-to-end test (JP1-T336).

## 4. WorkDrive/WordPress folder-name reconciliation (informational)

Not a WordPress change, but adjacent: `Ambassador_Master_Reference_Sheet.md`
flags that some docs use `WORDPRESS_SITE_URL` / `WORDPRESS_APP_USERNAME` /
`WORDPRESS_APP_PASSWORD` inconsistently. Both Agent 2 and Agent 5's
`manifest.js` files are the reconciled source of truth for the canonical env
var names — use those, not the design docs' names, if they ever diverge.

## Summary checklist for Parmeet

- [ ] Decide: one shared WordPress service account, or `wp-agent2` +
      `wp-agent5` separate (recommend separate).
- [ ] Create application password(s), provide to developer as env vars.
- [ ] Confirm `ambassador_applicant` → `ambassador_active` role-gating already
      exists and works as the Agent 2 design doc assumes.
- [ ] Confirm which REST API call/plugin actually performs the role change,
      so Agent 2's implementation matches the live site.
- [ ] Scope and assign the net-new chat widget build (Agent 5) to whoever
      handles WordPress front-end work — this is not a Catalyst/backend task.
- [ ] Confirm the chat widget's placement/visibility gating matches the
      referral-link pattern (visible only to `ambassador_active`).
