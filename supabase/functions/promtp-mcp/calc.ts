// Deal math — ported from src/lib/calculations.ts, breakEvenCalculations.ts,
// artistCalculations.ts and the Settlement / ArtistDealTab screens so the MCP
// returns the same numbers the PROMTP app shows.

export interface TicketTier {
  type: string;
  allotment: number;
  comps: number;
  price: number;
  actualSold?: number;
}
export type Expenses = Record<string, Record<string, number>>;

const n = (v: unknown, d = 0): number => {
  const x = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(x) ? x : d;
};

export const DEFAULT_EXPENSES: Expenses = {
  talent: { rider_hospitality: 0 },
  general: { security: 0, emt: 0, gate_staff: 0 },
  marketing: { radio: 0, marketing: 0, paid_social: 0 },
  production: { production: 0, crew_stagehands: 0, camera_operator: 0, technical_director: 0 },
};

export function totalExpenses(expenses: Expenses | null | undefined): number {
  if (!expenses) return 0;
  return Object.values(expenses).reduce(
    (t, cat) => t + Object.values(cat || {}).reduce((s, v) => s + n(v), 0),
    0,
  );
}

// deno-lint-ignore no-explicit-any
type Offer = Record<string, any>;

function accommodationTotal(o: Offer, includeFlights = true): number {
  let t = 0;
  if (o.include_hotel && n(o.hotel_budget)) t += n(o.hotel_budget) * (n(o.hotel_nights) || 1);
  if (o.include_transport && n(o.transport_budget)) t += n(o.transport_budget);
  if (includeFlights && o.include_flights && n(o.flight_budget)) t += n(o.flight_budget);
  if (o.include_rider && n(o.rider_cap)) t += n(o.rider_cap);
  return t;
}

function supportActsTotal(o: Offer): number {
  return (o.support_acts || []).reduce((s: number, a: Offer) => s + n(a.guarantee), 0);
}

function variableRates(o: Offer) {
  return {
    ascap: n(o.ascap_rate, 0.0023),
    bmi: n(o.bmi_rate, 0.003),
    sesac: n(o.sesac_rate, 0.000214),
    insurance: n(o.insurance_per_attendee, 0.62),
    cc: n(o.cc_fee_rate, 0.012),
  };
}


const DEFAULT_CAR_OCCUPANCY = 2.5;
/** Bar, parking, vendor spots, sponsorship: the promoter's share, split into a
 *  flat part and a per-head part. Mirrors src/lib/calculations.ts. */
export function splitExtraRevenue(lines: Any[] = [], enabled = true) {
  if (!enabled || !Array.isArray(lines)) return { flat: 0, perHead: 0 };
  let flat = 0, perHead = 0;
  for (const l of lines) {
    if (!l) continue;
    const amount = Number(l.amount) || 0;
    const share = (Number(l.promoter_pct) ?? 100) / 100;
    if (!isFinite(amount) || amount === 0) continue;
    const mine = amount * (isFinite(share) ? Math.max(0, Math.min(1, share)) : 1);
    if (l.basis === "per_head") perHead += mine;
    else if (l.basis === "per_car") perHead += mine / (Number(l.occupancy) > 0 ? Number(l.occupancy) : DEFAULT_CAR_OCCUPANCY);
    else if (l.basis === "per_unit") flat += mine * (Number(l.units) || 0);
    else flat += mine;
  }
  return { flat, perHead };
}

function sellable(t: TicketTier, useActual: boolean) {
  return useActual && t.actualSold !== undefined ? n(t.actualSold) : n(t.allotment) - n(t.comps);
}

