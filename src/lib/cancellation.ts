import { OfferWithShow } from '../types';

/**
 * PROMOTER OS — what a dead show actually cost.
 *
 * A cancelled event used to just vanish from the dashboard: its projected
 * profit stopped counting and nothing replaced it, so a month where two shows
 * died looked identical to a month where nothing happened. That is backwards.
 * Cancelling costs money — deposits already paid, ads already run, refund fees
 * you never get back — and that money is the whole reason to record it.
 *
 * So: when a show is cancelled the promoter fills in what they actually spent,
 * and the month reports the loss instead of pretending the show never existed.
 */

export interface CancellationLine {
  id: string;
  label: string;
  /** What you committed or spent. */
  amount: number;
  /** How much of it you got back. Net loss is amount - recovered. */
  recovered: number;
  note?: string;
  /** True when it came from the offer rather than being typed by hand. */
  fromOffer?: boolean;
}

export interface CancellationRefunds {
  /** Did any tickets sell before it died? */
  soldTickets: boolean;
  tickets: number;
  /** Ticket money handed back. Not a loss on its own — you never earned it. */
  revenue: number;
  /** Processor fees on those refunds. THIS is the real money gone. */
  feesLost: number;
}

export interface Cancellation {
  lines: CancellationLine[];
  refunds: CancellationRefunds;
  notes: string;
  /** True once the promoter has actually filled it in. */
  completed: boolean;
}

const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const uid = () => `cx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

export const EMPTY_CANCELLATION: Cancellation = {
  lines: [],
  refunds: { soldTickets: false, tickets: 0, revenue: 0, feesLost: 0 },
  notes: '',
  completed: false,
};

/**
 * The bill for a dead show.
 *
 * Refunded ticket revenue is deliberately NOT counted as a loss. Handing back
 * money you never earned costs you nothing; the processor fee on that refund
 * is what you actually eat, so that is the only part of a refund that lands
 * here.
 */
export function cancellationLoss(c: Cancellation | null | undefined): number {
  if (!c) return 0;
  const lines = (c.lines || []).reduce(
    (sum, l) => sum + Math.max(0, num(l.amount) - num(l.recovered)), 0,
  );
  return lines + num(c.refunds?.feesLost);
}

export function readCancellation(offer: any): Cancellation {
  const raw = offer?.cancellation;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...EMPTY_CANCELLATION };
  return {
    lines: Array.isArray(raw.lines) ? raw.lines : [],
    refunds: { ...EMPTY_CANCELLATION.refunds, ...(raw.refunds || {}) },
    notes: typeof raw.notes === 'string' ? raw.notes : '',
    completed: raw.completed === true,
  };
}

/**
 * The starting sheet, built from what the offer already knows.
 *
 * Only money that is genuinely at risk before the doors open is pre-filled: a
 * deposit that has been paid, marketing that has already run. The venue's fee,
 * the production and the security are NOT here — you do not pay those for a
 * show that never happened. Everything is editable and removable, because the
 * offer's guess about what got spent is only ever a starting point.
 */
export function prefillCancellation(offer: OfferWithShow): Cancellation {
  const o = offer as any;
  const lines: CancellationLine[] = [];
  const add = (label: string, amount: number, note?: string) => {
    if (amount > 0) lines.push({ id: uid(), label, amount, recovered: 0, note, fromOffer: true });
  };

  // Deposits are the classic sunk cost on a dead show.
  const artistDeposit = num(offer.guarantee) * (num(offer.deposit_pct) / 100);
  if (o.artist_deposit_status === 'paid') {
    add('Artist deposit (already paid)', artistDeposit, 'Set what you got back, if anything');
  } else if (artistDeposit > 0) {
    add('Artist deposit', artistDeposit, 'The offer says this was not paid yet — delete it if no money left');
  }
  if (num(o.venue_deposit) > 0) {
    add('Venue deposit', num(o.venue_deposit), o.venue_deposit_status === 'paid' ? 'Already paid' : 'The offer says this was not paid yet');
  }

  // Marketing is money that is gone the moment it runs.
  const marketing = (offer.expenses as any)?.marketing || {};
  for (const [name, amount] of Object.entries(marketing)) {
    add(name.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()), num(amount), 'Ad spend does not come back');
  }

  return { ...EMPTY_CANCELLATION, lines };
}

/** What to write to the offers row. */
export function cancellationPayload(c: Cancellation, alreadyCancelledAt?: string | null) {
  return {
    cancellation: c,
    cancellation_loss: Math.round(cancellationLoss(c) * 100) / 100,
    cancelled_at: alreadyCancelledAt || new Date().toISOString(),
  };
}

export function newCancellationLine(label = ''): CancellationLine {
  return { id: uid(), label, amount: 0, recovered: 0 };
}

/**
 * What a show contributes to a month or year total.
 *
 * A cancelled show contributes its real loss as a negative number, not the
 * profit it was never going to make, and not nothing.
 */
export function offerContribution(offer: any): number {
  if (offer?.status === 'cancelled') return -num(offer.cancellation_loss);
  return num(offer?.calculations?.netProfit);
}
