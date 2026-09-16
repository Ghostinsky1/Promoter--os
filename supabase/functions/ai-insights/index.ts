import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

/**
 * PROMOTER OS — insights for the dashboard.
 *
 * Reads the promoter's own settled shows and tells them what the numbers say:
 * where money leaks, which deals pay, how good their projections are.
 *
 * Deliberately NOT a language model. Every figure here comes off their own
 * settlements, so it costs nothing per load, answers instantly, and can't
 * invent a number. Wording follows EXTRACTION.md: state the arithmetic, never
 * accuse anyone.
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const MIN_SETTLED = 3;                       // below this there's nothing trustworthy to say
const TIERS_WITH_INSIGHTS = new Set(['pro', 'agency_scale']);

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

type Any = any;
const n = (v: Any, d = 0) => (typeof v === 'number' && isFinite(v) ? v : d);
const money = (v: number) => `$${Math.round(Math.abs(v)).toLocaleString('en-US')}`;
const CATEGORIES = ['talent', 'general', 'marketing', 'production'] as const;

/** Sum a {category: {line: amount}} block. */
function sumBlock(block: Any): number {
  if (!block || typeof block !== 'object') return 0;
  let t = 0;
  for (const c of CATEGORIES) {
    const lines = block[c];
    if (lines && typeof lines === 'object') for (const v of Object.values(lines)) t += n(v);
  }
  return t;
}

/** Per-line totals across every settled show, projected vs actual. */
function lineVariances(rows: Any[]) {
  const acc = new Map<string, { projected: number; actual: number; shows: number; category: string }>();
  for (const r of rows) {
    for (const c of CATEGORIES) {
      const proj = r.offer?.expenses?.[c] ?? {};
      const act = r.settlement?.actual_expenses?.[c] ?? {};
      const keys = new Set([...Object.keys(proj || {}), ...Object.keys(act || {})]);
      for (const k of keys) {
        const p = n(proj?.[k]);
        const a = n(act?.[k]);
        if (p === 0 && a === 0) continue;
        const cur = acc.get(k) ?? { projected: 0, actual: 0, shows: 0, category: c };
        cur.projected += p;
        cur.actual += a;
        cur.shows += 1;
        acc.set(k, cur);
      }
    }
  }
  return acc;
}

