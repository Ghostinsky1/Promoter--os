import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import type { OfferWithShow, Calculations, TicketTier, Expenses } from '../types';

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
  dealType: string;
  artistBackendPct: number;
  promoterBackendPct: number;
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
    dealType: offer.deal_type,
    artistBackendPct: offer.artist_backend_pct ?? 85,
    promoterBackendPct: offer.promoter_backend_pct ?? 15,
  };
}

function computeFromState(s: EstimateState): Calculations {
  const grossPotential = s.ticketTiers.reduce(
    (sum, t) => sum + (t.allotment - t.comps) * t.price, 0
  );
  const salesTax = grossPotential * (s.salesTaxPct / 100);
  const netGross = grossPotential - salesTax;

  const expenseItemsTotal = s.fixedExpenses.reduce((sum, e) => sum + e.amount, 0);
  const supportActsTotal = s.supportActs.reduce((sum, a) => sum + a.guarantee, 0);
  const fixedExpensesTotal = expenseItemsTotal + supportActsTotal + s.accommodationTotal;

  const totalSellable = s.ticketTiers.reduce((sum, t) => sum + (t.allotment - t.comps), 0);
  let variableExpensesTotal = 0;
  variableExpensesTotal += netGross * s.variableRates.ascapRate;
  variableExpensesTotal += netGross * s.variableRates.bmiRate;
  variableExpensesTotal += netGross * s.variableRates.sesacRate;
  variableExpensesTotal += totalSellable * s.variableRates.insurancePerAttendee;
  variableExpensesTotal += netGross * s.variableRates.ccFeeRate;

  const totalExpenses = fixedExpensesTotal + variableExpensesTotal;

  let artistTotalPayout = s.artistGuarantee * (1 - s.taxWithholdingPct / 100);
  let promoterProfit = 0;
  let splitPoint = 0;
  let artistBackend = 0;
  let promoterBackend = 0;
  let profitPool = 0;

  if (s.dealType === 'promoter_profit') {
    profitPool = netGross - totalExpenses - s.artistGuarantee;
    if (profitPool > 0) {
      artistBackend = profitPool * (s.artistBackendPct / 100);
      promoterBackend = profitPool * (s.promoterBackendPct / 100);
      artistTotalPayout = (s.artistGuarantee + artistBackend) * (1 - s.taxWithholdingPct / 100);
      promoterProfit = promoterBackend;
    }
    splitPoint = s.artistGuarantee + totalExpenses;
  }

  const taxMul = 1 - s.taxWithholdingPct / 100;
  const grossArtistCost = taxMul > 0 ? artistTotalPayout / taxMul : s.artistGuarantee;
  const netProfit = netGross - totalExpenses - grossArtistCost;

  return {
    grossPotential,
    salesTax,
    netGross,
    totalExpenses,
    fixedExpensesTotal,
    variableExpensesTotal,
    netProfit,
    artistTotalPayout,
    profitPool: s.dealType === 'promoter_profit' ? profitPool : undefined,
    promoterProfit: s.dealType === 'promoter_profit' ? promoterProfit : undefined,
    splitPoint: s.dealType === 'promoter_profit' ? splitPoint : undefined,
    backend: s.dealType === 'promoter_profit' ? profitPool : undefined,
    artistBackend: s.dealType === 'promoter_profit' ? artistBackend : undefined,
    promoterBackend: s.dealType === 'promoter_profit' ? promoterBackend : undefined,
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
    updateSupportAct,
    updateVariableRate,
    setArtistGuarantee,
    setSalesTaxPct,
    setTaxWithholdingPct,
    setDepositPct,
  };
}