// ---------------------------------------------------------------------------
// THE MONEY MODEL. Mirrors src/lib/calculations.ts exactly. If one changes,
// change the other in the same commit.
//
// Jose's decisions, Sep 19 2026: sales tax is on top and passes through;
// the facility fee is on top by default (switchable to inside per show); the
// artist's percentage and a door split are of net after the promoter's costs
// (switchable to gross per show).
// ---------------------------------------------------------------------------
export type DealType = "flat_fee" | "flat_guarantee" | "promoter_profit" | "guarantee_vs_percentage" | "percentage_only" | "door_deal";
const DEAL_TYPES = new Set<string>(["flat_fee", "flat_guarantee", "promoter_profit", "guarantee_vs_percentage", "percentage_only", "door_deal"]);
export function dealTypeOf(o: Offer): DealType {
  return DEAL_TYPES.has(o.deal_type) ? (o.deal_type as DealType) : "flat_fee";
}
export function dealTermsOf(o: Offer) {
  return {
    facilityFeePerTicket: n(o.facility_fee_per_ticket),
    facilityFeeMode: (o.facility_fee_mode === "inside" ? "inside" : "on_top") as "inside" | "on_top",
    artistPercentage: n(o.artist_percentage),
    artistPctBasis: (o.artist_pct_basis === "gross" ? "gross" : "net_after_costs") as "gross" | "net_after_costs",
    doorSplitBasis: (o.door_split_basis === "gross" ? "gross" : "net_after_costs") as "gross" | "net_after_costs",
  };
}
export function netGrossOf(grossPotential: number, paidTickets: number, salesTaxPct: number, feePerTicket: number, feeMode: "on_top" | "inside") {
  const facilityFeeTotal = Math.max(0, n(feePerTicket)) * Math.max(0, paidTickets);
  const facilityFeeDeducted = feeMode === "inside" ? facilityFeeTotal : 0;
  const netGross = Math.max(0, grossPotential - facilityFeeDeducted);
  const salesTax = netGross * (n(salesTaxPct) / 100);
  return { grossPotential, facilityFeeTotal, facilityFeeDeducted, salesTax, netGross };
}
export function computeDeal(netGross: number, totalCosts: number, t: {
  dealType: DealType; guarantee: number; taxWithholdingPct: number;
  artistPercentage?: number; artistPctBasis?: "gross" | "net_after_costs"; doorSplitBasis?: "gross" | "net_after_costs";
  artistBackendPct?: number; promoterBackendPct?: number;
}) {
  const guarantee = Math.max(0, n(t.guarantee));
  const withhold = 1 - n(t.taxWithholdingPct) / 100;
  const pct = n(t.artistPercentage) / 100;
  const netAfterCosts = netGross - totalCosts;
  let artistCost = guarantee, artistBackend = 0, promoterBackend = 0, profitPool = 0, splitPoint = 0;
  let describe = `Flat guarantee of $${Math.round(guarantee).toLocaleString("en-US")}.`;
  switch (t.dealType) {
    case "guarantee_vs_percentage": {
      const basis = t.artistPctBasis === "gross" ? netGross : netAfterCosts;
      artistCost = Math.max(guarantee, Math.max(0, basis) * pct);
      artistBackend = Math.max(0, artistCost - guarantee);
      describe = `${Math.round(pct * 100)}% of ${t.artistPctBasis === "gross" ? "gross" : "net after your costs"} vs a $${Math.round(guarantee).toLocaleString("en-US")} guarantee, whichever is more.`;
      break;
    }
    case "percentage_only": {
      const basis = t.artistPctBasis === "gross" ? netGross : netAfterCosts;
      artistCost = Math.max(0, basis) * pct; artistBackend = artistCost;
      describe = `${Math.round(pct * 100)}% of ${t.artistPctBasis === "gross" ? "gross" : "net after your costs"}, no guarantee.`;
      break;
    }
    case "door_deal": {
      const basis = t.doorSplitBasis === "gross" ? netGross : netAfterCosts;
      artistCost = Math.max(0, basis) * pct; artistBackend = artistCost;
      describe = `Artist takes ${Math.round(pct * 100)}% of the door ${t.doorSplitBasis === "gross" ? "before" : "after"} your costs.`;
      break;
    }
    case "promoter_profit": {
      const aPct = n(t.artistBackendPct, 85) / 100, pPct = n(t.promoterBackendPct, 15) / 100;
      profitPool = netGross - totalCosts - guarantee; splitPoint = guarantee + totalCosts;
      if (profitPool > 0) { artistBackend = profitPool * aPct; promoterBackend = profitPool * pPct; artistCost = guarantee + artistBackend; }
      describe = `$${Math.round(guarantee).toLocaleString("en-US")} guarantee, then ${Math.round(aPct * 100)}/${Math.round(pPct * 100)} of what is left after costs.`;
      break;
    }
    default: artistCost = guarantee;
  }
  const artistTotalPayout = artistCost * withhold;
  const netProfit = netGross - totalCosts - artistCost;
  const promoterProfit = t.dealType === "promoter_profit" ? promoterBackend : netProfit;
  return { artistCost, artistTotalPayout, artistBackend, promoterBackend, promoterProfit, profitPool, splitPoint, netProfit, describe };
}

