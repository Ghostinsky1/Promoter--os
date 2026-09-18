import { OfferWithShow } from '../types';
import { survivalRead } from './downside';

/**
 * PROMOTER OS — what to spend on marketing.
 *
 * Not a rule of thumb. This reads the promoter's own settled shows, works out
 * what a ticket actually cost them to sell on the nights that made money, and
 * budgets the next show against that.
 *
 * Jose's four settled shows, Sep 2026:
 *   Desenfocado STL      $412.60 -> 338 paid   $1.22/ticket   +$3,319
 *   Perreo Electrico V13 $800.05 -> 390 paid   $2.05/ticket   +$3,190
 *   Perreo Electrico V14 $1,149.98 -> 400 paid $2.87/ticket   +$3,490
 *   After Hours Vol 1    $378.33 -> 170 paid   $2.23/ticket   -$1,153
 *
 * The losing night is deliberately excluded from the benchmark: it is not
 * evidence of what marketing costs, it is evidence of a room that was too
 * expensive. Shows that lost money do not get to set the target.
 */

const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

/** Before there is any history, a rate that is honest about being a placeholder. */
export const FALLBACK_COST_PER_TICKET = 2.0;

export interface SettledMarketing {
  name: string;
  marketing: number;
  paidTickets: number;
  costPerTicket: number;
  profit: number;
}

export interface MarketingBenchmark {
  /** Shows that made money and actually spent on marketing. */
  sample: SettledMarketing[];
  /** Dollars of marketing per paid ticket, from those shows. */
  costPerTicket: number;
  low: number;
  high: number;
  /** True when this came from real settled shows rather than the fallback. */
  fromHistory: boolean;
}

/** What a ticket has cost this promoter to sell, on the nights that worked. */
export function marketingBenchmark(settled: any[]): MarketingBenchmark {
  const sample: SettledMarketing[] = [];

  for (const row of settled || []) {
    const offer = row.offer ?? row;
    const settlement = row.settlement ?? row;

    const marketingBlock =
      settlement?.actual_expenses?.marketing ?? offer?.expenses?.marketing ?? {};
    const marketing = Object.values(marketingBlock).reduce((s: number, v) => s + num(v), 0);

    const attendance: any[] = settlement?.actual_attendance ?? [];
    const paidTickets = attendance
      .filter((t) => num(t?.price) > 0)
      .reduce((s, t) => s + num(t?.actual_sold), 0);

    const profit = num(settlement?.actual_profit);

    // A night that lost money is not evidence of what marketing costs.
    if (marketing > 0 && paidTickets > 0 && profit > 0) {
      sample.push({
        name: offer?.show?.event_name || offer?.show?.artist_name || 'Show',
        marketing,
        paidTickets,
        costPerTicket: marketing / paidTickets,
        profit,
      });
    }
  }

  if (sample.length === 0) {
    return {
      sample: [],
      costPerTicket: FALLBACK_COST_PER_TICKET,
      low: FALLBACK_COST_PER_TICKET,
      high: FALLBACK_COST_PER_TICKET,
      fromHistory: false,
    };
  }

  const rates = sample.map((s) => s.costPerTicket).sort((a, b) => a - b);
  const avg = rates.reduce((s, r) => s + r, 0) / rates.length;

  return {
    sample,
    costPerTicket: avg,
    low: rates[0],
    high: rates[rates.length - 1],
    fromHistory: true,
  };
}

export interface MarketingAdvice {
  /** What is currently budgeted on this offer. */
  budgeted: number;
  /** Enough to sell the tickets that cover the show. */
  toBreakEven: number;
  /** Enough to fill the room. */
  toSellOut: number;
  /** The number to act on. */
  recommended: number;
  /** recommended - budgeted. Positive means spend more. */
  gap: number;
  breakEvenTickets: number;
  ticketsOnSale: number;
  benchmark: MarketingBenchmark;
  /** One line, ending in a number, that says what to do. */
  verdict: string;
}

/**
 * What this show should spend.
 *
 * Marketing is budgeted against TICKETS, not against a percentage of a gross
 * the promoter has not earned yet. A show needing 498 of 600 tickets to break
 * even needs more selling than one needing 200, whatever the two rooms gross.
 */
export function marketingAdvice(
  offer: OfferWithShow,
  benchmark: MarketingBenchmark,
): MarketingAdvice {
  const budgeted = Object.values((offer.expenses as any)?.marketing ?? {})
    .reduce((s: number, v) => s + num(v), 0);

  const survival = survivalRead(offer);
  const ticketsOnSale = (offer.ticket_tiers || [])
    .reduce((s, t) => s + Math.max(0, num(t.allotment) - num(t.comps)), 0);
  const breakEvenTickets = survival.breakEvenTickets >= 0 ? survival.breakEvenTickets : ticketsOnSale;

  const rate = benchmark.costPerTicket;
  const toBreakEven = breakEvenTickets * rate;
  const toSellOut = ticketsOnSale * rate;

  // Budget to clear break-even with room to spare, not to a sellout nobody is
  // owed. Halfway between covering the show and filling the room.
  const recommended = Math.round(((toBreakEven + toSellOut) / 2) / 25) * 25;
  const gap = recommended - budgeted;

  let verdict: string;
  if (breakEvenTickets >= ticketsOnSale) {
    verdict = `This show needs a near-sellout before marketing can help. Fix the costs first — no ad spend covers a ${survival.at50.profit < 0 ? 'half house losing ' + money(-survival.at50.profit) : 'gap this size'}.`;
  } else if (gap > 25) {
    verdict = `Budgeted ${money(budgeted)}. At your usual ${money(rate)} a ticket, selling the ${breakEvenTickets.toLocaleString()} you need to break even costs about ${money(toBreakEven)}. Put in ${money(gap)} more.`;
  } else if (gap < -25) {
    verdict = `Budgeted ${money(budgeted)}, which is ${money(-gap)} more than this room needs at your usual ${money(rate)} a ticket. That ${money(-gap)} is profit or a better guarantee.`;
  } else {
    verdict = `${money(budgeted)} is about right — enough to sell past the ${breakEvenTickets.toLocaleString()} tickets that cover the show at your usual ${money(rate)} a ticket.`;
  }

  return {
    budgeted, toBreakEven, toSellOut, recommended, gap,
    breakEvenTickets, ticketsOnSale, benchmark, verdict,
  };
}

function money(v: number): string {
  return `$${Math.round(Math.abs(v)).toLocaleString('en-US')}`;
}
