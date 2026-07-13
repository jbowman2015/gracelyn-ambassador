Subject: Sign-off needed — 3 policy values before Ambassador Scaling go-live (JP1-T320)

Dr. Flippen, Parmeet —

Quick update first: APPROVAL_MODE is resolved — since we already auto-approve ambassadors
once they sign compliance documents and complete training, there's no MANUAL phase to start
in, so this launches as APPROVAL_MODE=AUTO from day one. That also makes the 1,000-ambassador
threshold moot (it only mattered as a MANUAL→AUTO switch trigger, and there's no switch to
make). Both are updated in the repo and the Zoho board.

Three environment variables still need your sign-off before they can ship:

**For Dr. Flippen — 2 program-policy thresholds:**

| # | Variable | Proposed value | What it controls |
|---|---|---|---|
| 3 | `NON_REFERRAL_DAYS_THRESHOLD` | **90 days** | How long an ambassador can go without a referral before Agent 3 moves them to the "Alternative" engagement track |
| 4 | `DORMANT_DAYS_THRESHOLD` | **30 days** | How long with no activity before Agent 3 flags an ambassador dormant and starts re-engagement |

Reply with "approved" or tell me what to change for each.

**For Parmeet — 1 keyword list you'll own and can update anytime without a code change:**

| # | Variable | Proposed starting list | What it controls |
|---|---|---|---|
| 5 | `MISSION_KEYWORDS` | vulnerable children, teacher development, educational equity, faith educator, underserved students, teacher shortage, paraprofessional, early childhood, foster care, mission-driven education | Agent 1B scans VIP prospects' social posts for these terms and fires a "warm follow" alert to the relationship manager when a match hits during an active outreach window |

This list came from your own Agent 1B design doc as a starting point — add, remove, or replace
any of these. It's a plain comma-separated Catalyst env var, so once it's set you can edit it
yourself going forward.

Once I have both replies I'll record the confirmed values, close out JP1-T320, and this stops
blocking the Week 2 deploy gate.

Thanks,
[your name]
