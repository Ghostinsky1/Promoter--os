import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Route as RouteIcon, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { parseLocalDate } from '../../lib/dateHelpers';
import { buildCards, money, nextShow, short$, money$, STAGE, type TourLead, type TourCost } from '../../lib/tourPipeline';

/** Dashboard: one compact card per tour that is still running. Links into the tour. */
export function TourCards() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data: tours } = await supabase.from('tours').select('*').not('status', 'in', '(completed,cancelled)').order('start_date');
      if (!tours?.length) { setRows([]); return; }
      const ids = tours.map((t: any) => t.id);
      const [{ data: offers }, { data: leads }, { data: costs }] = await Promise.all([
        supabase.from('offers').select('*, show:shows(*)').in('tour_id', ids),
        supabase.from('tour_leads').select('*').in('tour_id', ids),
        supabase.from('tour_costs').select('*').in('tour_id', ids),
      ]);
      const offerIds = (offers || []).map((o: any) => o.id);
      const { data: st } = offerIds.length ? await supabase.from('settlements').select('offer_id, actual_profit').in('offer_id', offerIds) : { data: [] as any[] };
      const sMap = Object.fromEntries((st || []).map((s: any) => [s.offer_id, s]));
      setRows(tours.map((t: any) => {
        const cards = buildCards((leads || []).filter((l: any) => l.tour_id === t.id) as TourLead[], (offers || []).filter((o: any) => o.tour_id === t.id), sMap);
        return { tour: t, m: money(cards, (costs || []).filter((c: any) => c.tour_id === t.id) as TourCost[]), next: nextShow(cards), venues: cards.length };
      }));
    })();
  }, []);

  if (!rows?.length) return null;
  return (
    <div className="mb-4 space-y-2">
      {rows.map(({ tour, m, next, venues }) => (
        <button key={tour.id} onClick={() => navigate(`/tours/${tour.id}`)} className="w-full text-left bg-[#14171E] border border-[#2A3040] hover:border-[#8FD3FF]/60 rounded-2xl px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2" style={{ textTransform: 'none', letterSpacing: 0 }}>
          <div className="min-w-0 flex-1">
            <div className="font-label text-[10px] tracking-[0.18em] uppercase text-[#8FD3FF] inline-flex items-center gap-1.5"><RouteIcon className="w-3.5 h-3.5" /> Tour · {venues} venues</div>
            <div className="text-white font-bold truncate">{tour.name}</div>
            {next ? (
              <div className="text-xs text-gray-400 truncate">Next: <span className="text-white">{next.city}</span> · {parseLocalDate(next.date!)!.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · <span style={{ color: STAGE[next.stage as keyof typeof STAGE].color }}>{STAGE[next.stage as keyof typeof STAGE].label}</span></div>
            ) : <div className="text-xs text-gray-500">No dated shows yet</div>}
          </div>
          {[
            ['Made', m.made, '#4ADE80'], ['Closed', m.closed, '#8FD3FF'], ['Pipeline', m.pipeline, '#F2B640'],
          ].map(([l, v, c]) => (
            <div key={l as string} className="text-right">
              <div className="font-label text-[9px] tracking-[0.16em] uppercase" style={{ color: c as string }}>{l as string}</div>
              <div className="text-white font-semibold">{short$(v as number)}</div>
            </div>
          ))}
          <div className="text-right">
            <div className="font-label text-[9px] tracking-[0.16em] uppercase text-white">P/L</div>
            <div className={`font-bold ${m.pl >= 0 ? 'text-green-400' : 'text-red-400'}`}>{money$(m.pl)}</div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-500" />
        </button>
      ))}
    </div>
  );
}
