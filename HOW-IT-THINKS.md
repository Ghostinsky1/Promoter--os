# How Promoter OS thinks — the guardrails

Every place the app draws a conclusion for a promoter follows this. It is written for whoever
touches the Deal Score, the settlement insights, the marketing budget, the bad-night test, the
document scanner, or anything that comes after them. Change this, change the behaviour.

Jose's ask, Sep 18 2026: "create how this thinks to give them guardrails, keeps us protected."

---

## 0. What is and isn't AI here

Be honest about this first, because the labels used to lie.

| Feature | What it actually is | Uses a model? |
|---|---|---|
| Deal Score | Arithmetic on the offer's own numbers | No |
| "What your settlements say" (was "AI Business Insights") | Arithmetic on the promoter's settled shows | No |
| Marketing budget | Arithmetic on the promoter's settled shows | No |
| Bad-night test (50% / 70%) | Arithmetic on the offer | No |
| Cash on hand | Arithmetic across live offers | No |
| Document scanner | Reads an uploaded PDF or photo into fields | **Yes** — the only one |

**Rule: nothing gets called "AI" unless a model is involved.** The word was on two features that
were plain arithmetic. It was removed from both. Arithmetic is better than AI for these jobs anyway:
it is free, instant, cannot invent a number, and gives the same answer twice.

---

## 1. Where every number comes from

**Every figure the app shows a promoter is either theirs or derived from theirs by stated
arithmetic.** Nothing is estimated from "industry norms," nothing is generated, nothing is filled in.

- The marketing rate ($2.05 a ticket) is what *their* shows cost. Not a benchmark.
- The Deal Score thresholds are fixed and written down. They do not learn or drift.
- The bad-night test moves each cost line the way that line actually behaves — rights fees
  follow the ticket count, the guarantee does not. It never scales a total.
- The document scanner **copies, never computes.** If the paper says $1,383.33 and the lines add
  to $1,883.33, the field says $1,383.33 and a flag says the two disagree. It never "fixes" a
  document.

**The money rules are fixed and the same everywhere** (offer page, PDF, settlement, dashboard,
the connector). Sales tax is added on top and is never the promoter's money — it is shown, never
subtracted. The facility fee is on top by default (the venue's) and can be switched to "inside the
price" per show. An artist's percentage and a door split are of what is left *after the promoter's
costs*, and can be switched to gross per show. The switch is always visible on the Artist Deal tab;
the app never picks a basis silently.

**When the app has no history, it says so.** "No settled shows yet — using a placeholder rate" is
the honest state, and the placeholder is labelled as one.

**A losing show does not set the target.** After Hours lost $1,153; it is excluded from the
marketing benchmark. What a night cost to sell on the nights that made money is evidence. What a
night cost on a room that was too expensive is not.

---

## 2. How it talks about problems

This is the rule that matters most and the one most likely to erode.

**The app says "check this." It never says, or implies, that anyone is stealing, cheating,
skimming, padding, or acting in bad faith.** Three reasons:

1. It is usually a mistake. Tired people do arithmetic at 2am.
2. The promoter has to work with these people again. A tool that shouts "THEY'RE ROBBING YOU" over
   a $2 rounding error costs them the venue.
3. The app sees one document, one offer. It does not know what was agreed on the phone.

| Say | Never say |
|---|---|
| "Worth checking" | "They overcharged you" |
| "Stated $X, lines add to $Y, difference $Z" | "They padded it" |
| "Charged twice — confirm it's intentional" | "Double-billed you" |
| "Runs over on most shows" | "You're bad at budgeting" |

**State the arithmetic and stop.** The promoter draws the conclusion. That is their job.

Three severities and no more: `check` (doesn't reconcile), `unreadable` (couldn't read it),
`unusual` (fine but odd — lowest priority, never framed as wrongdoing). **There is no fraud level.
There will not be one.**

---

## 3. What it says, and what it shuts up about

**Silence means it checked out.** Never "matches exactly," "verified," "consistent." Those cost
money on every run and tell the promoter nothing. A clean document returns an empty flag list.

**Every recommendation ends in a number the promoter can act on.** "That headroom is real money
you could be putting into the guarantee" was called out as meaningless and rewritten. The test:
could they do it tomorrow? "Put $371 in this line instead of $221" passes. "Consider optimising
your spend" does not.

**Business judgement is not the app's.** Whether $1,515 is too much for marketing is not its
call. Whether to sign a FRAGILE deal is not its call. It shows the number and the downside and
gets out of the way.

**The bad night is the decision, not the sellout.** Every deal can be made to look fine at a full
house. 60 of the Deal Score's 100 points are the downside because that is the question that
decides whether to sign.

---

## 4. What it never does on its own

**Nothing writes to a promoter's data without them pressing a button that says what it does.**

- The document scanner has two gates: approve on the review screen, then Save on the settlement.
  Both are deliberate. A silent bad parse corrupts the record of what a night actually cost.
- A scan may change work the promoter typed by hand; it may not change it quietly. Replacements
  are shown old → new with a tick box on each before anything applies.
- The Deal Score, insights, marketing budget and bad-night test are read-only. They never save.
- The Claude connector's `create_offer` refuses a duplicate and hands back the existing one. It
  never creates a second show for the same night.
- **Claude never inserts into `shows` or `offers` with SQL.** That is how the Dirty Dave duplicate
  got in. See DATA-RULES.md.

---

## 5. What the promoter can always see

- **What a scan cost.** Every extraction records its tokens and its price. "This scan cost 2.8¢."
- **Where a rate came from.** "$2.05 a ticket, from your last 3 profitable shows" — with the three
  shows listed under it.
- **What a flag concerns.** Attached to the field, not floating in a list.
- **What is already paid vs still to go out.** Never one blended number.
- **Why a show is FRAGILE.** The three figures — sellout, 70%, half — not just the verdict.

If a number cannot be traced back to something the promoter entered, it does not ship.

---

## 6. Cost and privacy

- The only model call is the document scanner, gated to Pro and Agency Scale. ~3¢ a document.
  Static instructions are cached. One pass, no re-reads, hard cap of 10 pages.
- Uploaded documents carry artist fees and personal details. Private bucket, paths namespaced by
  organisation, RLS so a member reaches only their own org's files, signed URLs that expire.
- The scanner sends only the document and the instructions. Never other shows, never the
  promoter's history, never anything it does not need to read that one document.

---

## 7. When a rule here is wrong

Change the rule, here, first. Then the code. A rule that lives only in a prompt or a comment gets
lost the next time someone rewrites the file.