/** Same as calculateOffer() in the app. Result is stored in offers.calculations. */
export function calculateOffer(o: Offer, mode: "estimate" | "settlement" = "estimate") {
  const tiers: TicketTier[] = o.ticket_tiers || [];
  const salesTaxPct = n(o.sales_tax_pct);
  const guarantee = n(o.guarantee);
  const wh = n(o.tax_withholding_pct);
  const dealType = dealTypeOf(o);
  const terms = dealTermsOf(o);
  const aPct = n(o.artist_backend_pct, 85);
  const pPct = n(o.promoter_backend_pct, 15);
  const r = variableRates(o);
  const useActual = mode === "settlement";

  const grossPotential = tiers.reduce((s, t) => s + sellable(t, useActual) * n(t.price), 0);
  const totalSellable = tiers.reduce((s, t) => s + sellable(t, useActual), 0);
  const g = netGrossOf(grossPotential, totalSellable, salesTaxPct, terms.facilityFeePerTicket, terms.facilityFeeMode);
  const salesTax = g.salesTax, netGross = g.netGross;
  const variable = netGross * (r.ascap + r.bmi + r.sesac + r.cc) + totalSellable * r.insurance;

  const base = totalExpenses(o.expenses) + supportActsTotal(o) + accommodationTotal(o);
  const total = base + variable;

  const dealTerms = { dealType, guarantee, taxWithholdingPct: wh, artistPercentage: terms.artistPercentage, artistPctBasis: terms.artistPctBasis, doorSplitBasis: terms.doorSplitBasis, artistBackendPct: aPct, promoterBackendPct: pPct };
  const deal = computeDeal(netGross, total, dealTerms);

  // Same fill rule and the same bar/parking take as src/lib/calculations.ts.
  const extra = splitExtraRevenue(o.extra_revenue, o.include_extra_revenue !== false);
  const mix = o.downside_tier_mix === "blended" ? "blended" : "cheapest_first";
  const proj = (pct: number) => {
    const sellable = tiers.reduce((s, t) => s + n(t.allotment) - n(t.comps), 0);
    const tickets = Math.floor(sellable * pct);
    let gp = 0;
    if (pct >= 1) {
      gp = tiers.reduce((s, t) => s + Math.max(0, n(t.allotment) - n(t.comps)) * n(t.price), 0);
    } else if (mix === "blended") {
      const full = tiers.reduce((s, t) => s + Math.max(0, n(t.allotment) - n(t.comps)) * n(t.price), 0);
      gp = sellable > 0 ? (full / sellable) * tickets : 0;
    } else {
      let left = tickets;
      for (const t of tiers.map((t) => ({ price: n(t.price), seats: Math.max(0, n(t.allotment) - n(t.comps)) })).sort((a, b) => a.price - b.price)) {
        const take = Math.min(left, t.seats); gp += take * t.price; left -= take; if (left <= 0) break;
      }
    }
    const ng = netGrossOf(gp, tickets, salesTaxPct, terms.facilityFeePerTicket, terms.facilityFeeMode).netGross;
    const te = base + ng * (r.ascap + r.bmi + r.sesac + r.cc) + tickets * r.insurance;
    const d = computeDeal(ng, te, dealTerms);
    const extraHere = extra.flat + extra.perHead * tickets;
    const netProfit = d.netProfit + extraHere;
    return {
      tickets, grossPotential: gp, netGross: ng, artistPayout: d.artistTotalPayout,
      promoterProfit: dealType === "promoter_profit" ? d.promoterProfit + extraHere : netProfit,
      netProfit, splitPointHit: dealType === "promoter_profit" ? d.profitPool > 0 : netProfit >= 0,
    };
  };

  const isPP = dealType === "promoter_profit";
  const extraRevenueTotal = extra.flat + extra.perHead * totalSellable;
  return {
    extraRevenueTotal, extraRevenuePerHead: extra.perHead,
    grossPotential, salesTax, netGross,
    totalExpenses: total,
    totalShowCost: total + deal.artistCost,
    artistCost: deal.artistCost,
    facilityFeeTotal: g.facilityFeeTotal,
    facilityFeeDeducted: g.facilityFeeDeducted,
    dealDescription: deal.describe,
    fixedExpensesTotal: base,
    variableExpensesTotal: variable,
    netProfit: deal.netProfit + extraRevenueTotal, artistTotalPayout: deal.artistTotalPayout,
    profitPool: isPP ? deal.profitPool : undefined,
    promoterProfit: isPP ? deal.promoterProfit : undefined,
    splitPoint: isPP ? deal.splitPoint : undefined,
    backend: isPP ? deal.profitPool : undefined,
    artistBackend: deal.artistBackend > 0 ? deal.artistBackend : undefined,
    promoterBackend: isPP ? deal.promoterBackend : undefined,
    projections: mode === "estimate"
      ? { capacity50: proj(0.5), capacity70: proj(0.7), capacity100: proj(1) }
      : undefined,
  };
}

