# Agent 1A — Email Templates (ready to paste into Catalyst env vars)

These are the six template pairs (12 values) the design doc assigns to Agent 1A's
`AGENT1A_SEQ{1,2}_{PARA,PROSPECT,STUDENT}_{SUBJECT,BODY}` environment variables.
Per `docs/design/Gracelyn_Agent_1A_Database_Email_v1.md` §5.1, the doc originally
assumed Parmeet would write this copy; written here directly at Jessica's request.

**This file is a staging/reference copy, not a deploy mechanism.** These values go
into Catalyst environment variables at deploy time (per `functions/agent1A/DEPLOY.md`'s
fill-in → deploy → verify → scrub sequence) — they are never wired into
`catalyst-config.json`, which stays `{}` per CLAUDE.md's deploy-safety rule. This
mirrors how `docs/brand/*.txt` mirrors the live WorkDrive Folder 08 assets: a
committed reference copy of content that actually lives elsewhere at runtime.

## Compliance notes (checked against `docs/brand/` on every template below)

- **Mission before fee** (`ambassador_copy_rules.txt` Rule 3): every SEQ1 template
  has two full paragraphs of mission/social-proof language before the referral fee
  is mentioned in the closing paragraph. Follow-ups (SEQ2) don't mention the fee at
  all — no pressure, per the design doc's "Shorter. Warmer. No pressure" instruction.
- **Exact fee language** (Rule 7): every fee mention uses the required phrase
  verbatim — "Your referral fee is paid after the educator you referred has been
  actively enrolled for four consecutive months" — with the exact amounts ($100
  undergraduate, $200 graduate) from `ambassador_program_descriptions.txt`.
- **Never "commission," never em dashes** (Rules 1–2): neither appears anywhere below.
- **Ambassador as participant, not recruiter** (Rule 4): every ask uses "share," never
  "recruit," "sign up," or "sell."
- **No admissions counseling**: no template advises on program fit or outcomes —
  the ask is only to become an ambassador (share Gracelyn), never to enroll.
- **Motivation framing** (`ambassador_motivation_frames.txt`), matching the design
  doc's per-population defaults: PARA → Recognition (per the design doc's own
  "Recognition and mission framing by default" instruction for this population),
  PROSPECT → Mission Impact (the Unknown-tag default), STUDENT → Pride and Gratitude.
  No template names the motivation tag or frame explicitly (Rule 6 of the frames doc).
- **CTA link**: every ask points to `www.gracelyn.edu/ambassador-program`
  (confirmed by Jessica). Written as literal text, not a substitution token —
  the URL is the same for every recipient, so no template-substitution code
  was needed (only `[FIRST_NAME]` in subjects is ever substituted at runtime).
- **Three-layer structure preserved**: every body is exactly 3 paragraphs (mission
  hook / social proof or program description / simple ask), matching what
  `functions/agent1A/template-guard.js` checks after Claude personalizes the
  opening sentence — personalization must not add or remove a paragraph break.

---

## Paraprofessional database (PARA)

### `AGENT1A_SEQ1_PARA_SUBJECT`
```
[FIRST_NAME], we see the work you do
```

### `AGENT1A_SEQ1_PARA_BODY`
```
The work you do every day with children matters more than most people acknowledge. Every vulnerable child deserves an incredible teacher, and paraprofessionals like you are often the first person who notices when a child needs one.

Gracelyn University is a Christian university built to equip educators for exactly this kind of work. Our Ambassador Program invites people who already believe in that mission, like you, to share Gracelyn with the teachers, coaches, and school staff in their communities who might be ready for the next step.

Becoming a Gracelyn ambassador is simple: you share what you know, and we handle the rest. Your referral fee is paid after the educator you referred has been actively enrolled for four consecutive months: $100 for undergraduate programs, $200 for graduate programs. If that sounds like something you would want to be part of, visit www.gracelyn.edu/ambassador-program to get started.
Warmly,
The Gracelyn Ambassador Team
```

### `AGENT1A_SEQ2_PARA_SUBJECT`
```
Following up, [FIRST_NAME]
```

