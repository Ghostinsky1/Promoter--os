// PROMOTER OS — the bad-night test, Deno copy of src/lib/downside.ts.
// If one changes, change the other in the same commit.
import { netGrossOf, computeDeal, dealTermsOf, dealTypeOf, totalExpenses } from '../promtp-mcp/calc.ts';

// deno-lint-ignore no-explicit-any
type Any = any;
const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const DEFAULT_CAR_OCCUPANCY = 2.5;

function splitExtraRevenue(lines: Any[] = [], enabled = true) {
  if (!enabled || !Array.isArray(lines)) return { flat: 0, perHead: 0 };
  let flat = 0, perHead = 0;
  for (const l of lines) {
    if (!l) continue;
    const amount = Number(l.amount) || 0;
    const share = (Number(l.promoter_pct) ?? 100) / 100;
    if (!isFinite(amount) || amount === 0) continue;
    const mine = amount * (isFinite(share) ? Math.max(0, Math.min(1, share)) : 1);
    if (l.basis === 'per_head') perHead += mine;
    else if (l.basis === 'per_car') perHead += mine / (Number(l.occupancy) > 0 ? Number(l.occupancy) : DEFAULT_CAR_OCCUPANCY);
    else if (l.basis === 'per_unit') flat += mine * (Number(l.units) || 0);
    else flat += mine;
  }
  return { flat, perHead };
}

function revenueFor(offer: Any, tickets: number, mix: 'cheapest_first' | 'blended'): number {
  const tiers = (offer.ticket_tiers || [])
    .map((t: Any) => ({ price: num(t.price), seats: Math.max(0, num(t.allotment) - num(t.comps)) }))
    .filter((t: Any) => t.seats > 0);
  if (tiers.length === 0 || tickets <= 0) return 0;
  const sellable = tiers.reduce((s: number, t: Any) => s + t.seats, 0);
  if (mix === 'blended') {
    const full = tiers.reduce((s: number, t: Any) => s + t.seats * t.price, 0);
    return sellable > 0 ? (full / sellable) * tickets : 0;
  }
  let left = tickets, revenue = 0;
  for (const t of [...tiers].sort((a: Any, b: Any) => a.price - b.price)) {
    const take = Math.min(left, t.seats);
    revenue += take * t.price; left -= take;
    if (left <= 0) break;
  }
  return revenue;
}

export function sellableOf(offer: Any): number {
  return (offer.ticket_tiers || []).reduce((s: number, t: Any) => s + Math.max(0, num(t.allotment) - num(t.comps)), 0);
}

export function downsideAt(offer: Any, pct: number) {
  const sellable = sellableOf(offer);
  const tickets = Math.floor(sellable * (pct / 100));
  const mix = offer?.downside_tier_mix === 'blended' ? 'blended' : 'cheapest_first';
  const grossRevenue = revenueFor(offer, tickets, mix);
  const terms = dealTermsOf(offer);
  const netGross = netGrossOf(grossRevenue, tickets, num(offer.sales_tax_pct), terms.facilityFeePerTicket, terms.facilityFeeMode).netGross;
  const variableExpenses =
    netGross * (num(offer.ascap_rate) + num(offer.bmi_rate) + num(offer.sesac_rate) + num(offer.cc_fee_rate)) +
    tickets * num(offer.insurance_per_attendee);
  let fixedExpenses = totalExpenses(offer.expenses);
  fixedExpenses += (offer.support_acts || []).reduce((s: number, a: Any) => s + num(a.guarantee), 0);
  if (offer.include_hotel) fixedExpenses += num(offer.hotel_budget) * num(offer.hotel_nights, 1);
  if (offer.include_transport) fixedExpenses += num(offer.transport_budget);
  if (offer.include_flights) fixedExpenses += num(offer.flight_budget);
  if (offer.include_rider) fixedExpenses += num(offer.rider_cap);
  const deal = computeDeal(netGross, variableExpenses + fixedExpenses, {
    dealType: dealTypeOf(offer), guarantee: num(offer.guarantee), taxWithholdingPct: num(offer.tax_withholding_pct),
    artistPercentage: terms.artistPercentage, artistPctBasis: terms.artistPctBasis, doorSplitBasis: terms.doorSplitBasis,
    artistBackendPct: num(offer.artist_backend_pct, 85), promoterBackendPct: num(offer.promoter_backend_pct, 15),
  });
  const { flat, perHead } = splitExtraRevenue(offer.extra_revenue, offer.include_extra_revenue !== false);
  const profit = deal.netProfit + flat + perHead * tickets;
  return { pct, tickets, profit, survives: profit >= 0 };
}

export function survivalRead(offer: Any) {
  const at50 = downsideAt(offer, 50), at70 = downsideAt(offer, 70), atFull = downsideAt(offer, 100);
  let verdict: 'SAFE' | 'TIGHT' | 'FRAGILE' | 'UNDERWATER';
  if (atFull.profit < 0) verdict = 'UNDERWATER';
  else if (at50.survives) verdict = 'SAFE';
  else if (at70.survives) verdict = 'TIGHT';
  else verdict = 'FRAGILE';
  return { at50, at70, atFull, verdict };
}
