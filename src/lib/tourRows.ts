import { supabase } from './supabase';
import { buildCards, money, nextShow, route, type Card, type Money, type TourLead, type TourCost } from './tourPipeline';

export interface TourRow {
  tour: any;
  cards: Card[];
  m: Money;
  next: Card | null;
  cities: string[];
  first: string | null; // first dated show (YYYY-MM-DD)
  last: string | null;
}

/** Every tour with its pipeline money, worked out the same way as the tour page. */
export async function loadTourRows(opts: { activeOnly?: boolean } = {}): Promise<TourRow[]> {
  let q = supabase.from('tours').select('*').order('start_date', { ascending: true });
  if (opts.activeOnly) q = q.not('status', 'in', '(completed,cancelled)');
  const { data: tours } = await q;
  if (!tours?.length) return [];
  const ids = tours.map((t: any) => t.id);
  const [{ data: offers }, { data: leads }, { data: costs }] = await Promise.all([
    supabase.from('offers').select('*, show:shows(*), venue:venues(*)').in('tour_id', ids),
    supabase.from('tour_leads').select('*').in('tour_id', ids),
    supabase.from('tour_costs').select('*').in('tour_id', ids),
  ]);
  const offerIds = (offers || []).map((o: any) => o.id);
  const { data: st } = offerIds.length
    ? await supabase.from('settlements').select('offer_id, actual_profit').in('offer_id', offerIds)
    : { data: [] as any[] };
  const sMap = Object.fromEntries((st || []).map((s: any) => [s.offer_id, s]));
  return tours.map((t: any) => {
    const cards = buildCards(
      (leads || []).filter((l: any) => l.tour_id === t.id) as TourLead[],
      (offers || []).filter((o: any) => o.tour_id === t.id),
      sMap,
    );
    const r = route(cards);
    const cities = [...new Set(cards.filter((c) => c.stage !== 'dead' && c.city).map((c) => c.city))];
    return {
      tour: t, cards,
      m: money(cards, (costs || []).filter((c: any) => c.tour_id === t.id) as TourCost[]),
      next: nextShow(cards), cities,
      first: r[0]?.date ?? null, last: r[r.length - 1]?.date ?? null,
    };
  });
}
