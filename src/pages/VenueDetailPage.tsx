import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Loader2, Zap, FileText, GitMerge, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { parseLocalDate } from '../lib/dateHelpers';
import { geocode, money$, short$ } from '../lib/tourPipeline';
import { costTotal, loadVenues, mergeVenues, type CostCategory, type Venue, type VenueCost } from '../lib/venues';

const CATS: { key: CostCategory; label: string }[] = [
  { key: 'general', label: 'Venue / staff' }, { key: 'production', label: 'Production' }, { key: 'marketing', label: 'Marketing' }, { key: 'talent', label: 'Talent / hospitality' },
];
const STATUS_COLOR: Record<string, string> = { planning: '#93A2B8', offer_sent: '#8FD3FF', confirmed: '#4ADE80', active: '#4ADE80', settled: '#FFFFFF', cancelled: '#F0605A' };

type Draft = {
  name: string; street: string; city: string; state: string; zip: string; capacity: string;
  contact_name: string; contact_email: string; contact_phone: string; contact_ig: string;
  facility_fee_per_ticket: string; notes: string; costs: { label: string; amount: string; category: CostCategory }[];
};
const toDraft = (v?: Partial<Venue> | null): Draft => ({
  name: v?.name ?? '', street: v?.street ?? '', city: v?.city ?? '', state: v?.state ?? '', zip: v?.zip ?? '',
  capacity: v?.capacity != null ? String(v.capacity) : '',
  contact_name: v?.contact_name ?? '', contact_email: v?.contact_email ?? '', contact_phone: v?.contact_phone ?? '', contact_ig: v?.contact_ig ?? '',
  facility_fee_per_ticket: v?.facility_fee_per_ticket != null ? String(v.facility_fee_per_ticket) : '',
  notes: v?.notes ?? '',
  costs: (v?.costs || []).map((c) => ({ label: c.label, amount: String(c.amount ?? ''), category: c.category || 'general' })),
});
const num = (s: string) => { const n = Number(String(s).replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? n : 0; };
const blank = (s: string) => (s.trim() === '' ? null : s.trim());

export function VenueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const [venue, setVenue] = useState<Venue | null>(null);
  const [d, setD] = useState<Draft>(toDraft());
  const [offers, setOffers] = useState<any[]>([]);
  const [settled, setSettled] = useState<Record<string, number>>({});
  const [others, setOthers] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mergeInto, setMergeInto] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (isNew || !id) return;
    (async () => {
      const [{ data: v }, { data: o }, all] = await Promise.all([
        supabase.from('venues').select('*').eq('id', id).maybeSingle(),
        supabase.from('offers').select('id, status, is_settled, actual_profit, calculations, tour_id, show:shows(artist_name, event_date, capacity)').eq('venue_id', id),
        loadVenues(),
      ]);
      setVenue(v as Venue); setD(toDraft(v as Venue));
      const list = (o || []).sort((a: any, b: any) => String(b.show?.event_date || '').localeCompare(String(a.show?.event_date || '')));
      setOffers(list);
      const ids = list.filter((x: any) => x.status === 'settled' || x.is_settled).map((x: any) => x.id);
      if (ids.length) {
        const { data: st } = await supabase.from('settlements').select('offer_id, actual_profit').in('offer_id', ids);
        setSettled(Object.fromEntries((st || []).map((s: any) => [s.offer_id, Number(s.actual_profit) || 0])));
      }
      setOthers(all.filter((x) => x.id !== id));
      setLoading(false);
    })();
  }, [id, isNew]);

  const summary = useMemo(() => {
    const live = offers.filter((o) => o.status !== 'cancelled');
    const done = live.filter((o) => o.status === 'settled' || o.is_settled);
    const made = done.reduce((s, o) => s + (settled[o.id] ?? (Number(o.actual_profit) || 0)), 0);
    return { shows: live.length, settled: done.length, made, avg: done.length ? made / done.length : 0 };
  }, [offers, settled]);

  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setD({ ...d, [k]: e.target.value }); setSaved(false); };
  const setCost = (i: number, patch: Partial<Draft['costs'][number]>) => { setD({ ...d, costs: d.costs.map((c, j) => (j === i ? { ...c, ...patch } : c)) }); setSaved(false); };

  const save = async () => {
    if (!d.name.trim()) { setErr('Give the venue a name.'); return; }
    setSaving(true); setErr(null);
    try {
      const costs: VenueCost[] = d.costs.filter((c) => c.label.trim()).map((c) => ({ label: c.label.trim(), amount: num(c.amount), category: c.category }));
      const moved = !venue || venue.city !== blank(d.city) || venue.state !== blank(d.state) || venue.lat == null;
      const g = moved && d.city.trim() ? await geocode(d.city.trim(), blank(d.state)) : null;
      const row: Record<string, any> = {
        name: d.name.trim(), street: blank(d.street), city: blank(d.city), state: blank(d.state), zip: blank(d.zip),
        capacity: d.capacity.trim() ? Math.round(num(d.capacity)) : null,
        contact_name: blank(d.contact_name), contact_email: blank(d.contact_email), contact_phone: blank(d.contact_phone), contact_ig: blank(d.contact_ig),
        facility_fee_per_ticket: d.facility_fee_per_ticket.trim() ? num(d.facility_fee_per_ticket) : null,
        notes: blank(d.notes), costs, updated_at: new Date().toISOString(),
        ...(moved ? { lat: g?.lat ?? null, lng: g?.lng ?? null } : {}),
      };
      if (isNew) {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: m } = await supabase.from('organization_members').select('organization_id').eq('user_id', user!.id).eq('is_active', true).maybeSingle();
        if (!m?.organization_id) throw new Error('No organization found.');
        const { data, error } = await supabase.from('venues').insert({ ...row, organization_id: m.organization_id, created_by: user!.id }).select('*').single();
        if (error) throw error.code === '23505' ? new Error('You already have a venue with that name.') : error;
        navigate(`/venues/${data.id}`, { replace: true });
        return;
      }
      const { data, error } = await supabase.from('venues').update(row).eq('id', venue!.id).select('*').single();
      if (error) throw error.code === '23505' ? new Error('Another venue already has that name — merge them instead.') : error;
      setVenue(data as Venue); setSaved(true);
    } catch (e: any) {
      setErr(e?.message || 'Could not save.');
    } finally { setSaving(false); }
  };

  const doMerge = async () => {
    const target = others.find((o) => o.id === mergeInto);
    if (!venue || !target) return;
    if (!confirm(`Move all ${summary.shows} show(s) from "${venue.name}" into "${target.name}" and remove "${venue.name}"?`)) return;
    try { await mergeVenues(target, venue); navigate(`/venues/${target.id}`, { replace: true }); window.location.reload(); }
    catch (e: any) { setErr(e?.message || 'Could not merge.'); }
  };

  const remove = async () => {
    if (!venue) return;
    const { error } = await supabase.from('venues').delete().eq('id', venue.id);
    if (error) { setErr(error.message); return; }
    navigate('/venues', { replace: true });
  };

  const newOffer = (full: boolean) => {
    if (!venue) return;
    if (full) navigate('/offers/create', { state: { venueId: venue.id } });
    else navigate(`/offers/quick?venue_id=${venue.id}`);
  };

  if (loading) return <div className="min-h-screen bg-[#1140F0] flex items-center justify-center text-white"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (!isNew && !venue) return <div className="min-h-screen bg-[#1140F0] flex items-center justify-center text-white">Venue not found</div>;

  const base = 'bg-[#0B0D12] border border-[#2A3040] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#8FD3FF] placeholder:text-gray-600';
  const input = `w-full ${base}`;
  const lab = 'font-label text-[10px] tracking-[0.16em] uppercase text-gray-400';
  const panel = 'bg-[#14171E] border border-[#2A3040] rounded-xl p-4';
  // Called as a function (not <F/>) so inputs keep focus while typing.
  const F = ({ k, label, ph, w }: { k: keyof Draft; label: string; ph?: string; w?: string }) => (
    <label key={k} className={`block ${w || ''}`}><span className={lab}>{label}</span>
      <input className={input} value={d[k] as string} onChange={set(k)} placeholder={ph} style={{ textTransform: 'none', letterSpacing: 0 }} />
    </label>
  );

  return (
    <div className="min-h-screen bg-[#1140F0]">
      <div className="max-w-6xl mx-auto px-3 sm:px-5 py-4">
        <div className="flex items-start gap-2 mb-3">
          <button onClick={() => navigate('/venues')} className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10"><ArrowLeft className="w-5 h-5" /></button>
          <div className="min-w-0 flex-1">
            <div className="font-label text-[10px] tracking-[0.2em] uppercase text-[#CFE4FF]">Venue</div>
            <h1 className="text-xl sm:text-2xl font-bold text-white leading-tight truncate">{isNew ? 'New venue' : venue!.name}</h1>
          </div>
          {!isNew && (
            <div className="flex gap-2 shrink-0">
              <button onClick={() => newOffer(false)} className="text-sm bg-[#8FD3FF] text-[#04214D] rounded-xl px-3 py-2 font-bold inline-flex items-center gap-1.5"><Zap className="w-4 h-4" /> Offer here</button>
              <button onClick={() => newOffer(true)} className="hidden sm:inline-flex text-sm text-white border border-white/30 rounded-xl px-3 py-2 items-center gap-1.5" style={{ textTransform: 'none', letterSpacing: 0 }}><FileText className="w-4 h-4" /> Full offer</button>
            </div>
          )}
        </div>

        {!isNew && (
          <div className="bg-[#14171E] border border-[#2A3040] rounded-xl grid grid-cols-4 divide-x divide-[#2A3040] mb-3">
            {[['Shows', String(summary.shows), '#fff'], ['Settled', String(summary.settled), '#fff'], ['Made', summary.settled ? money$(summary.made) : '—', summary.made < 0 ? '#F87171' : '#4ADE80'], ['Per show', summary.settled ? short$(summary.avg) : '—', summary.avg < 0 ? '#F87171' : '#4ADE80']].map(([l, v, c]) => (
              <div key={l} className="px-3 py-2"><div className={lab}>{l}</div><div className="text-base font-bold" style={{ color: c }}>{v}</div></div>
            ))}
          </div>
        )}

        <div className="grid lg:grid-cols-[1fr_380px] gap-3 items-start">
          <div className="space-y-3">
            <div className={panel}>
              <div className="text-white font-semibold mb-2">The room</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {F({ k: 'name', label: 'Name', ph: 'Warehouse on Broadway', w: 'col-span-2 sm:col-span-3' })}
                {F({ k: 'capacity', label: 'Capacity', ph: '800' })}
                {F({ k: 'street', label: 'Street', w: 'col-span-2' })}
                {F({ k: 'city', label: 'City', ph: 'Kansas City' })}
                <div className="grid grid-cols-2 gap-2">{F({ k: 'state', label: 'State', ph: 'MO' })}{F({ k: 'zip', label: 'Zip' })}</div>
              </div>
            </div>

            <div className={panel}>
              <div className="text-white font-semibold mb-2">Contact</div>
              <div className="grid grid-cols-2 gap-2">
                {F({ k: 'contact_name', label: 'Talent buyer / booker' })}
                {F({ k: 'contact_phone', label: 'Phone' })}
                {F({ k: 'contact_email', label: 'Email' })}
                {F({ k: 'contact_ig', label: 'Instagram', ph: '@venue' })}
              </div>
            </div>

            <div className={panel}>
              <div className="flex items-baseline justify-between mb-1">
                <div className="text-white font-semibold">Venue costs</div>
                <div className="text-sm text-gray-400">Total <b className="text-white">{money$(costTotal(d.costs.map((c) => ({ ...c, amount: num(c.amount) }))))}</b></div>
              </div>
              <p className="text-[12px] text-gray-500 mb-2">Pick this venue on a new offer and these lines go straight into its expenses.</p>
              <div className="space-y-1.5">
                {d.costs.map((c, i) => (
                  <div key={i} className="flex gap-1.5 items-center">
                    <input className={`${base} flex-1 min-w-0`} value={c.label} onChange={(e) => setCost(i, { label: e.target.value })} placeholder="Rent / security / bartenders" style={{ textTransform: 'none', letterSpacing: 0 }} />
                    <select className={`${base} w-36 shrink-0 hidden sm:block`} value={c.category} onChange={(e) => setCost(i, { category: e.target.value as CostCategory })}>
                      {CATS.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
                    </select>
                    <input className={`${base} w-24 shrink-0`} value={c.amount} onChange={(e) => setCost(i, { amount: e.target.value })} placeholder="$" inputMode="decimal" />
                    <button onClick={() => { setD({ ...d, costs: d.costs.filter((_, j) => j !== i) }); setSaved(false); }} className="text-gray-600 hover:text-red-300 p-1"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
              <button onClick={() => setD({ ...d, costs: [...d.costs, { label: '', amount: '', category: 'general' }] })} className="mt-2 text-sm text-[#8FD3FF] inline-flex items-center gap-1" style={{ textTransform: 'none', letterSpacing: 0 }}><Plus className="w-4 h-4" /> Add a cost line</button>
              <div className="grid grid-cols-2 gap-2 mt-3">
                {F({ k: 'facility_fee_per_ticket', label: 'Facility fee per ticket', ph: '$2.00' })}
              </div>
            </div>

            <div className={panel}>
              <label className="block"><span className={lab}>Notes — age, curfew, ticketing, load-in, bar deal</span>
                <textarea className={`${input} min-h-[90px]`} value={d.notes} onChange={set('notes')} style={{ textTransform: 'none', letterSpacing: 0 }} />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button onClick={save} disabled={saving} className="bg-[#8FD3FF] hover:bg-[#6FB8F2] text-[#04214D] rounded-xl px-5 py-2.5 font-bold inline-flex items-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null} {saved ? 'Saved' : isNew ? 'Save venue' : 'Save changes'}
              </button>
              {err && <span className="text-sm text-amber-200">{err}</span>}
            </div>
          </div>

          {!isNew && (
            <div className="space-y-3">
              <div className={panel}>
                <div className="text-white font-semibold mb-2">Shows here</div>
                {offers.length ? (
                  <div className="divide-y divide-[#2A3040]">
                    {offers.map((o) => {
                      const done = o.status === 'settled' || o.is_settled;
                      const p = done ? (settled[o.id] ?? Number(o.actual_profit) ?? 0) : Number(o.calculations?.netProfit ?? 0);
                      return (
                        <button key={o.id} onClick={() => navigate(`/offers/${o.id}`)} className="w-full text-left py-2 flex items-center gap-2 hover:bg-white/5 rounded" style={{ textTransform: 'none', letterSpacing: 0 }}>
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: STATUS_COLOR[o.status] || '#93A2B8' }} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm text-white truncate">{o.show?.artist_name}</span>
                            <span className="block text-[11px] text-gray-400">{o.show?.event_date ? parseLocalDate(o.show.event_date)?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No date'} · {String(o.status || 'planning').replace('_', ' ')}</span>
                          </span>
                          <span className={`text-sm shrink-0 ${o.status === 'cancelled' ? 'text-gray-600 line-through' : p < 0 ? 'text-red-400' : done ? 'text-green-400' : 'text-gray-300'}`} title={done ? 'Actual' : 'Projected'}>{short$(p)}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : <div className="text-sm text-gray-400">No offers here yet.</div>}
                <p className="text-[11px] text-gray-500 mt-2">Green = actual (settled). Grey = projected.</p>
              </div>

              <div className={panel}>
                <div className="text-white font-semibold mb-1 flex items-center gap-2"><GitMerge className="w-4 h-4" /> Same room as another venue?</div>
                <p className="text-[12px] text-gray-500 mb-2">Merge moves these shows over and remembers this spelling.</p>
                <div className="flex gap-2">
                  <select className={`${base} flex-1 min-w-0`} value={mergeInto} onChange={(e) => setMergeInto(e.target.value)}>
                    <option value="">Pick the venue to keep…</option>
                    {others.map((o) => <option key={o.id} value={o.id}>{o.name}{o.city ? ` — ${o.city}` : ''}</option>)}
                  </select>
                  <button onClick={doMerge} disabled={!mergeInto} className="text-sm bg-[#F2B640] text-[#14171E] rounded-lg px-3 font-bold disabled:opacity-40">Merge</button>
                </div>
                {summary.shows === 0 && offers.length === 0 && (
                  <div className="mt-3 pt-3 border-t border-[#2A3040]">
                    {confirmDelete
                      ? <button onClick={remove} className="text-sm text-red-300 border border-red-800/60 rounded-lg px-3 py-1.5">Tap again to remove this venue</button>
                      : <button onClick={() => setConfirmDelete(true)} className="text-sm text-gray-500 hover:text-red-300 inline-flex items-center gap-1"><Trash2 className="w-4 h-4" /> Remove venue</button>}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
