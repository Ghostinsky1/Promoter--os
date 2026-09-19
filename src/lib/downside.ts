import { OfferWithShow } from '../types';
import { splitExtraRevenue, calculateTotalExpenses, netGrossOf, computeDeal, dealTermsOf, dealTypeOf } from './calculations';

/**
 * PROMOTER OS — the bad-night test.
 *
 * Every other number in the app is figured at capacity: a full house, the best
 * the night can do. That's the right way to price a deal. It is not the
 * question that matters, which is "if this show goes soft, do I survive it?"
 *
 * This computes the night properly at a given attendance instead of scaling the
 * sellout down. That distinction is the whole point: when you sell fewer
 * tickets the rights fees, card fees and insurance shrink with you, but the
 * venue, the production, the security and the artist guarantee do not move a
 * dollar. Halving the sellout profit gets the answer wrong in the promoter's
 * favour, which is the one direction it must never be wrong.
 */

/** How a soft night fills the room. */
export type DownsideMix = 'cheapest_first' | 'blended';
export const DEFAULT_DOWNSIDE_MIX: DownsideMix = 'cheapest_first';

export interface DownsideResult {
  /** 50 for a half house. */
  pct: number;
  tickets: number;
  /** Face value of those tickets, before facility fee and tax. */
  grossRevenue: number;
  /** After facility fee and sales tax. */
  netGross: number;
  /** Rights fees, card fees, insurance — these shrink with the count. */
  variableExpenses: number;
  /** Venue, production, security, marketing — these do not. */
  fixedExpenses: number;
  /** What the artist costs at this attendance, before withholding. Flat on a flat deal; moves with the door on a percentage deal. */
  artistCost: number;
  /** Bar, parking, sponsorship at this attendance. */
  extraRevenue: number;
  /** What's left. Negative means the night costs you money. */
  profit: number;
  /** True when the show still clears at this attendance. */
  survives: boolean;
}

const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

export function downsideMixOf(offer: any): DownsideMix {
  return offer?.downside_tier_mix === 'blended' ? 'blended' : DEFAULT_DOWNSIDE_MIX;
}

/**
 * Revenue from selling `tickets` seats.
 *
 * cheapest_first fills the cheap tiers before the expensive ones, because a
 * soft show sells presale and never gets to the door price. blended assumes
 * the sellout mix holds all the way down, which is the flattering read.
 */
