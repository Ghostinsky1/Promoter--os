import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe2, Loader2 } from 'lucide-react';
import { loadTourRows, type TourRow } from '../../lib/tourRows';
import { nextShow, isBooked, isPast, STAGE, short$, type Card } from '../../lib/tourPipeline';
import { parseLocalDate } from '../../lib/dateHelpers';

const TourGlobe = lazy(() => import('./TourGlobe'));

/**
 * Dashboard: one globe for every tour. Where we've been in gray, what's coming lit, the next
 * show across all tours pulsing. Tap a dot to open that tour.
 */
export function DashboardGlobe() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<TourRow[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => { loadTourRows().then(setRows).catch(() => setRows([])); }, []);

  // Keys get the tour id in front so two tours never share one.
  const cards = useMemo<Card[]>(() => (rows || []).flatMap((r) => r.cards.map((c) => ({ ...c, key: `${r.tour.id}|${c.key}` }))), [rows]);
  const next = useMemo(() => nextShow(cards), [cards]);
  const tourOf = (key: string) => key.split('|')[0];
  const open = (key: string) => {
    const [tourId, inner] = [tourOf(key), key.slice(key.indexOf('|') + 1)];
    setSelected(key);
    navigate(`/tours/${tourId}${inner.startsWith('offer:') ? '' : `?open=${inner}`}`);
  };

  if (!rows || !cards.some((c) => c.lat != null)) return null;
  const nextTour = next ? rows.find((r) => r.tour.id === tourOf(next.key))?.tour : null;
  const played = cards.filter((c) => isBooked(c.stage) && isPast(c)).length;
  const coming = cards.filter((c) => isBooked(c.stage) && c.date && !isPast(c)).length;

  return (
    <div className="bg-[#14171E] border border-[#2A3040] rounded-2xl overflow-hidden">
      <div className="relative bg-[radial-gradient(ellipse_at_center,#0B2FB8_0%,#0B0D12_70%)]">
        <div className="absolute top-3 left-3 z-10 font-label text-[10px] tracking-[0.2em] uppercase text-[#8FD3FF] flex items-center gap-1.5"><Globe2 className="w-3.5 h-3.5" /> Where we've been · where we're going</div>
        <div className="absolute top-3 right-3 z-10 flex items-center gap-3 text-[10px] font-label tracking-[0.14em] uppercase">
          <span className="inline-flex items-center gap-1 text-[#9AA4B5]"><span className="w-2 h-2 rounded-full bg-[#9AA4B5]" /> Been {played}</span>
          <span className="inline-flex items-center gap-1 text-[#4ADE80]"><span className="w-2 h-2 rounded-full bg-[#4ADE80]" /> Coming {coming}</span>
        </div>
        <Suspense fallback={<div className="h-[340px] flex items-center justify-center text-gray-500"><Loader2 className="w-5 h-5 animate-spin" /></div>}>
          <TourGlobe cards={cards.filter((c) => c.stage !== 'dead')} nextKey={next?.key ?? null} selectedKey={selected} onSelect={open} height={typeof window !== 'undefined' && window.innerWidth < 640 ? 300 : 340} />
        </Suspense>
      </div>
      {next && nextTour && (
        <button onClick={() => open(next.key)} className="w-full text-left px-3 py-2 border-t border-[#2A3040] flex flex-wrap items-center gap-x-3 gap-y-0.5 hover:bg-white/5" style={{ textTransform: 'none', letterSpacing: 0 }}>
          <span className="font-label text-[10px] tracking-[0.18em] text-[#8FD3FF] shrink-0">NEXT</span>
          <span className="text-white font-semibold min-w-0">{next.artist ? `${next.artist} · ` : ''}{next.city} · {next.venue}</span>
          <span className="text-gray-400 text-sm shrink-0">{parseLocalDate(next.date!)!.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {nextTour.name}</span>
          <span className="sm:ml-auto text-xs shrink-0" style={{ color: STAGE[next.stage].color }}>{STAGE[next.stage].label}{next.money != null ? ` · ${short$(next.money)}` : ''}</span>
        </button>
      )}
    </div>
  );
}
