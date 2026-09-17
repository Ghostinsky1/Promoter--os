import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

/**
 * PROMOTER OS — deal score.
 *
 * Scored on whether the night SURVIVES, not on how good a sellout looks.
 *
 * Jose's rule: "we calculate at cap but we estimate at 50% to see if the event
 * can survive a bad night." A full house is the ceiling and every promoter can
 * make that number look fine. The question that decides whether to sign is what
 * a soft night costs. So 60 of the 100 points here are about the downside.
 *
 * The 50% and 70% figures are computed properly, not scaled down from the
 * sellout: rights fees, card fees and insurance follow the ticket count, while
 * venue, production, security and the artist guarantee do not move a dollar.
 *
 * NOT a language model. Every point comes from the offer's own numbers, so it
 * answers instantly, costs nothing, and cannot invent a figure. Wording follows
 * EXTRACTION.md: state the arithmetic, never accuse anyone.
 */

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

type Any = any;
const n = (v: Any, d = 0) => (typeof v === 'number' && isFinite(v) ? v : d);
const money = (v: number) => `$${Math.round(Math.abs(v)).toLocaleString('en-US')}`;
const pct = (v: number) => `${Math.round(v)}%`;
const CATEGORIES = ['talent', 'general', 'marketing', 'production'] as const;

interface Factor { factor: string; score: number; max: number; status: string; detail: string }
interface Tier { price: number; seats: number }

function sumExpenses(block: Any): number {
  if (!block || typeof block !== 'object') return 0;
  let t = 0;
  for (const c of CATEGORIES) {
    const lines = block[c];
    if (lines && typeof lines === 'object') for (const v of Object.values(lines)) t += n(v);
  }
  return t;
}

/** Bar / parking / sponsorship split into what's flat and what's per head. */
function splitExtras(offer: Any): { flat: number; perHead: number } {
  if (offer?.include_extra_revenue === false) return { flat: 0, perHead: 0 };
  const lines: Any[] = Array.isArray(offer?.extra_revenue) ? offer.extra_revenue : [];
  let flat = 0;
  let perHead = 0;
  for (const l of lines) {
    const mine = n(l?.amount) * (n(l?.promoter_pct, 100) / 100);
    if (l?.basis === 'per_head') perHead += mine;
    else if (l?.basis === 'per_car') perHead += mine / n(l?.occupancy, 2.5);
    else if (l?.basis === 'per_unit') flat += mine * n(l?.units);
    else flat += mine;
  }
  return { flat, perHead };
}

