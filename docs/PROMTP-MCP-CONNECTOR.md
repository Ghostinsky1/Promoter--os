# PromoterOS — MCP Connector (Claude integration)

Companion to PROMTP-BUILD-GUIDE.md. Section numbering continues from that guide.

## 8. PROMTP MCP connector (Claude integration)

Lets any paying PROMTP customer connect their account to Claude (claude.ai custom connector / Claude Desktop / Claude Code) and run the app by chat.

**URL customers paste into Claude:** `https://azenzsggqexyonafxlsf.supabase.co/functions/v1/promtp-mcp`

### How it works
- Supabase edge function `promtp-mcp` (`supabase/functions/promtp-mcp/index.ts` + `calc.ts`), `verify_jwt` OFF (it validates tokens itself and must return a proper 401 so Claude starts sign-in). Stateless JSON-RPC over HTTP POST.
- Sign-in = **Supabase OAuth 2.1 server**. Unauthenticated calls get `401` + `WWW-Authenticate: resource_metadata=…/promtp-mcp/.well-known/oauth-protected-resource`, which points Claude at `https://azenzsggqexyonafxlsf.supabase.co/auth/v1`. Claude self-registers (dynamic client registration), sends the user to `promoteros.com/oauth/consent`, user clicks Allow, Claude gets a normal Supabase token.
- Every query runs with the **user's own token** → existing RLS keeps each org in its own data (tested: a second org could not read, edit or delete the first org's offers, tasks or lineup).
- Paywall: tools refuse unless org `subscription_status` is `active`, or `trialing` with trial not expired. `create_offer` respects `max_offers`.
- Math in `calc.ts` is ported 1:1 from `src/lib/calculations.ts`, `breakEvenCalculations.ts`, `artistCalculations.ts`, Settlement and ArtistDealTab (verified identical output). If app formulas change, update `calc.ts` too.

### Tools (17)
get_account · list_offers · get_offer · create_offer · update_offer · calculate_deal (what-if, never saves) · analyze_offer · preview_settlement (save=true writes settlement + marks settled) · add_lineup_artist · update_lineup_artist · add_task · list_tasks · update_task · delete_task · add_note · get_run_of_show · update_run_of_show

### Frontend pieces
- `src/pages/OAuthConsentPage.tsx` at route `/oauth/consent` (public route; sends to `/login?next=…` if signed out).
- `src/lib/safeNext.ts` + `LoginForm` / `App.tsx` honor `?next=` so login returns to the approval page.
- `@supabase/supabase-js` bumped to `^2.116.0` (needed for `supabase.auth.oauth.*`).

### One-time dashboard settings (Supabase → Authentication) — DONE except Site URL
(OAuth Server + dynamic registration were switched on 2026-09-15. Full sign-in flow tested end to end with a throwaway account, since deleted.)
1. **OAuth Server** → Enable, Authorization Path `/oauth/consent`, **Allow dynamic client registration ON**.
2. **URL Configuration** → Site URL `https://promoteros.com`.

### Known quirk (app, not MCP)
For `guarantee_vs_percentage` / `percentage_only` / `door_deal`, the app's stored `calculations.netProfit` still assumes the artist is paid the flat guarantee. The MCP returns both `projected_net_profit` (app's number) and `promoter_profit_under_deal_terms` (applies the % split) so Claude doesn't mislead.

### Redeploying the function
Supabase dashboard → Edge Functions, or the Supabase connector's deploy tool, with both files, `verify_jwt: false`.
