import type { TicketTier, Expenses, Calculations, ProjectionResult, SupportAct } from '../types';

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
  }
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

  const netProfit = netGross - totalExpenses - artistTotalPayout / (1 - taxWithholdingPct / 100);

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
  return Object.values(expenses).reduce((total, category) => {
    return total + Object.values(category).reduce((sum, val) => sum + val, 0);
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
