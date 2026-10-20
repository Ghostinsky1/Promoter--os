import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Music2, Plus, Trash2, Globe2, Loader2, Link2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { parseLocalDate } from '../lib/dateHelpers';
import {
  STAGES, STAGE, buildCards, money, nextShow, geocode, short$, money$,
  type Card, type Stage, type TourLead, type TourCost, type LeadStage,
} from '../lib/tourPipeline';
import { PipelineBoard } from '../components/tour/PipelineBoard';
import { TourTimeline } from '../components/tour/TourTimeline';
import { LeadDrawer } from '../components/tour/LeadDrawer';

const TourGlobe = lazy(() => import('../components/tour/TourGlobe'));

/**
 * A tour, run like a CRM (Jose, Oct 20): the route on a globe, the run on a timeline,
 * every venue on a pipeline board from first email to settled, and the tour's money —
 * what we made, what's closed, what we're trying to close, tour costs, and the P/L.
 */
export function TourDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [tour, setTour] = useState<any>(null);
  const [offers, setOffers] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<Record<string, any>>({});
  const [leads, setLeads] = useState<TourLead[]>([]);
  const [costs, setCosts] = useState<TourCost[]>([]);
  const [available, setAvailable] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<{ card: Card | null; stage?: LeadStage } | null>(null);
  const [showAddOffer, setShowAddOffer] = useState(false);
  const [toast, setToast] = useState<{ text: string; link?: { label: string; to: string } } | null>(null);
  const [offerGeo, setOfferGeo] = useState<Record<string, { lat: number; lng: number }>>({});
  const [statusOpen, setStatusOpen] = useState(false);
  const [newCost, setNewCost] = useState({ label: '', amount: '' });

  const load = useCallback(async () => {
    if (!id) return;
    const [{ data: t }, { data: o }, { data: l }, { data: c }, { data: av }] = await Promise.all([
      supabase.from('tours').select('*').eq('id', id).maybeSingle(),
      supabase.from('offers').select('*, show:shows(*), venue:venues(*)').eq('tour_id', id),
      supabase.from('tour_leads').select('*').eq('tour_id', id).order('position'),
      supabase.from('tour_costs').select('*').eq('tour_id', id).order('created_at'),
      supabase.from('offers').select('id, status, calculations, show:shows(artist_name, venue_name, event_date, capacity)').is('tour_id', null),
    ]);
    setTour(t); setOffers(o || []); setLeads((l || []) as TourLead[]); setCosts((c || []) as TourCost[]); setAvailable(av || []);
    const ids = (o || []).map((x: any) => x.id);
    if (ids.length) {
      const { data: s } = await supabase.from('settlements').select('offer_id, actual_profit, actual_revenue, settled_at').in('offer_id', ids);
      setSettlements(Object.fromEntries((s || []).map((x: any) => [x.offer_id, x])));
    } else setSettlements({});
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const k = params.get('open'); if (k && leads.length) { setSelected(k); } }, [params, leads.length]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 6000); return () => clearTimeout(t); }, [toast]);
  useEffect(() => {
    if (!statusOpen) return;
    const close = () => setStatusOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [statusOpen]);

  const rawCards = useMemo(() => buildCards(leads, offers, settlements), [leads, offers, settlements]);

  // Shows with no spot on the map yet: look the city up once. A hit is saved on the
  // venue (or the lead) so every offer at that room lands on the globe from now on.
  const [geoTried, setGeoTried] = useState<Record<string, boolean>>({});
  useEffect(() => {
    let alive = true;
    (async () => {
      for (const c of rawCards) {
        if (c.lat != null || offerGeo[c.key] || geoTried[c.key]) continue;
        const g = c.city ? await geocode(c.city, c.region) : null;
        if (!alive) return;
        setGeoTried((t) => ({ ...t, [c.key]: true }));
        if (!g) continue;
        setOfferGeo((m) => ({ ...m, [c.key]: g }));
        if (c.lead) await supabase.from('tour_leads').update({ lat: g.lat, lng: g.lng }).eq('id', c.lead.id);
        else if (c.offer?.venue?.id) await supabase.from('venues').update({ lat: g.lat, lng: g.lng }).eq('id', c.offer.venue.id);
      }
    })();
    return () => { alive = false; };
  }, [rawCards]); // eslint-disable-line react-hooks/exhaustive-deps

  const cards = useMemo(() => rawCards.map((c) => (c.lat == null && offerGeo[c.key] ? { ...c, ...offerGeo[c.key] } : c)), [rawCards, offerGeo]);
  const m = useMemo(() => money(cards, costs), [cards, costs]);
  const next = useMemo(() => nextShow(cards), [cards]);
  const sel = cards.find((c) => c.key === selected) ?? null;
  const offMap = cards.filter((c) => c.stage !== 'dead' && c.lat == null && geoTried[c.key]);
  const [fix, setFix] = useState<{ key: string; value: string; busy?: boolean; err?: string } | null>(null);

  // Put a show on the map by fixing its city. Offers fix the saved venue (so every show
  // there is fixed); leads fix the lead.
  const saveCity = async (c: Card, raw: string) => {
    const [city, region] = raw.split(',').map((x) => x.trim());
    if (!city) return;
    setFix({ key: c.key, value: raw, busy: true });
    const g = await geocode(city, region || null);
    if (!g) { setFix({ key: c.key, value: raw, err: `Couldn't find "${raw}". Try "Denver, CO".` }); return; }
    if (c.lead) await supabase.from('tour_leads').update({ city, region: region || null, lat: g.lat, lng: g.lng, updated_at: new Date().toISOString() }).eq('id', c.lead.id);
    else if (c.offer?.venue?.id) await supabase.from('venues').update({ city, state: region || null, lat: g.lat, lng: g.lng, updated_at: new Date().toISOString() }).eq('id', c.offer.venue.id);
    else if (c.offer) await supabase.from('offers').update({ venue_city: city, venue_state: region || null }).eq('id', c.offer.id);
    setOfferGeo((m) => ({ ...m, [c.key]: g }));
    setFix(null);
    await load();
  };

  // ───────── writes ─────────
  const saveLead = async (patch: Partial<TourLead>, leadId: string | null) => {
    if (!tour) return;
    if (leadId) {
      const { error } = await supabase.from('tour_leads').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', leadId);
      if (error) throw error;
    } else {
      const { data, error } = await supabase.from('tour_leads').insert({ ...patch, tour_id: tour.id, organization_id: tour.organization_id, position: leads.length }).select('id').single();
      if (error) throw error;
      setSelected(data.id);
    }
    await load();
  };

  const deleteLead = async (leadId: string) => {
    await supabase.from('tour_leads').delete().eq('id', leadId);
    setDrawer(null); setSelected(null); await load();
  };

  const moveCard = async (c: Card, to: Stage) => {
    if (!tour) return;
    // A lead with no offer: stage only. Offer stages need the offer first.
    if (!c.offer) {
      if (to === 'offer_sent' || to === 'settled') {
        setToast({ text: `${c.city}: make the offer first — then it can move to ${STAGE[to].label}.` });
        setDrawer({ card: c });
        return;
      }
      if (to === 'confirmed') setToast({ text: `${c.city} is confirmed. Make the offer when you're ready so the numbers count.`, link: { label: 'Open', to: `/tours/${tour.id}?open=${c.lead!.id}` } });
      setLeads((ls) => ls.map((l) => (l.id === c.lead!.id ? { ...l, stage: to as LeadStage } : l)));
      await supabase.from('tour_leads').update({ stage: to, updated_at: new Date().toISOString() }).eq('id', c.lead!.id);
      return;
    }
    // A card with an offer: the offer's status moves it.
    if (to === 'settled') {
      setToast({ text: `${c.city}: settle it on the settlement page — that's what marks it settled.`, link: { label: 'Open settlement', to: `/offers/${c.offer.id}/settlement` } });
      return;
    }
    const patch: Record<string, any> =
      to === 'offer_sent' ? { status: 'offer_sent' } :
      to === 'confirmed' ? { status: 'confirmed' } :
      to === 'dead' ? { status: 'cancelled', ...(c.offer.cancelled_at ? {} : { cancelled_at: new Date().toISOString() }) } :
      { status: 'planning' };
    setOffers((os) => os.map((o) => (o.id === c.offer.id ? { ...o, ...patch } : o)));
    const { error } = await supabase.from('offers').update(patch).eq('id', c.offer.id);
    if (error) { setToast({ text: 'Could not move that one. Try again.' }); await load(); return; }
    if (to === 'lead' || to === 'contacted' || to === 'talking' || to === 'hold' || to === 'confirmed') {
      if (c.lead) await supabase.from('tour_leads').update({ stage: to }).eq('id', c.lead.id);
      else await supabase.from('tour_leads').insert({ tour_id: tour.id, organization_id: tour.organization_id, venue: c.venue, city: c.city, region: c.region, lat: c.lat, lng: c.lng, event_date: c.date, stage: to, offer_id: c.offer.id, position: leads.length });
    }
    if (to === 'dead') setToast({ text: `${c.city} marked cancelled. If it cost you anything, record it on the offer.`, link: { label: 'Open offer', to: `/offers/${c.offer.id}` } });
    await load();
  };

  const addExistingOffer = async (offerId: string) => {
    await supabase.from('offers').update({ tour_id: id, show_number: offers.length + 1 }).eq('id', offerId);
    setShowAddOffer(false); await load();
  };

  const addCost = async () => {
    const amount = Number(newCost.amount.replace(/[^0-9.-]/g, ''));
    if (!newCost.label.trim() || !Number.isFinite(amount) || !tour) return;
    await supabase.from('tour_costs').insert({ tour_id: tour.id, organization_id: tour.organization_id, label: newCost.label.trim(), amount });
    setNewCost({ label: '', amount: '' }); await load();
  };
  const removeCost = async (costId: string) => { await supabase.from('tour_costs').delete().eq('id', costId); await load(); };

  const setStatus = async (s: string) => {
    await supabase.from('tours').update({ status: s }).eq('id', id);
    setTour({ ...tour, status: s }); setStatusOpen(false);
  };

  const pick = (key: string) => { setSelected(key); setParams({}, { replace: true }); };

  if (loading) return <div className="min-h-screen bg-[#1140F0] flex items-center justify-center text-white"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (!tour) return <div className="min-h-screen bg-[#1140F0] flex items-center justify-center text-white">Tour not found</div>;

  const tiles = [
    { label: 'Made', sub: `${m.counts.settled} settled · actual`, v: m.made, color: '#4ADE80' },
    { label: 'Closed', sub: `${m.counts.confirmed} confirmed · projected`, v: m.closed, color: '#8FD3FF' },
    { label: 'Trying to close', sub: `${m.counts.talking + m.counts.hold + m.counts.offer_sent} talking / hold / sent`, v: m.tryingToClose, color: '#F2B640' },
    { label: 'Early leads', sub: `${m.counts.lead + m.counts.contacted} to contact / contacted · your guesses`, v: m.earlyLeads, color: '#93A2B8' },
    { label: 'Tour costs', sub: `${costs.length} line${costs.length === 1 ? '' : 's'}`, v: -m.tourCosts, color: '#F0605A' },
  ];
  const statusOptions = ['planning', 'booking', 'confirmed', 'active', 'completed', 'cancelled'];

  return (
    <div className="min-h-screen bg-[#1140F0]">
      <div className="max-w-7xl mx-auto px-3 sm:px-5 py-4">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <button onClick={() => navigate('/tours')} className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 shrink-0"><ArrowLeft className="w-5 h-5" /></button>
          <div className="min-w-0 flex-1">
            <div className="font-label text-[10px] tracking-[0.2em] uppercase text-[#CFE4FF]">Tour</div>
            <h1 className="text-xl sm:text-2xl font-bold text-white leading-tight truncate">{tour.name}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/80 mt-1">
              {tour.artist_name && <span className="inline-flex items-center gap-1.5"><Music2 className="w-4 h-4" />{tour.artist_name}</span>}
              {(tour.start_date || tour.end_date) && (
                <span className="inline-flex items-center gap-1.5"><Calendar className="w-4 h-4" />
                  {parseLocalDate(tour.start_date)?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {parseLocalDate(tour.end_date)?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              )}
              <span className="relative">
                <button onClick={(e) => { e.stopPropagation(); setStatusOpen((v) => !v); }} className="crt-tab on" style={{ padding: '3px 10px' }}>{tour.status}</button>
                {statusOpen && (
                  <div className="absolute left-0 top-full mt-1 bg-[#14171E] border border-[#2A3040] rounded-xl z-20 min-w-[140px] py-1">
                    {statusOptions.map((s) => (
                      <button key={s} onClick={() => setStatus(s)} className={`block w-full text-left px-3 py-1.5 text-sm hover:bg-white/5 ${s === tour.status ? 'text-[#8FD3FF]' : 'text-gray-300'}`} style={{ textTransform: 'none', letterSpacing: 0 }}>{s}</button>
                    ))}
                  </div>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Money */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-1.5 sm:gap-2 mb-3">
          {tiles.map((t) => (
            <div key={t.label} className="bg-[#14171E] border border-[#2A3040] rounded-2xl px-3 py-2.5">
              <div className="font-label text-[9px] sm:text-[10px] tracking-[0.14em] uppercase truncate" style={{ color: t.color }}>{t.label}</div>
              <div className={`text-base sm:text-xl font-bold ${t.v < 0 ? 'text-red-400' : 'text-white'}`}>{t.v === 0 ? '$0' : short$(t.v)}</div>
              <div className="text-[10px] sm:text-[11px] text-gray-500 leading-tight truncate">{t.sub}</div>
            </div>
          ))}
          <div className="col-span-3 md:col-span-1 rounded-2xl px-3 py-2.5 border-2" style={{ background: '#0B0D12', borderColor: m.pl >= 0 ? '#4ADE80' : '#F0605A', boxShadow: `0 0 22px ${m.pl >= 0 ? 'rgba(74,222,128,0.25)' : 'rgba(240,96,90,0.25)'}` }}>
            <div className="font-label text-[10px] tracking-[0.16em] uppercase text-white">Tour P/L</div>
            <div className={`text-2xl font-bold ${m.pl >= 0 ? 'text-green-400' : 'text-red-400'}`}>{money$(m.pl)}</div>
            <div className="text-[11px] text-gray-500 leading-tight">made − tour costs</div>
          </div>
        </div>
        <div className="text-[12px] text-white/80 mb-3">
          In the pipeline, not closed yet: <b className="text-white">{money$(m.pipeline)}</b> across {m.counts.lead + m.counts.contacted + m.counts.talking + m.counts.hold + m.counts.offer_sent} venues.
          {m.closed !== 0 && <> If every confirmed show hits its projection, P/L would be <b className="text-white">{money$(m.pl + m.closed)}</b>.</>}
        </div>

        {/* Globe + timeline */}
        <div className="bg-[#14171E] border border-[#2A3040] rounded-2xl overflow-hidden mb-3">
          <div className="grid lg:grid-cols-[1fr_300px]">
            <div className="relative bg-[radial-gradient(ellipse_at_center,#0B2FB8_0%,#0B0D12_70%)]">
              <div className="absolute top-3 left-3 z-10 font-label text-[10px] tracking-[0.2em] uppercase text-[#8FD3FF] flex items-center gap-1.5"><Globe2 className="w-3.5 h-3.5" /> The route</div>
              <div className="absolute top-3 right-3 z-10 flex items-center gap-3 text-[10px] font-label tracking-[0.14em] uppercase">
                <span className="inline-flex items-center gap-1 text-[#9AA4B5]"><span className="w-2 h-2 rounded-full bg-[#9AA4B5]" /> Been</span>
                <span className="inline-flex items-center gap-1 text-[#4ADE80]"><span className="w-2 h-2 rounded-full bg-[#4ADE80]" /> Coming</span>
                <span className="inline-flex items-center gap-1 text-[#8FD3FF]"><span className="w-2 h-2 rounded-full bg-[#8FD3FF] animate-pulse" /> Next</span>
              </div>
              {!next && cards.some((c) => c.lat != null) && (
                <div className="absolute inset-x-0 bottom-4 z-10 text-center text-sm text-white/80">Nothing coming up on this tour — these are the cities you played. Add a venue with a date and it lights up.</div>
              )}
              <Suspense fallback={<div className="h-[420px] flex items-center justify-center text-gray-500"><Loader2 className="w-5 h-5 animate-spin" /></div>}>
                <TourGlobe cards={cards.filter((c) => c.stage !== 'dead')} nextKey={next?.key ?? null} selectedKey={selected} onSelect={pick} height={typeof window !== 'undefined' && window.innerWidth < 640 ? 340 : 420} />
              </Suspense>
              {!cards.some((c) => c.lat != null) && (
                <div className="absolute inset-x-0 bottom-4 text-center text-sm text-gray-400">Add a venue with a city and it lands on the globe.</div>
              )}
            </div>
            <div className="border-t lg:border-t-0 lg:border-l border-[#2A3040] p-3 space-y-3">
              {sel ? (
                <div className="crt-panel" key={sel.key}>
                  <div className="font-label text-[10px] tracking-[0.16em] uppercase" style={{ color: STAGE[sel.stage].color }}>{STAGE[sel.stage].label}</div>
                  <div className="text-lg font-bold text-white leading-tight">{sel.city}</div>
                  <div className="text-sm text-gray-400">{sel.venue}</div>
                  <div className="text-sm text-gray-300 mt-1">{sel.date ? parseLocalDate(sel.date)!.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'No date yet'}</div>
                  {sel.money != null && <div className={`text-sm mt-1 ${sel.money < 0 ? 'text-red-400' : 'text-white'}`}>{sel.moneyKind === 'actual' ? 'Made' : sel.moneyKind === 'projected' ? 'Projected' : 'Guess'}: <b>{money$(sel.money)}</b></div>}
                  {sel.next && <div className="text-sm text-gray-300 mt-1"><span className="text-gray-500">Next:</span> {sel.next}</div>}
                  {sel.contact && <div className="text-xs text-gray-500 mt-1 break-words">{sel.contact}</div>}
                  <button onClick={() => setDrawer({ card: sel })} className="mt-2 text-sm bg-[#8FD3FF] text-[#04214D] rounded-lg px-3 py-1.5 font-semibold" style={{ textTransform: 'none', letterSpacing: 0 }}>Open</button>
                </div>
              ) : (
                <div className="text-sm text-gray-400">Tap a city on the globe, the line or a card.</div>
              )}
              <div className="space-y-1 pt-2 border-t border-[#2A3040]">
                {STAGES.filter((s) => s.key !== 'dead').map((s) => (
                  <div key={s.key} className="flex items-center justify-between text-[12px]">
                    <span className="inline-flex items-center gap-2 text-gray-300"><span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color, boxShadow: `0 0 6px ${s.color}` }} />{s.label}</span>
                    <span className="text-gray-500">{m.counts[s.key]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {offMap.length > 0 && (
            <div className="border-t border-[#2A3040] px-3 sm:px-4 py-2.5 bg-[#F2B640]/5">
              <div className="text-[12px] text-amber-200 mb-1.5">Not on the map yet — the city is missing or misspelled. Fix it once and every show at that venue lands on the globe.</div>
              <div className="flex flex-wrap gap-2">
                {offMap.map((c) => fix?.key === c.key ? (
                  <div key={c.key} className="flex flex-wrap items-center gap-1.5 bg-[#0B0D12] border border-[#2A3040] rounded-lg px-2 py-1">
                    <span className="text-xs text-white">{c.venue}</span>
                    <input autoFocus value={fix.value} onChange={(e) => setFix({ key: c.key, value: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveCity(c, fix.value); if (e.key === 'Escape') setFix(null); }}
                      placeholder="City, ST" className="w-36 bg-transparent border-b border-[#8FD3FF]/60 text-sm text-white outline-none" style={{ textTransform: 'none', letterSpacing: 0 }} />
                    <button onClick={() => saveCity(c, fix.value)} disabled={fix.busy} className="text-xs bg-[#8FD3FF] text-[#04214D] rounded px-2 py-0.5 font-bold">{fix.busy ? '…' : 'Save'}</button>
                    {fix.err && <span className="text-[11px] text-amber-300 w-full">{fix.err}</span>}
                  </div>
                ) : (
                  <button key={c.key} onClick={() => setFix({ key: c.key, value: [c.city, c.region].filter(Boolean).join(', ') })}
                    className="text-xs text-white bg-[#0B0D12] border border-[#F2B640]/50 rounded-lg px-2 py-1 hover:border-[#F2B640]" style={{ textTransform: 'none', letterSpacing: 0 }}>
                    {c.venue}{c.date ? ` · ${parseLocalDate(c.date)!.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''} · <span className="text-amber-300">{c.city || c.region ? `"${[c.city, c.region].filter(Boolean).join(', ')}"` : 'no city'} — set city</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="border-t border-[#2A3040] px-3 sm:px-4 pt-3 pb-3">
            <TourTimeline cards={cards} nextKey={next?.key ?? null} selectedKey={selected} onSelect={pick} start={tour.start_date} end={tour.end_date} />
          </div>
        </div>

        {/* Pipeline */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h2 className="text-lg font-bold text-white">Pipeline</h2>
          <div className="flex gap-2">
            <button onClick={() => setShowAddOffer(true)} className="text-sm text-white border border-white/30 hover:bg-white/10 rounded-xl px-3 py-2 inline-flex items-center gap-1.5" style={{ textTransform: 'none', letterSpacing: 0 }}><Link2 className="w-4 h-4" /> Add an existing offer</button>
            <button onClick={() => setDrawer({ card: null, stage: 'lead' })} className="text-sm bg-[#8FD3FF] hover:bg-[#6FB8F2] text-[#04214D] rounded-xl px-3 py-2 font-bold inline-flex items-center gap-1.5"><Plus className="w-4 h-4" /> Venue</button>
          </div>
        </div>
        <PipelineBoard
          cards={cards}
          selectedKey={selected}
          onOpen={(c) => { pick(c.key); setDrawer({ card: c }); }}
          onMove={moveCard}
          onAdd={(stage) => setDrawer({ card: null, stage: stage as LeadStage })}
        />

        {/* Tour costs */}
        <div className="bg-[#14171E] border border-[#2A3040] rounded-2xl p-4 mt-4">
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-lg font-bold text-white">Tour costs</h2>
            <span className="text-sm text-gray-400">Total <b className="text-white">{money$(m.tourCosts)}</b></span>
          </div>
          <p className="text-[12px] text-gray-500 mb-3">Costs that belong to the whole run, not one show — van, flights, crew, tour ads. They come off the tour P/L.</p>
          <div className="space-y-1.5 mb-3">
            {costs.map((c) => (
              <div key={c.id} className="flex items-center gap-2 bg-[#0B0D12] rounded-lg px-3 py-2">
                <span className="text-white flex-1 truncate">{c.label}</span>
                <span className="text-gray-300">{money$(Number(c.amount))}</span>
                <button onClick={() => removeCost(c.id)} className="text-gray-600 hover:text-red-300 p-1" title="Remove"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            {!costs.length && <div className="text-sm text-gray-500">None yet.</div>}
          </div>
          <div className="flex gap-2">
            <input value={newCost.label} onChange={(e) => setNewCost({ ...newCost, label: e.target.value })} placeholder="Sprinter van rental" className="flex-1 bg-[#0B0D12] border border-[#2A3040] rounded-lg px-3 py-2 text-white outline-none focus:border-[#8FD3FF]" style={{ textTransform: 'none', letterSpacing: 0 }} />
            <input value={newCost.amount} onChange={(e) => setNewCost({ ...newCost, amount: e.target.value })} placeholder="$" inputMode="decimal" className="w-28 bg-[#0B0D12] border border-[#2A3040] rounded-lg px-3 py-2 text-white outline-none focus:border-[#8FD3FF]" onKeyDown={(e) => { if (e.key === 'Enter') addCost(); }} />
            <button onClick={addCost} className="bg-[#8FD3FF] text-[#04214D] rounded-lg px-3 font-bold"><Plus className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-[#14171E] border border-[#F2B640]/60 text-white rounded-xl px-4 py-3 shadow-2xl max-w-md w-[92%] flex items-center gap-3">
          <span className="text-sm flex-1">{toast.text}</span>
          {toast.link && <button onClick={() => navigate(toast.link!.to)} className="text-sm text-[#8FD3FF] font-semibold shrink-0" style={{ textTransform: 'none', letterSpacing: 0 }}>{toast.link.label}</button>}
        </div>
      )}

      {drawer && (
        <LeadDrawer
          key={drawer.card?.key ?? 'new'}
          card={drawer.card}
          initialStage={drawer.stage}
          tourId={tour.id}
          artist={tour.artist_name || ''}
          onClose={() => setDrawer(null)}
          onSave={saveLead}
          onDelete={deleteLead}
        />
      )}

      {showAddOffer && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowAddOffer(false)}>
          <div className="bg-[#14171E] border border-[#2A3040] rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-1">Add an existing offer</h2>
            <p className="text-sm text-gray-400 mb-3">Offers not on any tour yet.</p>
            <div className="space-y-2">
              {available.length ? available.map((o) => (
                <button key={o.id} onClick={() => addExistingOffer(o.id)} className="w-full text-left bg-[#0B0D12] border border-[#2A3040] hover:border-[#8FD3FF]/60 rounded-xl px-3 py-2.5 flex items-center justify-between gap-3" style={{ textTransform: 'none', letterSpacing: 0 }}>
                  <span className="min-w-0">
                    <span className="block text-white font-semibold truncate">{o.show?.artist_name} · {o.show?.venue_name}</span>
                    <span className="block text-xs text-gray-400">{o.show?.event_date ? parseLocalDate(o.show.event_date)?.toLocaleDateString() : 'No date'} · {o.status || 'planning'}</span>
                  </span>
                  <span className="text-sm text-[#8FD3FF] shrink-0">{o.calculations?.netProfit != null ? short$(o.calculations.netProfit) : ''}</span>
                </button>
              )) : <div className="text-sm text-gray-400">Every offer is already on a tour.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
