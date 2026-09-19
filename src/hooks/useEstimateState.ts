import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import type { OfferWithShow, Calculations, TicketTier, Expenses } from '../types';
import { netGrossOf, computeDeal, dealTermsOf, dealTypeOf, type DealType, type FacilityFeeMode, type PctBasis } from '../lib/calculations';

export function toNumber(val: string | number): number {
  if (typeof val === 'number') return val;
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

export interface TierState {
  id: string;
  type: string;
  allotment: number;
  comps: number;
  price: number;
}

export interface FixedExpenseItem {
  id: string;
  category: string;
  name: string;
  amount: number;
}

export interface SupportActItem {
  id: string;
  name: string;
  type: string;
  guarantee: number;
}

export interface VariableRates {
  ascapRate: number;
  bmiRate: number;
  sesacRate: number;
  insurancePerAttendee: number;
  ccFeeRate: number;
}

export interface EstimateState {
  ticketTiers: TierState[];
  salesTaxPct: number;
  artistGuarantee: number;
  taxWithholdingPct: number;
  depositPct: number;
  fixedExpenses: FixedExpenseItem[];
  supportActs: SupportActItem[];
  accommodationTotal: number;
  variableRates: VariableRates;
  dealType: DealType;
  artistBackendPct: number;
  promoterBackendPct: number;
  facilityFeePerTicket: number;
  facilityFeeMode: FacilityFeeMode;
  artistPercentage: number;
  artistPctBasis: PctBasis;
  doorSplitBasis: PctBasis;
}

function initEstimateState(offer: OfferWithShow): EstimateState {
  const tiers: TierState[] = offer.ticket_tiers.map((t, i) => ({
    id: `tier-${i}`,
    type: t.type,
    allotment: t.allotment,
    comps: t.comps,
    price: t.price,
  }));

  const fixedExpenses: FixedExpenseItem[] = [];
  for (const [category, items] of Object.entries(offer.expenses)) {
    for (const [name, amount] of Object.entries(items as Record<string, number>)) {
      fixedExpenses.push({ id: `${category}__${name}`, category, name, amount });
    }
  }

  const supportActs: SupportActItem[] = (offer.support_acts || []).map((a, i) => ({
    id: `sa-${i}`,
    name: a.name,
    type: a.type,
    guarantee: a.guarantee,
  }));

  let accommodationTotal = 0;
  if (offer.include_hotel && offer.hotel_budget) {
    accommodationTotal += offer.hotel_budget * (offer.hotel_nights || 1);
  }
  if (offer.include_transport && offer.transport_budget) {
    accommodationTotal += offer.transport_budget;
  }
  if (offer.include_flights && offer.flight_budget) {
    accommodationTotal += offer.flight_budget;
  }
  if (offer.include_rider && offer.rider_cap) {
    accommodationTotal += offer.rider_cap;
  }

  return {
    ticketTiers: tiers,
    salesTaxPct: offer.sales_tax_pct,
    artistGuarantee: offer.guarantee,
    taxWithholdingPct: offer.tax_withholding_pct,
    depositPct: offer.deposit_pct,
    fixedExpenses,
    supportActs,
    accommodationTotal,
    variableRates: {
      ascapRate: offer.ascap_rate ?? 0,
      bmiRate: offer.bmi_rate ?? 0,
      sesacRate: offer.sesac_rate ?? 0,
      insurancePerAttendee: offer.insurance_per_attendee ?? 0,
      ccFeeRate: offer.cc_fee_rate ?? 0,
    },
    dealType: dealTypeOf(offer),
    artistBackendPct: offer.artist_backend_pct ?? 85,
    promoterBackendPct: offer.promoter_backend_pct ?? 15,
    ...dealTermsOf(offer),
  };
}

function computeFromState(s: EstimateState): Calculations {
  // This used to be a second copy of the deal arithmetic that only knew flat
  // and promoter_profit. It reads the shared model now, so what the offer page
  // shows while you edit is exactly what gets saved.
  const grossPotential = s.ticketTiers.reduce(
    (sum, t) => sum + (t.allotment - t.comps) * t.price, 0
  );
  const totalSellable = s.ticketTiers.reduce((sum, t) => sum + (t.allotment - t.comps), 0);

  const g = netGrossOf(grossPotential, totalSellable, s.salesTaxPct, s.facilityFeePerTicket, s.facilityFeeMode);
  const netGross = g.netGross;

  const expenseItemsTotal = s.fixedExpenses.reduce((sum, e) => sum + e.amount, 0);
  const supportActsTotal = s.supportActs.reduce((sum, a) => sum + a.guarantee, 0);
  const fixedExpensesTotal = expenseItemsTotal + supportActsTotal + s.accommodationTotal;

  let variableExpensesTotal = 0;
  variableExpensesTotal += netGross * s.variableRates.ascapRate;
  variableExpensesTotal += netGross * s.variableRates.bmiRate;
  variableExpensesTotal += netGross * s.variableRates.sesacRate;
  variableExpensesTotal += totalSellable * s.variableRates.insurancePerAttendee;
  variableExpensesTotal += netGross * s.variableRates.ccFeeRate;

  const totalExpenses = fixedExpensesTotal + variableExpensesTotal;

  const deal = computeDeal(netGross, totalExpenses, {
    dealType: s.dealType,
    guarantee: s.artistGuarantee,
    taxWithholdingPct: s.taxWithholdingPct,
    artistPercentage: s.artistPercentage,
    artistPctBasis: s.artistPctBasis,
    doorSplitBasis: s.doorSplitBasis,
    artistBackendPct: s.artistBackendPct,
    promoterBackendPct: s.promoterBackendPct,
  });

  return {
    grossPotential,
    salesTax: g.salesTax,
    netGross,
    totalExpenses,
    totalShowCost: totalExpenses + deal.artistCost,
    artistCost: deal.artistCost,
    facilityFeeTotal: g.facilityFeeTotal,
    facilityFeeDeducted: g.facilityFeeDeducted,
    dealDescription: deal.describe,
    fixedExpensesTotal,
    variableExpensesTotal,
    netProfit: deal.netProfit,
    artistTotalPayout: deal.artistTotalPayout,
    profitPool: s.dealType === 'promoter_profit' ? deal.profitPool : undefined,
    promoterProfit: s.dealType === 'promoter_profit' ? deal.promoterProfit : undefined,
    splitPoint: s.dealType === 'promoter_profit' ? deal.splitPoint : undefined,
    backend: s.dealType === 'promoter_profit' ? deal.profitPool : undefined,
    artistBackend: deal.artistBackend > 0 ? deal.artistBackend : undefined,
    promoterBackend: s.dealType === 'promoter_profit' ? deal.promoterBackend : undefined,
  };
}

export function buildUpdatePayload(s: EstimateState, calc: Calculations) {
  const ticket_tiers = s.ticketTiers.map(t => ({
    type: t.type,
    allotment: t.allotment,
    comps: t.comps,
    price: t.price,
  }));

  const expenses: Expenses = { talent: {}, general: {}, marketing: {}, production: {} };
  for (const item of s.fixedExpenses) {
    const cat = item.category as keyof Expenses;
    if (cat in expenses) {
      expenses[cat][item.name] = item.amount;
    }
  }

  const support_acts = s.supportActs.map(a => ({
    name: a.name,
    type: a.type,
    guarantee: a.guarantee,
    set_length: 0,
  }));

  return {
    guarantee: s.artistGuarantee,
    tax_withholding_pct: s.taxWithholdingPct,
    deposit_pct: s.depositPct,
    sales_tax_pct: s.salesTaxPct,
    ticket_tiers,
    expenses,
    support_acts,
    calculations: calc,
    ascap_rate: s.variableRates.ascapRate,
    bmi_rate: s.variableRates.bmiRate,
    sesac_rate: s.variableRates.sesacRate,
    insurance_per_attendee: s.variableRates.insurancePerAttendee,
    cc_fee_rate: s.variableRates.ccFeeRate,
    artist_backend_pct: s.artistBackendPct,
    promoter_backend_pct: s.promoterBackendPct,
    deal_type: s.dealType,
    facility_fee_per_ticket: s.facilityFeePerTicket,
    facility_fee_mode: s.facilityFeeMode,
    artist_percentage: s.artistPercentage,
    artist_pct_basis: s.artistPctBasis,
    door_split_basis: s.doorSplitBasis,
  };
}

export function useEstimateState(offer: OfferWithShow | null) {
  const [state, setState] = useState<EstimateState | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const initializedForRef = useRef<string | null>(null);
  const initialSnapshotRef = useRef<string | null>(null);

  useEffect(() => {
    if (offer && initializedForRef.current !== offer.id) {
      initializedForRef.current = offer.id;
      const init = initEstimateState(offer);
      setState(init);
      initialSnapshotRef.current = JSON.stringify(init);
      setIsDirty(false);
    }
  }, [offer]);

  useEffect(() => {
    if (!state || !initialSnapshotRef.current) return;
    const current = JSON.stringify(state);
    setIsDirty(current !== initialSnapshotRef.current);
  }, [state]);

  const liveCalc = useMemo<Calculations | null>(() => {
    if (!state) return null;
    return computeFromState(state);
  }, [state]);

  const liveExpenses = useMemo<Expenses | null>(() => {
    if (!state) return null;
    const result: Expenses = { talent: {}, general: {}, marketing: {}, production: {} };
    for (const item of state.fixedExpenses) {
      const cat = item.category as keyof Expenses;
      if (cat in result) {
        result[cat][item.name] = item.amount;
      }
    }
    return result;
  }, [state]);

  const liveTiers = useMemo<TicketTier[] | null>(() => {
    if (!state) return null;
    return state.ticketTiers.map(t => ({
      type: t.type,
      allotment: t.allotment,
      comps: t.comps,
      price: t.price,
    }));
  }, [state]);

  const markClean = useCallback(() => {
    if (state) {
      initialSnapshotRef.current = JSON.stringify(state);
      setIsDirty(false);
    }
  }, [state]);

  const resetToOriginal = useCallback(() => {
    if (initialSnapshotRef.current) {
      setState(JSON.parse(initialSnapshotRef.current));
      setIsDirty(false);
    }
  }, []);

  const updateTier = useCallback((id: string, patch: Partial<Pick<TierState, 'allotment' | 'comps' | 'price'>>) => {
    setState(prev => prev ? {
      ...prev,
      ticketTiers: prev.ticketTiers.map(t => t.id === id ? { ...t, ...patch } : t),
    } : prev);
  }, []);

  const updateFixedExpense = useCallback((id: string, amount: number) => {
    setState(prev => prev ? {
      ...prev,
      fixedExpenses: prev.fixedExpenses.map(e => e.id === id ? { ...e, amount } : e),
    } : prev);
  }, []);

  /** Add a blank line to a category. The id is unique and permanent so the row
   *  survives being renamed; buildUpdatePayload keys the saved object off name. */
  const addFixedExpense = useCallback((category: string, name = 'new_expense') => {
    setState(prev => {
      if (!prev) return prev;
      const taken = new Set(prev.fixedExpenses.filter(e => e.category === category).map(e => e.name));
      let candidate = name;
      let n = 2;
      while (taken.has(candidate)) candidate = `${name}_${n++}`;
      return {
        ...prev,
        fixedExpenses: [
          ...prev.fixedExpenses,
          { id: `${category}__new_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, category, name: candidate, amount: 0 },
        ],
      };
    });
  }, []);

  const renameFixedExpense = useCallback((id: string, typed: string) => {
    const next = typed.toLowerCase().trim().replace(/\s+/g, '_');
    if (!next) return;
    setState(prev => {
      if (!prev) return prev;
      const target = prev.fixedExpenses.find(e => e.id === id);
      if (!target || target.name === next) return prev;
      const clash = prev.fixedExpenses.some(e => e.category === target.category && e.id !== id && e.name === next);
      if (clash) return prev;
      return {
        ...prev,
        fixedExpenses: prev.fixedExpenses.map(e => e.id === id ? { ...e, name: next } : e),
      };
    });
  }, []);

  const removeFixedExpense = useCallback((id: string) => {
    setState(prev => prev ? {
      ...prev,
      fixedExpenses: prev.fixedExpenses.filter(e => e.id !== id),
    } : prev);
  }, []);

  const updateSupportAct = useCallback((id: string, guarantee: number) => {
    setState(prev => prev ? {
      ...prev,
      supportActs: prev.supportActs.map(a => a.id === id ? { ...a, guarantee } : a),
    } : prev);
  }, []);

  const updateVariableRate = useCallback((key: keyof VariableRates, value: number) => {
    setState(prev => prev ? {
      ...prev,
      variableRates: { ...prev.variableRates, [key]: value },
    } : prev);
  }, []);

  const setArtistGuarantee = useCallback((value: number) => {
    setState(prev => prev ? { ...prev, artistGuarantee: value } : prev);
  }, []);

  const setSalesTaxPct = useCallback((value: number) => {
    setState(prev => prev ? { ...prev, salesTaxPct: value } : prev);
  }, []);

  const setTaxWithholdingPct = useCallback((value: number) => {
    setState(prev => prev ? { ...prev, taxWithholdingPct: value } : prev);
  }, []);

  const setDealTerms = useCallback((patch: Partial<Pick<EstimateState,
    'dealType' | 'facilityFeePerTicket' | 'facilityFeeMode' | 'artistPercentage' | 'artistPctBasis' | 'doorSplitBasis'>>) => {
    setState(prev => prev ? { ...prev, ...patch } : prev);
  }, []);

  const setDepositPct = useCallback((value: number) => {
    setState(prev => prev ? { ...prev, depositPct: value } : prev);
  }, []);

  return {
    state,
    isDirty,
    liveCalc,
    liveExpenses,
    liveTiers,
    markClean,
    resetToOriginal,
    updateTier,
    updateFixedExpense,
    addFixedExpense,
    renameFixedExpense,
    removeFixedExpense,
    updateSupportAct,
    updateVariableRate,
    setArtistGuarantee,
    setSalesTaxPct,
    setTaxWithholdingPct,
    setDepositPct,
    setDealTerms,
  };
}
