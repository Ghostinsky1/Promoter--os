import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, FileText, Loader2, Trash2, ArrowRight, Receipt } from 'lucide-react';
import { LEAD_STAGES, STAGE, geocode, splitCity, short$, type Card, type LeadStage, type TourLead } from '../../lib/tourPipeline';

export interface LeadDraft {
  venue: string; cityLine: string; event_date: string; stage: LeadStage;
  contact: string; sent: string; next_step: string; notes: string; est_profit: string;
}

/**
 * Add or update a venue on the tour. A card that already has an offer shows the offer's
 * numbers and links; its stage then follows the offer.
 */
export function LeadDrawer({ card, initialStage, tourId, artist, onClose, onSave, onDelete }: {
  card: Card | null; initialStage?: LeadStage; tourId: string; artist: string;
  onClose: () => void;
  onSave: (patch: Partial<TourLead>, leadId: string | null) => Promise<void>;
  onDelete: (leadId: string) => Promise<void>;
}) {
  const navigate = useNavigate();
  const lead = card?.lead ?? null;
  const offer = card?.offer ?? null;
  const [d, setD] = useState<LeadDraft>({
    venue: card?.venue ?? '',
    cityLine: card ? [card.city, card.region].filter(Boolean).join(', ') : '',
    event_date: card?.date ?? '',
    stage: (lead?.stage ?? initialStage ?? 'lead') as LeadStage,
    contact: lead?.contact ?? '', sent: lead?.sent ?? '', next_step: lead?.next_step ?? '', notes: lead?.notes ?? '',
    est_profit: lead?.est_profit != null ? String(lead.est_profit) : '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (k: keyof LeadDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setD({ ...d, [k]: e.target.value });

  const save = async () => {
    if (!d.venue.trim() || !d.cityLine.trim()) { setErr('Venue and city are needed.'); return; }
    setBusy(true); setErr(null);
    try {
      const { city, region } = splitCity(d.cityLine);
      const moved = !lead || lead.city !== city || (lead.region ?? null) !== region || lead.lat == null;
      const geo = moved ? await geocode(city, region) : { lat: lead!.lat!, lng: lead!.lng! };
      const est = d.est_profit.trim() === '' ? null : Number(d.est_profit.replace(/[^0-9.-]/g, ''));
      await onSave({
        venue: d.venue.trim(), city, region, event_date: d.event_date || null, stage: d.stage,
        contact: d.contact.trim() || null, sent: d.sent.trim() || null, next_step: d.next_step.trim() || null, notes: d.notes.trim() || null,
        est_profit: Number.isFinite(est as number) ? est : null,
        lat: geo?.lat ?? null, lng: geo?.lng ?? null,
      }, lead?.id ?? null);
      if (!geo) setErr(`Saved — but I couldn't find "${d.cityLine}" on the map. Try "City, ST".`);
      else onClose();
    } catch (e: any) {
      setErr(e?.message || 'Could not save.');
    } finally { setBusy(false); }
  };

  const makeOffer = async () => {
    // Save first so the offer can link back to this lead.
    if (!lead) { setErr('Save the venue first, then make the offer.'); return; }
    const { city, region } = splitCity(d.cityLine);
    const q = new URLSearchParams({ tour: tourId, lead: lead.id, artist, venue: d.venue, city, ...(region ? { state: region } : {}), ...(d.event_date ? { date: d.event_date } : {}) });
    navigate(`/offers/quick?${q.toString()}`);
  };

  const input = 'w-full bg-[#0B0D12] border border-[#2A3040] rounded-lg px-3 py-2 text-[15px] text-white outline-none focus:border-[#8FD3FF] placeholder:text-gray-600';
  const lab = 'font-label text-[10px] tracking-[0.16em] uppercase text-gray-400';

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={onClose}>
      <div className="w-full max-w-md h-full overflow-y-auto bg-[#14171E] border-l border-[#2A3040] p-4 sm:p-5 crt-panel" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className={lab} style={{ color: card ? STAGE[card.stage].color : '#8FD3FF' }}>{card ? STAGE[card.stage].label : 'New venue'}</div>
            <h2 className="text-xl font-bold text-white leading-tight">{card ? `${card.city} · ${card.venue}` : 'Add a venue'}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1"><X className="w-5 h-5" /></button>
        </div>

        {offer && (
          <div className="mb-4 bg-[#0B0D12] border border-[#8FD3FF]/40 rounded-xl p-3">
            <div className="flex items-center gap-2 text-[#8FD3FF] font-label text-[10px] tracking-[0.16em] uppercase"><FileText className="w-3.5 h-3.5" /> Offer · {offer.status?.replace('_', ' ') || 'planning'}</div>
            <div className="text-sm text-gray-300 mt-1">
              {card?.money != null && <>{card.moneyKind === 'actual' ? 'Actual profit' : 'Projected profit'}: <b className={card.money < 0 ? 'text-red-400' : 'text-white'}>{short$(card.money)}</b> · </>}
              Its stage follows the offer — change the offer's status, or drag the card.
            </div>
            <div className="flex gap-2 mt-2">
              <button onClick={() => navigate(`/offers/${offer.id}`)} className="text-sm text-[#04214D] bg-[#8FD3FF] rounded-lg px-3 py-1.5 font-semibold inline-flex items-center gap-1" style={{ textTransform: 'none', letterSpacing: 0 }}>Open offer <ArrowRight className="w-3.5 h-3.5" /></button>
              <button onClick={() => navigate(`/offers/${offer.id}/settlement`)} className="text-sm text-white border border-[#2A3040] rounded-lg px-3 py-1.5 inline-flex items-center gap-1" style={{ textTransform: 'none', letterSpacing: 0 }}><Receipt className="w-3.5 h-3.5" /> Settlement</button>
            </div>
          </div>
        )}

        {(lead || !offer) ? (
          <div className="space-y-3">
            <label className="block"><span className={lab}>Venue</span><input className={input} value={d.venue} onChange={set('venue')} placeholder="Warehouse on Broadway" /></label>
            <label className="block"><span className={lab}>City</span><input className={input} value={d.cityLine} onChange={set('cityLine')} placeholder="Kansas City, MO" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className={lab}>Show date</span><input type="date" className={input} value={d.event_date} onChange={set('event_date')} /></label>
              <label className="block"><span className={lab}>Stage</span>
                <select className={input} value={d.stage} onChange={set('stage')} disabled={!!offer && offer.status !== 'planning'}>
                  {LEAD_STAGES.map((s) => <option key={s} value={s}>{STAGE[s].label}</option>)}
                </select>
              </label>
            </div>
            <label className="block"><span className={lab}>Email / phone / IG</span><input className={input} value={d.contact} onChange={set('contact')} placeholder="booking@venue.com · @venue" /></label>
            <label className="block"><span className={lab}>What we sent</span><input className={input} value={d.sent} onChange={set('sent')} placeholder="Avail request + deck, Oct 14" /></label>
            <label className="block"><span className={lab}>Next step</span><input className={input} value={d.next_step} onChange={set('next_step')} placeholder="Call Mon if no reply" /></label>
            <label className="block"><span className={lab}>Rough profit guess {offer ? '(the offer replaces this)' : '(optional)'}</span><input className={input} inputMode="decimal" value={d.est_profit} onChange={set('est_profit')} placeholder="$" /></label>
            <label className="block"><span className={lab}>Notes (cap, age, ticketing, deal)</span><textarea className={`${input} min-h-[80px]`} value={d.notes} onChange={set('notes')} /></label>

            {err && <p className="text-xs text-amber-300">{err}</p>}
            <div className="flex flex-wrap gap-2 pt-1">
              <button onClick={save} disabled={busy} className="bg-[#8FD3FF] hover:bg-[#6FB8F2] text-[#04214D] rounded-xl px-4 py-2.5 font-bold inline-flex items-center gap-2 disabled:opacity-50">
                {busy && <Loader2 className="w-4 h-4 animate-spin" />} Save
              </button>
              {lead && !offer && (
                <button onClick={makeOffer} className="border border-[#8FD3FF]/60 text-white rounded-xl px-4 py-2.5 font-semibold inline-flex items-center gap-2" style={{ textTransform: 'none', letterSpacing: 0 }}>
                  <FileText className="w-4 h-4 text-[#8FD3FF]" /> Make offer
                </button>
              )}
              {lead && !offer && (
                confirmDelete
                  ? <button onClick={() => onDelete(lead.id)} className="ml-auto text-red-300 border border-red-800/60 rounded-xl px-3 py-2.5 text-sm" style={{ textTransform: 'none', letterSpacing: 0 }}>Tap again to remove</button>
                  : <button onClick={() => setConfirmDelete(true)} className="ml-auto text-gray-500 hover:text-red-300 p-2" title="Remove this venue"><Trash2 className="w-4 h-4" /></button>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400">This show was added to the tour from an offer. Open the offer to change it.</p>
        )}
      </div>
    </div>
  );
}
