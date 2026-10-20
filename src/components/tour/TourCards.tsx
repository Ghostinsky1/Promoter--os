import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Route as RouteIcon, ChevronRight } from 'lucide-react';
import { loadTourRows } from '../../lib/tourRows';
import { parseLocalDate } from '../../lib/dateHelpers';
import { short$, money$, STAGE } from '../../lib/tourPipeline';

/** Dashboard: one compact card per tour that is still running. Links into the tour. */
export function TourCards() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[] | null>(null);

  useEffect(() => {
    loadTourRows({ activeOnly: true })
      .then((rs) => setRows(rs.map((r) => ({ tour: r.tour, m: r.m, next: r.next, venues: r.cards.length }))))
      .catch(() => setRows([]));
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
