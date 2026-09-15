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

function sellable(t: TicketTier, useActual: boolean) {
  return useActual && t.actualSold !== undefined ? n(t.actualSold) : n(t.allotment) - n(t.comps);
}

/** Same as calculateOffer() in the app. Result is stored in offers.calculations. */
export function calculateOffer(o: Offer, mode: "estimate" | "settlement" = "estimate") {
  const tiers: TicketTier[] = o.ticket_tiers || [];
  const salesTaxPct = n(o.sales_tax_pct);
  const guarantee = n(o.guarantee);
  const wh = n(o.tax_withholding_pct);
  const dealType = o.deal_type === "promoter_profit" ? "promoter_profit" : "flat_guarantee";
  const aPct = n(o.artist_backend_pct, 85);
  const pPct = n(o.promoter_backend_pct, 15);
  const r = variableRates(o);
  const useActual = mode === "settlement";

  const grossPotential = tiers.reduce((s, t) => s + sellable(t, useActual) * n(t.price), 0);
  const salesTax = grossPotential * (salesTaxPct / 100);
  const netGross = grossPotential - salesTax;
  const totalSellable = tiers.reduce((s, t) => s + sellable(t, useActual), 0);
  const variable = netGross * (r.ascap + r.bmi + r.sesac + r.cc) + totalSellable * r.insurance;

  const base = totalExpenses(o.expenses) + supportActsTotal(o) + accommodationTotal(o);
  const total = base + variable;

  let artistTotalPayout = guarantee * (1 - wh / 100);
  let promoterProfit = 0, profitPool = 0, artistBackend = 0, promoterBackend = 0;
  if (dealType === "promoter_profit") {
    profitPool = netGross - total - guarantee;
    if (profitPool > 0) {
      artistBackend = profitPool * (aPct / 100);
      promoterBackend = profitPool * (pPct / 100);
      artistTotalPayout = (guarantee + artistBackend) * (1 - wh / 100);
      promoterProfit = promoterBackend;
    }
  }
  const netProfit = netGross - total - artistTotalPayout / (1 - wh / 100);

  const proj = (pct: number) => {
    const tickets = Math.floor(tiers.reduce((s, t) => s + n(t.allotment) - n(t.comps), 0) * pct);
    const gp = tiers.reduce((s, t) => s + Math.floor((n(t.allotment) - n(t.comps)) * pct) * n(t.price), 0);
    const ng = gp - gp * (salesTaxPct / 100);
    const te = base + ng * (r.ascap + r.bmi + r.sesac + r.cc) + tickets * r.insurance;
    let ap = guarantee * (1 - wh / 100), pp = 0, hit = false;
    if (dealType === "promoter_profit") {
      const pool = ng - te - guarantee;
      if (pool > 0) {
        hit = true;
        ap = (guarantee + pool * (aPct / 100)) * (1 - wh / 100);
        pp = pool * (pPct / 100);
      }
    }
    return {
      tickets, grossPotential: gp, netGross: ng, artistPayout: ap, promoterProfit: pp,
      netProfit: ng - te - ap / (1 - wh / 100), splitPointHit: hit,
    };
  };

  const isPP = dealType === "promoter_profit";
  return {
    grossPotential, salesTax, netGross,
    totalExpenses: total,
    fixedExpensesTotal: base,
    variableExpensesTotal: variable,
    netProfit, artistTotalPayout,
    profitPool: isPP ? profitPool : undefined,
    promoterProfit: isPP ? promoterProfit : undefined,
    splitPoint: isPP ? guarantee + total : undefined,
    backend: isPP ? profitPool : undefined,
    artistBackend: isPP ? artistBackend : undefined,
    promoterBackend: isPP ? promoterBackend : undefined,
    projections: mode === "estimate"
      ? { capacity70: proj(0.7), capacity85: proj(0.85), capacity100: proj(1) }
      : undefined,
  };
}

/** The "Deal Summary" box on the Artist Deal tab (handles guarantee vs %, % only, door deal). */
export function dealSummary(o: Offer) {
  const tiers: TicketTier[] = o.ticket_tiers || [];
  const r = variableRates(o);
  const gross = tiers.reduce((s, t) => s + (n(t.allotment) - n(t.comps)) * n(t.price), 0);
  const netGross = gross - gross * (n(o.sales_tax_pct) / 100);
  const sell = tiers.reduce((s, t) => s + n(t.allotment) - n(t.comps), 0);
  const fixed = totalExpenses(o.expenses) + supportActsTotal(o) + accommodationTotal(o);
  const variable = netGross * (r.ascap + r.bmi + r.sesac + r.cc) + sell * r.insurance;
  const netRevenue = netGross - fixed - variable;
  const g = n(o.guarantee);
  const pct = n(o.artist_percentage, 100);
  let artistPayout: number;
  switch (o.deal_type) {
    case "guarantee_vs_percentage": artistPayout = Math.max(g, netRevenue * (pct / 100)); break;
    case "percentage_only":
    case "door_deal": artistPayout = netRevenue * (pct / 100); break;
    default: artistPayout = g;
  }
  return {
    deal_type: o.deal_type,
    gross_potential: gross,
    net_gross_after_sales_tax: netGross,
    total_expenses: fixed + variable,
    net_revenue_after_costs: netRevenue,
    artist_payout: artistPayout,
    promoter_profit: netRevenue - artistPayout,
  };
}

/** Break-even, scenarios, capital needed and risk score (Deal Analyzer). */
export function analyze(o: Offer, eventDate?: string) {
  const tiers: TicketTier[] = o.ticket_tiers || [];
  const calc = o.calculations && Object.keys(o.calculations).length ? o.calculations : calculateOffer(o);
  const fixed = n(calc.fixedExpensesTotal ?? calc.totalExpenses);
  const variable = n(calc.variableExpensesTotal);
  const totalCosts = fixed + variable + n(o.guarantee);
  const totalSellable = tiers.reduce((s, t) => s + n(t.allotment) - n(t.comps), 0);
  if (totalSellable <= 0) {
    return { error: "No sellable tickets yet — add ticket tiers (allotment and price) first." };
  }
  const avg = tiers.reduce((s, t) => s + n(t.price) * (n(t.allotment) - n(t.comps)), 0) / totalSellable;
  const tax = n(o.sales_tax_pct) / 100;
  const beGross = totalCosts / (1 - tax);
  const beTickets = avg > 0 ? Math.ceil(beGross / avg) : Infinity;
  const bePct = (beTickets / totalSellable) * 100;

  const scenarios = [50, 70, 85, 100].map((p) => {
    const tickets = Math.floor(totalSellable * (p / 100));
    const net = tickets * avg * (1 - tax);
    return { sold_pct: p, tickets, net_revenue: net, profit: net - totalCosts };
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
    break_even: {
      tickets: beTickets,
      percent_of_sellable: bePct,
      net_revenue: beGross * (1 - tax),
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
  const sold = attendance.reduce((s, t) => s + n(t.actual_sold), 0);
  const netGross = revenue - revenue * (n(o.sales_tax_pct) / 100);
  const r = variableRates(o);
  const variable = sold * n(o.facility_fee_per_ticket) +
    netGross * (r.ascap + r.bmi + r.sesac + r.cc) + sold * r.insurance;
  const total = base + supportActsTotal(o) + accommodationTotal(o, false) + variable;
  const artist = n(o.calculations?.artistTotalPayout);
  const profit = revenue - total - artist;
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
