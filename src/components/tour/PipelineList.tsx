import { useEffect, useMemo, useState } from 'react';
import { Search, Plus, ChevronDown, FileText } from 'lucide-react';
import { parseLocalDate } from '../../lib/dateHelpers';
import { STAGE, STAGES, isBooked, isPast, short$, canonicalCity, type Card, type Stage } from '../../lib/tourPipeline';

/**
 * The pipeline the way Jose ran his booking board: one block per show date, the venues in
 * that city under it, each row with the contact, what we sent, the next step and a status
 * pill you click to move it. Undated leads sit at the bottom. Chips on top narrow it to what
 * needs you.
 */
type Filter = 'all' | 'todo' | 'live' | 'locked' | 'nodate' | 'dead';
const FILTERS: { key: Filter; label: string; hint: string }[] = [
  { key: 'all', label: 'All', hint: '' },
  { key: 'todo', label: 'Your move', hint: 'Not contacted yet, or on hold' },
  { key: 'live', label: 'Waiting on them', hint: 'Contacted, talking, offer out' },
  { key: 'locked', label: 'Locked', hint: 'Confirmed or played' },
  { key: 'nodate', label: 'No date', hint: 'Leads without a show date' },
  { key: 'dead', label: 'Dead', hint: 'Said no, released, cancelled' },
];
const GROUP: Record<Exclude<Filter, 'all' | 'nodate'>, Stage[]> = {
  todo: ['lead', 'hold'], live: ['contacted', 'talking', 'offer_sent'], locked: ['confirmed', 'settled'], dead: ['dead'],
};
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function PipelineList({ cards, selectedKey, onOpen, onMove, onAdd, onMakeOffer }: {
  cards: Card[]; selectedKey: string | null;
  onOpen: (c: Card) => void; onMove: (c: Card, to: Stage) => void; onAdd: () => void; onMakeOffer: (c: Card) => void;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [menu, setMenu] = useState<string | null>(null);
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menu]);

  const counts = useMemo(() => ({
    all: cards.length,
    todo: cards.filter((c) => GROUP.todo.includes(c.stage)).length,
    live: cards.filter((c) => GROUP.live.includes(c.stage)).length,
    locked: cards.filter((c) => GROUP.locked.includes(c.stage)).length,
    nodate: cards.filter((c) => !c.date && c.stage !== 'dead').length,
    dead: cards.filter((c) => c.stage === 'dead').length,
  }), [cards]);

  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    return cards
      .filter((c) => filter === 'all' ? c.stage !== 'dead' : filter === 'nodate' ? !c.date && c.stage !== 'dead' : GROUP[filter].includes(c.stage))
      .filter((c) => !k || `${c.city} ${c.venue} ${c.artist || ''} ${c.contact || ''}`.toLowerCase().includes(k))
      .sort((a, b) => ((a.date ?? '9999') + a.city).localeCompare((b.date ?? '9999') + b.city) || a.venue.localeCompare(b.venue));
  }, [cards, filter, q]);

  const groups = useMemo(() => {
    const by = new Map<string, Card[]>();
    for (const c of shown) { const k = c.date ?? 'nodate'; by.set(k, [...(by.get(k) || []), c]); }
    return [...by.entries()];
  }, [shown]);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const chip = 'px-2.5 py-1 rounded-lg text-xs font-semibold border';

  return (
    <div>
      {/* chips + search */}
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)} title={f.hint}
            className={`${chip} ${filter === f.key ? 'bg-[#8FD3FF] text-[#04214D] border-[#8FD3FF]' : 'bg-[#14171E] text-gray-300 border-[#2A3040] hover:border-gray-500'}`}
            style={{ textTransform: 'none', letterSpacing: 0 }}>
            {f.label} <span className="opacity-60">{counts[f.key]}</span>
          </button>
        ))}
        <div className="flex items-center gap-1.5 bg-[#14171E] border border-[#2A3040] rounded-lg px-2 ml-auto focus-within:border-[#8FD3FF] min-w-[180px]">
          <Search className="w-3.5 h-3.5 text-gray-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="City or venue" className="w-full bg-transparent py-1 text-sm text-white outline-none placeholder:text-gray-600" style={{ textTransform: 'none', letterSpacing: 0 }} />
        </div>
      </div>
      <p className="text-[11px] text-white/70 mb-2">Click a status pill to move a venue. Click the row to open it. <b className="text-white">Your move</b> = nothing sent yet or on hold. <b className="text-white">Waiting on them</b> = they have our email or offer.</p>

      {groups.length === 0 ? (
        <div className="bg-[#14171E] border border-dashed border-[#2A3040] rounded-xl p-6 text-center text-sm text-gray-400">
          {cards.length ? 'Nothing here. Pick another chip or clear the search.' : <>No venues yet. <button onClick={onAdd} className="text-[#8FD3FF] underline" style={{ textTransform: 'none', letterSpacing: 0 }}>Add the first one</button>.</>}
        </div>
      ) : groups.map(([date, rows]) => {
        const d = date === 'nodate' ? null : parseLocalDate(date)!;
        const cities = [...new Set(rows.map((r) => canonicalCity(r.city)).filter(Boolean))];
        const past = d ? d < today : false;
        const locked = rows.some((r) => isBooked(r.stage));
        return (
          <section key={date} className={`grid grid-cols-[72px_1fr] sm:grid-cols-[96px_1fr] gap-3 border-t-2 ${locked && !past ? 'border-[#4ADE80]' : past ? 'border-[#3A4152]' : 'border-white/70'} pt-2.5 mb-3`}>
            <div className={`leading-none ${past ? 'text-gray-500' : 'text-white'}`}>
              {d ? (
                <>
                  <div className="font-label text-[10px] tracking-[0.14em] text-gray-400 uppercase">{DOW[d.getDay()]} · {MON[d.getMonth()]}</div>
                  <div className="text-3xl font-bold">{d.getDate()}</div>
                  <div className="text-[11px] text-gray-400 mt-1 leading-tight">{d.getFullYear() !== today.getFullYear() ? d.getFullYear() + ' · ' : ''}{cities.join(' · ')}</div>
                </>
              ) : (
                <>
                  <div className="font-label text-[10px] tracking-[0.14em] text-gray-400 uppercase">New leads</div>
                  <div className="text-3xl font-bold">—</div>
                  <div className="text-[11px] text-gray-400 mt-1 leading-tight">No date · {cities.length} cities</div>
                </>
              )}
            </div>
            <div className="space-y-1.5 min-w-0">
              {rows.map((c) => {
                const on = c.key === selectedKey;
                const dead = c.stage === 'dead';
                const options: Stage[] = c.offer
                  ? (['talking', 'hold', 'offer_sent', 'confirmed', 'dead'] as Stage[])
                  : (['lead', 'contacted', 'talking', 'hold', 'confirmed', 'dead'] as Stage[]);
                return (
                  <article key={c.key} onClick={() => onOpen(c)}
                    className={`cursor-pointer rounded-lg border px-3 py-2 grid gap-x-3 gap-y-1 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)_auto] items-start ${on ? 'border-[#8FD3FF] bg-[#8FD3FF]/5' : 'border-[#2A3040] bg-[#14171E] hover:border-gray-500'} ${dead ? 'opacity-50' : ''}`}
                    style={{ textTransform: 'none', letterSpacing: 0 }}>
                    <div className="min-w-0">
                      <div className="text-white font-semibold text-sm truncate">{c.venue}{!d ? <span className="text-gray-400 font-normal"> · {c.city}</span> : null}</div>
                      {c.artist && <div className="text-[12px] text-[#8FD3FF] truncate">{c.artist}</div>}
                      {c.contact && <div className="text-[11px] text-gray-400 font-mono truncate" title={c.contact}>{c.contact}</div>}
                    </div>
                    <div className="min-w-0 text-[13px]">
                      <div className="text-gray-200"><span className="text-gray-500">Next:</span> {c.next || '—'}</div>
                      <div className="text-gray-400 text-[12px]"><span className="text-gray-500">Sent:</span> {c.sent || '—'}</div>
                      {c.money != null && (
                        <div className={`text-[12px] font-semibold ${c.moneyKind === 'actual' ? (c.money >= 0 ? 'text-green-400' : 'text-red-400') : 'text-gray-300'}`}>
                          {c.moneyKind === 'actual' ? (c.money >= 0 ? 'Made' : 'Lost') : c.moneyKind === 'projected' ? 'Projected' : 'Guess'} {short$(Math.abs(c.money))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 sm:justify-end" onClick={(e) => e.stopPropagation()}>
                      {!c.offer && !dead && (
                        <button onClick={() => onMakeOffer(c)} className="hidden sm:inline-flex items-center gap-1 text-[11px] text-[#8FD3FF] border border-[#8FD3FF]/40 rounded-md px-2 py-1 hover:bg-[#8FD3FF]/10" title="Turn this venue into a real offer"><FileText className="w-3 h-3" /> Offer</button>
                      )}
                      <div className="relative">
                        <button onClick={() => setMenu(menu === c.key ? null : c.key)}
                          className="inline-flex items-center gap-1 font-mono text-[10px] tracking-[0.08em] uppercase rounded-full px-2 py-1 border"
                          style={{ color: isPast(c) && isBooked(c.stage) ? '#9AA4B5' : STAGE[c.stage].color, borderColor: (isPast(c) && isBooked(c.stage) ? '#9AA4B5' : STAGE[c.stage].color) + '66', background: '#0B0D12' }}
                          title="Change status">
                          {isPast(c) && c.stage === 'settled' ? 'Played' : STAGE[c.stage].label} <ChevronDown className="w-3 h-3" />
                        </button>
                        {menu === c.key && (
                          <div className="absolute right-0 top-full mt-1 bg-[#14171E] border border-[#2A3040] rounded-lg shadow-2xl z-30 min-w-[170px] py-1">
                            {options.map((s) => (
                              <button key={s} onClick={() => { setMenu(null); if (s !== c.stage) onMove(c, s); }}
                                className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-white/5 ${s === c.stage ? 'bg-white/5' : ''}`}
                                style={{ color: STAGE[s].color, textTransform: 'none', letterSpacing: 0 }}>
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: STAGE[s].color }} />{STAGE[s].label}
                                <span className="text-gray-500 ml-auto text-[10px]">{STAGES.find((x) => x.key === s)?.hint}</span>
                              </button>
                            ))}
                            {!c.offer && <div className="border-t border-[#2A3040] mt-1 pt-1 px-3 py-1 text-[10px] text-gray-500">Offer sent / Settled come from the offer itself.</div>}
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
      <button onClick={onAdd} className="w-full border border-dashed border-[#8FD3FF]/40 rounded-xl py-2.5 text-sm text-[#8FD3FF] hover:bg-[#8FD3FF]/5 inline-flex items-center justify-center gap-1.5" style={{ textTransform: 'none', letterSpacing: 0 }}><Plus className="w-4 h-4" /> Add a venue</button>
    </div>
  );
}
