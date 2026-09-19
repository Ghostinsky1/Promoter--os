import type { TicketTier, Expenses, Calculations, ProjectionResult, SupportAct, ExtraRevenueLine } from '../types';

/** People per car when nothing else is set. Club nights carpool. */
export const DEFAULT_CAR_OCCUPANCY = 2.5;

/** Cars for a given crowd, at a given people-per-car. */
export function carsFor(paidAttendance: number, occupancy = DEFAULT_CAR_OCCUPANCY): number {
  const per = Number(occupancy) > 0 ? Number(occupancy) : DEFAULT_CAR_OCCUPANCY;
  return Math.max(0, Math.round((paidAttendance || 0) / per));
}

/**
 * Bar, coat check, VIP tables, sponsorship, parking — the promoter's share only.
 *
 * Split into two numbers on purpose:
 *  - flat: a total for the night, whatever the crowd is
 *  - perHead: dollars per paid ticket, so a slow night doesn't leave a made-up
 *    number sitting in the profit line
 *
 * Parking is entered per CAR and converted here, because 400 people is not 400
 * cars — at 2.5 to a car it's about 160.
 *
 * This money is deliberately kept OUT of the artist's backend pot. On a
 * guarantee-vs-percentage deal the artist splits net box office, not the bar.
 */
export function splitExtraRevenue(lines: ExtraRevenueLine[] = [], enabled = true) {
  if (!enabled || !Array.isArray(lines)) return { flat: 0, perHead: 0 };
  let flat = 0;
  let perHead = 0;
  for (const l of lines) {
    if (!l) continue;
    const amount = Number(l.amount) || 0;
    const share = (Number(l.promoter_pct) ?? 100) / 100;
    if (!isFinite(amount) || amount === 0) continue;
    const mine = amount * (isFinite(share) ? Math.max(0, Math.min(1, share)) : 1);
    if (l.basis === 'per_head') perHead += mine;
    else if (l.basis === 'per_car') perHead += mine / (Number(l.occupancy) > 0 ? Number(l.occupancy) : DEFAULT_CAR_OCCUPANCY);
    // per_unit is a count you set rather than one that follows the crowd —
    // truck spots, vendor booths, tables — so it behaves like a flat total.
    else if (l.basis === 'per_unit') flat += mine * (Number(l.units) || 0);
    else flat += mine;
  }
  return { flat, perHead };
}

/** Total promoter share of extra revenue at a given paid attendance. */
export function extraRevenueAt(lines: ExtraRevenueLine[] = [], paidAttendance: number, enabled = true) {
  const { flat, perHead } = splitExtraRevenue(lines, enabled);
  return flat + perHead * Math.max(0, paidAttendance || 0);
}

/**
 * THE MONEY MODEL. Every path that turns tickets into profit -- the offer
 * engine, the estimate hook, the bad-night test, break-even, the PDF, the
 * settlement, the connector -- goes through these two functions. There used
 * to be four separate copies of this arithmetic and only one of them knew
 * what a percentage deal was; the one that got saved did not.
 *
 * Jose's decisions, Sep 19 2026:
 *   - Sales tax is added on top of the ticket price and is NOT the promoter's
 *     money. It passes through. It never reduces net gross.
 *   - The facility fee is added on top by default: the venue charges it and
 *     keeps it, neutral to the promoter. Per show it can be switched to
 *     "inside", where it is carved out of the face price first.
 *   - The artist's percentage is of net AFTER the promoter's costs, switchable
 *     per show to a share of gross.
 *   - A door split is after the promoter's costs, switchable per show.
 */
export type DealType =
  | 'flat_fee' | 'flat_guarantee' | 'promoter_profit'
  | 'guarantee_vs_percentage' | 'percentage_only' | 'door_deal';
export type FacilityFeeMode = 'on_top' | 'inside';
export type PctBasis = 'net_after_costs' | 'gross';