/** The "Deal Summary" box on the Artist Deal tab. Reads the shared model. */
export function dealSummary(o: Offer) {
  const tiers: TicketTier[] = o.ticket_tiers || [];
  const r = variableRates(o);
  const terms = dealTermsOf(o);
  const gross = tiers.reduce((s, t) => s + (n(t.allotment) - n(t.comps)) * n(t.price), 0);
  const sell = tiers.reduce((s, t) => s + n(t.allotment) - n(t.comps), 0);
  const netGross = netGrossOf(gross, sell, n(o.sales_tax_pct), terms.facilityFeePerTicket, terms.facilityFeeMode).netGross;
  const fixed = totalExpenses(o.expenses) + supportActsTotal(o) + accommodationTotal(o);
  const variable = netGross * (r.ascap + r.bmi + r.sesac + r.cc) + sell * r.insurance;
  const netRevenue = netGross - fixed - variable;
  const d = computeDeal(netGross, fixed + variable, {
    dealType: dealTypeOf(o), guarantee: n(o.guarantee), taxWithholdingPct: n(o.tax_withholding_pct),
    artistPercentage: terms.artistPercentage, artistPctBasis: terms.artistPctBasis, doorSplitBasis: terms.doorSplitBasis,
    artistBackendPct: n(o.artist_backend_pct, 85), promoterBackendPct: n(o.promoter_backend_pct, 15),
  });
  const artistPayout = d.artistCost;
  return {
    deal_type: o.deal_type,
    gross_potential: gross,
    net_gross: netGross,
    deal: d.describe,
    total_expenses: fixed + variable,
    net_revenue_after_costs: netRevenue,
    artist_payout: artistPayout,
    promoter_profit: netRevenue - artistPayout,
  };
}

/** Break-even, scenarios, capital needed and risk score (Deal Analyzer). */
export function analyze(o: Offer, eventDate?: string) {
  const tiers: TicketTier[] = o.ticket_tiers || [];
  const calc = calculateOffer(o);
  const totalCosts = n(calc.totalExpenses) + n(calc.artistCost); // show costs + artist at full sell-through
  const totalSellable = tiers.reduce((s, t) => s + n(t.allotment) - n(t.comps), 0);
  if (totalSellable <= 0) {
    return { error: "No sellable tickets yet — add ticket tiers (allotment and price) first." };
  }
  const avg = tiers.reduce((s, t) => s + n(t.price) * (n(t.allotment) - n(t.comps)), 0) / totalSellable;
  const r = variableRates(o);
  const terms = dealTermsOf(o);
  const dealTerms = {
    dealType: dealTypeOf(o), guarantee: n(o.guarantee), taxWithholdingPct: n(o.tax_withholding_pct),
    artistPercentage: terms.artistPercentage, artistPctBasis: terms.artistPctBasis, doorSplitBasis: terms.doorSplitBasis,
    artistBackendPct: n(o.artist_backend_pct, 85), promoterBackendPct: n(o.promoter_backend_pct, 15),
  };
  const fixed = n(calc.fixedExpensesTotal);
  // Same math as the app: tax on top (never deducted), fee per the show's switch, artist per the deal type.
  const at = (tickets: number) => {
    const ng = netGrossOf(tickets * avg, tickets, n(o.sales_tax_pct), terms.facilityFeePerTicket, terms.facilityFeeMode).netGross;
    const costs = fixed + ng * (r.ascap + r.bmi + r.sesac + r.cc) + tickets * r.insurance;
    const d = computeDeal(ng, costs, dealTerms);
    const r2 = (x: number) => Math.round(x * 100) / 100;
    return { net_revenue: r2(ng), profit: r2(d.promoterProfit) };
  };
  let beTickets = Infinity;
  if (avg > 0) {
    let lo = 0, hi = totalSellable;
    if (at(hi).profit < 0) beTickets = Infinity;
    else {
      while (lo < hi) { const mid = Math.floor((lo + hi) / 2); if (at(mid).profit >= 0) hi = mid; else lo = mid + 1; }
      beTickets = lo;
    }
  }
  const bePct = beTickets === Infinity ? 999 : Math.round((beTickets / totalSellable) * 1000) / 10;

  const scenarios = [50, 70, 85, 100].map((p) => {
    const tickets = Math.floor(totalSellable * (p / 100));
    const s = at(tickets);
    return { sold_pct: p, tickets, net_revenue: s.net_revenue, profit: s.profit };
  });

  const artistDeposit = n(o.guarantee) * (n(o.deposit_pct) / 100);
  const venueDeposit = n(o.venue_deposit);
  const marketing = Object.values(o.expenses?.marketing || {}).reduce((s: number, v) => s + n(v), 0);

  const days = eventDate
    ? Math.max(0, Math.floor((new Date(eventDate).getTime() - Date.now()) / 86400000))
    : null;
  const timeRisk = days !== null && days < 30 ? ((30 - days) / 30) * 40 : 0;
  const mktPct = totalCosts > 0 ? (marketing / totalCosts) * 100 : 0;
  const mktRisk = mktPct < 15 ? (15 - mktPct) * 2 : 0;
  const risk = Math.min(100, bePct * 0.6 + timeRisk + mktRisk);

  return {
    total_costs_including_artist: totalCosts,
    average_ticket_price: avg,
    total_sellable_tickets: totalSellable,
    break_even: beTickets === Infinity
      ? { tickets: null, percent_of_sellable: null, net_revenue: null, ticket_buffer: null, confidence: "LOW", note: "Does not break even even at a sellout." }
      : {
        tickets: beTickets,
        percent_of_sellable: bePct,
        net_revenue: at(beTickets).net_revenue,
        ticket_buffer: totalSellable - beTickets,
        confidence: bePct < 50 ? "HIGH" : bePct < 70 ? "MEDIUM" : "LOW",
      },
    scenarios,
    capital_required_upfront: {
      total: artistDeposit + venueDeposit + marketing,
      artist_deposit: artistDeposit,
      venue_deposit: venueDeposit,
      marketing,
    },
    days_until_event: days,
    risk_score_0_to_100: Math.round(risk),
  };
}

