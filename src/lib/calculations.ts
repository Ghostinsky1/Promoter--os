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

export function calculateOffer(
  ticketTiers: TicketTier[],
  salesTaxPct: number,
  expenses: Expenses,
  guarantee: number,
  taxWithholdingPct: number,
  dealType: 'flat_guarantee' | 'promoter_profit',
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
  extraRevenue?: { include?: boolean; lines?: ExtraRevenueLine[] }
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

  const salesTax = grossPotential * (salesTaxPct / 100);
  const netGross = grossPotential - salesTax;

  // Paid heads drive anything charged per person.
  const paidAttendance = ticketTiers.reduce((sum, tier) => {
    const tickets = mode === 'settlement' && tier.actualSold !== undefined
      ? tier.actualSold
      : (tier.allotment - tier.comps);
    return sum + tickets;
  }, 0);

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

  let artistTotalPayout = guarantee * (1 - taxWithholdingPct / 100);
  let promoterProfit = 0;
  let splitPoint = 0;
  let backend = 0;
  let artistBackend = 0;
  let promoterBackend = 0;
  let profitPool = 0;

  if (dealType === 'promoter_profit') {
    profitPool = netGross - totalExpenses - guarantee;

    if (profitPool > 0) {
      artistBackend = profitPool * (artistBackendPct / 100);
      promoterBackend = profitPool * (promoterBackendPct / 100);
      artistTotalPayout = (guarantee + artistBackend) * (1 - taxWithholdingPct / 100);
      promoterProfit = promoterBackend;
    }

    splitPoint = guarantee + totalExpenses;
    backend = profitPool;
  }

  // Extra revenue lands in the promoter's pocket after the artist is paid. It is
  // intentionally absent from profitPool above, so the artist's percentage is
  // calculated on box office alone.
  const netProfit = netGross - totalExpenses - artistTotalPayout / (1 - taxWithholdingPct / 100) + extraRevenueTotal;

  const baseExpenses = calculateTotalExpenses(expenses) + supportActsCost + accommodationTotal;

  const projections = mode === 'estimate' ? {
    capacity70: calculateProjection(ticketTiers, 0.7, salesTaxPct, baseExpenses, guarantee, taxWithholdingPct, dealType, artistBackendPct, promoterBackendPct, variableRates),
    capacity85: calculateProjection(ticketTiers, 0.85, salesTaxPct, baseExpenses, guarantee, taxWithholdingPct, dealType, artistBackendPct, promoterBackendPct, variableRates),
    capacity100: calculateProjection(ticketTiers, 1.0, salesTaxPct, baseExpenses, guarantee, taxWithholdingPct, dealType, artistBackendPct, promoterBackendPct, variableRates),
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
    totalShowCost: totalExpenses + artistTotalPayout / (1 - taxWithholdingPct / 100),
    extraRevenueTotal,
    extraRevenuePerHead: extra.perHead,
    artistTotalPayout,
    profitPool: dealType === 'promoter_profit' ? profitPool : undefined,
    promoterProfit: dealType === 'promoter_profit' ? promoterProfit : undefined,
    splitPoint: dealType === 'promoter_profit' ? splitPoint : undefined,
    backend: dealType === 'promoter_profit' ? backend : undefined,
    artistBackend: dealType === 'promoter_profit' ? artistBackend : undefined,
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
  dealType: 'flat_guarantee' | 'promoter_profit',
  artistBackendPct: number = 85,
  promoterBackendPct: number = 15,
  variableRates?: {
    ascapRate?: number;
    bmiRate?: number;
    sesacRate?: number;
    insurancePerAttendee?: number;
    ccFeeRate?: number;
  }
): ProjectionResult {
  const totalSellable = ticketTiers.reduce((sum, tier) => sum + (tier.allotment - tier.comps), 0);
  const projectedTickets = Math.floor(totalSellable * capacityPct);

  const grossPotential = ticketTiers.reduce((sum, tier) => {
    const tierSellable = tier.allotment - tier.comps;
    const tierProjected = Math.floor(tierSellable * capacityPct);
    return sum + (tierProjected * tier.price);
  }, 0);

  const salesTax = grossPotential * (salesTaxPct / 100);
  const netGross = grossPotential - salesTax;

  // Calculate variable expenses for this projection
  let variableExpenses = 0;
  if (variableRates) {
    variableExpenses += netGross * (variableRates.ascapRate || 0);
    variableExpenses += netGross * (variableRates.bmiRate || 0);
    variableExpenses += netGross * (variableRates.sesacRate || 0);
    variableExpenses += projectedTickets * (variableRates.insurancePerAttendee || 0);
    variableExpenses += netGross * (variableRates.ccFeeRate || 0);
  }

  const totalExpenses = baseExpenses + variableExpenses;

  let artistPayout = guarantee * (1 - taxWithholdingPct / 100);
  let promoterProfit = 0;
  let splitPointHit = false;

  if (dealType === 'promoter_profit') {
    const profitPool = netGross - totalExpenses - guarantee;

    if (profitPool > 0) {
      splitPointHit = true;
      const artistBackend = profitPool * (artistBackendPct / 100);
      const promoterBackend = profitPool * (promoterBackendPct / 100);
      artistPayout = (guarantee + artistBackend) * (1 - taxWithholdingPct / 100);
      promoterProfit = promoterBackend;
    }
  }

  const netProfit = netGross - totalExpenses - artistPayout / (1 - taxWithholdingPct / 100);

  return {
    tickets: projectedTickets,
    grossPotential,
    netGross,
    artistPayout,
    promoterProfit,
    netProfit,
    splitPointHit,
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
export function ensureCalculations(offer: any): Calculations {
  const c = offer?.calculations;
  if (c && typeof c === 'object' && typeof c.totalExpenses === 'number') return c as Calculations;

  return calculateOffer(
    offer?.ticket_tiers || [],
    Number(offer?.sales_tax_pct) || 0,
    offer?.expenses || { talent: {}, general: {}, marketing: {}, production: {} },
    Number(offer?.guarantee) || 0,
    Number(offer?.tax_withholding_pct) || 0,
    offer?.deal_type === 'promoter_profit' ? 'promoter_profit' : 'flat_guarantee',
    'estimate',
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
  );
}