const pretty = (k: string) => k.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Not signed in' }, 401);

    // Everything runs under the promoter's own token, so RLS keeps them in their own data.
    const db = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userRes, error: userErr } = await db.auth.getUser(token);
    if (userErr || !userRes?.user) return json({ error: 'Not signed in' }, 401);

    const { data: mem } = await db
      .from('organization_members')
      .select('organization_id, organizations(subscription_tier)')
      .eq('user_id', userRes.user.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    const orgId = (mem as Any)?.organization_id;
    const tier = String((mem as Any)?.organizations?.subscription_tier ?? '').toLowerCase();
    if (!orgId) return json({ ready: false, settled_count: 0, message: 'No organization on this account yet.' });

    const { data: settlements } = await db
      .from('settlements')
      .select('*')
      .eq('organization_id', orgId);

    const settled = settlements ?? [];
    const settled_count = settled.length;

    if (!TIERS_WITH_INSIGHTS.has(tier)) {
      return json({
        ready: false,
        settled_count,
        message: 'Insights are part of the Pro and Agency Scale plans.',
      });
    }

    if (settled_count < MIN_SETTLED) {
      return json({
        ready: false,
        settled_count,
        message: `Settle ${MIN_SETTLED - settled_count} more show${MIN_SETTLED - settled_count === 1 ? '' : 's'} and this fills in with your own numbers.`,
      });
    }

    const offerIds = settled.map((s: Any) => s.offer_id).filter(Boolean);
    const { data: offers } = await db
      .from('offers')
      .select('id, deal_type, guarantee, expenses, calculations, show_id')
      .in('id', offerIds.length ? offerIds : ['__none__']);

    const offerById = new Map((offers ?? []).map((o: Any) => [o.id, o]));
    const rows = settled
      .map((s: Any) => ({ settlement: s, offer: offerById.get(s.offer_id) }))
      .filter((r: Any) => r.offer);

    const insights: Any[] = [];

    /* 1. Where the expenses actually land, line by line. */
    const variances = [...lineVariances(rows).entries()]
      .filter(([, v]) => v.projected > 0 && v.shows >= 2)
      .map(([k, v]) => ({ key: k, ...v, over: v.actual - v.projected, pct: (v.actual - v.projected) / v.projected }))
      .sort((a, b) => b.over - a.over);

    const worst = variances[0];
    if (worst && worst.over > 0 && worst.pct >= 0.1) {
      insights.push({
        type: 'expense_variance',
        title: `${pretty(worst.key)} runs over on most shows`,
        description: `Across ${worst.shows} settled shows you budgeted ${money(worst.projected)} for ${pretty(worst.key).toLowerCase()} and settled at ${money(worst.actual)} — ${money(worst.over)} more, or ${Math.round(worst.pct * 100)}% over.`,
        recommendation: `Next offer, put ${money(worst.actual / worst.shows)} in this line instead of ${money(worst.projected / worst.shows)}. Your break-even will be right the first time.`,
        impact: worst.over > 1000 ? 'HIGH' : 'MEDIUM',
        icon: 'trending-up',
        data: { line: worst.key, projected: worst.projected, actual: worst.actual, shows: worst.shows },
      });
    }

    const best = variances[variances.length - 1];
    if (best && best.over < 0 && Math.abs(best.pct) >= 0.15 && best.key !== worst?.key) {
      insights.push({
        type: 'expense_headroom',
        title: `You set aside too much for ${pretty(best.key).toLowerCase()}`,
        description: `You budgeted ${money(best.projected)} across ${best.shows} shows and only spent ${money(best.actual)}. That is ${money(Math.abs(best.over))} you set aside and never used.`,
        recommendation: `Drop this line to about ${money(best.actual / best.shows)} per show. That frees up roughly ${money(Math.abs(best.over) / best.shows)} a show you can put toward the artist fee.`,
        impact: 'LOW',
        icon: 'trending-down',
        data: { line: best.key, projected: best.projected, actual: best.actual },
      });
    }

    /* 2. Which deal type actually pays. */
    const byDeal = new Map<string, { profit: number; shows: number }>();
    for (const r of rows) {
      const d = String(r.offer.deal_type ?? 'unknown');
      const cur = byDeal.get(d) ?? { profit: 0, shows: 0 };
      cur.profit += n(r.settlement.actual_profit);
      cur.shows += 1;
      byDeal.set(d, cur);
    }
    if (byDeal.size >= 2) {
      const ranked = [...byDeal.entries()]
        .map(([d, v]) => ({ deal: d, avg: v.profit / v.shows, shows: v.shows }))
        .sort((a, b) => b.avg - a.avg);
      const top = ranked[0];
      const bottom = ranked[ranked.length - 1];
      insights.push({
        type: 'deal_type',
        title: `${pretty(top.deal)} deals pay you the most`,
        description: `${pretty(top.deal)} averages ${money(top.avg)} profit across ${top.shows} show${top.shows === 1 ? '' : 's'}. ${pretty(bottom.deal)} averages ${money(bottom.avg)}.`,
        recommendation: `On your next offer, run the numbers for all three deal types before you pick one. On these shows, ${pretty(top.deal).toLowerCase()} kept you ${money(top.avg - bottom.avg)} more per night than ${pretty(bottom.deal).toLowerCase()}.`,
        impact: top.avg - bottom.avg > 1500 ? 'HIGH' : 'MEDIUM',
        icon: 'dollar-sign',
        data: { ranked },
      });
    }

    /* 3. How good the projections are. */
    const withProjection = rows.filter((r: Any) => n(r.offer?.calculations?.netProfit) !== 0);
    if (withProjection.length >= 2) {
      const diffs = withProjection.map((r: Any) => n(r.settlement.actual_profit) - n(r.offer.calculations.netProfit));
      const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length;
      const beat = diffs.filter((d) => d >= 0).length;
      insights.push({
        type: 'projection_accuracy',
        title: avg >= 0 ? 'Your projections are conservative' : 'Your projections run optimistic',
        description: `Across ${withProjection.length} settled shows you came in ${avg >= 0 ? 'above' : 'below'} projection by ${money(avg)} on average. ${beat} of ${withProjection.length} beat the number.`,
        recommendation: avg >= 0
          ? `Your shows tend to earn ${money(avg)} more than you expect. You can offer a bit more on a guarantee than your estimate says and still be safe.`
          : `Your shows tend to earn ${money(avg)} less than you expect. Add that much to your costs before you send an offer, so the break-even number is honest.`,
        impact: Math.abs(avg) > 1000 ? 'HIGH' : 'MEDIUM',
        icon: 'target',
        data: { average_variance: avg, beat, total: withProjection.length },
      });
    }

    /* 4. Margin, plainly. */
    const revenue = rows.reduce((t: number, r: Any) => t + n(r.settlement.actual_revenue), 0);
    const profit = rows.reduce((t: number, r: Any) => t + n(r.settlement.actual_profit), 0);
    if (revenue > 0) {
      const margin = (profit / revenue) * 100;
      insights.push({
        type: 'margin',
        title: `You keep ${margin.toFixed(0)} cents of every dollar`,
        description: `${money(profit)} profit on ${money(revenue)} of settled revenue across ${rows.length} shows.`,
        recommendation: margin < 15
          ? `Under 15% means one slow night wipes out a good one. Start with the expense lines above.`
          : `That is a solid margin for live events. Remember it the next time an agent asks you to stretch on a guarantee.`,
        impact: margin < 15 ? 'HIGH' : 'LOW',
        icon: 'bar-chart',
        data: { revenue, profit, margin },
      });
    }

    return json({
      ready: insights.length > 0,
      insights,
      settled_count,
      generated_at: new Date().toISOString(),
      message: insights.length ? undefined : 'Nothing stands out in your settled shows yet.',
    });
  } catch (e) {
    return json({ error: 'server_error', detail: String(e).slice(0, 300) }, 500);
  }
});