/** Same math as the Settlement screen. */
export function settlementActuals(
  o: Offer,
  attendance: { type: string; price: number; actual_sold: number; projected_sold?: number }[],
  actualExpenses: Expenses,
) {
  const revenue = attendance.reduce((s, t) => s + n(t.actual_sold) * n(t.price), 0);
  const base = Object.entries(actualExpenses || {}).reduce(
    (s, [k, cat]) => (k === "support_acts" ? s : s + Object.values(cat || {}).reduce((a, v) => a + n(v), 0)),
    0,
  );
  const sold = attendance.filter((t) => n(t.price) > 0).reduce((s, t) => s + n(t.actual_sold), 0);
  const terms = dealTermsOf(o);
  const netGross = netGrossOf(revenue, sold, n(o.sales_tax_pct), terms.facilityFeePerTicket, terms.facilityFeeMode).netGross;
  const r = variableRates(o);
  const variable = netGross * (r.ascap + r.bmi + r.sesac + r.cc) + sold * r.insurance;
  const total = base + supportActsTotal(o) + accommodationTotal(o, false) + variable;
  // The artist is paid on what actually sold, whatever the deal says.
  const artist = computeDeal(netGross, total, {
    dealType: dealTypeOf(o), guarantee: n(o.guarantee), taxWithholdingPct: n(o.tax_withholding_pct),
    artistPercentage: terms.artistPercentage, artistPctBasis: terms.artistPctBasis, doorSplitBasis: terms.doorSplitBasis,
    artistBackendPct: n(o.artist_backend_pct, 85), promoterBackendPct: n(o.promoter_backend_pct, 15),
  }).artistCost;
  const profit = netGross - total - artist;
  return {
    actual_revenue: revenue,
    actual_total_expenses: total,
    actual_profit: profit,
    variance_revenue: revenue - n(o.calculations?.grossPotential),
    variance_expenses: total - n(o.calculations?.totalExpenses),
    variance_profit: profit - n(o.calculations?.netProfit),
  };
}

/** Artist lineup card math. */
// deno-lint-ignore no-explicit-any
export function artistCost(a: Record<string, any>) {
  const g = n(a.guarantee);
  let dep = a.deposit_type === "percentage" ? g * (n(a.deposit_percentage) / 100) : n(a.deposit_amount);
  dep = Math.min(dep, g);
  const travel = (a.flight_covered ? n(a.flight_budget) : 0) +
    (a.hotel_covered ? n(a.hotel_budget) * (n(a.hotel_nights) || 1) : 0) +
    (a.ground_transport_covered ? n(a.ground_transport_budget) : 0);
  const hosp = n(a.hospitality_buyout) + n(a.dinner_buyout);
  return { guarantee: g, deposit: dep, balance: Math.max(g - dep, 0), travel, hospitality: hosp, total: g + travel + hosp };
}
