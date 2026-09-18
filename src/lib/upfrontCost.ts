import { OfferWithShow } from '../types';

/**
 * PROMOTER OS — what you need in the bank today.
 *
 * Jose's question, in his words: "I got 3 events, I paid deposit on all 3 of
 * them $200, and marketing is $1000 on each. If venue deposit needed $1000,
 * then boom, my upfront cost."
 *
 * The app could already work this out for ONE show and only showed it buried on
 * that show's analytics page. A promoter running six rooms at once does not
 * have a per-show cash problem, they have a this-month cash problem, and
 * nothing added it up.
 *
 * Upfront money is the money committed BEFORE a ticket is sold: the artist
 * deposit, the venue deposit, and the marketing — because ads run in advance
 * and do not come back. The guarantee balance, the security and the production
 * are paid on the night out of the door, so they are not what you need on hand
 * today.
 */

const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

export interface UpfrontCost {
  offerId: string;
  name: string;
  venue: string;
  eventDate: string;
  daysAway: number;
  artistDeposit: number;
  venueDeposit: number;
  marketing: number;
  total: number;
  /** Deposits the offer says are still outstanding. */
  artistDepositPaid: boolean;
  venueDepositPaid: boolean;
  /** What is still to go out, ignoring what is already paid. */
  stillToPay: number;
}

/** What one show ties up before it opens its doors. */
export function upfrontCostOf(offer: OfferWithShow): UpfrontCost {
  const o = offer as any;
  const artistDeposit = num(offer.guarantee) * (num(offer.deposit_pct) / 100);
  const venueDeposit = num(o.venue_deposit);
  const marketing = Object.values((offer.expenses as any)?.marketing ?? {})
    .reduce((s: number, v) => s + num(v), 0);

  const artistDepositPaid = o.artist_deposit_status === 'paid';
  const venueDepositPaid = o.venue_deposit_status === 'paid';

  const eventDate = offer.show?.event_date ?? '';
  const days = eventDate
    ? Math.ceil((new Date(eventDate).getTime() - Date.now()) / 86_400_000)
    : 0;

  const total = artistDeposit + venueDeposit + marketing;
  const stillToPay =
    (artistDepositPaid ? 0 : artistDeposit) +
    (venueDepositPaid ? 0 : venueDeposit) +
    marketing;

  return {
    offerId: offer.id,
    name: offer.show?.event_name || offer.show?.artist_name || 'Show',
    venue: offer.show?.venue_name ?? '',
    eventDate,
    daysAway: days,
    artistDeposit,
    venueDeposit,
    marketing,
    total,
    artistDepositPaid,
    venueDepositPaid,
    stillToPay,
  };
}

export interface CashOnHand {
  shows: UpfrontCost[];
  artistDeposits: number;
  venueDeposits: number;
  marketing: number;
  /** Everything committed across every live show. */
  total: number;
  /** What has not gone out of the account yet. */
  stillToPay: number;
  /** Already paid, so it is gone rather than needed. */
  alreadyPaid: number;
}

/**
 * Add it up across every show that is still going to happen.
 *
 * Cancelled and settled shows are out: a cancelled show's real cost is recorded
 * on its cancellation sheet, and a settled one has already been paid for.
 */
export function cashOnHand(offers: OfferWithShow[]): CashOnHand {
  const live = (offers || []).filter((o: any) => {
    const status = o?.status ?? 'planning';
    if (status === 'cancelled' || status === 'settled') return false;
    const d = o?.show?.event_date;
    if (!d) return true;
    // Yesterday's show is not an upcoming cash need.
    return new Date(d).getTime() >= Date.now() - 86_400_000;
  });

  const shows = live.map(upfrontCostOf).sort((a, b) => a.daysAway - b.daysAway);

  const sum = (f: (s: UpfrontCost) => number) => shows.reduce((t, s) => t + f(s), 0);
  const total = sum((s) => s.total);
  const stillToPay = sum((s) => s.stillToPay);

  return {
    shows,
    artistDeposits: sum((s) => s.artistDeposit),
    venueDeposits: sum((s) => s.venueDeposit),
    marketing: sum((s) => s.marketing),
    total,
    stillToPay,
    alreadyPaid: total - stillToPay,
  };
}
