/**
 * PROMOTER OS — where the money actually came in.
 *
 * A settlement used to carry one gross figure and nothing behind it. On After
 * Hours Vol 1 that single $2,120 hid a real question: the ~$360 of card taps at
 * the door might have run through the same online link as the $1,422.35 of app
 * sales, in which case it was counted twice and the night lost $360 more than
 * the report said. Nobody could tell from the document.
 *
 * Splitting the gross by channel makes that answerable. It also makes it
 * checkable: the channels have to add up to the gross, and when they don't the
 * report says so instead of quietly showing whichever number was typed last.
 */

export interface RevenueChannel {
  id: string;
  label: string;
  /** Face value taken on this channel, before anything is deducted. */
  gross: number;
  /** What the processor kept. Informational — see channelFeesNote below. */
  fees: number;
  note?: string;
}

const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const uid = () => `rc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

/** The channels a promoter actually sells through, as a starting point. */
export const DEFAULT_CHANNEL_LABELS = [
  'Ticketing app (online)',
  'Cash at the door',
  'Card taps at the door',
] as const;

export function newRevenueChannel(label = ''): RevenueChannel {
  return { id: uid(), label, gross: 0, fees: 0 };
}

export function defaultRevenueChannels(): RevenueChannel[] {
  return DEFAULT_CHANNEL_LABELS.map((label) => ({ ...newRevenueChannel(label) }));
}

export function readRevenueChannels(settlement: any): RevenueChannel[] {
  const raw = settlement?.actual_revenue_channels;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c) => c && typeof c === 'object')
    .map((c) => ({
      id: typeof c.id === 'string' ? c.id : uid(),
      label: typeof c.label === 'string' ? c.label : '',
      gross: num(c.gross),
      fees: num(c.fees),
      note: typeof c.note === 'string' ? c.note : undefined,
    }));
}

export interface ChannelTotals {
  gross: number;
  fees: number;
  net: number;
  /** actual_revenue as recorded on the settlement. */
  recordedGross: number;
  /** recordedGross - channel gross. Non-zero means the split doesn't reconcile. */
  difference: number;
  reconciles: boolean;
  /** Any channel used. Below this the section is not worth printing. */
  used: boolean;
}

export function channelTotals(channels: RevenueChannel[], recordedGross: number): ChannelTotals {
  const used = channels.some((c) => num(c.gross) !== 0 || num(c.fees) !== 0);
  const gross = channels.reduce((s, c) => s + num(c.gross), 0);
  const fees = channels.reduce((s, c) => s + num(c.fees), 0);
  const difference = num(recordedGross) - gross;
  return {
    gross,
    fees,
    net: gross - fees,
    recordedGross: num(recordedGross),
    difference,
    reconciles: Math.abs(difference) < 0.01,
    used,
  };
}

/**
 * The warning a promoter needs, in their own terms.
 *
 * More gross recorded than the channels account for usually means a channel is
 * missing. Less usually means one is counted twice — door taps that actually
 * ran through the online link and are already inside the online total.
 */
export function reconciliationNote(t: ChannelTotals): string | null {
  if (!t.used || t.reconciles) return null;
  if (t.difference > 0) {
    return `The channels below account for ${fmt(t.gross)} of the ${fmt(t.recordedGross)} recorded. ${fmt(t.difference)} came in somewhere that is not listed.`;
  }
  return `The channels below add up to ${fmt(t.gross)}, which is ${fmt(-t.difference)} MORE than the ${fmt(t.recordedGross)} recorded as gross. Check whether a channel is counted twice — door taps that ran through the online link are already inside the online total.`;
}

function fmt(v: number): string {
  return `$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Processing fees can legitimately be recorded on either side: netted off
 * revenue, or entered as an expense line. Recorded on both, the night looks
 * worse than it was. This spots that.
 */
export function feesAlsoInExpenses(settlement: any): number {
  const fees = settlement?.actual_expenses?.fees;
  if (!fees || typeof fees !== 'object') return 0;
  return Object.values(fees).reduce((s: number, v) => s + num(v), 0);
}