export interface DealTerms {
  dealType: DealType;
  guarantee: number;
  taxWithholdingPct: number;
  /** For guarantee_vs_percentage, percentage_only and door_deal. */
  artistPercentage?: number;
  artistPctBasis?: PctBasis;
  doorSplitBasis?: PctBasis;
  /** For promoter_profit only. */
  artistBackendPct?: number;
  promoterBackendPct?: number;
}

export interface GrossResult {
  /** Face value of every paid ticket. */
  grossPotential: number;
  facilityFeeTotal: number;
  /** What the facility fee did to the promoter's gross: 0 when on top. */
  facilityFeeDeducted: number;
  /** Informational. Collected on top and remitted; never the promoter's. */
  salesTax: number;
  /** The promoter's gross. Equals grossPotential unless the fee is inside. */
  netGross: number;
}

const nz = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

/** From face value to the promoter's gross. */
export function netGrossOf(
  grossPotential: number,
  paidTickets: number,
  salesTaxPct: number,
  facilityFeePerTicket: number,
  facilityFeeMode: FacilityFeeMode = 'on_top',
): GrossResult {
  const facilityFeeTotal = Math.max(0, nz(facilityFeePerTicket)) * Math.max(0, paidTickets);
  const facilityFeeDeducted = facilityFeeMode === 'inside' ? facilityFeeTotal : 0;
  const netGross = Math.max(0, grossPotential - facilityFeeDeducted);
  // Charged on what the promoter actually sells for, on top, passed through.
  const salesTax = netGross * (nz(salesTaxPct) / 100);
  return { grossPotential, facilityFeeTotal, facilityFeeDeducted, salesTax, netGross };
}

export interface DealResult {
  /** What the show pays the artist, before withholding. The cost to the promoter. */
  artistCost: number;
  /** What the artist actually receives, after withholding. */
  artistTotalPayout: number;
  /** The percentage-driven part of artistCost, where there is one. */
  artistBackend: number;
  /** For promoter_profit deals. */
  promoterBackend: number;
  promoterProfit: number;
  profitPool: number;
  splitPoint: number;
  /** netGross - costs - artistCost. Extras are added by the caller. */
  netProfit: number;
  /** One line, in the promoter's terms, for screens and the PDF. */
  describe: string;
}

/** From the promoter's gross and costs to what the artist gets and what is left. */
export function computeDeal(netGross: number, totalCosts: number, t: DealTerms): DealResult {
  const guarantee = Math.max(0, nz(t.guarantee));
  const withhold = 1 - nz(t.taxWithholdingPct) / 100;
  const pct = nz(t.artistPercentage) / 100;
  const netAfterCosts = netGross - totalCosts;

  let artistCost = guarantee;
  let artistBackend = 0;
  let promoterBackend = 0;
  let profitPool = 0;
  let splitPoint = 0;
  let describe = `Flat guarantee of $${Math.round(guarantee).toLocaleString('en-US')}.`;

  switch (t.dealType) {
    case 'guarantee_vs_percentage': {
      const basis = t.artistPctBasis === 'gross' ? netGross : netAfterCosts;
      const pctAmount = Math.max(0, basis) * pct;
      artistCost = Math.max(guarantee, pctAmount);
      artistBackend = Math.max(0, artistCost - guarantee);
      describe = `${Math.round(pct * 100)}% of ${t.artistPctBasis === 'gross' ? 'gross' : 'net after your costs'} vs a $${Math.round(guarantee).toLocaleString('en-US')} guarantee, whichever is more.`;
      break;
    }
    case 'percentage_only': {
      const basis = t.artistPctBasis === 'gross' ? netGross : netAfterCosts;
      artistCost = Math.max(0, basis) * pct;
      artistBackend = artistCost;
      describe = `${Math.round(pct * 100)}% of ${t.artistPctBasis === 'gross' ? 'gross' : 'net after your costs'}, no guarantee.`;
      break;
    }
    case 'door_deal': {
      const basis = t.doorSplitBasis === 'gross' ? netGross : netAfterCosts;
      artistCost = Math.max(0, basis) * pct;
      artistBackend = artistCost;
      describe = `Artist takes ${Math.round(pct * 100)}% of the door ${t.doorSplitBasis === 'gross' ? 'before' : 'after'} your costs.`;
      break;
    }
    case 'promoter_profit': {
      const aPct = nz(t.artistBackendPct, 85) / 100;
      const pPct = nz(t.promoterBackendPct, 15) / 100;
      profitPool = netGross - totalCosts - guarantee;
      splitPoint = guarantee + totalCosts;
      if (profitPool > 0) {
        artistBackend = profitPool * aPct;
        promoterBackend = profitPool * pPct;
        artistCost = guarantee + artistBackend;
      }
      describe = `$${Math.round(guarantee).toLocaleString('en-US')} guarantee, then ${Math.round(aPct * 100)}/${Math.round(pPct * 100)} of what is left after costs.`;
      break;
    }
    default:
      artistCost = guarantee;
  }

  const artistTotalPayout = artistCost * withhold;
  const netProfit = netGross - totalCosts - artistCost;
  const promoterProfit = t.dealType === 'promoter_profit' ? promoterBackend : netProfit;

  return { artistCost, artistTotalPayout, artistBackend, promoterBackend, promoterProfit, profitPool, splitPoint, netProfit, describe };
}

