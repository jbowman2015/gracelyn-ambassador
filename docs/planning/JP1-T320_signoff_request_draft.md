Subject: Sign-off needed — 5 policy values before Ambassador Scaling go-live (JP1-T320)

Dr. Flippen, Parmeet —

Five environment variables control ambassador-facing behavior across the program and can't
ship with developer-guessed defaults. I've proposed values below (pulled from the design
docs) — I need an explicit yes/adjust on each before we lock them in and deploy.

**For Dr. Flippen — 4 program-policy thresholds:**

| # | Variable | Proposed value | What it controls |
|---|---|---|---|
| 1 | `APPROVAL_MODE` | **MANUAL** initially, flips to AUTO once we hit 1,000 active ambassadors | Whether Agent 2 auto-approves new ambassador applications or a human reviews each one |
| 2 | `ACTIVE_AMBASSADOR_THRESHOLD_AUTO` | **1,000** | The active-ambassador count that triggers the MANUAL → AUTO switch above |
| 3 | `NON_REFERRAL_DAYS_THRESHOLD` | **90 days** | How long an ambassador can go without a referral before Agent 3 moves them to the "Alternative" engagement track |
| 4 | `DORMANT_DAYS_THRESHOLD` | **30 days** | How long with no activity before Agent 3 flags an ambassador dormant and starts re-engagement |

Reply with "approved" or tell me what to change for each. (There's also an
`ACTIVE_AMBASSADOR_THRESHOLD_ALERT` = 800 — the "we're approaching the switch" warning — using
the same proposed-value pattern; flag if you want that one called out separately too.)

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