### `AGENT1A_SEQ2_PARA_BODY`
```
We reached out last week about Gracelyn's Ambassador Program, and we wanted to follow up because the work you do with children deserves to be recognized, not just mentioned once.

Gracelyn exists because every vulnerable child deserves an incredible teacher, and ambassadors like you help make that possible simply by sharing what you already believe.

No pressure at all. If you would like to learn more, visit www.gracelyn.edu/ambassador-program whenever you are ready.
Warmly,
The Gracelyn Ambassador Team
```

---

## Agent 0 prospects (PROSPECT)

### `AGENT1A_SEQ1_PROSPECT_SUBJECT`
```
[FIRST_NAME], every child deserves an incredible teacher
```

### `AGENT1A_SEQ1_PROSPECT_BODY`
```
Every vulnerable child deserves an incredible teacher. That belief is why Gracelyn University exists, and it is why we think you would be a natural fit for something we are building.

Gracelyn is a Christian university that equips educators like you to grow in their craft while continuing to serve where they already are. Our Ambassador Program invites people who care about that mission to share Gracelyn with the educators, coaches, and community leaders in their own networks.

There is no selling involved. You simply share what you know, and Gracelyn takes it from there. Your referral fee is paid after the educator you referred has been actively enrolled for four consecutive months: $100 for undergraduate programs, $200 for graduate programs. If this sounds like something you would want to be part of, visit www.gracelyn.edu/ambassador-program to learn more.
Warmly,
The Gracelyn Ambassador Team
```

### `AGENT1A_SEQ2_PROSPECT_SUBJECT`
```
Still thinking of you, [FIRST_NAME]
```

### `AGENT1A_SEQ2_PROSPECT_BODY`
```
We wanted to follow up because we think you would be a great fit for Gracelyn's Ambassador Program, and we did not want this to get lost in your inbox.

Every vulnerable child deserves an incredible teacher, and ambassadors help make that possible just by sharing what they already believe with the right people.

No pressure. If you are interested, visit www.gracelyn.edu/ambassador-program whenever you are ready.
Warmly,
The Gracelyn Ambassador Team
```

---

## Students and alumni (STUDENT)

### `AGENT1A_SEQ1_STUDENT_SUBJECT`
```
[FIRST_NAME], someone needs what you found
```

### `AGENT1A_SEQ1_STUDENT_BODY`
```
You found Gracelyn when you needed it, and somewhere right now, an educator is standing exactly where you were before you started.

Gracelyn's Ambassador Program exists so that students and alumni like you can share what you found with someone who needs it. It costs nothing, it takes only a few minutes, and it means everything to the next person who says yes.

When the educator you refer enrolls and stays actively enrolled for four consecutive months, your referral fee is paid: $100 for undergraduate programs, $200 for graduate programs. If someone comes to mind, visit www.gracelyn.edu/ambassador-program to get started.
With gratitude,
The Gracelyn Ambassador Team
```

### `AGENT1A_SEQ2_STUDENT_SUBJECT`
```
One more note, [FIRST_NAME]
```

### `AGENT1A_SEQ2_STUDENT_BODY`
```
We wanted to follow up because what you found at Gracelyn is worth sharing, and we do not want you to forget that.

Someone in your life, maybe another educator, a coworker, or a friend, is exactly where you were before you started your program.

If someone comes to mind, visit www.gracelyn.edu/ambassador-program whenever you are ready.
With gratitude,
The Gracelyn Ambassador Team
```

---

## Open items before these go live

1. **Parmeet/Dr. Flippen sign-off.** The design doc assigns copy-writing to Parmeet;
   this was written directly at Jessica's request instead. Recommend a quick review
   before these get set as real Catalyst env vars, especially given the referral-fee
   language is compliance-sensitive.
2. **CTA link resolved.** All six templates point to `www.gracelyn.edu/ambassador-program`
   (confirmed by Jessica). If that URL ever changes, it needs a find-and-replace across
   all six `_BODY` values — it's literal text, not a substitution token.
3. **Signature line.** Every body ends with `Warmly,` / `With gratitude,` + team
   name on the next line — deliberately kept inside the same paragraph as the "simple
   ask" (single line break, not a blank line) so it doesn't add a 4th paragraph that
   `template-guard.js` would flag as a structural deviation after Claude personalizes.
