import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

/**
 * PROMOTER OS — deal score.
 *
 * Scores one offer out of 100 on five things a promoter actually cares about:
 * what's left at the end, how full the room has to be to break even, how much
 * of the gross the artist is taking, whether the ticket scaling gives any room
 * to move, and what a half-full night costs.
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

interface Factor {
  factor: string;
  score: number;
  max: number;
  status: string;
  detail: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  let body: Any;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Body must be JSON' }, 400);
  }

  const capacity = n(body.capacity);
  const guarantee = n(body.guarantee);
  const grossPotential = n(body.gross_potential);
  const netProfit = n(body.net_profit);
  const totalCosts = n(body.total_costs);
  const tiers: Any[] = Array.isArray(body.ticket_tiers) ? body.ticket_tiers : [];

  if (capacity <= 0 || grossPotential <= 0) {
    return json({ error: 'Need a capacity and a gross potential to score this deal' }, 400);
  }

  const sellable = tiers.reduce((s, t) => s + Math.max(0, n(t.allotment) - n(t.comps)), 0) || capacity;
  const avgPrice = sellable > 0 ? grossPotential / sellable : 0;
  const factors: Factor[] = [];
  const tips: string[] = [];

  // 1. Margin — what's actually left at a full house, out of 30.
  const margin = grossPotential > 0 ? (netProfit / grossPotential) * 100 : 0;
  let marginScore = 0;
  let marginStatus = 'DANGEROUS';
  if (margin >= 30) { marginScore = 30; marginStatus = 'EXCELLENT'; }
  else if (margin >= 20) { marginScore = 24; marginStatus = 'GOOD'; }
  else if (margin >= 10) { marginScore = 16; marginStatus = 'DECENT'; }
  else if (margin > 0) { marginScore = 8; marginStatus = 'RISKY'; }
  factors.push({
    factor: 'Profit margin',
    score: marginScore,
    max: 30,
    status: marginStatus,
    detail: netProfit >= 0
      ? `${money(netProfit)} left on ${money(grossPotential)} of ticket revenue — ${pct(margin)} margin at a full house.`
      : `A sellout still loses ${money(netProfit)}. Costs run ${money(totalCosts)} against ${money(grossPotential)} of ticket revenue.`,
  });

  // 2. Break-even as a share of the room, out of 30.
  const breakEvenTickets = avgPrice > 0 ? Math.ceil(totalCosts / avgPrice) : Infinity;
  const breakEvenPct = capacity > 0 && isFinite(breakEvenTickets) ? (breakEvenTickets / capacity) * 100 : 999;
  let beScore = 0;
  let beStatus = 'DANGEROUS';
  if (breakEvenPct <= 50) { beScore = 30; beStatus = 'LOW RISK'; }
  else if (breakEvenPct <= 65) { beScore = 23; beStatus = 'MEDIUM RISK'; }
  else if (breakEvenPct <= 80) { beScore = 14; beStatus = 'HIGH RISK'; }
  else if (breakEvenPct <= 100) { beScore = 6; beStatus = 'RISKY'; }
  factors.push({
    factor: 'Break-even point',
    score: beScore,
    max: 30,
    status: beStatus,
    detail: isFinite(breakEvenTickets) && breakEvenPct <= 100
      ? `You need ${breakEvenTickets.toLocaleString('en-US')} of ${capacity.toLocaleString('en-US')} tickets sold to cover everything — ${pct(breakEvenPct)} of the room.`
      : `Costs of ${money(totalCosts)} are more than the room can sell at ${money(avgPrice)} a ticket. There is no break-even at this capacity.`,
  });
  if (beScore < 23 && isFinite(breakEvenTickets)) {
    const target = Math.round(capacity * 0.6);
    const costRoom = totalCosts - target * avgPrice;
    if (costRoom > 0) {
      tips.push(`Cut ${money(costRoom)} of cost (or raise the average ticket by ${money(costRoom / Math.max(1, target))}) to break even at 60% of the room instead of ${pct(breakEvenPct)}.`);
    }
  }

  // 3. What share of the gross the artist takes, out of 20.
  const artistShare = grossPotential > 0 ? (guarantee / grossPotential) * 100 : 0;
  let artistScore = 0;
  let artistStatus = 'DANGEROUS';
  if (artistShare <= 35) { artistScore = 20; artistStatus = 'EXCELLENT'; }
  else if (artistShare <= 50) { artistScore = 15; artistStatus = 'GOOD'; }
  else if (artistShare <= 65) { artistScore = 9; artistStatus = 'RISKY'; }
  else if (artistShare < 100) { artistScore = 3; artistStatus = 'HIGH RISK'; }
  factors.push({
    factor: 'Artist cost vs gross',
    score: artistScore,
    max: 20,
    status: artistStatus,
    detail: `The guarantee of ${money(guarantee)} is ${pct(artistShare)} of a full-house gross of ${money(grossPotential)}.`,
  });
  if (artistScore < 15 && artistShare > 0) {
    const target = grossPotential * 0.5;
    tips.push(`Getting the guarantee to ${money(target)} would put the artist at half the gross instead of ${pct(artistShare)} — that is ${money(guarantee - target)} back in your pocket.`);
  }

  // 4. Ticket scaling — does the pricing give you anywhere to go, out of 10.
  const priced = tiers.filter((t) => n(t.price) > 0);
  const prices = priced.map((t) => n(t.price));
  const spread = prices.length > 1 ? Math.max(...prices) - Math.min(...prices) : 0;
  let scaleScore = 0;
  let scaleStatus = 'SIMPLISTIC';
  if (priced.length >= 3 && spread > 0) { scaleScore = 10; scaleStatus = 'OPTIMIZED'; }
  else if (priced.length === 2 && spread > 0) { scaleScore = 7; scaleStatus = 'BASIC'; }
  else if (priced.length >= 1) { scaleScore = 3; scaleStatus = 'SIMPLISTIC'; }
  factors.push({
    factor: 'Ticket scaling',
    score: scaleScore,
    max: 10,
    status: scaleStatus,
    detail: priced.length > 1
      ? `${priced.length} price levels from ${money(Math.min(...prices))} to ${money(Math.max(...prices))}, averaging ${money(avgPrice)}.`
      : `One price level at ${money(avgPrice)}. Nothing to move if sales come in slow or fast.`,
  });
  if (scaleScore < 7) {
    tips.push(`Add an early-bird tier below ${money(avgPrice)} and a door price above it — on ${sellable.toLocaleString('en-US')} tickets, a ${money(5)} swing either way is ${money(sellable * 5)}.`);
  }

  // 5. The downside — what a half-full night costs, out of 10.
  const halfHouse = Math.floor(sellable * 0.5);
  const profitAtHalf = halfHouse * avgPrice - totalCosts;
  let downsideScore = 0;
  let downsideStatus = 'HIGH RISK';
  if (profitAtHalf >= 0) { downsideScore = 10; downsideStatus = 'LOW RISK'; }
  else if (profitAtHalf > -(totalCosts * 0.15)) { downsideScore = 6; downsideStatus = 'MEDIUM RISK'; }
  else if (profitAtHalf > -(totalCosts * 0.35)) { downsideScore = 3; downsideStatus = 'HIGH RISK'; }
  factors.push({
    factor: 'Downside at half a house',
    score: downsideScore,
    max: 10,
    status: downsideStatus,
    detail: profitAtHalf >= 0
      ? `Half the room sold still clears ${money(profitAtHalf)}.`
      : `Half the room sold is ${money(profitAtHalf)} out of pocket.`,
  });

  const overall = factors.reduce((s, f) => s + f.score, 0);
  let recommendation: string;
  let recommendation_type: string;
  if (overall >= 80) {
    recommendation_type = 'STRONG BUY';
    recommendation = `The numbers hold up. ${money(netProfit)} at a sellout, break-even at ${pct(breakEvenPct)} of the room.`;
  } else if (overall >= 60) {
    recommendation_type = 'PROCEED';
    recommendation = `Workable deal. It makes ${money(netProfit)} full, but you need ${pct(breakEvenPct)} of the room before you keep a dollar.`;
  } else if (overall >= 40) {
    recommendation_type = 'CAUTION';
    recommendation = `Thin. Break-even sits at ${pct(breakEvenPct)} of the room and half a house is ${money(profitAtHalf)}. Review before you sign.`;
  } else {
    recommendation_type = 'PASS';
    recommendation = `The math does not work as written. ${isFinite(breakEvenPct) && breakEvenPct <= 100 ? `You need ${pct(breakEvenPct)} of the room to break even` : 'There is no break-even at this capacity'}, and half a house is ${money(profitAtHalf)}. Review the guarantee and the expense lines.`;
  }

  return json({
    overall_score: overall,
    max_score: 100,
    recommendation,
    recommendation_type,
    factors,
    improvement_tips: tips,
    analyzed_at: new Date().toISOString(),
  });
});
