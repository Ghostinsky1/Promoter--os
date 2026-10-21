import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, RotateCcw } from 'lucide-react';
import { Mascot, type Mood } from '../ask/Mascot';
import { calculateFromOffer, formatCurrency } from '../../lib/calculations';
import { survivalRead } from '../../lib/downside';

/**
 * The little TV, on the landing page, doing what it does in the app: you give it a show in
 * one line, it reads the bad night back to you. The numbers are real — the same math the app
 * runs — so the demo never promises something the product doesn't do.
 */
const SHOW = { artist: 'Flores Negras', venue: 'Mississippi Underground', city: 'St. Louis', cap: 800, price: 20, fee: 4000, costs: 3200, ads: 800 };

const DEFAULTS = {
  mode: 'estimate', status: 'planning', deal_type: 'flat_fee', artist_percentage: 100,
  facility_fee_mode: 'on_top', artist_pct_basis: 'net_after_costs', door_split_basis: 'net_after_costs',
  tax_withholding_pct: 2, deposit_pct: 20, artist_backend_pct: 85, promoter_backend_pct: 15,
  sales_tax_pct: 13.18, include_extra_revenue: false, extra_revenue: [], support_acts: [], artist_deductions: [],
  ascap_rate: 0.0023, bmi_rate: 0.003, sesac_rate: 0.000214, insurance_per_attendee: 0.62, cc_fee_rate: 0.012,
  facility_fee_per_ticket: 2, comps_artist: 0, comps_venue: 0, comps_promoter: 0,
};

const money = (v: number) => (v < 0 ? '−' : '+') + formatCurrency(Math.round(Math.abs(v))).replace(/\.00$/, '');

