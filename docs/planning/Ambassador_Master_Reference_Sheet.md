# Ambassador Program — Master Reference Sheet

**This is the one document every Claude Code session reads from and every UI task writes into.** Keep it open for the entire build. As you create each folder, form, and credential, record the confirmed value here. Field API names are **not** transcribed here on purpose — per the Zoho API Names instruction, Claude Code pulls those live from Zoho and Agent 5A confirms them.

Status legend: ⬜ not started · 🟡 in progress · ✅ confirmed

---

## 1. Reconciled environment variables

The source documents use conflicting names for several credentials. **Pick the canonical name below, set exactly that string in Catalyst, and use it in every agent AND in the Agent 5A validation list.** Aliases are the other spellings found in the docs — do not create both.

### Credentials with naming conflicts to resolve first

| Purpose | Canonical name (use this) | Alias in docs (do NOT use) | Value / status |
|---|---|---|---|
| Anthropic API key (model `claude-sonnet-4-20250514`) | `ANTHROPIC_API_KEY` | `CLAUDE_API_KEY` (Agent 5A doc) | ⬜ |
| OpenAI ambassador assistant ID | `OPENAI_AMBASSADOR_ASSISTANT_ID` | `OPENAI_ASSISTANT_ID` (Agent 5 doc) | ⬜ |
| Dr. Flippen HeyGen avatar ID | `HEYGEN_FLIPPEN_AVATAR_ID` | `HEYGEN_AVATAR_ID` (tool accounts) | ⬜ |
| Meta Ads access token | `META_ADS_ACCESS_TOKEN` | `META_ACCESS_TOKEN` (tool accounts) | ⬜ |
| Ad spend threshold | decide: one combined `AGENT1C_DAILY_SPEND_THRESHOLD` **or** split `META_DAILY_SPEND_THRESHOLD` + `GOOGLE_DAILY_SPEND_THRESHOLD` | mixed across docs | ⬜ |

> The spend-threshold conflict is conceptual, not just naming: the policy table defines one combined Meta+Google limit, while Agent 5A expects separate Meta and Google limits. Decide which model Agent 1C uses and make the docs agree before 5A runs.

### Zoho OAuth (client id / secret / refresh token each)

| Service | Variables | Status |
|---|---|---|
| Zoho CRM | `ZOHO_CRM_CLIENT_ID`, `ZOHO_CRM_CLIENT_SECRET`, `ZOHO_CRM_REFRESH_TOKEN` | ⬜ |
| Zoho Mail | `ZOHO_MAIL_CLIENT_ID`, `ZOHO_MAIL_CLIENT_SECRET`, `ZOHO_MAIL_REFRESH_TOKEN` | ⬜ |
| Zoho WorkDrive | `ZOHO_WORKDRIVE_CLIENT_ID`, `ZOHO_WORKDRIVE_CLIENT_SECRET`, `ZOHO_WORKDRIVE_REFRESH_TOKEN` | ⬜ |
| Zoho Forms | `ZOHO_FORMS_CLIENT_ID`, `ZOHO_FORMS_CLIENT_SECRET`, `ZOHO_FORMS_REFRESH_TOKEN` | ⬜ |
| Zoho Books | `ZOHO_BOOKS_ORGANIZATION_ID`, `ZOHO_BOOKS_CLIENT_ID`, `ZOHO_BOOKS_CLIENT_SECRET`, `ZOHO_BOOKS_REFRESH_TOKEN` | ⬜ |
| Zoho Social | `ZOHO_SOCIAL_PORTAL_ID` | ⬜ |

> Add the settings read scope (`ZohoCRM.settings.READ`) to the CRM credential so Claude Code can pull module/field metadata.

### Payments

