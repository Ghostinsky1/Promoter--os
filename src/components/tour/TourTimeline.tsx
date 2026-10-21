import { useMemo } from 'react';
import { parseLocalDate } from '../../lib/dateHelpers';
import { STAGE, route, isBooked, isPast, type Card } from '../../lib/tourPipeline';

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
                style={on
                  ? { width: 14, height: 14, background: '#FFFFFF', boxShadow: '0 0 14px #FFFFFF' }
                  : isPast(c)
                    ? { width: isBooked(c.stage) ? 11 : 7, height: isBooked(c.stage) ? 11 : 7, background: '#9AA4B5', opacity: isBooked(c.stage) ? 0.8 : 0.4, marginTop: isBooked(c.stage) ? 1.5 : 3.5 }
                    : isBooked(c.stage)
                      ? { width: 14, height: 14, background: STAGE[c.stage].color, boxShadow: `0 0 ${isNext ? 14 : 6}px ${STAGE[c.stage].color}` }
                      : { width: 8, height: 8, background: STAGE[c.stage].color, opacity: 0.6, marginTop: 3 }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
