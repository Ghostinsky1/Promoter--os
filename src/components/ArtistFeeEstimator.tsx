import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Target, Search, AlertTriangle, ArrowDownRight } from 'lucide-react';

// ---------- helpers ----------
const money = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const num = (v: string) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};
const roundTo = (n: number, step = 50) => Math.max(0, Math.round(n / step) * step);

type ModeKey = 'lowball' | 'fair' | 'need';

const MODES: { key: ModeKey; label: string; blurb: string }[] = [
  { key: 'lowball', label: 'Low Ball', blurb: 'Open low, leave room to negotiate' },
  { key: 'fair', label: 'Fair Price', blurb: 'What the numbers say is right' },
  { key: 'need', label: 'Need the Headliner', blurb: 'Pay up to lock them in' },
];

interface PastEvent {
  city: string;
  cap: number;
  price: number;
  soldPct: number;
  expenses: number;
}

// Shared inputs
function Field({
  label, value, onChange, prefix, suffix, hint,
}: { label: string; value: number; onChange: (v: number) => void; prefix?: string; suffix?: string; hint?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</span>
      <div className="mt-1 flex items-center bg-[#1140F0] border border-white/10 rounded-xl px-3 focus-within:border-[#8FD3FF]/60">
        {prefix && <span className="text-gray-500 mr-1">{prefix}</span>}
        <input
          type="number"
          inputMode="decimal"
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(num(e.target.value))}
          className="w-full bg-transparent py-2.5 text-white outline-none"
        />
        {suffix && <span className="text-gray-500 ml-1">{suffix}</span>}
      </div>
      {hint && <span className="text-[11px] text-gray-500 mt-1 block">{hint}</span>}
    </label>
  );
}

const card = 'bg-gradient-to-br from-[#14171E] to-[#0B0D12] rounded-3xl p-5 sm:p-6 border border-white/10';

