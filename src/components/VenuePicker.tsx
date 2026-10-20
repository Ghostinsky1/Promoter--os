import { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, Check } from 'lucide-react';
import { loadVenues, venueCityLine, costTotal, type Venue } from '../lib/venues';
import { short$ } from '../lib/tourPipeline';

let cache: Promise<Venue[]> | null = null;
export function useVenues() {
  const [venues, setVenues] = useState<Venue[]>([]);
  useEffect(() => {
    cache ||= loadVenues();
    cache.then(setVenues).catch(() => setVenues([]));
  }, []);
  return venues;
}

/**
 * The venue box on an offer: type freely, or pick a saved venue and its address, capacity,
 * fee and costs come along. A typed name that isn't saved yet becomes a venue when the offer
 * is saved (the database links every offer to its venue).
 */
export function VenuePicker({ value: outer, onChange: setOuter, onPick, picked, label = 'Venue', placeholder = 'The room', className = '' }: {
  /** Leave value/onChange out for a search-only box (it doesn't type into the venue name). */
  value?: string; onChange?: (v: string) => void; onPick: (v: Venue) => void; picked?: Venue | null;
  label?: string; placeholder?: string; className?: string;
}) {
  const venues = useVenues();
  const [own, setOwn] = useState('');
  const searchOnly = setOuter === undefined;
  const value = searchOnly ? own : outer ?? '';
  const onChange = searchOnly ? setOwn : setOuter!;
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const hits = useMemo(() => {
    const k = value.trim().toLowerCase();
    return venues.filter((v) => !k || v.name.toLowerCase().includes(k) || (v.city || '').toLowerCase().includes(k)).slice(0, 8);
  }, [venues, value]);

  return (
    <div ref={box} className={`relative ${className}`}>
      <label className="block">
        <span className="font-label text-[10px] tracking-[0.16em] uppercase text-gray-400">{label}</span>
        <div className="mt-1 flex items-center bg-[#0B0D12] border border-[#2A3040] rounded-lg px-3 focus-within:border-[#8FD3FF]">
          <MapPin className="w-4 h-4 text-gray-500 mr-1.5 shrink-0" />
          <input
            value={value}
            onChange={(e) => { onChange(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder={venues.length && !searchOnly ? `${placeholder} — or pick a saved one` : placeholder}
            className="w-full bg-transparent py-2 text-[15px] text-white outline-none placeholder:text-gray-600"
            style={{ textTransform: 'none', letterSpacing: 0 }}
          />
          {picked && !searchOnly && picked.name === value && <Check className="w-4 h-4 text-green-400 shrink-0" />}
        </div>
      </label>
      {picked && (searchOnly || picked.name === value) && (
        <span className="text-[11px] text-green-300/90 mt-0.5 block">
          {searchOnly ? `Using ${picked.name}` : 'Saved venue'}{picked.capacity ? ` · cap ${picked.capacity.toLocaleString()}` : ''}{picked.costs?.length ? ` · ${picked.costs.length} cost lines (${short$(costTotal(picked.costs))})` : ''}{picked.facility_fee_per_ticket != null ? ` · $${picked.facility_fee_per_ticket} fee` : ''}
        </span>
      )}
      {open && hits.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-[#14171E] border border-[#2A3040] rounded-lg shadow-2xl max-h-72 overflow-y-auto py-1">
          {hits.map((v) => (
            <button
              key={v.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onPick(v); setOpen(false); if (searchOnly) setOwn(''); }}
              className="w-full text-left px-3 py-2 hover:bg-[#1A1F2B] flex items-center justify-between gap-2"
              style={{ textTransform: 'none', letterSpacing: 0 }}
            >
              <span className="min-w-0">
                <span className="block text-sm text-white truncate">{v.name}</span>
                <span className="block text-[11px] text-gray-400 truncate">{venueCityLine(v) || 'no city'}{v.capacity ? ` · cap ${v.capacity.toLocaleString()}` : ''}</span>
              </span>
              {v.costs?.length ? <span className="text-[11px] text-gray-400 shrink-0">{short$(costTotal(v.costs))} costs</span> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
