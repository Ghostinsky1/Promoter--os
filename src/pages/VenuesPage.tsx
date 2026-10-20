import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, ChevronRight, Loader2, GitMerge } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { parseLocalDate } from '../lib/dateHelpers';
import { loadVenues, likelyDuplicates, mergeVenues, venueCityLine, type Venue } from '../lib/venues';
import { short$, money$ } from '../lib/tourPipeline';

export interface VenueStats { shows: number; settled: number; made: number; projected: number; last: string | null; next: string | null }

/** Offers grouped by venue: how many shows, what they made, last and next date. */
export async function loadVenueStats(): Promise<Record<string, VenueStats>> {
  const { data: offers } = await supabase.from('offers')
    .select('id, venue_id, status, is_settled, actual_profit, calculations, show:shows(event_date)')
    .not('venue_id', 'is', null);
  const ids = (offers || []).filter((o: any) => o.status === 'settled' || o.is_settled).map((o: any) => o.id);
  const { data: st } = ids.length ? await supabase.from('settlements').select('offer_id, actual_profit').in('offer_id', ids) : { data: [] as any[] };
  const sm = Object.fromEntries((st || []).map((s: any) => [s.offer_id, s]));
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const out: Record<string, VenueStats> = {};
  for (const o of (offers || []) as any[]) {
    if (o.status === 'cancelled') continue;
    const s = (out[o.venue_id] ||= { shows: 0, settled: 0, made: 0, projected: 0, last: null, next: null });
    s.shows++;
    if (o.status === 'settled' || o.is_settled) { s.settled++; s.made += Number(sm[o.id]?.actual_profit ?? o.actual_profit ?? 0) || 0; }
    else s.projected += Number(o.calculations?.netProfit ?? 0) || 0;
    const d = o.show?.event_date as string | undefined;
    if (d) {
      const dt = parseLocalDate(d);
      if (dt && dt < today) { if (!s.last || d > s.last) s.last = d; }
      else if (!s.next || d < s.next) s.next = d;
    }
  }
  return out;
}

const fmt = (d: string | null) => (d ? parseLocalDate(d)?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '—');

