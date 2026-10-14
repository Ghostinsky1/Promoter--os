import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Zap, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { calculateFromOffer, formatCurrency } from '../lib/calculations';
import { survivalRead } from '../lib/downside';
import { findExistingShow } from '../lib/duplicateShow';
import { HelpLink } from './HelpLink';

/**
 * PROMOTER OS — Quick Offer. The easy way.
 *
 * Six numbers and a name, and the bad-night read is on screen before you
 * save. Everything else (deposit %, tax, PRO rates, fees) comes from the
 * same defaults the full wizard uses, and can be changed on the offer page
 * afterwards. Saved as Planning, so it is a sketch until you move it.
 */

const DEFAULTS = {
  mode: 'estimate', status: 'planning', deal_type: 'flat_fee', artist_percentage: 100,
  facility_fee_mode: 'on_top', artist_pct_basis: 'net_after_costs', door_split_basis: 'net_after_costs',
  tax_withholding_pct: 2, deposit_pct: 20, artist_backend_pct: 85, promoter_backend_pct: 15,
  deposit_due_timing: '30_days_before', artist_deposit_status: 'pending', balance_due_timing: 'at_settlement',
  venue_deposit: 0, venue_deposit_status: 'pending', sales_tax_pct: 13.18,
  include_extra_revenue: false, extra_revenue: [], support_acts: [], artist_deductions: [],
  ascap_rate: 0.0023, bmi_rate: 0.003, sesac_rate: 0.000214, insurance_per_attendee: 0.62, cc_fee_rate: 0.012,
  facility_fee_per_ticket: 2, comps_artist: 0, comps_venue: 0, comps_promoter: 0,
  doors_time: '20:00', doors_duration: 60, show_time: '21:00', show_duration: 240, curfew_time: '01:00',
  age_limit: 'All Ages', merch_rate_soft: 100, merch_rate_hard: 100,
  include_hotel: false, hotel_budget: 0, hotel_nights: 1, include_transport: false, transport_budget: 0,
  include_flights: false, flight_budget: 0, include_rider: false, rider_cap: 100,
  payment_method: 'deposit_balance', settlement_days: 7,
};

