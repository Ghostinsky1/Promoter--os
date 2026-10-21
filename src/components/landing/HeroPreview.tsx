import { useEffect, useState } from 'react';
import { formatCurrency } from '../../lib/calculations';

const $ = (v: number) => formatCurrency(Math.round(v)).replace(/\.00$/, '');
import { SHOW, demoRead, demoScore } from './demoShow';

/**
 * The card that sits on the hero globe and hangs into the dark section below:
 * one offer, scored. Same show and same math as the little TV further down,
 * so a visitor who scrolls sees the numbers agree.
 */
const VERDICT = {
  SAFE: { c: '#4ADE80', t: 'Safe', s: 'Survives a half-full room.' },
  TIGHT: { c: '#F2B640', t: 'Tight', s: 'Needs about 70% sold to clear.' },
  FRAGILE: { c: '#FB923C', t: 'Fragile', s: 'Only a near-sellout pays.' },
  UNDERWATER: { c: '#F87171', t: 'Underwater', s: 'A full house still loses money.' },
} as const;

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function HeroPreview() {
  const { calc, r } = demoRead();
  const target = demoScore();
  const v = VERDICT[r.verdict];
  const be = Math.max(0, r.breakEvenTickets);
  const bePct = Math.min(100, (be / SHOW.cap) * 100);

  // Everything is static until the card is on screen, then it "reads" the deal:
  // the dial counts up, the bar fills, the three nights fade in one by one.
  const [go, setGo] = useState(false);
  const [score, setScore] = useState(0);
  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setGo(true); setScore(target); return; }
    const t0 = setTimeout(() => setGo(true), 700);
    let raf = 0; const start = performance.now() + 900; const dur = 1300;
    const tick = (now: number) => {
      const k = Math.min(1, Math.max(0, (now - start) / dur));
      const e = 1 - Math.pow(1 - k, 3);
      setScore(Math.round(target * e));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { clearTimeout(t0); cancelAnimationFrame(raf); };
  }, [target]);

  const R = 44, C = 2 * Math.PI * R;
  const nights = [
    { l: 'Half house', sub: `${SHOW.cap / 2} sold`, p: r.at50.profit },
    { l: '70% sold', sub: `${Math.round(SHOW.cap * 0.7)} sold`, p: r.at70.profit },
    { l: 'Sellout', sub: `${SHOW.cap} sold`, p: r.atFull.profit },
  ];
  const lines = [
    ['Artist fee', $(SHOW.fee)],
    ['Show costs', $(SHOW.costs)],
    ['Ads', $(SHOW.ads)],
    ['Tickets', `${SHOW.cap} × $${SHOW.price}`],
  ];

  return (
    <div className="relative mx-auto max-w-4xl">
      {/* glow under the card */}
      <div className="absolute -inset-6 rounded-[2rem] bg-[#8FD3FF]/20 blur-3xl -z-10" aria-hidden="true" />
      <div className="relative overflow-hidden rounded-2xl border border-[#8FD3FF]/35 bg-[#0B0D12] shadow-[0_30px_80px_-20px_rgba(0,0,0,.8)] crt-panel">
        {/* one soft scan band, like the TV */}
        <div className="pointer-events-none absolute left-0 right-0 h-16 bg-gradient-to-b from-transparent via-[#8FD3FF]/10 to-transparent" style={{ animation: 'crt-band 6s linear infinite' }} aria-hidden="true" />

        {/* header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <div className="font-label text-[10px] tracking-[0.2em] uppercase text-[#8FD3FF]">An offer, scored · real math</div>
            <div className="mt-0.5 truncate text-white text-base sm:text-lg font-semibold">
              {SHOW.artist} <span className="text-white/50 font-normal">· {SHOW.venue} · {SHOW.city} · {fmtDate(SHOW.date)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-label tracking-[0.14em] uppercase" style={{ borderColor: v.c + '66', color: v.c, background: v.c + '14' }}>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: v.c }} />
              <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: v.c }} />
            </span>
            {go ? v.t : 'Reading…'}
          </div>
        </div>

        <div className="grid gap-0 md:grid-cols-[1.15fr_1fr]">
          {/* left: the deal and where the money turns yours */}
          <div className="px-4 py-4 sm:px-6 sm:py-5 md:border-r border-white/10">
            <div className="font-label text-[10px] tracking-[0.18em] uppercase text-white/45 mb-2">1 · The deal you typed</div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              {lines.map(([k, val]) => (
                <div key={k} className="flex items-baseline justify-between gap-2 border-b border-dashed border-white/10 pb-1">
                  <dt className="text-white/55">{k}</dt><dd className="text-white font-mono tabular-nums">{val}</dd>
                </div>
              ))}
            </dl>

            <div className="font-label text-[10px] tracking-[0.18em] uppercase text-white/45 mt-5 mb-2">2 · What it works out to</div>
            <div className="space-y-1.5 text-sm">
              <Row k="Sellout revenue" val={$(calc.netGross)} />
              <Row k="Night costs (artist + show + fees)" val={$(calc.totalShowCost)} />
              <Row k="Net profit at sellout" val={$(calc.netProfit)} strong color={calc.netProfit >= 0 ? '#4ADE80' : '#F87171'} />
            </div>

            <div className="mt-4">
              <div className="relative h-3 overflow-hidden rounded-full bg-white/10">
                <div className="absolute inset-y-0 left-0 bg-red-500/70 transition-[width] duration-[1400ms] ease-out" style={{ width: go ? `${bePct}%` : '0%' }} />
                <div className="absolute inset-y-0 right-0 transition-[width] duration-[1400ms] ease-out" style={{ background: "rgba(74,222,128,.85)", width: go ? `${100 - bePct}%` : "0%", transitionDelay: "300ms" }} />
                <div className="absolute inset-y-0 w-0.5 bg-white transition-[left] duration-[1400ms] ease-out" style={{ left: go ? `${bePct}%` : '0%' }} />
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-white/50">
                <span>ticket 1</span>
                <span className="text-white">Nothing is yours until ticket <b className="text-[#8FD3FF]">{be.toLocaleString()}</b></span>
                <span>ticket {SHOW.cap}</span>
              </div>
            </div>
          </div>

          {/* right: the score and the three nights */}
          <div className="px-4 py-4 sm:px-6 sm:py-5 bg-white/[0.025]">
            <div className="font-label text-[10px] tracking-[0.18em] uppercase text-white/45 mb-2">3 · The read</div>
            <div className="flex items-center gap-4">
              <svg viewBox="0 0 100 100" className="h-24 w-24 shrink-0 -rotate-90">
                <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="8" />
                <circle cx="50" cy="50" r={R} fill="none" stroke={v.c} strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={C} strokeDashoffset={C - (C * score) / 100} style={{ transition: 'stroke-dashoffset .12s linear', filter: `drop-shadow(0 0 6px ${v.c}88)` }} />
                <text x="50" y="50" transform="rotate(90 50 50)" textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize="26" fontWeight="700" className="font-mono">{score}</text>
              </svg>
              <div className="min-w-0">
                <div className="text-white text-lg font-semibold leading-tight">Deal score {score}<span className="text-white/40 text-sm">/100</span></div>
                <div className="text-sm mt-1" style={{ color: v.c }}>{go ? v.s : 'Running the night three ways…'}</div>
              </div>
            </div>

            <div className="mt-4 space-y-1.5">
              {nights.map((n, i) => (
                <div key={n.l} className="flex items-center justify-between rounded-lg border border-white/10 bg-[#0B0D12] px-3 py-2 text-sm"
                  style={{ opacity: go ? 1 : 0, transform: go ? 'none' : 'translateY(6px)', transition: `opacity .5s ease ${900 + i * 260}ms, transform .5s ease ${900 + i * 260}ms` }}>
                  <div><div className="text-white">{n.l}</div><div className="text-[11px] text-white/45">{n.sub}</div></div>
                  <div className="font-mono tabular-nums font-semibold" style={{ color: n.p >= 0 ? '#4ADE80' : '#F87171' }}>{n.p >= 0 ? '+' : '−'}{$(Math.abs(n.p))}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 text-[11px] text-white/45">Green means you walk out with money. Red means you paid to throw the show.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ k, val, strong, color }: { k: string; val: string; strong?: boolean; color?: string }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${strong ? 'border-t border-white/15 pt-1.5' : ''}`}>
      <span className={strong ? 'text-white' : 'text-white/55'}>{k}</span>
      <span className={`font-mono tabular-nums ${strong ? 'text-base font-bold' : 'text-white'}`} style={color ? { color } : undefined}>{val}</span>
    </div>
  );
}