export function BotDemo() {
  const navigate = useNavigate();
  const read = useMemo(() => {
    const draft: any = {
      ...DEFAULTS, guarantee: SHOW.fee,
      ticket_tiers: [{ type: 'GA', allotment: SHOW.cap, comps: 0, price: SHOW.price }],
      expenses: { talent: {}, general: { show_costs: SHOW.costs }, marketing: { paid_social: SHOW.ads }, production: {} },
    };
    const calc = calculateFromOffer(draft, 'estimate');
    const r = survivalRead({ ...draft, calculations: calc, show: { capacity: SHOW.cap } });
    return { calc, r };
  }, []);

  const verdictLine = {
    SAFE: 'SAFE. Survives a half-full room.',
    TIGHT: 'TIGHT. Needs about 70% sold to clear.',
    FRAGILE: 'FRAGILE. Only works if it nearly sells out.',
    UNDERWATER: 'UNDERWATER. Loses money even sold out.',
  }[read.r.verdict];
  const verdictColor = { SAFE: '#4ADE80', TIGHT: '#F2B640', FRAGILE: '#FB923C', UNDERWATER: '#F87171' }[read.r.verdict];

  const script = useMemo(() => [
    { who: 'you' as const, text: `${SHOW.artist} at ${SHOW.venue}, cap ${SHOW.cap}, $${SHOW.price} tickets, $${SHOW.fee.toLocaleString()} fee, $${SHOW.costs.toLocaleString()} costs, $${SHOW.ads} ads. Good deal?` },
    { who: 'bot' as const, text: verdictLine, color: verdictColor },
    { who: 'bot' as const, text: `Half house ${money(read.r.at50.profit)} · 70% ${money(read.r.at70.profit)} · Sellout ${money(read.r.atFull.profit)}.` },
    { who: 'bot' as const, text: read.r.breakEvenTickets >= 0 ? `Nothing is yours until ticket ${read.r.breakEvenTickets.toLocaleString()} of ${SHOW.cap}. Want the offer written up? One tap.` : 'A full house does not cover the costs. Renegotiate the fee first.' },
  ], [read, verdictLine, verdictColor]);

  // Plays when it scrolls into view; Replay runs it again.
  const box = useRef<HTMLDivElement>(null);
  const [run, setRun] = useState(0);
  const [started, setStarted] = useState(false);
  const [shown, setShown] = useState(0);        // how many messages are on screen
  const [typed, setTyped] = useState('');        // the user line, typed out
  const [mood, setMood] = useState<Mood>('idle');
  const [done, setDone] = useState(false);

  useEffect(() => {
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) { setStarted(true); io.disconnect(); } }, { threshold: 0.4 });
    if (box.current) io.observe(box.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    let alive = true;
    const timers: number[] = [];
    const at = (ms: number, f: () => void) => timers.push(window.setTimeout(() => { if (alive) f(); }, ms));
    setShown(0); setTyped(''); setDone(false); setMood('listening');
    const line = script[0].text;
    const perChar = 28;
    for (let i = 1; i <= line.length; i++) at(300 + i * perChar, () => setTyped(line.slice(0, i)));
    const t0 = 300 + line.length * perChar + 400;
    at(t0, () => { setShown(1); setMood('thinking'); });
    at(t0 + 1500, () => { setShown(2); setMood('reading'); });
    at(t0 + 2700, () => { setShown(3); });
    at(t0 + 3900, () => { setShown(4); setMood('happy'); setDone(true); });
    at(t0 + 6500, () => setMood('idle'));
    return () => { alive = false; timers.forEach(clearTimeout); };
  }, [started, run, script]);

  return (
    <div ref={box} className="max-w-3xl mx-auto">
      <div className="bg-[#14171E] border border-[#2A3040] rounded-2xl overflow-hidden shadow-2xl">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#2A3040] bg-[#0B0D12]">
          <Mascot mood={mood} size={44} powerOn />
          <div className="min-w-0">
            <div className="text-white font-bold text-sm leading-tight">The little TV</div>
            <div className="text-[11px] text-gray-400">lives inside Promoter OS · reads cost sheets, writes offers, settles shows</div>
          </div>
          <span className="ml-auto font-label text-[9px] tracking-[0.18em] uppercase px-2 py-1 rounded-full border" style={{ color: mood === 'idle' ? '#9AA4B5' : '#8FD3FF', borderColor: mood === 'idle' ? '#2A3040' : 'rgba(143,211,255,.5)' }}>{mood}</span>
        </div>
        <div className="p-4 space-y-3 min-h-[260px]" style={{ textTransform: 'none', letterSpacing: 0 }}>
          {/* you */}
          <div className="flex justify-end">
            <div className="max-w-[88%] bg-[#1140F0] text-white rounded-2xl rounded-br-md px-4 py-2.5 text-[15px] leading-snug">
              {typed || <span className="opacity-40">…</span>}{typed && typed.length < script[0].text.length && <span className="inline-block w-[2px] h-[1em] bg-white ml-0.5 align-middle animate-pulse" />}
            </div>
          </div>
          {/* bot */}
          {script.slice(1, Math.max(0, shown)).map((m, i) => (
            <div key={i} className="flex gap-2 items-end">
              <div className="w-6 shrink-0"><Mascot mood="idle" size={24} /></div>
              <div className="max-w-[88%] bg-[#0B0D12] border border-[#2A3040] rounded-2xl rounded-bl-md px-4 py-2.5 text-[15px] leading-snug text-gray-100 crt-panel" style={m.color ? { borderColor: m.color + '66' } : undefined}>
                {m.color ? <><b style={{ color: m.color }}>{m.text.split('.')[0]}.</b>{m.text.slice(m.text.indexOf('.') + 1)}</> : m.text}
              </div>
            </div>
          ))}
          {shown >= 1 && shown < 4 && (
            <div className="flex gap-2 items-end">
              <div className="w-6 shrink-0" />
              <div className="bg-[#0B0D12] border border-[#2A3040] rounded-2xl rounded-bl-md px-4 py-2.5 text-gray-500 text-sm">
                <span className="animate-pulse">thinking…</span>
              </div>
            </div>
          )}
        </div>
        <div className="px-4 py-3 border-t border-[#2A3040] bg-[#0B0D12] flex flex-wrap items-center gap-2">
          <button onClick={() => navigate('/signup')} className={`bg-[#8FD3FF] hover:bg-[#6FB8F2] text-[#04214D] rounded-xl px-4 py-2.5 font-bold inline-flex items-center gap-2 text-sm transition-opacity ${done ? 'opacity-100' : 'opacity-60'}`}>
            <Zap className="w-4 h-4" /> Try it on your next deal
          </button>
          <button onClick={() => setRun((r) => r + 1)} className="text-gray-400 hover:text-white text-xs inline-flex items-center gap-1.5 ml-auto" style={{ textTransform: 'none', letterSpacing: 0 }}>
            <RotateCcw className="w-3.5 h-3.5" /> Replay
          </button>
        </div>
      </div>
      <p className="text-center text-[12px] text-white/70 mt-3">Real math, not a script: the same bad-night read the app runs on every offer. Drop in a photo of a venue's cost sheet and it reads that too.</p>
    </div>
  );
}
