import { OfferWithShow } from '../types';
import { getExpenseBreakdown, splitExtraRevenue } from './calculations';

/** The promoter's bar / extras on an offer, split into a flat total and a per-head rate. */
function extrasOn(offer: OfferWithShow) {
  return splitExtraRevenue(
    (offer as any).extra_revenue,
    (offer as any).include_extra_revenue !== false,
  );
}

export interface BreakEvenResult {
  tickets: number;
  percentage: number;
  revenue: number;
  buffer: number;
}

export interface ScenarioResult {
  percentage: number;
  tickets: number;
  revenue: number;
  profit: number;
  isProfit: boolean;
}

export function calculateBreakEven(offer: OfferWithShow): BreakEvenResult {
  const totalCosts = getExpenseBreakdown(offer.calculations, offer.guarantee).totalExpenses;
  const totalSellable = offer.ticket_tiers.reduce((sum, tier) => sum + (tier.allotment - tier.comps), 0);
  const avgTicketPrice = offer.ticket_tiers.reduce((sum, tier) =>
    sum + (tier.price * (tier.allotment - tier.comps)), 0
  ) / totalSellable;

  // Bar and extras change break-even two different ways, so they're applied
  // separately: a flat sponsorship is money you don't have to sell tickets for,
  // while a per-head bar cut raises what every ticket is worth to you.
  const { flat, perHead } = extrasOn(offer);

  const netPerTicket = avgTicketPrice * (1 - (offer.sales_tax_pct / 100)) + perHead;
  const costsToCover = Math.max(0, totalCosts - flat);

  const breakEvenTickets = netPerTicket > 0 ? Math.ceil(costsToCover / netPerTicket) : 0;
  const breakEvenNetRevenue = breakEvenTickets * avgTicketPrice * (1 - (offer.sales_tax_pct / 100));

  return {
    tickets: breakEvenTickets,
    percentage: totalSellable > 0 ? (breakEvenTickets / totalSellable) * 100 : 0,
    revenue: breakEvenNetRevenue,
    buffer: totalSellable - breakEvenTickets
  };
}

export function calculateScenarios(offer: OfferWithShow): ScenarioResult[] {
  const totalSellable = offer.ticket_tiers.reduce((sum, tier) => sum + (tier.allotment - tier.comps), 0);
  const avgTicketPrice = offer.ticket_tiers.reduce((sum, tier) =>
    sum + (tier.price * (tier.allotment - tier.comps)), 0
  ) / totalSellable;
  const totalCosts = getExpenseBreakdown(offer.calculations, offer.guarantee).totalExpenses;
  const { flat, perHead } = extrasOn(offer);

  return [50, 70, 85, 100].map(pct => {
    const tickets = Math.floor(totalSellable * (pct / 100));
    const grossRevenue = tickets * avgTicketPrice;
    const salesTax = grossRevenue * (offer.sales_tax_pct / 100);
    const netRevenue = grossRevenue - salesTax;
    const extras = flat + perHead * tickets;
    const profit = netRevenue + extras - totalCosts;

    return {
      percentage: pct,
      tickets,
      revenue: netRevenue,
      profit,
      isProfit: profit >= 0
    };
  });
}

export function calculateCapitalRequired(offer: OfferWithShow): {
  total: number;
  artistDeposit: number;
  venueDeposit: number;
  marketing: number;
} {
  const artistDeposit = offer.guarantee * (offer.deposit_pct / 100);
  const venueDeposit = offer.venue_deposit || 0;
  const marketing = offer.expenses.marketing
    ? Object.values(offer.expenses.marketing).reduce((sum, val) => sum + val, 0)
    : 0;

  return {
    total: artistDeposit + venueDeposit + marketing,
    artistDeposit,
    venueDeposit,
    marketing
  };
}

export function calculateRiskScore(offer: OfferWithShow): number {
  const breakEven = calculateBreakEven(offer);
  const totalSellable = offer.ticket_tiers.reduce((sum, tier) => sum + (tier.allotment - tier.comps), 0);

  const breakEvenRisk = breakEven.percentage;

  const daysUntilEvent = Math.max(0, Math.floor(
    (new Date(offer.show.event_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  ));
  const timeRisk = daysUntilEvent < 30 ? ((30 - daysUntilEvent) / 30) * 40 : 0;

  const capital = calculateCapitalRequired(offer);
  const canonicalTotal = getExpenseBreakdown(offer.calculations, offer.guarantee).totalExpenses;
  const marketingPct = (capital.marketing / canonicalTotal) * 100;
  const marketingRisk = marketingPct < 15 ? (15 - marketingPct) * 2 : 0;

  return Math.min(100, breakEvenRisk * 0.6 + timeRisk + marketingRisk);
}

export function getDaysUntilEvent(eventDate: string): number {
  return Math.max(0, Math.floor(
    (new Date(eventDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  ));
}

export function getConfidenceLevel(breakEvenPct: number): { emoji: string; text: string; color: string } {
  if (breakEvenPct < 50) return { emoji: '🟢', text: 'HIGH', color: 'text-green-400' };
  if (breakEvenPct < 70) return { emoji: '��', text: 'MEDIUM', color: 'text-yellow-400' };
  return { emoji: '🔴', text: 'LOW', color: 'text-red-400' };
}

export function getRiskAngle(score: number): number {
  return ((-180 + (score * 1.8)) * Math.PI) / 180;
}