export function calculateOffer(
  ticketTiers: TicketTier[],
  salesTaxPct: number,
  expenses: Expenses,
  guarantee: number,
  taxWithholdingPct: number,
  dealType: DealType,
  mode: 'estimate' | 'settlement',
  artistBackendPct: number = 85,
  promoterBackendPct: number = 15,
  supportActs: SupportAct[] = [],
  accommodationCosts?: {
    includeHotel?: boolean;
    hotelBudget?: number;
    hotelNights?: number;
    includeTransport?: boolean;
    transportBudget?: number;
    includeFlights?: boolean;
    flightBudget?: number;
    includeRider?: boolean;
    riderCap?: number;
  },
  variableRates?: {
    ascapRate?: number;
    bmiRate?: number;
    sesacRate?: number;
    insurancePerAttendee?: number;
    ccFeeRate?: number;
  },
  extraRevenue?: { include?: boolean; lines?: ExtraRevenueLine[] },
  terms?: {
    facilityFeePerTicket?: number;
    facilityFeeMode?: FacilityFeeMode;
    artistPercentage?: number;
    artistPctBasis?: PctBasis;
    doorSplitBasis?: PctBasis;
  },
): Calculations {
  const supportActsCost = supportActs.reduce((sum, act) => sum + act.guarantee, 0);

  // Calculate accommodation costs
  let accommodationTotal = 0;
  if (accommodationCosts) {
    if (accommodationCosts.includeHotel && accommodationCosts.hotelBudget) {
      accommodationTotal += accommodationCosts.hotelBudget * (accommodationCosts.hotelNights || 1);
    }
    if (accommodationCosts.includeTransport && accommodationCosts.transportBudget) {
      accommodationTotal += accommodationCosts.transportBudget;
    }
    if (accommodationCosts.includeFlights && accommodationCosts.flightBudget) {
      accommodationTotal += accommodationCosts.flightBudget;
    }
    if (accommodationCosts.includeRider && accommodationCosts.riderCap) {
      accommodationTotal += accommodationCosts.riderCap;
    }
  }

  // Calculate gross potential first (needed for variable expenses)
  const grossPotential = ticketTiers.reduce((sum, tier) => {
    const tickets = mode === 'settlement' && tier.actualSold !== undefined
      ? tier.actualSold
      : (tier.allotment - tier.comps);
    return sum + (tickets * tier.price);
  }, 0);

  // Paid heads drive anything charged per person.
  const paidAttendance = ticketTiers.reduce((sum, tier) => {
    const tickets = mode === 'settlement' && tier.actualSold !== undefined
      ? tier.actualSold
      : (tier.allotment - tier.comps);
    return sum + tickets;
  }, 0);

  const g = netGrossOf(grossPotential, paidAttendance, salesTaxPct, terms?.facilityFeePerTicket ?? 0, terms?.facilityFeeMode ?? 'on_top');
  const salesTax = g.salesTax;
  const netGross = g.netGross;

  const extra = splitExtraRevenue(extraRevenue?.lines, extraRevenue?.include !== false);
  const extraRevenueTotal = extra.flat + extra.perHead * paidAttendance;

  // Calculate variable expenses
  let variableExpenses = 0;
  if (variableRates) {
    const totalSellable = ticketTiers.reduce((sum, tier) => {
      const tickets = mode === 'settlement' && tier.actualSold !== undefined
        ? tier.actualSold
        : (tier.allotment - tier.comps);
      return sum + tickets;
    }, 0);

    variableExpenses += netGross * (variableRates.ascapRate || 0);
    variableExpenses += netGross * (variableRates.bmiRate || 0);
    variableExpenses += netGross * (variableRates.sesacRate || 0);
    variableExpenses += totalSellable * (variableRates.insurancePerAttendee || 0);
    variableExpenses += netGross * (variableRates.ccFeeRate || 0);
  }

  const fixedExpensesTotal = calculateTotalExpenses(expenses) + supportActsCost + accommodationTotal;
  const totalExpenses = fixedExpensesTotal + variableExpenses;

  const deal = computeDeal(netGross, totalExpenses, {
    dealType, guarantee, taxWithholdingPct,
    artistPercentage: terms?.artistPercentage,
    artistPctBasis: terms?.artistPctBasis,
    doorSplitBasis: terms?.doorSplitBasis,
    artistBackendPct, promoterBackendPct,
  });
  const artistTotalPayout = deal.artistTotalPayout;
  const promoterProfit = deal.promoterProfit;
  const splitPoint = deal.splitPoint;
  const backend = deal.profitPool;
  const artistBackend = deal.artistBackend;
  const promoterBackend = deal.promoterBackend;
  const profitPool = deal.profitPool;

  // Extra revenue lands in the promoter's pocket after the artist is paid. It is
  // intentionally absent from the deal above, so the artist's percentage is
  // calculated on box office alone.
  const netProfit = deal.netProfit + extraRevenueTotal;

  const baseExpenses = calculateTotalExpenses(expenses) + supportActsCost + accommodationTotal;

  const projections = mode === 'estimate' ? {
    capacity70: calculateProjection(ticketTiers, 0.7, salesTaxPct, baseExpenses, guarantee, taxWithholdingPct, dealType, artistBackendPct, promoterBackendPct, variableRates, terms),
    capacity85: calculateProjection(ticketTiers, 0.85, salesTaxPct, baseExpenses, guarantee, taxWithholdingPct, dealType, artistBackendPct, promoterBackendPct, variableRates, terms),
    capacity100: calculateProjection(ticketTiers, 1.0, salesTaxPct, baseExpenses, guarantee, taxWithholdingPct, dealType, artistBackendPct, promoterBackendPct, variableRates, terms),
  } : undefined;

  return {
    grossPotential,
    salesTax,
    netGross,
    totalExpenses,
    fixedExpensesTotal,
    variableExpensesTotal: variableExpenses,
    netProfit,
    // Artist money is a cost of the night like any other. totalExpenses leaves it
    // out because the profit formula subtracts it separately; every screen that
    // says "expenses" should use this instead.
    totalShowCost: totalExpenses + deal.artistCost,
    artistCost: deal.artistCost,
    facilityFeeTotal: g.facilityFeeTotal,
    facilityFeeDeducted: g.facilityFeeDeducted,
    dealDescription: deal.describe,
    extraRevenueTotal,
    extraRevenuePerHead: extra.perHead,
    artistTotalPayout,
    profitPool: dealType === 'promoter_profit' ? profitPool : undefined,
    promoterProfit: dealType === 'promoter_profit' ? promoterProfit : undefined,
    splitPoint: dealType === 'promoter_profit' ? splitPoint : undefined,
    backend: dealType === 'promoter_profit' ? backend : undefined,
    artistBackend: artistBackend > 0 ? artistBackend : undefined,
    promoterBackend: dealType === 'promoter_profit' ? promoterBackend : undefined,
    projections,
  };
}

