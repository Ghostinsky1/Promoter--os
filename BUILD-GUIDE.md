# PROMTP (PromoterOS) — Architecture & Build Guide

Artist offer, deal estimate and settlement tool for promoters. Paste this into a new chat to bring an assistant fully up to speed on **how it's built and how it deploys**.

---

## 1. The stack in one picture

```
Promoter's browser
      |
      v
Cloudflare Workers + Assets  (the ./dist folder = static Vite build)
      |
      v
Supabase  (project "Promoter--os", ref azenzsggqexyonafxlsf, us-east-2)
      |
      +--> Postgres (19 tables, RLS on every one)
      +--> Auth (email + password sign-in)
      +--> Edge Functions (Deno) — stripe-checkout, stripe-webhook, send-email [LIVE]; ai-insights, analyze-deal [not deployed]
```

**Key architectural decision:** the frontend is a *static site* that talks to Supabase directly with the **publishable (public) key**. Row Level Security on every table is what keeps users inside their own organization's data. There are no server-side secrets in the frontend; the only secrets (Stripe, AI keys) live in Supabase edge-function settings.

---

## 2. Frontend

**Framework:** React 18 + Vite 5 + TypeScript + Tailwind. `npm run build` outputs plain HTML/JS/CSS to `dist/`. No Node server at runtime.

```
/
├── src/
│   ├── App.tsx                 # routes (react-router)
│   ├── main.tsx                # entry
│   ├── components/             # every screen and panel
│   │   ├── LandingPage.tsx     # public marketing page
│   │   ├── Home.tsx            # dashboard after login
│   │   ├── CreateOffer.tsx / EditOffer.tsx / OfferDetails.tsx
│   │   ├── DealEstimator.tsx / DealAnalyzer.tsx / Settlement.tsx / RunOfShow.tsx
│   │   ├── tabs/               # the offer editor tabs (deal, deposits, expenses, ticket scaling, summary)
│   │   ├── artists/            # multi-artist lineup CRM cards + per-artist offer sheet
│   │   ├── auth/               # login, signup, signup-with-organization, protected route
│   │   └── subscription/       # plan cards
│   ├── pages/                  # tours, templates, pricing, legal pages
│   ├── hooks/                  # useAuth, useOrganization, useSubscription, useAdmin, useEventArtists…
│   ├── lib/
│   │   ├── supabase.ts         # Supabase client (public URL + key baked in, .env overrides)
│   │   ├── calculations.ts / breakEvenCalculations.ts / artistCalculations.ts
│   │   ├── generateOfferPDF.ts / generateArtistOfferSheet.ts / generateSettlementPDF.ts / generateRunOfShowPDF.ts
│   │   └── subscriptionTiers.ts / stripe.ts / email.ts (send-email client)
│   └── types/index.ts
├── public/                     # logo PNGs + favicon
├── supabase/
│   ├── schema.sql              # the whole database in one file (already applied to Promoter--os)
│   └── functions/              # stripe-checkout, stripe-webhook, send-email, ai-insights, analyze-deal
├── docs/                       # admin commands, setup notes, testing guide
├── wrangler.jsonc              # Cloudflare deploy config
├── vite.config.ts / tailwind.config.js / tsconfig*.json
└── package.json
```

