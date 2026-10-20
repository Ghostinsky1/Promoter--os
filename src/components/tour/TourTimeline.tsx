import { useMemo } from 'react';
import { parseLocalDate } from '../../lib/dateHelpers';
import { STAGE, route, short$, type Card } from '../../lib/tourPipeline';

/**
 * The run as a line: every dated show from first to last, a dot per show in its stage color,
 * a "today" marker, the next show lit. Tap a dot to pick that show (the globe flies to it).
 */
export function TourTimeline({ cards, nextKey, selectedKey, onSelect, start, end }: {
  cards: Card[]; nextKey: string | null; selectedKey: string | null; onSelect: (key: string) => void; start?: string | null; end?: string | null;
}) {
  const shows = useMemo(() => route(cards), [cards]);
  const dates = shows.map((c) => parseLocalDate(c.date!)!.getTime());
  const s0 = start ? parseLocalDate(start)?.getTime() : undefined;
  const e0 = end ? parseLocalDate(end)?.getTime() : undefined;
  const lo = Math.min(...[...dates, s0 ?? Infinity].filter(Number.isFinite));
  const hi = Math.max(...[...dates, e0 ?? -Infinity].filter(Number.isFinite));

  if (!shows.length || !Number.isFinite(lo) || !Number.isFinite(hi)) {
    return <div className="text-sm text-gray-400 py-4 text-center">Give a lead a date and it shows up on the line.</div>;
  }
  const span = Math.max(hi - lo, 86_400_000);
  const pct = (t: number) => 3 + ((t - lo) / span) * 94;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tPct = today.getTime() >= lo && today.getTime() <= hi ? pct(today.getTime()) : null;
  const months: { label: string; at: number }[] = [];
  const m = new Date(lo); m.setDate(1); m.setMonth(m.getMonth() + 1);
  while (m.getTime() <= hi) { months.push({ label: m.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(), at: pct(m.getTime()) }); m.setMonth(m.getMonth() + 1); }
  const next = shows.find((c) => c.key === nextKey);

  return (
    <div className="select-none">
      <div className="relative h-20">
        {/* the line */}
        <div className="absolute left-[3%] right-[3%] top-9 h-[2px] bg-[#2A3040]" />
        {tPct != null && <div className="absolute top-9 h-[2px] bg-[#8FD3FF] shadow-[0_0_10px_#8FD3FF]" style={{ left: '3%', width: `${tPct - 3}%` }} />}
        {months.map((mo) => (
          <div key={mo.label + mo.at} className="absolute top-12 -translate-x-1/2 font-label text-[9px] tracking-[0.18em] text-gray-500" style={{ left: `${mo.at}%` }}>
            <div className="w-px h-2 bg-[#2A3040] mx-auto mb-1" />{mo.label}
          </div>
        ))}
        {tPct != null && (
          <div className="absolute top-2 -translate-x-1/2 text-center" style={{ left: `${tPct}%` }}>
            <div className="font-label text-[9px] tracking-[0.18em] text-[#8FD3FF]">TODAY</div>
            <div className="w-px h-4 bg-[#8FD3FF] mx-auto" />
          </div>
        )}
        {shows.map((c) => {
          const at = pct(parseLocalDate(c.date!)!.getTime());
          const on = c.key === selectedKey, isNext = c.key === nextKey;
          return (
            <button
              key={c.key}
              onClick={() => onSelect(c.key)}
              title={`${c.city} · ${c.venue} · ${STAGE[c.stage].label}`}
              className="absolute top-9 -translate-x-1/2 -translate-y-1/2 group"
              style={{ left: `${at}%` }}
            >
              <span
                className={`block rounded-full border-2 border-[#14171E] transition-transform ${on ? 'scale-150' : 'group-hover:scale-125'} ${isNext ? 'animate-pulse' : ''}`}
                style={{ width: 14, height: 14, background: STAGE[c.stage].color, boxShadow: `0 0 ${on || isNext ? 14 : 6}px ${STAGE[c.stage].color}` }}
              />
            </button>
          );
        })}
      </div>
      {!next && shows.length > 0 && (() => {
        const last = [...shows].reverse().find((c) => parseLocalDate(c.date!)! <= today) ?? shows[shows.length - 1];
        return (
          <button onClick={() => onSelect(last.key)} className="mt-1 w-full text-left bg-[#0B0D12] border border-[#2A3040] rounded-xl px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-0.5" style={{ textTransform: 'none', letterSpacing: 0 }}>
            <span className="font-label text-[10px] tracking-[0.18em] text-gray-400 shrink-0">NOTHING COMING UP</span>
            <span className="text-gray-300 text-sm min-w-0">Last show: <span className="text-white">{last.city || last.venue}</span> · {parseLocalDate(last.date!)!.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}. Add a dated venue and it lights up as NEXT.</span>
          </button>
        );
      })()}
      {next && (
        <button onClick={() => onSelect(next.key)} className="mt-1 w-full text-left bg-[#0B0D12] border border-[#8FD3FF]/40 rounded-xl px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-0.5" style={{ textTransform: 'none', letterSpacing: 0 }}>
          <span className="font-label text-[10px] tracking-[0.18em] text-[#8FD3FF] shrink-0">NEXT</span>
          <span className="text-white font-semibold min-w-0">{next.city} · {next.venue}</span>
          <span className="text-gray-400 text-sm shrink-0">{parseLocalDate(next.date!)!.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · in {Math.max(0, Math.round((parseLocalDate(next.date!)!.getTime() - today.getTime()) / 86_400_000))} days</span>
          <span className="sm:ml-auto text-xs shrink-0" style={{ color: STAGE[next.stage].color }}>{STAGE[next.stage].label}{next.money != null ? ` · ${short$(next.money)}` : ''}</span>
        </button>
      )}
    </div>
  );
}