const num = (v: string) => { const n = Number(String(v).replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? n : 0; };

function Field({ label, value, onChange, prefix, placeholder, type = 'text', hint, inputMode }: {
  label: string; value: string; onChange: (v: string) => void; prefix?: string; placeholder?: string; type?: string; hint?: string; inputMode?: 'numeric' | 'decimal' | 'text';
}) {
  return (
    <label className="block">
      <span className="font-label text-[10px] tracking-[0.16em] uppercase text-gray-400">{label}</span>
      <div className="mt-1 flex items-center bg-[#0B0D12] border border-[#2A3040] rounded-lg px-3 focus-within:border-[#8FD3FF]">
        {prefix && <span className="text-gray-500 mr-1 text-sm">{prefix}</span>}
        <input
          type={type}
          inputMode={inputMode}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent py-2 text-[15px] text-white outline-none placeholder:text-gray-600"
          style={{ textTransform: 'none', letterSpacing: 0 }}
        />
      </div>
      {hint && <span className="text-[11px] text-gray-500 mt-0.5 block">{hint}</span>}
    </label>
  );
}

export function QuickOffer() {
  const navigate = useNavigate();
  const [artist, setArtist] = useState('');
  const [venue, setVenue] = useState('');
  const [date, setDate] = useState('');
  const [capacity, setCapacity] = useState('');
  const [price, setPrice] = useState('');
  const [fee, setFee] = useState('');
  const [costs, setCosts] = useState('');
  const [ads, setAds] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The offer as it would be saved. The read below runs on exactly this.
  const draft = useMemo(() => {
    const cap = Math.max(0, Math.round(num(capacity)));
    return {
      ...DEFAULTS,
      guarantee: num(fee),
      ticket_tiers: [{ type: 'GA', allotment: cap, comps: 0, price: num(price) }],
      expenses: {
        talent: {},
        general: { show_costs: num(costs) },
        marketing: { paid_social: num(ads) },
        production: {},
      },
    };
  }, [capacity, price, fee, costs, ads]);

  const calc = useMemo(() => calculateFromOffer(draft, 'estimate'), [draft]);
  const read = useMemo(() => survivalRead({ ...draft, calculations: calc, show: { capacity: num(capacity) } } as any), [draft, calc, capacity]);
  const ready = artist.trim() && venue.trim() && date && num(capacity) > 0 && num(price) > 0;

  const verdictCls = { SAFE: 'text-green-400', TIGHT: 'text-yellow-400', FRAGILE: 'text-orange-400', UNDERWATER: 'text-red-400' }[read.verdict];
  const verdictText = {
    SAFE: 'Survives a half-full room.',
    TIGHT: 'Needs about 70% sold to clear.',
    FRAGILE: 'Only works if it nearly sells out.',
    UNDERWATER: 'Loses money even sold out.',
  }[read.verdict];
  const money = (v: number) => (v < 0 ? '-' : '') + formatCurrency(Math.abs(v));

  const create = async () => {
    if (!ready || saving) return;
    setSaving(true); setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sign in first.');
      const { data: member } = await supabase.from('organization_members').select('organization_id').eq('user_id', user.id).eq('is_active', true).maybeSingle();
      if (!member?.organization_id) throw new Error('Your account has no organization yet. Finish signup first.');

      const existing = await findExistingShow(member.organization_id, artist.trim(), venue.trim(), date);
      if (existing?.offerId) {
        if (confirm(`You already have ${existing.artistName} at ${existing.venueName} on ${existing.eventDate}. Open that one?`)) navigate(`/offers/${existing.offerId}`);
        setSaving(false);
        return;
      }

      const showId = `show_${Date.now()}`;
      const offerId = `offer_${Date.now()}`;
      const { error: showErr } = await supabase.from('shows').insert({
        id: showId, event_name: null, artist_name: artist.trim(), venue_name: venue.trim(), event_date: date,
        capacity: Math.round(num(capacity)), user_id: user.id, organization_id: member.organization_id,
      });
      if (showErr) throw showErr;
      const { error: offerErr } = await supabase.from('offers').insert({
        id: offerId, show_id: showId, ...draft, calculations: calc,
        user_id: user.id, organization_id: member.organization_id,
        offer_sent_date: new Date().toISOString().slice(0, 10),
      });
      if (offerErr) { await supabase.from('shows').delete().eq('id', showId); throw offerErr; }
      navigate(`/offers/${offerId}`);
    } catch (e: any) {
      setError(e?.message || 'Could not create the offer.');
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1140F0] p-3 sm:p-5">
      <div className="max-w-5xl mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-white/80 hover:text-white mb-3 text-sm" style={{ textTransform: 'none', letterSpacing: 0 }}>
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Zap className="w-5 h-5 text-[#8FD3FF]" /> Quick offer</h1>
            <p className="text-white/80 text-sm">Seven boxes. The bad-night read updates as you type. Everything else can be tuned on the offer page after.</p>
          </div>
          <HelpLink section="quick" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_360px] gap-3 items-start">
          <div className="bg-[#14171E] border border-[#2A3040] rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2"><Field label="Artist" value={artist} onChange={setArtist} placeholder="Who is playing" /></div>
            <Field label="Venue" value={venue} onChange={setVenue} placeholder="The room" />
            <Field label="Date" value={date} onChange={setDate} type="date" />
            <Field label="Capacity" value={capacity} onChange={setCapacity} placeholder="800" inputMode="numeric" hint="How many tickets you can sell" />
            <Field label="Ticket price" value={price} onChange={setPrice} prefix="$" placeholder="30" inputMode="decimal" hint="One price is fine; add tiers later" />
            <Field label="Artist fee" value={fee} onChange={setFee} prefix="$" placeholder="0" inputMode="decimal" hint="Flat guarantee. Leave 0 if not set yet" />
            <Field label="Show costs" value={costs} onChange={setCosts} prefix="$" placeholder="0" inputMode="decimal" hint="Venue, sound, security, staff — one number for now" />
            <Field label="Ads" value={ads} onChange={setAds} prefix="$" placeholder="0" inputMode="decimal" hint="What you plan to spend on marketing" />
          </div>

          <div className="space-y-3">
            <div className="bg-[#14171E] border border-[#2A3040] rounded-2xl p-4">
              <div className="font-label text-[10px] tracking-[0.16em] uppercase text-[#8FD3FF] mb-2">The read</div>
              {num(capacity) > 0 && num(price) > 0 ? (
                <>
                  <div className={`text-xl font-bold ${verdictCls}`}>{read.verdict}</div>
                  <div className="text-sm text-gray-300 mb-3">{verdictText}</div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[
                      { l: 'Half house', v: read.at50.profit }, { l: '70% sold', v: read.at70.profit }, { l: 'Sellout', v: read.atFull.profit },
                    ].map((c) => (
                      <div key={c.l} className="bg-[#0B0D12] rounded-lg py-2">
                        <div className="text-[10px] text-gray-500">{c.l}</div>
                        <div className={`text-sm font-bold ${c.v >= 0 ? 'text-white' : 'text-red-400'}`}>{money(c.v)}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 text-[12px] text-gray-400 space-y-0.5">
                    <div className="flex justify-between"><span>Net gross at sellout</span><span className="text-white">{formatCurrency(calc.netGross)}</span></div>
                    <div className="flex justify-between"><span>Costs incl. artist</span><span className="text-white">{formatCurrency(calc.totalExpenses + num(fee))}</span></div>
                    <div className="flex justify-between font-semibold"><span className="text-gray-300">Profit at sellout</span><span className={calc.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}>{money(calc.netProfit)}</span></div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-400">Put in capacity and a ticket price and the read appears here.</p>
              )}
            </div>

            <button
              onClick={create}
              disabled={!ready || saving}
              className="w-full bg-[#8FD3FF] hover:bg-[#6FB8F2] text-[#04214D] rounded-xl py-3 font-bold flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {saving ? 'Creating…' : 'Create offer'}
            </button>
            {error && <p className="text-xs text-red-200 bg-red-900/30 border border-red-800/50 rounded-lg px-3 py-2">{error}</p>}
            <p className="text-[12px] text-white/75">Saved as <b>Planning</b> — a sketch, not counted in your numbers until you move it to Confirmed. Need tiers, deposits, or support acts? <button onClick={() => navigate('/offers/create')} className="text-white underline" style={{ textTransform: 'none', letterSpacing: 0 }}>Use the full offer</button>.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
