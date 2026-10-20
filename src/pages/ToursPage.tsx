import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ChevronRight, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { FeatureGate } from '../components/FeatureGate';
import { parseLocalDate } from '../lib/dateHelpers';
import { loadTourRows, type TourRow } from '../lib/tourRows';
import { STAGE, short$, money$ } from '../lib/tourPipeline';

export function ToursPage() {
  return (
    <FeatureGate feature="tours">
      <ToursPageContent />
    </FeatureGate>
  );
}

const STATUS: Record<string, string> = {
  planning: '#93A2B8', booking: '#5A8CFF', confirmed: '#4ADE80', active: '#8FD3FF', completed: '#6B7280', cancelled: '#F0605A',
};
const STATUS_OPTIONS = ['planning', 'booking', 'confirmed', 'active', 'completed', 'cancelled'];
type Filter = 'running' | 'done' | 'all';

const fmt = (d?: string | null) => (d ? parseLocalDate(d)?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : null);

function ToursPageContent() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rows, setRows] = useState<TourRow[] | null>(null);
  const [filter, setFilter] = useState<Filter>('running');
  const [menu, setMenu] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadTourRows().then(setRows).catch(() => setRows([]));
  }, [user]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menu]);

  const shown = useMemo(() => (rows || []).filter((r) => {
    const done = r.tour.status === 'completed' || r.tour.status === 'cancelled';
    return filter === 'all' ? true : filter === 'done' ? done : !done;
  }), [rows, filter]);

  const totals = useMemo(() => shown.reduce((a, r) => ({
    shows: a.shows + r.cards.filter((c) => c.stage !== 'dead').length,
    made: a.made + r.m.made, closed: a.closed + r.m.closed, pipeline: a.pipeline + r.m.pipeline, pl: a.pl + r.m.pl,
  }), { shows: 0, made: 0, closed: 0, pipeline: 0, pl: 0 }), [shown]);

  const setStatus = async (id: string, status: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setMenu(null);
    const { error } = await supabase.from('tours').update({ status }).eq('id', id);
    if (!error) setRows((rs) => (rs || []).map((r) => (r.tour.id === id ? { ...r, tour: { ...r.tour, status } } : r)));
  };

  const counts = {
    running: (rows || []).filter((r) => !['completed', 'cancelled'].includes(r.tour.status)).length,
    done: (rows || []).filter((r) => ['completed', 'cancelled'].includes(r.tour.status)).length,
    all: rows?.length || 0,
  };
  const lab = 'font-label text-[10px] tracking-[0.16em] uppercase';

  return (
    <div className="min-h-screen bg-[#1140F0]">
      <div className="bg-[#14171E] border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white leading-none">Tours</h1>
            <p className="text-gray-400 text-sm mt-1">Every run, its pipeline and its P/L.</p>
          </div>
          <button onClick={() => navigate('/tours/create')} className="flex items-center gap-1.5 px-3 py-2 bg-[#8FD3FF] hover:bg-[#6FB8F2] text-[#04214D] rounded-xl text-sm font-bold">
            <Plus className="h-4 w-4" /> New tour
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-4">
        {/* totals strip */}
        <div className="bg-[#14171E] border border-[#2A3040] rounded-xl grid grid-cols-3 sm:grid-cols-6 divide-x divide-[#2A3040] mb-3">
          {[
            ['Tours', String(shown.length), '#FFFFFF'],
            ['Shows', String(totals.shows), '#FFFFFF'],
            ['Made', short$(totals.made), '#4ADE80'],
            ['Closed', short$(totals.closed), '#8FD3FF'],
            ['Pipeline', short$(totals.pipeline), '#F2B640'],
            ['P/L', money$(totals.pl), totals.pl < 0 ? '#F87171' : '#4ADE80'],
          ].map(([l, v, c], i) => (
            <div key={l} className={`px-3 py-2 ${i >= 3 ? 'border-t sm:border-t-0 border-[#2A3040]' : ''}`}>
              <div className={`${lab} text-gray-400`}>{l}</div>
              <div className="text-base font-bold leading-tight" style={{ color: c }}>{v}</div>
            </div>
          ))}
        </div>

        {/* filter */}
        <div className="flex gap-1 mb-2">
          {(['running', 'done', 'all'] as Filter[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold border ${filter === f ? 'bg-[#8FD3FF] text-[#04214D] border-[#8FD3FF]' : 'bg-[#14171E] text-gray-300 border-[#2A3040]'}`}
              style={{ textTransform: 'none', letterSpacing: 0 }}>
              {f === 'running' ? 'Running' : f === 'done' ? 'Done' : 'All'} <span className="opacity-60">{counts[f]}</span>
            </button>
          ))}
        </div>

        {rows === null ? (
          <div className="flex items-center justify-center py-16 text-white"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : shown.length === 0 ? (
          <div className="bg-[#14171E] border border-[#2A3040] rounded-xl p-8 text-center">
            <p className="text-white font-semibold">{rows.length ? 'Nothing here.' : 'No tours yet.'}</p>
            <p className="text-gray-400 text-sm mt-1">A tour holds a run of shows: venues you are chasing, offers out, and the P/L.</p>
            {!rows.length && (
              <button onClick={() => navigate('/tours/create')} className="mt-4 inline-flex items-center gap-1.5 px-3 py-2 bg-[#8FD3FF] text-[#04214D] rounded-xl text-sm font-bold">
                <Plus className="h-4 w-4" /> New tour
              </button>
            )}
          </div>
        ) : (
          <div className="bg-[#14171E] border border-[#2A3040] rounded-xl overflow-visible">
            {/* column heads, desktop */}
            <div className={`hidden md:grid grid-cols-[minmax(0,1fr)_150px_70px_80px_80px_80px_90px_16px] gap-3 px-4 py-2 border-b border-[#2A3040] ${lab} text-gray-500`}>
              <span>Tour</span><span>Dates</span><span className="text-right">Shows</span>
              <span className="text-right">Made</span><span className="text-right">Closed</span><span className="text-right">Pipeline</span><span className="text-right">P/L</span><span />
            </div>
            {shown.map((r) => {
              const t = r.tour;
              const live = r.cards.filter((c) => c.stage !== 'dead');
              const badDates = t.start_date && t.end_date && t.end_date < t.start_date;
              const from = r.first || t.start_date, to = r.last || t.end_date;
              return (
                <div key={t.id} onClick={() => navigate(`/tours/${t.id}`)}
                  className="group cursor-pointer px-4 py-2.5 border-b border-[#2A3040] last:border-b-0 hover:bg-[#1A1F2B] md:grid md:grid-cols-[minmax(0,1fr)_150px_70px_80px_80px_80px_90px_16px] md:gap-3 md:items-center">
                  <div className="min-w-0 flex items-center gap-2">
                    <div className="relative shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); setMenu(menu === t.id ? null : t.id); }}
                        title="Change status"
                        className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-md border border-[#2A3040] text-[10px] font-semibold"
                        style={{ color: STATUS[t.status] || '#93A2B8', textTransform: 'none', letterSpacing: 0 }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS[t.status] || '#93A2B8' }} />{t.status}
                      </button>
                      {menu === t.id && (
                        <div className="absolute left-0 top-full mt-1 bg-[#14171E] border border-[#2A3040] rounded-lg shadow-xl z-20 min-w-[120px] py-1" onClick={(e) => e.stopPropagation()}>
                          {STATUS_OPTIONS.map((s) => (
                            <button key={s} onClick={(e) => setStatus(t.id, s, e)} className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-[#1A1F2B] ${s === t.status ? 'bg-[#1A1F2B]' : ''}`} style={{ textTransform: 'none', letterSpacing: 0, color: STATUS[s] }}>
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS[s] }} />{s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-white font-semibold text-sm truncate">{t.name}{t.artist_name && t.artist_name !== t.name ? <span className="text-gray-400 font-normal"> · {t.artist_name}</span> : null}</div>
                      <div className="text-[11px] text-gray-400 truncate">
                        {r.next
                          ? <>Next <span className="text-white">{r.next.city || r.next.venue}</span> {fmt(r.next.date)} · <span style={{ color: STAGE[r.next.stage].color }}>{STAGE[r.next.stage].label}</span></>
                          : r.cities.length ? r.cities.slice(0, 4).join(' · ') + (r.cities.length > 4 ? ` +${r.cities.length - 4}` : '') : 'No venues yet'}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-300 mt-1 md:mt-0 flex items-center gap-1">
                    {badDates && <span title="The tour's end date is before its start date. Check the dates."><AlertTriangle className="w-3.5 h-3.5 text-amber-300" /></span>}
                    {from ? `${fmt(from)} – ${fmt(to)}` : <span className="text-gray-500">No dates</span>}
                  </div>
                  {/* numbers: a 5-across mini grid on phones, columns on desktop */}
                  <div className="grid grid-cols-5 gap-2 mt-1.5 md:mt-0 md:contents">
                    {[
                      ['Shows', String(live.length), 'text-white'],
                      ['Made', short$(r.m.made), 'text-green-400'],
                      ['Closed', short$(r.m.closed), 'text-[#8FD3FF]'],
                      ['Pipeline', short$(r.m.pipeline), 'text-amber-300'],
                      ['P/L', money$(r.m.pl), r.m.pl < 0 ? 'text-red-400' : 'text-green-400'],
                    ].map(([l, v, c]) => (
                      <div key={l} className="md:text-right">
                        <div className={`md:hidden ${lab} text-[9px] text-gray-500`}>{l}</div>
                        <div className={`text-sm font-semibold ${c} ${l === 'P/L' ? 'font-bold' : ''}`}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <ChevronRight className="hidden md:block w-4 h-4 text-gray-600 group-hover:text-white" />
                </div>
              );
            })}
          </div>
        )}
        <p className="text-[11px] text-white/60 mt-2">Made = settled shows. Closed = confirmed shows' projected profit. P/L = made minus tour costs.</p>
      </div>
    </div>
  );
}