function calculateProjection(
  ticketTiers: TicketTier[],
  capacityPct: number,
  salesTaxPct: number,
  baseExpenses: number,
  guarantee: number,
  taxWithholdingPct: number,
  dealType: DealType,
  artistBackendPct: number = 85,
  promoterBackendPct: number = 15,
  variableRates?: {
    ascapRate?: number;
    bmiRate?: number;
    sesacRate?: number;
    insurancePerAttendee?: number;
    ccFeeRate?: number;
  },
  terms?: {
    facilityFeePerTicket?: number;
    facilityFeeMode?: FacilityFeeMode;
    artistPercentage?: number;
    artistPctBasis?: PctBasis;
    doorSplitBasis?: PctBasis;
  },
): ProjectionResult {
  const totalSellable = ticketTiers.reduce((sum, tier) => sum + (tier.allotment - tier.comps), 0);
  const projectedTickets = Math.floor(totalSellable * capacityPct);

  const grossPotential = ticketTiers.reduce((sum, tier) => {
    const tierSellable = tier.allotment - tier.comps;
    const tierProjected = Math.floor(tierSellable * capacityPct);
    return sum + (tierProjected * tier.price);
  }, 0);

  // Same money model as the full offer, at this attendance.
  const g = netGrossOf(grossPotential, projectedTickets, salesTaxPct, terms?.facilityFeePerTicket ?? 0, terms?.facilityFeeMode ?? 'on_top');
  const netGross = g.netGross;

  let variableExpenses = 0;
  if (variableRates) {
    variableExpenses += netGross * (variableRates.ascapRate || 0);
    variableExpenses += netGross * (variableRates.bmiRate || 0);
    variableExpenses += netGross * (variableRates.sesacRate || 0);
    variableExpenses += projectedTickets * (variableRates.insurancePerAttendee || 0);
    variableExpenses += netGross * (variableRates.ccFeeRate || 0);
  }

  const totalExpenses = baseExpenses + variableExpenses;

  const deal = computeDeal(netGross, totalExpenses, {
    dealType, guarantee, taxWithholdingPct,
    artistPercentage: terms?.artistPercentage,
    artistPctBasis: terms?.artistPctBasis,
    doorSplitBasis: terms?.doorSplitBasis,
    artistBackendPct, promoterBackendPct,
  });

  return {
    tickets: projectedTickets,
    grossPotential,
    netGross,
    artistPayout: deal.artistTotalPayout,
    promoterProfit: deal.promoterProfit,
    netProfit: deal.netProfit,
    splitPointHit: dealType === 'promoter_profit' ? deal.profitPool > 0 : deal.netProfit >= 0,
  };
}