function revenueFor(tiers: Tier[], tickets: number, mix: string): number {
  if (tiers.length === 0 || tickets <= 0) return 0;
  const sellable = tiers.reduce((s, t) => s + t.seats, 0);
  if (mix === 'blended') {
    const full = tiers.reduce((s, t) => s + t.seats * t.price, 0);
    return sellable > 0 ? (full / sellable) * tickets : 0;
  }
  let left = tickets;
  let revenue = 0;
  for (const t of [...tiers].sort((a, b) => a.price - b.price)) {
    const take = Math.min(left, t.seats);
    revenue += take * t.price;
    left -= take;
    if (left <= 0) break;
  }
  return revenue;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  let body: Any;
  try { body = await req.json(); } catch { return json({ error: 'Body must be JSON' }, 400); }

  const rawTiers: Any[] = Array.isArray(body.ticket_tiers) ? body.ticket_tiers : [];
  const tiers: Tier[] = rawTiers
    .map((t) => ({ price: n(t.price), seats: Math.max(0, n(t.allotment) - n(t.comps)) }))
    .filter((t) => t.seats > 0 && t.price > 0);
  const onSale = tiers.reduce((s, t) => s + t.seats, 0);
  const guarantee = n(body.guarantee);
  const mix = body.downside_tier_mix === 'blended' ? 'blended' : 'cheapest_first';

  if (onSale <= 0) return json({ error: 'Need priced ticket tiers to score this deal' }, 400);

  // Fixed costs: these do not move with the ticket count.
  let fixed = sumExpenses(body.expenses);
  for (const a of (Array.isArray(body.support_acts) ? body.support_acts : [])) fixed += n(a?.guarantee);
  if (body.include_hotel) fixed += n(body.hotel_budget) * n(body.hotel_nights, 1);
  if (body.include_transport) fixed += n(body.transport_budget);
  if (body.include_flights) fixed += n(body.flight_budget);
  if (body.include_rider) fixed += n(body.rider_cap);

  const extras = splitExtras(body);

  /** The whole night, computed at a given attendance. */
  const at = (attendancePct: number) => {
    const tickets = Math.floor(onSale * (attendancePct / 100));
    const gross = revenueFor(tiers, tickets, mix);
    const afterFacility = Math.max(0, gross - n(body.facility_fee_per_ticket) * tickets);
    const netGross = afterFacility * (1 - n(body.sales_tax_pct) / 100);
    const variable =
      netGross * (n(body.ascap_rate) + n(body.bmi_rate) + n(body.sesac_rate) + n(body.cc_fee_rate)) +
      tickets * n(body.insurance_per_attendee);
    const extraRevenue = extras.flat + extras.perHead * tickets;
    return { tickets, gross, netGross, variable, profit: netGross - variable - fixed - guarantee + extraRevenue };
  };

  const full = at(100);
  const soft = at(70);
  const bad = at(50);

  // Lowest attendance that still clears, walked a ticket at a time — with
  // cheapest-first scaling each extra ticket is not worth the same, so dividing
  // gives the wrong answer.
  let breakEvenTickets = -1;
  if (full.profit >= 0) {
    let lo = 0, hi = onSale;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (at((mid / onSale) * 100).profit >= 0) hi = mid; else lo = mid + 1;
    }
    breakEvenTickets = lo;
  }
  const breakEvenPct = breakEvenTickets >= 0 ? (breakEvenTickets / onSale) * 100 : 999;

  const factors: Factor[] = [];
  const tips: string[] = [];

  // 1. THE BAD NIGHT — 35 points. The one that decides it.
  let badScore = 0, badStatus = 'DANGEROUS';
  if (bad.profit >= 0) { badScore = 35; badStatus = 'LOW RISK'; }
  else if (bad.profit > -(guarantee * 0.15)) { badScore = 22; badStatus = 'MEDIUM RISK'; }
  else if (bad.profit > -(guarantee * 0.40)) { badScore = 10; badStatus = 'HIGH RISK'; }
  factors.push({
    factor: 'Half a house sold',
    score: badScore, max: 35, status: badStatus,
    detail: bad.profit >= 0
      ? `${bad.tickets.toLocaleString('en-US')} tickets still clears ${money(bad.profit)}. This show survives a bad night.`
      : `${bad.tickets.toLocaleString('en-US')} tickets leaves you ${money(bad.profit)} out of pocket. That is what a bad night costs you.`,
  });

  // 2. THE SOFT NIGHT — 25 points.
  let softScore = 0, softStatus = 'HIGH RISK';
  if (soft.profit >= 0) { softScore = 25; softStatus = 'LOW RISK'; }
  else if (soft.profit > -(guarantee * 0.15)) { softScore = 14; softStatus = 'MEDIUM RISK'; }
  else if (soft.profit > -(guarantee * 0.35)) { softScore = 6; softStatus = 'HIGH RISK'; }
  factors.push({
    factor: '70% sold',
    score: softScore, max: 25, status: softStatus,
    detail: soft.profit >= 0
      ? `${soft.tickets.toLocaleString('en-US')} tickets clears ${money(soft.profit)}.`
      : `${soft.tickets.toLocaleString('en-US')} tickets is still ${money(soft.profit)} down. A merely soft night loses money.`,
  });

  // 3. Break-even — 20 points.
  let beScore = 0, beStatus = 'DANGEROUS';
  if (breakEvenPct <= 50) { beScore = 20; beStatus = 'LOW RISK'; }
  else if (breakEvenPct <= 65) { beScore = 15; beStatus = 'MEDIUM RISK'; }
  else if (breakEvenPct <= 80) { beScore = 8; beStatus = 'HIGH RISK'; }
  else if (breakEvenPct <= 100) { beScore = 3; beStatus = 'RISKY'; }
  factors.push({
    factor: 'Break-even point',
    score: beScore, max: 20, status: beStatus,
    detail: breakEvenPct <= 100
      ? `You need ${breakEvenTickets.toLocaleString('en-US')} of the ${onSale.toLocaleString('en-US')} tickets on sale before you keep a dollar — ${pct(breakEvenPct)} of what you are selling${mix === 'cheapest_first' ? ', selling the cheap tiers first' : ''}.`
      : `A full house does not cover the costs. There is no break-even at this scaling.`,
  });
  if (beScore < 15 && breakEvenPct <= 100) {
    const target = Math.round(onSale * 0.6);
    const gap = -at((target / onSale) * 100).profit;
    if (gap > 0) tips.push(`Cut ${money(gap)} of cost, or raise the guarantee's cover by that much, to break even at 60% of the tickets on sale instead of ${pct(breakEvenPct)}.`);
  }

  // 4. Upside — 20 points. The sellout still counts, just not for much.
  const margin = full.netGross > 0 ? (full.profit / full.netGross) * 100 : 0;
  let upScore = 0, upStatus = 'DANGEROUS';
  if (margin >= 30) { upScore = 20; upStatus = 'EXCELLENT'; }
  else if (margin >= 20) { upScore = 16; upStatus = 'GOOD'; }
  else if (margin >= 10) { upScore = 10; upStatus = 'DECENT'; }
  else if (margin > 0) { upScore = 5; upStatus = 'RISKY'; }
  factors.push({
    factor: 'Upside at a sellout',
    score: upScore, max: 20, status: upStatus,
    detail: full.profit >= 0
      ? `A full house pays ${money(full.profit)} — ${pct(margin)} of ${money(full.netGross)} net.`
      : `Even a full house loses ${money(full.profit)}.`,
  });

  const artistShare = full.netGross > 0 ? (guarantee / full.netGross) * 100 : 0;
  if (artistShare > 50 && guarantee > 0) {
    const target = full.netGross * 0.45;
    tips.push(`The guarantee of ${money(guarantee)} is ${pct(artistShare)} of a full-house net. At ${money(target)} the bad night improves by ${money(guarantee - target)}.`);
  }
  if (bad.profit < 0 && extras.perHead === 0 && extras.flat === 0) {
    tips.push(`Nothing but tickets is carrying this show. ${money(-bad.profit / Math.max(1, bad.tickets))} per head of bar, parking or sponsorship would cover the bad night.`);
  }
  if (tiers.length < 2) {
    tips.push(`One price level means nothing to move when sales come in slow. On ${onSale.toLocaleString('en-US')} tickets a $5 swing is ${money(onSale * 5)}.`);
  }

  const overall = factors.reduce((s, f) => s + f.score, 0);
  let recommendation: string;
  let recommendation_type: string;
  if (bad.profit >= 0 && overall >= 75) {
    recommendation_type = 'STRONG BUY';
    recommendation = `This one survives. Half a house still clears ${money(bad.profit)}, and a sellout pays ${money(full.profit)}.`;
  } else if (soft.profit >= 0 && overall >= 55) {
    recommendation_type = 'PROCEED';
    recommendation = `Workable, but it needs a real crowd. 70% sold clears ${money(soft.profit)}; half a house is ${bad.profit >= 0 ? `${money(bad.profit)} up` : `${money(bad.profit)} down`}.`;
  } else if (full.profit >= 0 && overall >= 35) {
    recommendation_type = 'CAUTION';
    recommendation = `The sellout looks fine at ${money(full.profit)}, but you need ${pct(breakEvenPct)} of the tickets on sale before you keep a dollar, and a bad night is ${money(bad.profit)} out of pocket.`;
  } else {
    recommendation_type = 'PASS';
    recommendation = full.profit < 0
      ? `A full house still loses ${money(full.profit)}. The math does not work as written.`
      : `Only a near-sellout saves this. Break-even is ${pct(breakEvenPct)} of the tickets on sale and a bad night costs you ${money(bad.profit)}.`;
  }

  return json({
    overall_score: overall,
    max_score: 100,
    recommendation,
    recommendation_type,
    factors,
    improvement_tips: tips,
    // The three-number read, for the offers list and anything else that wants it.
    scenarios: {
      mix,
      tickets_on_sale: onSale,
      break_even_tickets: breakEvenTickets,
      break_even_pct: breakEvenPct <= 100 ? Math.round(breakEvenPct) : null,
      at_50: { tickets: bad.tickets, profit: Math.round(bad.profit) },
      at_70: { tickets: soft.tickets, profit: Math.round(soft.profit) },
      at_100: { tickets: full.tickets, profit: Math.round(full.profit) },
      verdict: full.profit < 0 ? 'UNDERWATER' : bad.profit >= 0 ? 'SAFE' : soft.profit >= 0 ? 'TIGHT' : 'FRAGILE',
    },
    analyzed_at: new Date().toISOString(),
  });
});