| Provider | Variables | Status |
|---|---|---|
| Wise ⏰ | `WISE_API_TOKEN`, `WISE_PROFILE_ID` | ⬜ |
| Tremendous ⏰ | `TREMENDOUS_API_KEY`, `TREMENDOUS_FUNDING_SOURCE_ID` | ⬜ |
| PayPal | `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | ⬜ |

### Other third-party APIs

| Tool | Variables | Status |
|---|---|---|
| OpenAI | `OPENAI_API_KEY` (+ `OPENAI_AMBASSADOR_ASSISTANT_ID` above), `OPENAI_POLL_INTERVAL_MS` (2000), `OPENAI_POLL_MAX_ATTEMPTS` (15) | ⬜ |
| HeyGen | `HEYGEN_API_KEY`, `HEYGEN_TEMPLATE_ID` (+ avatar id above) | ⬜ |
| Ayrshare | `AYRSHARE_API_KEY` | ⬜ |
| Google Ads | `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN`, `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CUSTOMER_ID` | ⬜ |
| Meta Ads | `META_APP_ID`, `META_APP_SECRET`, `META_AD_ACCOUNT_ID` (+ token above) | ⬜ |

### WordPress

`WORDPRESS_API_BASE_URL`, `WP_ADMIN_USER`, `WP_ADMIN_APP_PASSWORD` (application password, not login), `AMBASSADOR_PORTAL_URL`, `AMBASSADOR_PORTAL_CHAT_URL` — ⬜

> Some agent docs use `WORDPRESS_SITE_URL` / `WORDPRESS_APP_USERNAME` / `WORDPRESS_APP_PASSWORD` and a per-agent user (`wp-agent2`, `wp-agent5`). Reconcile to one set of names and confirm whether each agent uses its own WordPress user or a shared one.

### Make.com webhook URLs (record after building each scenario)

`MAKE_AGENT0_COMPLETE_WEBHOOK_URL`, `MAKE_AGENT0_ONDEMAND_WEBHOOK_URL`, `MAKE_VIP_NOTIFY_WEBHOOK_URL`, `MAKE_AGENT1A_WEBHOOK_URL`, `MAKE_AGENT1A_FROM_1D_WEBHOOK_URL`, `MAKE_AGENT1B_WEBHOOK_URL`, `MAKE_AGENT1C_WEBHOOK_URL`, `MAKE_AGENT1D_WEBHOOK_URL`, `MAKE_AGENT3_WEBHOOK_URL`, `MAKE_VIP_MANAGER_NOTIFY_WEBHOOK_URL`, `MAKE_COORDINATOR_QUEUE_WEBHOOK_URL`, `MAKE_SPEND_ALERT_WEBHOOK_URL`, `MAKE_SPEND_CONFIRM_WEBHOOK_URL`, `MAKE_KILL_SWITCH_ALERT_WEBHOOK_URL`, `MAKE_CAMPAIGN_RESTART_WEBHOOK_URL`, `MAKE_FEE_PAYMENT_CONFIRM_WEBHOOK_URL`, `MAKE_ESCALATION_WEBHOOK_URL` — ⬜

### Alert emails

`SUPPORT_COORDINATOR_EMAIL`, `VIP_MANAGER_EMAIL`, `PARMEET_ALERT_EMAIL` — ⬜

---

## 2. WorkDrive folder IDs (capture by hand)

| Variable | Folder | ID | Link | Status |
|---|---|---|---|---|
| `WORKDRIVE_FOLDER_01_ID` | 01 Applications | `unrxh653f5e303ed149c3817d5aba432a5dee` | https://workdrive.zoho.com/folder/unrxh653f5e303ed149c3817d5aba432a5dee | ✅ |
| `WORKDRIVE_FOLDER_02_ID` | 02 Approved Social Content | `unrxh6db6782ab5c942e5888f3ae852f9db77` | https://workdrive.zoho.com/folder/unrxh6db6782ab5c942e5888f3ae852f9db77 | ✅ |
| `WORKDRIVE_FOLDER_03_ID` | 03 Ambassador Welcome Kits | `unrxh44c35ddd817845bbbd90e0b23ad7dd8f` | https://workdrive.zoho.com/folder/unrxh44c35ddd817845bbbd90e0b23ad7dd8f | ✅ |
| `WORKDRIVE_FOLDER_04_ID` | 04 Content Calendar Assets | `unrxh9abb44ede108493dabf39d170dcfc872` | https://workdrive.zoho.com/folder/unrxh9abb44ede108493dabf39d170dcfc872 | ✅ |
| `WORKDRIVE_FOLDER_05_ID` | 05 Story Files | `unrxhf7b490a6610c4a33bcb333bf64381a29` | https://workdrive.zoho.com/folder/unrxhf7b490a6610c4a33bcb333bf64381a29 | ✅ |
| `WORKDRIVE_FOLDER_06_ID` | 06 Lead Magnets | `unrxha083e89a4c5c4f6ba2f471ca281877ba` | https://workdrive.zoho.com/folder/unrxha083e89a4c5c4f6ba2f471ca281877ba | ✅ |
| — | 06 / k12-educator | `unrxh5135bf06592c4c8c984d96fea5ef2aff` | https://workdrive.zoho.com/folder/unrxh5135bf06592c4c8c984d96fea5ef2aff | ✅ |
| — | 06 / early-childhood | `unrxh3de6fa6bf4934870ad72ad50cfd5e76a` | https://workdrive.zoho.com/folder/unrxh3de6fa6bf4934870ad72ad50cfd5e76a | ✅ |
| — | 06 / faith-community | `unrxhe2fafc74f0be4939ad46f539f7c2d1c7` | https://workdrive.zoho.com/folder/unrxhe2fafc74f0be4939ad46f539f7c2d1c7 | ✅ |
| — | 06 / youth-serving | `unrxh351bad2a57bb49e1bafd64ff4f29f70d` | https://workdrive.zoho.com/folder/unrxh351bad2a57bb49e1bafd64ff4f29f70d | ✅ |
| `WORKDRIVE_FOLDER_07_ID` | 07 Analytics and Reports | `unrxh155ff62f74eb4018b0038fad6ee0437e` | https://workdrive.zoho.com/folder/unrxh155ff62f74eb4018b0038fad6ee0437e | ✅ |
| `WORKDRIVE_FOLDER_08_ID` | 08 Brand Assets | `unrxh7fa66c36a3874908a1f280237e52a815` | https://workdrive.zoho.com/folder/unrxh7fa66c36a3874908a1f280237e52a815 | ✅ |
| `WORKDRIVE_FOLDER_09_ID` | 09 VIP Prospect Briefings | `unrxhde78f41305d1413f9e841948efecc3ae` | https://workdrive.zoho.com/folder/unrxhde78f41305d1413f9e841948efecc3ae | ✅ |

Folders 06, 08, 09 live at WorkDrive → General → Operations → Ambassador Scaling Project
(parent folder `unrxhcee68ae9c260486e81ed8aee8db218e2`, https://workdrive.zoho.com/folder/unrxhcee68ae9c260486e81ed8aee8db218e2, created 2026-07-08).

---

## 3. Zoho Form IDs (capture by hand)

| Variable / use | Form | ID | Status |
|---|---|---|---|
| `AMBASSADOR_FORM_ID` | Ambassador Application | | ⬜ |
| — | Combined Compliance | | ⬜ |
| — | Win-Back Survey | | ⬜ |
| — | Story Content Intake | | ⬜ |
| `LEAD_CAPTURE_FORM_IDS` → k12 | Lead Capture K12 Educator | | ⬜ |
| `LEAD_CAPTURE_FORM_IDS` → ec | Lead Capture Early Childhood | | ⬜ |
| `LEAD_CAPTURE_FORM_IDS` → faith | Lead Capture Faith Community | | ⬜ |
| `LEAD_CAPTURE_FORM_IDS` → youth | Lead Capture Youth Serving | | ⬜ |

Also record: `AMBASSADOR_FORM_BASE_URL`, and `LEAD_MAGNET_MAP` (each `lead_magnet_id` → WorkDrive file path).

---

## 4. CRM module API names

Confirm each **from Zoho** (`GET /crm/v6/settings/modules`) — do not assume the label equals the API name.

| Variable | Module | Confirmed API name | Status |
|---|---|---|---|
| `AMBASSADORS_MODULE_API_NAME` | Ambassadors (extended) | | ⬜ |
| `PROSPECTS_MODULE_API_NAME` | Prospects (new) | | ⬜ |
| `SUPPORT_TICKETS_MODULE_API_NAME` | Support Tickets (new) | | ⬜ |
| `REFERRALS_MODULE_API_NAME` | Referrals (renamed from Commissions) | | ⬜ |
| `ACTIVITY_LOG_MODULE_API_NAME` | Ambassador Activity Log (new) | | ⬜ |
| `AD_CAMPAIGN_LOG_MODULE_API_NAME` | Ad Campaign Log (new) | | ⬜ |
| `SOCIAL_POST_LOG_MODULE_API_NAME` | Social Post Log (new) | | ⬜ |
| `PARA_DB_MODULE_NAME` | Paraprofessional DB | | ⬜ |
| `STUDENT_ALUMNI_MODULE` | Student / Alumni | | ⬜ |

**Field API names:** pulled live from Zoho by Claude Code (`GET /crm/v6/settings/fields?module=X`) and confirmed by Agent 5A. Verify `Bank_Account_Routing` and `Bank_Account_Number` return as **encrypted** type.

---

## 5. Policy thresholds (Dr. Flippen confirms)

| Env variable | Value |
|---|---|
| `APPROVAL_MODE` | MANUAL (flip to AUTO at 1,000) |
| `ACTIVE_AMBASSADOR_THRESHOLD_ALERT` | 800 |
| `ACTIVE_AMBASSADOR_THRESHOLD_AUTO` | 1,000 |
| `NON_REFERRAL_DAYS_THRESHOLD` | 90 |
| `DORMANT_DAYS_THRESHOLD` | 30 |
| `VIP_HIGH_PCT_SMALL` / `VIP_STD_PCT_SMALL` | 2.5% / 5% |
| `VIP_HIGH_PCT_LARGE` / `VIP_STD_PCT_LARGE` | 0.5% / 2.5% |
| `VIP_POPULATION_THRESHOLD` | 10,000 |
| `VIP_AUDIT_TOLERANCE_PCT` | 10% |
| `STORY_BUFFER_MINIMUM` | 4 |
| `WEEKLY_BATCH_SIZE` | 100 |
| `MISSION_KEYWORDS` | Dr. Flippen defines |
| `SLA_TIER2_FIRST_RESPONSE_HOURS` | 24 |
| `SLA_VIP_FIRST_RESPONSE_HOURS` | 4 |
| `SLA_TIER2_RESOLUTION_HOURS` | 72 |
| `SLA_VIP_RESOLUTION_HOURS` | 24 |
| `AGENT1C_DAILY_SPEND_THRESHOLD` | Dr. Flippen sets (see spend-threshold note in §1) |

Dr. Flippen sign-off: ______________________  Date: __________

---

## 6. Human role assignments (fill before launch)

| Role | Person | Status |
|---|---|---|
| Human Coordinator | Parmeet Kaur | ✅ |
| Ambassador Support Coordinator | | ⬜ blocking for Agent 5 |
| VIP Relationship Manager | | ⬜ blocking for Agent 3 VIP |
| International Payment Handler | Parmeet (initially) | 🟡 |
| HeyGen script approver | Dr. Flippen | ✅ |

---

## 7. The three silent-failure checks (confirm before CRM logic is written)

1. `ROLE_CATEGORY` header label — identical between Agent 3 and Agent 6, second line of every story file.
2. Nine Support Tickets SLA field API names — identical between Agent 4 and Agent 5.
3. `escalation_timestamp` webhook string == `Escalation_Timestamp` CRM value, exactly.