export function calculateTotalExpenses(expenses: Expenses): number {
  // Values can arrive as strings from form inputs. Without Number() the reduce
  // concatenates them ("100" + "250" = "100250") instead of adding.
  if (!expenses || typeof expenses !== 'object') return 0;
  return Object.values(expenses).reduce((total: number, category: any) => {
    if (!category || typeof category !== 'object') return total;
    return total + Object.values(category).reduce((sum: number, val: any) => {
      const num = Number(val);
      return sum + (isFinite(num) ? num : 0);
    }, 0);
  }, 0);
}

export function calculateCategoryTotal(category: Record<string, number>): number {
  return Object.values(category).reduce((sum, val) => sum + val, 0);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

export function getExpenseBreakdown(calculations: Calculations, guarantee: number) {
  const fixed = calculations.fixedExpensesTotal ?? calculations.totalExpenses;
  const variable = calculations.variableExpensesTotal ?? 0;
  const artistPayout = guarantee;
  return {
    fixedExpensesTotal: fixed,
    variableExpensesTotal: variable,
    artistPayout,
    totalExpenses: fixed + variable + artistPayout,
  };
}


/**
 * Offers can arrive with no calculations at all — created by the AI connector,
 * an import, or an older build. Every screen used to read straight through
 * `offer.calculations.totalExpenses`, which on those offers is undefined, and
 * the page filled with NaN and "$NaN". Run the offer through this first.
 */
/** The deal switches as stored on an offer row, with the decided defaults. */
export function dealTermsOf(offer: any) {
  return {
    facilityFeePerTicket: Number(offer?.facility_fee_per_ticket) || 0,
    facilityFeeMode: (offer?.facility_fee_mode === 'inside' ? 'inside' : 'on_top') as FacilityFeeMode,
    artistPercentage: Number(offer?.artist_percentage) || 0,
    artistPctBasis: (offer?.artist_pct_basis === 'gross' ? 'gross' : 'net_after_costs') as PctBasis,
    doorSplitBasis: (offer?.door_split_basis === 'gross' ? 'gross' : 'net_after_costs') as PctBasis,
  };
}

const DEAL_TYPES = new Set<DealType>(['flat_fee', 'flat_guarantee', 'promoter_profit', 'guarantee_vs_percentage', 'percentage_only', 'door_deal']);
export function dealTypeOf(offer: any): DealType {
  return DEAL_TYPES.has(offer?.deal_type) ? offer.deal_type : 'flat_fee';
}

/** Recompute an offer's calculations from its own row. The one way to do it. */
export function calculateFromOffer(offer: any, mode: 'estimate' | 'settlement' = 'estimate'): Calculations {
  return calculateOffer(
    offer?.ticket_tiers || [],
    Number(offer?.sales_tax_pct) || 0,
    offer?.expenses || { talent: {}, general: {}, marketing: {}, production: {} },
    Number(offer?.guarantee) || 0,
    Number(offer?.tax_withholding_pct) || 0,
    dealTypeOf(offer),
    mode,
    Number(offer?.artist_backend_pct) || 85,
    Number(offer?.promoter_backend_pct) || 15,
    offer?.support_acts || [],
    {
      includeHotel: offer?.include_hotel,
      hotelBudget: Number(offer?.hotel_budget) || 0,
      hotelNights: Number(offer?.hotel_nights) || 1,
      includeTransport: offer?.include_transport,
      transportBudget: Number(offer?.transport_budget) || 0,
      includeFlights: offer?.include_flights,
      flightBudget: Number(offer?.flight_budget) || 0,
      includeRider: offer?.include_rider,
      riderCap: Number(offer?.rider_cap) || 0,
    },
    {
      ascapRate: Number(offer?.ascap_rate) || 0,
      bmiRate: Number(offer?.bmi_rate) || 0,
      sesacRate: Number(offer?.sesac_rate) || 0,
      insurancePerAttendee: Number(offer?.insurance_per_attendee) || 0,
      ccFeeRate: Number(offer?.cc_fee_rate) || 0,
    },
    { include: offer?.include_extra_revenue, lines: offer?.extra_revenue || [] },
    dealTermsOf(offer),
  );
}

export function ensureCalculations(offer: any): Calculations {
  const c = offer?.calculations;
  if (c && typeof c === 'object' && typeof c.totalExpenses === 'number') return c as Calculations;
  return calculateFromOffer(offer);
}
