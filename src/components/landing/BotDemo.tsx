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

  const steps = [
    { n: 1, label: 'You type the show', on: started && shown === 0, done: shown >= 1 },
    { n: 2, label: 'It reads the bad night', on: shown >= 1 && shown < 4, done: shown >= 4 },
    { n: 3, label: 'It writes the offer', on: shown >= 4, done: false },
  ];
  const rows = [
    { l: 'Half house', v: read.r.at50.profit, sub: `${Math.round(SHOW.cap / 2)} sold` },
    { l: '70% sold', v: read.r.at70.profit, sub: `${Math.round(SHOW.cap * 0.7)} sold` },
    { l: 'Sellout', v: read.r.atFull.profit, sub: `${SHOW.cap} sold` },
  ];

  return (
    <div ref={box} className="max-w-3xl mx-auto">
      {/* what you're watching */}
      <div className="grid grid-cols-3 gap-1.5 mb-3">
        {steps.map((st) => (
          <div key={st.n} className={`rounded-lg border px-2.5 py-2 flex items-center gap-2 transition-colors ${st.on ? 'border-[#8FD3FF] bg-[#8FD3FF]/10' : st.done ? 'border-green-700/50 bg-green-900/10' : 'border-[#2A3040] bg-[#14171E]'}`}>
            <span className={`w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 ${st.on ? 'bg-[#8FD3FF] text-[#04214D]' : st.done ? 'bg-green-500 text-[#04214D]' : 'bg-[#2A3040] text-gray-400'}`}>{st.done ? '✓' : st.n}</span>
            <span className={`text-[11px] sm:text-xs font-semibold leading-tight ${st.on ? 'text-white' : st.done ? 'text-green-300' : 'text-gray-400'}`} style={{ textTransform: 'none', letterSpacing: 0 }}>{st.label}</span>
          </div>
        ))}
      </div>

      <div className="bg-[#14171E] border border-[#2A3040] rounded-2xl overflow-hidden shadow-2xl">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#2A3040] bg-[#0B0D12]">
          <Mascot mood={mood} size={44} powerOn />
          <div className="min-w-0">
            <div className="text-white font-bold text-sm leading-tight">The little TV</div>
            <div className="text-[11px] text-gray-400" style={{ textTransform: 'none', letterSpacing: 0 }}>
              {mood === 'listening' ? 'Listening…' : mood === 'thinking' ? 'Running the bad night…' : mood === 'reading' ? 'Counting tickets…' : mood === 'happy' ? 'Done. Your move.' : 'Lives inside Promoter OS'}
            </div>
          </div>
          <span className="ml-auto inline-flex items-center gap-1.5 font-label text-[9px] tracking-[0.18em] uppercase px-2 py-1 rounded-full border" style={{ color: mood === 'idle' ? '#9AA4B5' : '#8FD3FF', borderColor: mood === 'idle' ? '#2A3040' : 'rgba(143,211,255,.5)' }}>
            <span className={`w-1.5 h-1.5 rounded-full ${mood === 'idle' ? 'bg-gray-500' : 'bg-[#8FD3FF] animate-pulse'}`} />{mood === 'idle' ? 'standby' : mood}
          </span>
        </div>

        <div className="p-4 space-y-4 min-h-[300px]" style={{ textTransform: 'none', letterSpacing: 0 }}>
          {/* 1 · you */}
          <div className="flex flex-col items-end">
            <div className="font-label text-[9px] tracking-[0.18em] uppercase text-gray-500 mb-1">You · one line</div>
            <div className="max-w-[90%] bg-[#1140F0] text-white rounded-2xl rounded-br-md px-4 py-2.5 text-[15px] leading-snug">
              {typed || <span className="opacity-40">type the show…</span>}{typed && typed.length < script[0].text.length && <span className="inline-block w-[2px] h-[1em] bg-white ml-0.5 align-middle animate-pulse" />}
            </div>
          </div>

          {/* 2 · the TV */}
          {shown >= 1 && (
            <div className="flex gap-2 items-start">
              <div className="w-7 shrink-0 pt-5"><Mascot mood={shown < 4 ? 'thinking' : 'happy'} size={28} /></div>
              <div className="min-w-0 flex-1">
                <div className="font-label text-[9px] tracking-[0.18em] uppercase text-gray-500 mb-1">The TV · the bad-night read</div>
                <div className="bg-[#0B0D12] border rounded-2xl rounded-tl-md overflow-hidden crt-panel" style={{ borderColor: verdictColor + '66' }}>
                  {/* verdict */}
                  <div className="px-4 py-2.5 flex items-center gap-3 border-b border-[#2A3040]">
                    <span className="font-label text-[11px] tracking-[0.18em] uppercase px-2 py-1 rounded-md font-bold" style={{ background: verdictColor + '22', color: verdictColor, border: `1px solid ${verdictColor}66` }}>{read.r.verdict}</span>
                    <span className="text-sm text-gray-200">{verdictLine.slice(verdictLine.indexOf('.') + 2)}</span>
                  </div>
                  {/* three nights */}
                  <div className="grid grid-cols-3 divide-x divide-[#2A3040]">
                    {rows.map((r, i) => {
                      const live = shown >= 2;
                      return (
                        <div key={r.l} className="px-3 py-2.5 text-center">
                          <div className="font-label text-[9px] tracking-[0.14em] uppercase text-gray-500">{r.l}</div>
                          <div className={`text-base sm:text-lg font-bold transition-opacity ${live ? 'opacity-100' : 'opacity-0'} ${r.v < 0 ? 'text-red-400' : 'text-green-400'}`} style={{ transitionDelay: `${i * 180}ms` }}>{money(r.v)}</div>
                          <div className="text-[10px] text-gray-500">{r.sub}</div>
                        </div>
                      );
                    })}
                  </div>
                  {/* break-even */}
                  <div className={`px-4 py-2.5 border-t border-[#2A3040] text-sm transition-opacity ${shown >= 3 ? 'opacity-100' : 'opacity-0'}`}>
                    {read.r.breakEvenTickets >= 0 ? (
                      <>
                        <span className="text-gray-400">Nothing is yours until </span>
                        <b className="text-white">ticket {read.r.breakEvenTickets.toLocaleString()}</b>
                        <span className="text-gray-400"> of {SHOW.cap}. Every ticket after that is profit.</span>
                        <div className="mt-1.5 h-1.5 rounded-full bg-[#22262F] overflow-hidden relative">
                          <div className="absolute inset-y-0 left-0 bg-red-500/60" style={{ width: `${(read.r.breakEvenTickets / SHOW.cap) * 100}%` }} />
                          <div className="absolute inset-y-0 bg-green-500/80" style={{ left: `${(read.r.breakEvenTickets / SHOW.cap) * 100}%`, right: 0 }} />
                        </div>
                      </>
                    ) : 'A full house does not cover the costs. Renegotiate the fee first.'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3 · the offer */}
          {shown >= 4 && (
            <div className="flex gap-2 items-start">
              <div className="w-7 shrink-0 pt-5"><Mascot mood="happy" size={28} /></div>
              <div className="min-w-0">
                <div className="font-label text-[9px] tracking-[0.18em] uppercase text-gray-500 mb-1">The TV · next</div>
                <div className="bg-[#0B0D12] border border-[#2A3040] rounded-2xl rounded-tl-md px-4 py-2.5 text-[15px] text-gray-100 crt-panel">
                  Want the offer written up? One tap and it's a PDF with the deal, the tiers and every cost line.
                </div>
              </div>
            </div>
          )}

          {shown >= 1 && shown < 4 && (
            <div className="pl-9 text-[12px] text-gray-500 inline-flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#8FD3FF] animate-pulse" /> {shown === 1 ? 'Running the room at half, 70% and full…' : shown === 2 ? 'Finding the ticket where it turns…' : 'Almost there…'}</div>
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
