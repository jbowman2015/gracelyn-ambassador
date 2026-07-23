# Content Audit — JP1-T307

Audits what Gracelyn already has against the "three content needs" defined in
`docs/design/1__Gracelyn_Ambassador_Project_Kickoff.html` (Step 1): Folder 08
brand assets, Folder 06 lead magnets, and the Agent 5 knowledge base.

Audited 2026-07-14 against the repo's `docs/brand/` and `docs/design/` contents
(the only source I can check directly — WorkDrive itself isn't connected in
this session, so I can't confirm what's actually uploaded there yet).

## 1. Folder 08 brand assets

Kickoff doc names four required files: voice guidelines, copy rules, program
descriptions, update brief.

| File | Status |
| --- | --- |
| Voice guidelines | ✅ Exists — `docs/brand/ambassador_voice_guidelines__1_.txt` |
| Copy rules | ✅ Exists — `docs/brand/ambassador_copy_rules__1_.txt` |
| Program descriptions | ✅ Exists — `docs/brand/ambassador_program_descriptions__1_.txt` |
| Update brief | ❌ **Gap** — no `update_brief.txt` anywhere in the repo |

**One genuine gap, not four.** The kickoff doc's "draft 4 Folder 08 files" framing
assumed none existed; three are actually already written and just need to be
uploaded to WorkDrive Folder 08 once it's created. I've drafted the missing
fourth file: `docs/content-drafts/folder08-update_brief.txt` (see that file for
notes on how Parmeet should keep it current — it's meant to be refreshed
periodically, not a one-time deliverable, since Agent 3's Week 4 email reads it
fresh each cycle per `docs/design/Gracelyn_Agent_3_Engagement_v2.md` §5.2).

Bonus asset found, not one of the four named but clearly part of the same
brand system: `docs/brand/ambassador_motivation_frames__1_.txt` (the five
motivation-tag framing guide — Professional Growth, Mission Impact, Kingdom
Calling, Recognition, Pride and Gratitude). Worth uploading to Folder 08
alongside the four named files even though the kickoff doc didn't call it out.

## 2. Folder 06 lead magnets

Kickoff doc: one resource per audience track (K-12 educator, early childhood,
faith community, youth-serving professional), predicting K-12 and faith
already exist and early childhood + youth-serving are gaps.

I can't verify K-12/faith community status — those would be actual PDF/resource
files living in WorkDrive or Gracelyn's existing marketing materials, not
anything in this git repo. **Jessica/Parmeet need to confirm what already
exists before anyone drafts K-12 or faith community pieces from scratch**, to
avoid duplicating real assets.

What I *can* act on without that confirmation: the kickoff doc's own
prediction that early childhood and youth-serving are gaps matches exactly
what JP1-T313 already assumes ("two likely-missing pieces"). I've drafted both:
- `docs/content-drafts/folder06-early-childhood-educator-lead-magnet.md`
- `docs/content-drafts/folder06-youth-serving-professional-lead-magnet.md`

Each is framed to the matching motivation type from `ambassador_motivation_frames__1_.txt`
(early childhood → Recognition; youth-serving → Mission Impact) and follows
`ambassador_copy_rules__1_.txt` (no "commission," no em dashes, mission before
fee, no admissions-counseling language).

**Open item, needs Jessica:** confirm whether K-12 educator and faith community
resources already exist somewhere (physical/digital) before Week 2, since
`docs/design/Gracelyn_Agent_1D_Lead_Capture_v2.md` §Pre-Launch Checklist
requires at least one resource per track before Agent 1D can go live — all
four, not just two.

## 3. Agent 5 knowledge base

Kickoff doc names three sources: Ambassador Agreement v2.0, Payment Policy
v2.0, and "Training Guide."

| Source | Status |
| --- | --- |
| Ambassador Agreement v2.0 | ✅ `docs/design/Gracelyn_Ambassador_Agreement_v2.md` |
| Payment Policy v2.0 | ✅ `docs/design/Gracelyn_Payment_Policy_v2.md` |
| Training Guide | ✅ **Not actually missing** — it's Appendix B of the Ambassador Agreement doc ("Ambassador Training Guide Acknowledgment"), not a separate file. |

**No gap at all here** — all three named sources exist in the repo already,
just not in the Q&A format `docs/design/Gracelyn_Agent_5_Support_v2.md` §8
specifies (8 topic areas: referral tracking, referral fees, compliance and
portal, ambassador recruiting, international payment, program rules, portal
navigation, support and escalation). I've reformatted all three sources into
that structure: `docs/content-drafts/agent5-knowledge-base.md`.

**One real content gap inside the KB**, not a missing source doc: portal
navigation specifics (exact button/page names in the WordPress ambassador
portal — "Dashboard Home," "Referral Activity," "Account Settings" — are named
in the Agreement's Training Guide appendix and Payment Policy §4.3, so the KB
draft uses those) are as complete as the source documents allow. If the real
WordPress portal uses different page names, Parmeet needs to correct those
specific answers before sign-off — this is exactly the kind of accuracy gap
`Gracelyn_Agent_5_Support_v2.md`'s Knowledge Base Pre-Build Requirement warns
about.

## Summary

| Need | Kickoff doc assumed | Actually found |
| --- | --- | --- |
| Folder 08 (4 files) | 0 exist | 3 of 4 exist; 1 gap (drafted) |
| Folder 06 (4 tracks) | 2 exist, 2 gaps | Can't verify 2, drafted the 2 predicted gaps |
| Agent 5 KB (3 sources) | Sources exist, needs reformatting | Confirmed, reformatted |

The program has more brand/content infrastructure already in place than the
kickoff doc assumed. The real remaining work is narrower: one brand file, two
lead magnets (pending K-12/faith confirmation), and one reformatting pass —
all drafted in this folder.