export function VenuesPage() {
  const navigate = useNavigate();
  const [venues, setVenues] = useState<Venue[] | null>(null);
  const [stats, setStats] = useState<Record<string, VenueStats>>({});
  const [q, setQ] = useState('');
  const [skip, setSkip] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const [v, s] = await Promise.all([loadVenues(), loadVenueStats()]);
    setVenues(v); setStats(s);
  };
  useEffect(() => { load(); }, []);

  const dupes = useMemo(() => likelyDuplicates(venues || []).filter(([a, b]) => !skip.has(a.id + b.id)), [venues, skip]);
  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    const list = (venues || []).filter((v) => !k || v.name.toLowerCase().includes(k) || (v.city || '').toLowerCase().includes(k));
    return list.sort((a, b) => (stats[b.id]?.shows || 0) - (stats[a.id]?.shows || 0) || a.name.localeCompare(b.name));
  }, [venues, stats, q]);

  // Keep the one with more shows (or the nicer-looking name) and fold the other in.
  const merge = async (a: Venue, b: Venue) => {
    const sa = stats[a.id]?.shows || 0, sb = stats[b.id]?.shows || 0;
    const [keep, drop] = sa > sb || (sa === sb && a.name !== a.name.toUpperCase()) ? [a, b] : [b, a];
    if (!confirm(`Merge "${drop.name}" into "${keep.name}"? Its ${stats[drop.id]?.shows || 0} show(s) move over and the old spelling is remembered.`)) return;
    setBusy(a.id + b.id);
    try { await mergeVenues(keep, drop); await load(); } catch (e: any) { alert(e?.message || 'Could not merge.'); }
    setBusy(null);
  };

  const lab = 'font-label text-[10px] tracking-[0.16em] uppercase';
  const cols = 'md:grid-cols-[minmax(0,1fr)_70px_60px_90px_90px_90px_16px]';

  return (
    <div className="min-h-screen bg-[#1140F0]">
      <div className="bg-[#14171E] border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white leading-none">Venues</h1>
            <p className="text-gray-400 text-sm mt-1">Every room you've worked — the contact, the costs, and how each show did.</p>
          </div>
          <button onClick={() => navigate('/venues/new')} className="flex items-center gap-1.5 px-3 py-2 bg-[#8FD3FF] hover:bg-[#6FB8F2] text-[#04214D] rounded-xl text-sm font-bold">
            <Plus className="h-4 w-4" /> New venue
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex items-center gap-2 bg-[#14171E] border border-[#2A3040] rounded-xl px-3 mb-3 focus-within:border-[#8FD3FF]">
          <Search className="w-4 h-4 text-gray-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search venue or city" className="w-full bg-transparent py-2 text-sm text-white outline-none placeholder:text-gray-600" style={{ textTransform: 'none', letterSpacing: 0 }} />
        </div>

        {dupes.length > 0 && (
          <div className="bg-[#14171E] border border-[#F2B640]/50 rounded-xl p-3 mb-3">
            <div className="text-sm text-amber-200 mb-2 flex items-center gap-2"><GitMerge className="w-4 h-4" /> These look like the same room spelled two ways. Merge them and their shows add up in one place.</div>
            <div className="space-y-1.5">
              {dupes.slice(0, 8).map(([a, b]) => (
                <div key={a.id + b.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-white">"{a.name}"</span><span className="text-gray-500">({stats[a.id]?.shows || 0})</span>
                  <span className="text-gray-500">and</span>
                  <span className="text-white">"{b.name}"</span><span className="text-gray-500">({stats[b.id]?.shows || 0})</span>
                  <button onClick={() => merge(a, b)} disabled={busy === a.id + b.id} className="ml-auto text-xs bg-[#F2B640] text-[#14171E] rounded-md px-2 py-1 font-bold" style={{ textTransform: 'none', letterSpacing: 0 }}>{busy === a.id + b.id ? 'Merging…' : 'Merge'}</button>
                  <button onClick={() => setSkip((s) => new Set(s).add(a.id + b.id))} className="text-xs text-gray-400 hover:text-white" style={{ textTransform: 'none', letterSpacing: 0 }}>Not the same</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {venues === null ? (
          <div className="flex justify-center py-16 text-white"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : shown.length === 0 ? (
          <div className="bg-[#14171E] border border-[#2A3040] rounded-xl p-8 text-center">
            <p className="text-white font-semibold">{venues.length ? 'No match.' : 'No venues yet.'}</p>
            <p className="text-gray-400 text-sm mt-1">Every offer you make saves its venue here automatically. Add one by hand to load its costs before you book.</p>
          </div>
        ) : (
          <div className="bg-[#14171E] border border-[#2A3040] rounded-xl">
            <div className={`hidden md:grid ${cols} gap-3 px-4 py-2 border-b border-[#2A3040] ${lab} text-gray-500`}>
              <span>Venue</span><span className="text-right">Cap</span><span className="text-right">Shows</span><span className="text-right">Last</span><span className="text-right">Next</span><span className="text-right">Made</span><span />
            </div>
            {shown.map((v) => {
              const s = stats[v.id];
              return (
                <div key={v.id} onClick={() => navigate(`/venues/${v.id}`)} className={`group cursor-pointer px-4 py-2.5 border-b border-[#2A3040] last:border-b-0 hover:bg-[#1A1F2B] md:grid ${cols} md:gap-3 md:items-center`}>
                  <div className="min-w-0">
                    <div className="text-white font-semibold text-sm truncate">{v.name}</div>
                    <div className="text-[11px] text-gray-400 truncate">{venueCityLine(v) || <span className="text-amber-300/80">no city</span>}{v.contact_name ? ` · ${v.contact_name}` : ''}{v.costs?.length ? ` · ${v.costs.length} cost lines` : ''}</div>
                  </div>
                  <div className="grid grid-cols-5 gap-2 mt-1.5 md:mt-0 md:contents">
                    {[
                      ['Cap', v.capacity ? v.capacity.toLocaleString() : '—', 'text-gray-300'],
                      ['Shows', String(s?.shows || 0), 'text-white'],
                      ['Last', fmt(s?.last ?? null), 'text-gray-300'],
                      ['Next', fmt(s?.next ?? null), s?.next ? 'text-[#8FD3FF]' : 'text-gray-500'],
                      ['Made', s?.settled ? short$(s.made) : '—', s && s.made < 0 ? 'text-red-400' : 'text-green-400'],
                    ].map(([l, val, c]) => (
                      <div key={l} className="md:text-right">
                        <div className={`md:hidden ${lab} text-[9px] text-gray-500`}>{l}</div>
                        <div className={`text-sm ${c}`} title={l === 'Made' && s?.settled ? `${money$(s.made)} over ${s.settled} settled show(s)` : undefined}>{val}</div>
                      </div>
                    ))}
                  </div>
                  <ChevronRight className="hidden md:block w-4 h-4 text-gray-600 group-hover:text-white" />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
