import { OfferWithShow } from '../types';
import { getExpenseBreakdown } from './calculations';
import { survivalRead, downsideAt } from './downside';

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
  // Reads the same bad-night engine as the Deal Score, so this page and that
  // one never disagree. That engine walks the room a ticket at a time with
  // every cost line moving the way it actually moves; the old version here
  // divided costs by an average price and subtracted sales tax that is not
  // the promoter's money.
  const totalSellable = offer.ticket_tiers.reduce((sum, tier) => sum + (tier.allotment - tier.comps), 0);
  const read = survivalRead(offer);
  const breakEvenTickets = read.breakEvenTickets >= 0 ? read.breakEvenTickets : totalSellable;
  const atBreakEven = downsideAt(offer, totalSellable > 0 ? (breakEvenTickets / totalSellable) * 100 : 0);

  return {
    tickets: breakEvenTickets,
    percentage: totalSellable > 0 ? (breakEvenTickets / totalSellable) * 100 : 0,
    revenue: atBreakEven.netGross,
    buffer: totalSellable - breakEvenTickets,
  };
}

export function calculateScenarios(offer: OfferWithShow): ScenarioResult[] {
  return [50, 70, 85, 100].map(pct => {
    const d = downsideAt(offer, pct);
    return {
      percentage: pct,
      tickets: d.tickets,
      revenue: d.netGross,
      profit: d.profit,
      isProfit: d.profit >= 0,
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
