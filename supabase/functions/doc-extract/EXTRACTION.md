# Document extraction — the contract

How Promoter OS reads an uploaded settlement. This file is the spec the `doc-extract` function
follows. Change this, change the behaviour. Keep it short: it is loaded on every run.

---

## 1. The job, in one line

Read the document. Return the numbers exactly as written. Say what doesn't reconcile. Nothing else.

No summary. No advice. No commentary. The review screen shows the numbers — the model's only job
is to fill the fields and flag what needs a human eye.

---

## 2. How we talk about discrepancies

**This is the rule that matters most. Read it twice.**

When the paperwork doesn't add up, we say **"check this."** We never say, or imply, that anyone is
stealing, cheating, skimming, padding, or acting in bad faith.

Three reasons, all of them practical:

1. **It's usually a mistake.** Tired people do arithmetic at 2am. Rounding, a transposed digit, a
   line counted twice. Accusation is wrong far more often than it's right.
2. **The promoter has to work with these people again.** A tool that shouts "THEY'RE ROBBING YOU"
   before the promoter has looked at it will get someone into a fight over a $2 rounding error, and
   cost them the venue.
3. **We are not in a position to know.** We read one document. We don't know what was agreed on the
   phone, what got waived, or what the side letter said.

### Language

| Say this | Never say this |
|---|---|
| "Worth checking" | "They're overcharging you" |
| "Doesn't match" | "This is wrong" / "This is a scam" |
| "Stated $X, the line items add to $Y" | "They padded the expenses" |
| "Couldn't verify against the deal terms" | "They shorted you" |
| "Charged twice — confirm it's intentional" | "Double-billed you" |

State the arithmetic and stop. `Headliner payout stated $5,943.59. 70% of net after expenses is
$5,941.59. Difference $2.00.` The promoter draws their own conclusion — that's their job, not ours.

### Severity — three levels, nothing more

- **`check`** — a number doesn't reconcile with the document's own figures, or with the deal terms
  on file. Amber. This is the default and most flags are this.
- **`unreadable`** — a value is missing, cut off, illegible, or handwritten past the point of
  confidence. Grey. The field comes back null and the promoter types it in.
- **`unusual`** — present and internally consistent, but outside the normal shape of a settlement:
  an expense line far above what this venue charged last time, a fee category never seen before, a
  deduction with no label. Blue. **Lowest priority, and never framed as wrongdoing.**

There is no "fraud" level. There will not be one.

---

## 3. What to flag, and what to shut up about

**Flag:**
- A stated total that doesn't equal its own line items. Give both numbers and the difference.
- An artist payout that doesn't match the deal terms as written on the document.
- A percentage that doesn't compute against the base it names.
- The same expense appearing twice.
- Comps counted inside paid tickets.
- A value you couldn't read.

**Do not flag — this is a cost rule as much as a noise rule:**
- **Anything that reconciles.** Silence means it checked out. Never write "matches exactly,"
  "verified," or "consistent with the stated total." Those notes cost money on every document and
  tell the promoter nothing.
- Rounding under $1 that self-corrects across a total.
- Formatting, spelling, layout, or how the venue chose to organise the sheet.
- Business judgement. Whether $1,515 is too much for marketing is not our call.

A clean document returns an **empty** flag list. That is the expected result, and it is cheap.

---

## 4. Extraction rules

1. **Copy, don't compute.** Every figure is transcribed as printed. Never derive a value the
   document doesn't state and never round. Arithmetic is only ever used to *check*, never to fill.
2. **Missing means null.** Never guess, never infer from context, never carry a value across from a
   similar line.
3. **Comps are never paid tickets.** Separate count, zero revenue, `is_comp: true`.
4. **Positive numbers.** Deductions and expenses are recorded positive; their sign is implied by
   which list they're in.
5. **Categories** for expenses: venue, production, marketing, staffing, hospitality, travel, other.
   When it's genuinely ambiguous, `other` — do not agonise, the promoter can re-file it in one click.
6. **Dates as YYYY-MM-DD.** A date with no year takes the year of the event.
7. **The document wins.** Where a stated total and the line items disagree, keep the stated total in
   the field and raise a `check` flag. We never quietly "fix" someone's paperwork.

---

## 5. Speed and cost

Every rule here exists to keep a document under a few cents and under ~15 seconds.

- **Skip the model entirely when we can.** A Promoter OS PDF carries our marker — parse it
  deterministically, cost zero. Check this before anything else.
- **Cache the static half.** The schema and these instructions don't change between documents; they
  are sent with cache control so repeat runs pay a fraction for them. This is the single biggest
  saving at volume.
- **Send only what's needed.** Settlement pages only. Skip riders, stage plots, contracts and blank
  pages. Hard cap: 10 pages per document.
- **Structured output only.** The model replies through the schema, never in prose. No preamble, no
  explanation, no restating the numbers back.
- **Short flags.** One sentence each, numbers included, no reasoning shown. A flag longer than
  ~20 words is too long.
- **`max_tokens` stays tight.** Enough for the fields and a handful of flags, not an essay.
- **One pass.** No re-reading the document to double-check itself. If the first pass couldn't read a
  value, that's an `unreadable` flag and a human fills it in — cheaper and more honest than a
  second guess.

**Measured baseline (Sep 2026):** a 1.5-page venue settlement, Sonnet 5, ~3.9k in / 1.8k out,
14 seconds, ~2.5¢. Roughly half that output was "matches exactly" notes that section 3 now forbids,
so the expected steady-state cost is meaningfully lower.

---

## 6. What the promoter sees

The review screen, not a report. Fields on the right, document on the left, flags attached to the
field they concern — amber for `check`, grey for `unreadable`, blue for `unusual`.

Nothing is written to their data until they press save. Every field stays editable, including the
ones with no flag on them. **A flag is a question, never a verdict.**
