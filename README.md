# PROMTP / PromoterOS

Artist offer, deal estimate and settlement tool for promoters. React + Vite + Supabase.

## Folder guide
- `src/`        the app (components, pages, hooks, lib = calculations + PDF generators)
- `public/`     logo images + favicon
- `supabase/`   schema.sql (whole database, one file) + 4 server functions (Stripe + AI)
- `docs/`       admin/setup notes and testing guide
- root files    build config (package.json, vite, tailwind, tsconfig, eslint)

## Deploy (Cloudflare Pages, connected to this repo)
Cloudflare Workers, Git-connected. Build: `npm install && npm run build`  Deploy: `npx wrangler deploy`  Root: `/`. See BUILD-GUIDE.md.
No environment variables needed (public Supabase URL/key are in src/lib/supabase.ts). Optional overrides:
- `VITE_SUPABASE_URL`      = https://azenzsggqexyonafxlsf.supabase.co
- `VITE_SUPABASE_ANON_KEY` = the project's publishable key (Supabase → Settings → API)

## Run locally
Create `.env` with the two values above, then `npm install && npm run dev`.