### Access model (how a user gets in)
1. Sign up → Supabase Auth creates the user → DB triggers create a `user_roles` row **and** the organization: `handle_new_user_organization()` → `ensure_organization_for_user()` creates `organizations` (14-day trial, tier `starter`), the owner `organization_members` row and `company_settings`, all server-side (SECURITY DEFINER, so RLS can't block it). The browser inserts nothing at signup. `useOrganization` calls `ensure_my_organization()` as a fallback for any account that somehow has none.
2. Sign-up email checks (`src/lib/emailValidation.ts`): format, typo suggestions (gmial→gmail), and a block list of placeholder/disposable domains (test.com, example.com, mailinator…). If Supabase "Confirm email" is ON, the signup page shows a "Check your inbox" screen with a resend button; when OFF it goes straight to `/pricing`.
3. `useOrganization.hasActiveAccess()` decides if the app is usable: `subscription_status = 'active'`, or `trialing` and trial not expired.
4. Features are gated by `subscription_tier` (starter / pro / agency_scale) in `lib/subscriptionTiers.ts`.

**To unlock an account without Stripe** (Supabase → SQL Editor):
```sql
SELECT unlock_full_access('person@email.com');
```
Sets `is_admin = true`, org tier `agency_scale`, status `active`, unlimited offers, 10-year trial.

---

## 3. Cloudflare config (`wrangler.jsonc`)

```json
{
  "name": "promtp",
  "compatibility_date": "2026-08-01",
  "assets": {
    "directory": "./dist",
    "not_found_handling": "single-page-application"
  }
}
```

- No `main` worker — pure static assets. There is nothing to route server-side.
- `single-page-application` is what makes `/offers/123` load on refresh instead of 404. (This replaces the `_redirects` file used on Cloudflare Pages.)
- If a worker is ever added, remember the ticketing-site lesson: nothing between `</head>` and `<body>`, and never let injection throw.

---

## 4. Backend — Supabase

### Database (project `Promoter--os`)
**Core:** `shows`, `offers` (75 columns — the deal), `company_settings`, `templates`
**Org / access:** `organizations`, `organization_members`, `user_roles`
**Offer sub-records:** `offer_deposits`, `offer_tasks`, `offer_notes`, `expense_items`, `run_of_show`, `settlements`
**Artists:** `event_artists` (44 columns), `event_artist_tasks`
**Tours:** `tours`
**Stripe:** `stripe_customers`, `stripe_subscriptions`, `stripe_orders` + views `stripe_user_subscriptions`, `stripe_user_orders`

### Security model
Every table has RLS ON. Policies check `organization_members` for the signed-in user (`auth.uid()`), so the public key can only ever read/write rows belonging to the user's own organization. Helper functions (`is_organization_member`, `is_organization_admin`) are SECURITY DEFINER with `row_security = off` to avoid policy recursion.

### Helper SQL functions
`unlock_full_access(email)`, `grant_admin_access(email)` (admin flag only), `has_feature_access(feature)`, `get_user_organization()`, `list_users_and_organizations()` (admins only).

### Edge functions
| Function | Status | Purpose |
|---|---|---|
| `stripe-checkout` | DEPLOYED | Creates a Stripe Checkout session. Supports `ui_mode: 'embedded'` (returns `clientSecret` for the in-app form) and the legacy hosted redirect. Tags the session/subscription with `organization_id` + `tier`. `verify_jwt` off (it validates the user's token itself). |
| `stripe-webhook` | DEPLOYED | Receives Stripe events, syncs `stripe_subscriptions`, and sets the organization's `subscription_status` / `subscription_tier` / `max_offers`. Falls back to `stripe_customers → organization_members` if metadata is missing. `verify_jwt` off (Stripe signs requests). |
| `send-email` | DEPLOYED | Sends email through SendGrid for a signed-in user. See §4a. `verify_jwt` off (validates the user's token itself). |
| `stripe-setup` | DISABLED (410) | One-time helper that created the two products on 2026-09-15. |
| `email-selftest` | DISABLED (410) | One-time test used on 2026-09-15. |
| `ai-insights`, `analyze-deal` | NOT deployed | Need an AI API key as a secret. AI panels won't work until then. |

### Stripe (live account acct_1UG2vlGeegvFIqAC)
- Products/prices (lookup keys `promtp_starter`, `promtp_pro`):
  - Starter $39/mo — `prod_VGaRoeNJvg9HvX` / `price_1UG3GwGeegvFIqACVrur7gDr`
  - Pro $99/mo — `prod_VGaR1UwVJxWBa1` / `price_1UG3GxGeegvFIqACTTpeqq4n`
- Both carry a 14-day trial (set in `stripe-checkout`, `subscription_data.trial_period_days`).
- Secrets in Supabase (Edge Functions → Secrets): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
- Webhook endpoint: `https://azenzsggqexyonafxlsf.supabase.co/functions/v1/stripe-webhook` (events: checkout.session.completed, customer.subscription.updated/deleted, payment_intent.succeeded).
- Publishable key is baked into `src/lib/stripe.ts` (public by design).
- **Checkout is IN-APP:** `/checkout?price=<price_id>` (`src/pages/CheckoutPage.tsx`) renders Stripe Embedded Checkout inside PROMTP; `/checkout` is allowed without an active subscription in `ProtectedRoute`. Pricing page and SubscriptionPage buttons navigate there. Return URL is `/success?session_id=…`.
- If price IDs ever change, update: `src/stripe-config.ts`, `PRO_PRICE_ID` in `src/lib/stripe.ts`, and the `pro` mapping in both edge functions.

### 4a. Email (SendGrid)
- Secret in Supabase (Edge Functions → Secrets): `SENDGRID_API_KEY`. Optional overrides: `SENDGRID_FROM_EMAIL` (default `support@gozaentertainment.com`), `SENDGRID_FROM_NAME` (default `PROMTP · Goza Entertainment`).
- SendGrid domain authentication is set up for `gozaentertainment.com`, so the from-address is trusted.
- **How a send works:** Offer page → **Email** button → `EmailOfferModal` (to / subject / message, "Attach PDF" with Artist Offer or Internal Estimate mode, "Send me a copy") → builds the PDF in the browser as base64 → `lib/email.ts` POSTs to `${SUPABASE_URL}/functions/v1/send-email` with the user's session token → function checks the user, builds a branded HTML email (black header, blue rule, plain-text fallback), sets **Reply-To = the email saved in Company Settings** (falls back to the signed-in user's login email if blank), and calls SendGrid `POST /v3/mail/send`.
- Recipient is prefilled from the headliner's `contact_email` on the artist cards when one exists.
- Limits: 10 recipients, 8 MB of attachments per email.
- Reusing it elsewhere: `sendEmail({ to, subject, message, copySelf, attachments })` from `src/lib/email.ts` works from any screen.
- **Account emails (sign-up confirmation, password reset)** go through Supabase Auth's mailer. To require a real, confirmed email at sign-up: (1) Supabase → Project Settings → Authentication → SMTP Settings → Enable custom SMTP: host `smtp.sendgrid.net`, port `587`, username `apikey`, password = the SendGrid API key, sender `support@gozaentertainment.com`, sender name `PROMTP`; (2) Authentication → Sign In / Providers → Email → turn ON **Confirm email**. (3) Authentication → URL Configuration → Site URL = the live site, and add `https://<site>/pricing` to Redirect URLs. Do step 1 before step 2 — without custom SMTP Supabase only sends ~2 emails/hour. Only Jose should paste the key.

### Migrations gotchas already solved (don't re-break these)
- `expense_items` was referenced by a migration but never created in Bolt's files → created by hand before that migration.
- Two migrations (`20260211000000` and `20260212061234`) create the identical policy → second one now drops first.
- The combined setup SQL is **run-once**, not re-runnable.

---

## 5. Deploy pipeline

### Backend (instant)
Change a SQL policy/function in Supabase SQL Editor → live immediately. Deploy an edge function → live immediately.

### Frontend (Cloudflare build)
GitHub's web uploader allows **max 100 files per upload**, and this project is ~120 files, so it always goes up in **two batches**:
1. Assistant zips the project as two folders: `UPLOAD-1-first` (everything except `src/components`, ~67 files) and `UPLOAD-2-second` (a `src` folder holding only `components`, ~53 files).
2. Open `UPLOAD-1-first`, select the **contents** (⌘A *inside* the folder — never the folder itself, that nests the repo one level deep and the build fails with "root directory not found"). Drag into the GitHub repo root via **Add file → Upload files** → Commit.
3. Open `UPLOAD-2-second`, ⌘A inside it (you'll select one folder named `src`), drag into the **repo root** the same way → Commit. GitHub merges it into the existing `src` folder.
4. Check on GitHub that `src` now shows `components`, `hooks`, `lib`, `pages`, `types`. Cloudflare auto-builds after the second commit (the first commit's build will fail — that's expected).

**Cloudflare build configuration (Workers, Git-connected):**
```
Build command:   npm install && npm run build
Deploy command:  npx wrangler deploy
Root directory:  /
```
No environment variables required — the public Supabase URL/key are baked into `src/lib/supabase.ts`.

**Never delete config files when a build fails** — `wrangler.jsonc`, `package.json`, `vite.config.ts`, `tailwind.config.js`, `postcss.config.js`, `index.html` and `tsconfig*.json` are all load-bearing.

---

## 6. Deployment checklist (for any new change)

- [ ] Database change? Run it in Supabase SQL Editor — done, it's live. Also append it to `supabase/schema.sql` so the repo stays the source of truth.
- [ ] Frontend change? `npm run build` locally must pass (Vite doesn't type-check; `npm run typecheck` currently reports ~228 warnings that are safe to ignore).
- [ ] Upload repo **contents** to GitHub root, commit, let Cloudflare build.
- [ ] After deploy: load `/`, log in, open an offer, hard-refresh (⌘⇧R) if stale.
- [ ] Generate one PDF (offer + artist sheet) to confirm jsPDF still bundles.

---

## 7. Live coordinates

- **Site:** `promtp.gozaentertainment.com` (currently still pointing at the old Bolt deployment until Cloudflare DNS is switched)
- **Hosting:** Cloudflare Workers (Git-connected build)
- **Backend/DB:** Supabase project `Promoter--os` (ref `azenzsggqexyonafxlsf`, us-east-2)
- **Repo:** GitHub, private
- **Source of the code:** Bolt.new project "Promoter Offer Generator MVP (duplicated)" — Bolt's copy and its database are now legacy; the old Bolt DB still holds the historical 34 offers / 105 artists if a data migration is ever wanted.