function revenueFor(offer: OfferWithShow, tickets: number, mix: DownsideMix): number {
  const tiers = (offer.ticket_tiers || [])
    .map((t) => ({ price: num(t.price), seats: Math.max(0, num(t.allotment) - num(t.comps)) }))
    .filter((t) => t.seats > 0);
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

/** Bar, parking, sponsorship at a given head count. */
function extrasFor(offer: any, tickets: number): number {
  const { flat, perHead } = splitExtraRevenue(
    offer?.extra_revenue,
    offer?.include_extra_revenue !== false,
  );
  return flat + perHead * tickets;
}

/** The night, computed at `pct` of the tickets on sale. */
export function downsideAt(offer: OfferWithShow, pct: number): DownsideResult {
  const anyOffer = offer as any;
  const sellable = (offer.ticket_tiers || []).reduce(
    (s, t) => s + Math.max(0, num(t.allotment) - num(t.comps)), 0,
  );
  const tickets = Math.floor(sellable * (pct / 100));

  const grossRevenue = revenueFor(offer, tickets, downsideMixOf(anyOffer));
  // Same money model as everywhere else: the fee only bites when it is inside
  // the price, and sales tax is on top and passes through.
  const terms = dealTermsOf(anyOffer);
  const netGross = netGrossOf(grossRevenue, tickets, num(offer.sales_tax_pct), terms.facilityFeePerTicket, terms.facilityFeeMode).netGross;

  // These follow the count down.
  const variableExpenses =
    netGross * num(anyOffer.ascap_rate) +
    netGross * num(anyOffer.bmi_rate) +
    netGross * num(anyOffer.sesac_rate) +
    netGross * num(anyOffer.cc_fee_rate) +
    tickets * num(anyOffer.insurance_per_attendee);

  // These do not.
  let fixedExpenses = calculateTotalExpenses(offer.expenses);
  fixedExpenses += (offer.support_acts || []).reduce((s, a: any) => s + num(a.guarantee), 0);
  if (anyOffer.include_hotel) fixedExpenses += num(anyOffer.hotel_budget) * num(anyOffer.hotel_nights, 1);
  if (anyOffer.include_transport) fixedExpenses += num(anyOffer.transport_budget);
  if (anyOffer.include_flights) fixedExpenses += num(anyOffer.flight_budget);
  if (anyOffer.include_rider) fixedExpenses += num(anyOffer.rider_cap);

  // What the artist costs at THIS attendance. A flat guarantee is flat whether
  // 40 people show up or 4,000; a percentage deal moves with the door, which
  // is exactly why a promoter picks one -- and why the bad night looks
  // different under each.
  const deal = computeDeal(netGross, variableExpenses + fixedExpenses, {
    dealType: dealTypeOf(anyOffer),
    guarantee: num(offer.guarantee),
    taxWithholdingPct: num(anyOffer.tax_withholding_pct),
    artistPercentage: terms.artistPercentage,
    artistPctBasis: terms.artistPctBasis,
    doorSplitBasis: terms.doorSplitBasis,
    artistBackendPct: num(anyOffer.artist_backend_pct, 85),
    promoterBackendPct: num(anyOffer.promoter_backend_pct, 15),
  });
  const artistCost = deal.artistCost;

  const extraRevenue = extrasFor(anyOffer, tickets);
  const profit = deal.netProfit + extraRevenue;

  return {
    pct,
    tickets,
    grossRevenue,
    netGross,
    variableExpenses,
    fixedExpenses,
    artistCost,
    extraRevenue,
    profit,
    survives: profit >= 0,
  };
}

export interface SurvivalRead {
  at50: DownsideResult;
  at70: DownsideResult;
  atFull: DownsideResult;
  /** Lowest attendance (as a % of tickets on sale) where the show still clears. */
  breakEvenPct: number;
  breakEvenTickets: number;
  /** One line a promoter can act on. */
  verdict: 'SAFE' | 'TIGHT' | 'FRAGILE' | 'UNDERWATER';
}

/** The three-number read: sellout, soft night, bad night. */
export function survivalRead(offer: OfferWithShow): SurvivalRead {
  const at50 = downsideAt(offer, 50);
  const at70 = downsideAt(offer, 70);
  const atFull = downsideAt(offer, 100);

  const sellable = (offer.ticket_tiers || []).reduce(
    (s, t) => s + Math.max(0, num(t.allotment) - num(t.comps)), 0,
  );

  // Walk the room a ticket at a time rather than dividing, because with
  // cheapest-first scaling each additional ticket is not worth the same.
  let breakEvenTickets = -1;
  if (sellable > 0 && atFull.profit >= 0) {
    let lo = 0;
    let hi = sellable;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      const p = downsideAt(offer, (mid / sellable) * 100).profit;
      if (p >= 0) hi = mid; else lo = mid + 1;
    }
    breakEvenTickets = lo;
  }
  const breakEvenPct = breakEvenTickets >= 0 && sellable > 0 ? (breakEvenTickets / sellable) * 100 : 999;

  let verdict: SurvivalRead['verdict'];
  if (atFull.profit < 0) verdict = 'UNDERWATER';
  else if (at50.survives) verdict = 'SAFE';
  else if (at70.survives) verdict = 'TIGHT';
  else verdict = 'FRAGILE';

  return { at50, at70, atFull, breakEvenPct, breakEvenTickets, verdict };
}