export function ArtistFeeEstimator() {
  // ---------- Section 1: your show ----------
  const [cap, setCap] = useState(800);
  const [price, setPrice] = useState(30);
  const [soldPct, setSoldPct] = useState(75);
  const [feesPct, setFeesPct] = useState(12); // tax + ticketing fees taken off the top
  const [expenses, setExpenses] = useState(6000); // show costs NOT including the artist
  const [capPct, setCapPct] = useState(20); // artist share of gross at capacity
  const [mode, setMode] = useState<ModeKey>('fair');
  const [mult, setMult] = useState<Record<ModeKey, number>>({ lowball: 70, fair: 100, need: 125 });

  const show = useMemo(() => {
    const grossAtCap = cap * price;
    const capMethodFee = grossAtCap * (capPct / 100);
    const expectedTickets = cap * (soldPct / 100);
    const netPerTicket = price * (1 - feesPct / 100);
    const expectedNet = expectedTickets * netPerTicket;
    const breakevenCeiling = Math.max(0, expectedNet - expenses); // most you can pay and not lose money
    const fairFee = Math.min(capMethodFee, breakevenCeiling);
    const offers = {
      lowball: roundTo(fairFee * (mult.lowball / 100)),
      fair: roundTo(fairFee * (mult.fair / 100)),
      need: roundTo(fairFee * (mult.need / 100)),
    };
    const offer = offers[mode];
    const breakevenTickets = netPerTicket > 0 ? Math.ceil((expenses + offer) / netPerTicket) : 0;
    const profitAtExpected = expectedNet - expenses - offer;
    const profitAtSellout = cap * netPerTicket - expenses - offer;
    return {
      grossAtCap, capMethodFee, expectedTickets, netPerTicket, expectedNet, breakevenCeiling,
      fairFee, offers, offer, breakevenTickets, profitAtExpected, profitAtSellout,
      limitedByBreakeven: breakevenCeiling < capMethodFee,
    };
  }, [cap, price, soldPct, feesPct, expenses, capPct, mode, mult]);

  // ---------- Section 2: reverse engineer ----------
  const [artist, setArtist] = useState('');
  const [events, setEvents] = useState<PastEvent[]>([
    { city: 'City 1', cap: 1000, price: 35, soldPct: 80, expenses: 8000 },
    { city: 'City 2', cap: 700, price: 30, soldPct: 85, expenses: 6000 },
    { city: 'City 3', cap: 1200, price: 40, soldPct: 70, expenses: 10000 },
    { city: 'City 4', cap: 900, price: 30, soldPct: 75, expenses: 7000 },
  ]);

  const updateEvent = (i: number, patch: Partial<PastEvent>) =>
    setEvents((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));

  const reverse = useMemo(() => {
    const rows = events.map((e) => {
      const grossAtCap = e.cap * e.price;
      const net = e.cap * (e.soldPct / 100) * e.price * (1 - feesPct / 100);
      const ceiling = Math.max(0, net - e.expenses);
      const low = Math.min(grossAtCap * 0.15, ceiling);
      const likely = Math.min(grossAtCap * (capPct / 100), ceiling);
      const high = Math.min(grossAtCap * 0.25, ceiling);
      return { ...e, grossAtCap, net, ceiling, low, likely, high };
    });
    const n = rows.length || 1;
    const avg = (k: 'low' | 'likely' | 'high') => rows.reduce((s, r) => s + r[k], 0) / n;
    return { rows, low: roundTo(avg('low')), likely: roundTo(avg('likely')), high: roundTo(avg('high')) };
  }, [events, feesPct, capPct]);

  const offerVsMarket = reverse.likely > 0 ? show.offer - reverse.likely : 0;

  return (
    <div className="min-h-screen bg-[#1140F0] text-white p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        <Link to="/dashboard" className="flex items-center gap-2 text-gray-400 hover:text-[#8FD3FF] mb-6 transition-colors text-sm group w-fit">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to Dashboard
        </Link>

        <div className="mb-8">
          <div className="inline-block px-4 py-1.5 bg-[#8FD3FF]/10 border border-[#8FD3FF]/30 rounded-full mb-3">
            <span className="text-[#8FD3FF] text-xs font-bold uppercase tracking-wider">Artist Fee Estimator</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">What should I offer this artist?</h1>
          <p className="text-gray-400">Get a fair price for your show, pick how bad you want them, and check what other cities are paying.</p>
        </div>

        {/* ===== SECTION 1 ===== */}
        <section className="grid lg:grid-cols-5 gap-6 mb-10">
          <div className={`${card} lg:col-span-2`}>
            <div className="flex items-center gap-2 mb-5">
              <Target className="w-5 h-5 text-[#8FD3FF]" />
              <h2 className="text-lg font-bold">1. Your show</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Venue capacity" value={cap} onChange={setCap} />
              <Field label="Avg ticket price" value={price} onChange={setPrice} prefix="$" />
              <Field label="Expected sold" value={soldPct} onChange={setSoldPct} suffix="%" />
              <Field label="Tax + ticket fees" value={feesPct} onChange={setFeesPct} suffix="%" hint="Taken off each ticket" />
              <div className="col-span-2">
                <Field label="Show costs (not the artist)" value={expenses} onChange={setExpenses} prefix="$" hint="Venue, sound, ads, security, travel, etc." />
              </div>
              <div className="col-span-2">
                <Field label="Artist % of sold-out gross" value={capPct} onChange={setCapPct} suffix="%" hint="Rule of thumb is 20%" />
              </div>
            </div>
          </div>

          <div className="lg:col-span-3 space-y-6">
            {/* Mode picker */}
            <div className={card}>
              <h2 className="text-lg font-bold mb-4">2. How bad do you want them?</h2>
              <div className="grid sm:grid-cols-3 gap-3">
                {MODES.map((m) => {
                  const active = mode === m.key;
                  return (
                    <button
                      key={m.key}
                      onClick={() => setMode(m.key)}
                      className={`text-left rounded-2xl p-4 border-2 transition-all ${
                        active ? 'border-[#8FD3FF] bg-[#8FD3FF]/10' : 'border-white/10 hover:border-white/30'
                      }`}
                    >
                      <div className={`text-sm font-bold ${active ? 'text-[#8FD3FF]' : 'text-white'}`}>{m.label}</div>
                      <div className="text-2xl font-bold mt-1">{money(show.offers[m.key])}</div>
                      <div className="text-xs text-gray-400 mt-1">{m.blurb}</div>
                      <div className="mt-3 flex items-center gap-1 text-xs text-gray-500" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="number"
                          value={mult[m.key]}
                          onChange={(e) => setMult({ ...mult, [m.key]: num(e.target.value) })}
                          className="w-14 bg-[#1140F0] border border-white/10 rounded-lg px-2 py-1 text-white"
                        />
                        % of fair
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Result */}
            <div className="rounded-3xl p-6 border-2 border-[#8FD3FF] bg-[#8FD3FF]/5">
              <div className="text-xs font-bold uppercase tracking-wider text-[#8FD3FF]">
                Your offer — {MODES.find((m) => m.key === mode)?.label}
              </div>
              <div className="text-5xl font-extrabold my-2">{money(show.offer)}</div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 text-sm">
                <div>
                  <div className="text-gray-400">20% rule</div>
                  <div className="font-bold">{money(show.capMethodFee)}</div>
                </div>
                <div>
                  <div className="text-gray-400">Break-even max</div>
                  <div className="font-bold">{money(show.breakevenCeiling)}</div>
                </div>
                <div>
                  <div className="text-gray-400">Tickets to break even</div>
                  <div className="font-bold">
                    {show.breakevenTickets.toLocaleString()} <span className="text-gray-500">/ {cap.toLocaleString()}</span>
                  </div>
                </div>
                <div>
                  <div className="text-gray-400">Profit at {soldPct}% sold</div>
                  <div className={`font-bold ${show.profitAtExpected >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {money(show.profitAtExpected)}
                  </div>
                </div>
              </div>

              <div className="mt-4 text-sm text-gray-300">
                Profit if it sells out: <span className="font-bold text-white">{money(show.profitAtSellout)}</span>
              </div>

              {show.limitedByBreakeven && (
                <div className="mt-4 flex gap-2 text-sm text-yellow-300 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  Your costs are high for this room — fair price is capped at your break-even ({money(show.breakevenCeiling)}), not the 20% rule.
                </div>
              )}
              {show.breakevenTickets > cap && (
                <div className="mt-3 flex gap-2 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  You can't break even at this offer even if you sell out. Lower the offer, raise prices, or cut costs.
                </div>
              )}
              {reverse.likely > 0 && (
                <div className="mt-3 flex gap-2 text-sm text-gray-300">
                  <ArrowDownRight className="w-4 h-4 mt-0.5 shrink-0 text-[#8FD3FF]" />
                  {offerVsMarket >= 0
                    ? `${money(offerVsMarket)} above what other cities likely pay (${money(reverse.likely)}).`
                    : `${money(-offerVsMarket)} below what other cities likely pay (${money(reverse.likely)}).`}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ===== SECTION 2 ===== */}
        <section className={card}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <Search className="w-5 h-5 text-[#8FD3FF]" />
              <h2 className="text-lg font-bold">3. Reverse engineer: what are other cities paying?</h2>
            </div>
            <input
              placeholder="Artist name"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              className="bg-[#1140F0] border border-white/10 rounded-xl px-3 py-2 text-white w-full sm:w-64"
            />
          </div>
          <p className="text-sm text-gray-400 mb-5">
            Add 4–5 of {artist || "the artist's"} recent shows. Use the ticket price and venue size from the listing, and your best guess on how much sold and what it cost to run.
          </p>

          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm min-w-[860px]">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-gray-500">
                  <th className="px-2 py-2">City / venue</th>
                  <th className="px-2 py-2">Capacity</th>
                  <th className="px-2 py-2">Ticket $</th>
                  <th className="px-2 py-2">Est. sold %</th>
                  <th className="px-2 py-2">Est. costs $</th>
                  <th className="px-2 py-2 text-right">Sold-out gross</th>
                  <th className="px-2 py-2 text-right">Likely fee</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {reverse.rows.map((r, i) => (
                  <tr key={i} className="border-t border-white/5">
                    <td className="px-2 py-2">
                      <input value={r.city} onChange={(e) => updateEvent(i, { city: e.target.value })}
                        className="w-full bg-[#1140F0] border border-white/10 rounded-lg px-2 py-1.5" />
                    </td>
                    {(['cap', 'price', 'soldPct', 'expenses'] as const).map((k) => (
                      <td key={k} className="px-2 py-2">
                        <input type="number" value={r[k]} onChange={(e) => updateEvent(i, { [k]: num(e.target.value) })}
                          className="w-24 bg-[#1140F0] border border-white/10 rounded-lg px-2 py-1.5" />
                      </td>
                    ))}
                    <td className="px-2 py-2 text-right text-gray-300">{money(r.grossAtCap)}</td>
                    <td className="px-2 py-2 text-right">
                      <div className="font-bold">{money(r.likely)}</div>
                      <div className="text-[11px] text-gray-500">{money(r.low)} – {money(r.high)}</div>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button onClick={() => setEvents(events.filter((_, idx) => idx !== i))}
                        className="text-gray-500 hover:text-red-400" aria-label="Remove">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={() => setEvents([...events, { city: `City ${events.length + 1}`, cap: 800, price: 30, soldPct: 75, expenses: 6000 }])}
            className="mt-3 flex items-center gap-1 text-sm text-[#8FD3FF] hover:underline"
          >
            <Plus className="w-4 h-4" /> Add show
          </button>

          <div className="grid sm:grid-cols-3 gap-4 mt-6">
            <div className="rounded-2xl p-4 border border-white/10">
              <div className="text-xs text-gray-400 uppercase tracking-wider">Low end</div>
              <div className="text-2xl font-bold">{money(reverse.low)}</div>
            </div>
            <div className="rounded-2xl p-4 border-2 border-[#8FD3FF] bg-[#8FD3FF]/5">
              <div className="text-xs text-[#8FD3FF] uppercase tracking-wider font-bold">They're likely booking for</div>
              <div className="text-3xl font-extrabold">{money(reverse.likely)}</div>
            </div>
            <div className="rounded-2xl p-4 border border-white/10">
              <div className="text-xs text-gray-400 uppercase tracking-wider">High end</div>
              <div className="text-2xl font-bold">{money(reverse.high)}</div>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4">
            How it works: each show's fee is estimated at 15% / {capPct}% / 25% of its sold-out gross, but never more than that promoter could pay and still break even. Then the shows are averaged. It's an estimate — confirm with the agent.
          </p>
        </section>
      </div>
    </div>
  );
}

export default ArtistFeeEstimator;
