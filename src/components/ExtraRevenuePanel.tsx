import { Plus, Trash2, Beer, Car, Shirt, Crown, Megaphone, ShoppingBag, CircleDollarSign, Truck } from 'lucide-react';
import type { ExtraRevenueLine, ExtraRevenueKind } from '../types';
import { splitExtraRevenue, carsFor, DEFAULT_CAR_OCCUPANCY, formatCurrency } from '../lib/calculations';

/**
 * Bar, parking, coat check, VIP, sponsorship — money that isn't tickets.
 * Off by default, because plenty of shows have no bar cut at all.
 */

const KINDS: { value: ExtraRevenueKind; label: string; icon: typeof Beer; basis: ExtraRevenueLine['basis']; amount: number; pct: number }[] = [
  // Amounts start blank on purpose (Jose, Sep 26): the promoter types their own
  // number. A prefilled "$12 a head" is a guess dressed up as data.
  { value: 'bar',         label: 'Bar',         icon: Beer,              basis: 'per_head', amount: 0, pct: 100 },
  { value: 'truck_spot',  label: 'Truck spots', icon: Truck,             basis: 'per_unit', amount: 0, pct: 100 },
  { value: 'parking',     label: 'Parking',     icon: Car,               basis: 'per_car',  amount: 0, pct: 100 },
  { value: 'coat_check',  label: 'Coat check',  icon: Shirt,             basis: 'per_head', amount: 0, pct: 100 },
  { value: 'vip',         label: 'VIP tables',  icon: Crown,             basis: 'flat',     amount: 0,  pct: 100 },
  { value: 'sponsorship', label: 'Sponsorship', icon: Megaphone,         basis: 'flat',     amount: 0,  pct: 100 },
  { value: 'merch',       label: 'Merch cut',   icon: ShoppingBag,       basis: 'flat',     amount: 0,  pct: 100 },
  { value: 'other',       label: 'Other',       icon: CircleDollarSign,  basis: 'flat',     amount: 0,  pct: 100 },
];

const kindMeta = (k: ExtraRevenueKind) => KINDS.find(x => x.value === k) ?? KINDS[KINDS.length - 1];

interface Props {
  enabled: boolean;
  onToggle: (on: boolean) => void;
  lines: ExtraRevenueLine[];
  onChange: (lines: ExtraRevenueLine[]) => void;
  /** Paid attendance to preview against — usually the tickets you expect to sell. */
  expectedAttendance: number;
  title?: string;
  subtitle?: string;
  /** Offer-page density: smaller header, half-house preview on every line. */
  compact?: boolean;
}

export function ExtraRevenuePanel({
  enabled, onToggle, lines, onChange, expectedAttendance, compact = false,
  title = 'Bar & other revenue',
  subtitle = 'Money that isn’t tickets. Leave it off for shows where you don’t take a cut.',
}: Props) {
  const rows = Array.isArray(lines) ? lines : [];

  const addLine = (kind: ExtraRevenueKind) => {
    const m = kindMeta(kind);
    onChange([...rows, {
      id: `rev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      label: m.label,
      kind,
      basis: m.basis,
      amount: m.amount,
      promoter_pct: m.pct,
      ...(m.basis === 'per_car' ? { occupancy: DEFAULT_CAR_OCCUPANCY } : {}),
      ...(m.basis === 'per_unit' ? { units: 0 } : {}),
    }]);
  };

  const patch = (id: string, fields: Partial<ExtraRevenueLine>) =>
    onChange(rows.map(r => (r.id === id ? { ...r, ...fields } : r)));

  const remove = (id: string) => onChange(rows.filter(r => r.id !== id));

  const { flat, perHead } = splitExtraRevenue(rows, enabled);
  const total = flat + perHead * Math.max(0, expectedAttendance || 0);

  /** What one line is worth at the expected crowd. */
  const lineValueAt = (l: ExtraRevenueLine, people: number) => {
    const share = Math.max(0, Math.min(100, Number(l.promoter_pct) ?? 100)) / 100;
    const amt = Number(l.amount) || 0;
    if (l.basis === 'flat') return amt * share;
    if (l.basis === 'per_unit') return (Number(l.units) || 0) * amt * share;
    if (l.basis === 'per_car') return carsFor(people, l.occupancy) * amt * share;
    return people * amt * share;
  };
  const lineValue = (l: ExtraRevenueLine) => lineValueAt(l, expectedAttendance);
  const half = Math.floor(Math.max(0, expectedAttendance || 0) * 0.5);
  const totalAtHalf = flat + perHead * half;

  return (
    <div className="bg-[#14171E] border border-[#2A3040] rounded-2xl overflow-hidden">
      <div className={`flex items-start justify-between gap-4 border-b border-[#2A3040] ${compact ? 'p-4' : 'p-5'}`}>
        <div className="min-w-0">
          <h3 className={`text-white font-bold ${compact ? 'text-base' : 'text-lg'}`}>{title}</h3>
          {!compact && <p className="text-gray-400 text-sm mt-0.5">{subtitle}</p>}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => onToggle(!enabled)}
          className={`relative w-14 h-8 rounded-full flex-shrink-0 transition-colors ${enabled ? 'bg-[#8FD3FF]' : 'bg-[#2A3040]'}`}
        >
          <span
            className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-0'}`}
          />
        </button>
      </div>

      {!enabled ? (
        <p className={`text-gray-500 text-sm ${compact ? 'px-4 py-3' : 'px-5 py-6'}`}>
          Off — this show earns from tickets only. Turn it on to add bar, parking, vendor spots or sponsorship.
        </p>
      ) : (
        <div className={`space-y-3 ${compact ? 'p-4' : 'p-5'}`}>
          {rows.length === 0 && (
            <p className="text-gray-500 text-sm">Add a line below. Nothing counts until you do.</p>
          )}

          {rows.map((l) => {
            const Icon = kindMeta(l.kind).icon;
            return (
              <div key={l.id} className="bg-[#0B0D12] border border-[#2A3040] rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-[#22262F] flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-[#8FD3FF]" />
                  </div>
                  <input
                    value={l.label}
                    onChange={e => patch(l.id, { label: e.target.value })}
                    className="flex-1 min-w-0 bg-transparent text-white font-semibold outline-none border-b border-transparent focus:border-[#2A3040]"
                    placeholder="What is it?"
                  />
                  <span className="text-[#8FD3FF] font-bold whitespace-nowrap">{formatCurrency(lineValue(l))}</span>
                  <button type="button" onClick={() => remove(l.id)} className="text-gray-500 hover:text-[#FF7A7A] transition-colors" aria-label="Remove">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <label className="block">
                    <span className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">How it's counted</span>
                    <select
                      value={l.basis}
                      onChange={e => {
                        const basis = e.target.value as ExtraRevenueLine['basis'];
                        patch(l.id, {
                          basis,
                          ...(basis === 'per_car' && !l.occupancy ? { occupancy: DEFAULT_CAR_OCCUPANCY } : {}),
                          ...(basis === 'per_unit' && l.units === undefined ? { units: 0 } : {}),
                        });
                      }}
                      className="w-full bg-[#14171E] border border-[#2A3040] rounded-lg text-white text-sm px-3 py-2 outline-none focus:border-[#8FD3FF]"
                    >
                      <option value="per_head">Per person</option>
                      <option value="per_car">Per car</option>
                      <option value="per_unit">Per spot / booth / table</option>
                      <option value="flat">Flat total</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">
                      {l.basis === 'flat' ? 'Total' : l.basis === 'per_car' ? 'Per car' : l.basis === 'per_unit' ? 'Price each' : 'Per person'}
                    </span>
                    <input
                      type="number" min={0} step="0.01" value={l.amount}
                      onChange={e => patch(l.id, { amount: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-[#14171E] border border-[#2A3040] rounded-lg text-white text-sm px-3 py-2 outline-none focus:border-[#8FD3FF]"
                    />
                  </label>

                  {l.basis === 'per_unit' ? (
                    <label className="block">
                      <span className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">How many</span>
                      <input
                        type="number" min={0} step="1" value={l.units ?? 0}
                        onChange={e => patch(l.id, { units: parseInt(e.target.value) || 0 })}
                        className="w-full bg-[#14171E] border border-[#2A3040] rounded-lg text-white text-sm px-3 py-2 outline-none focus:border-[#8FD3FF]"
                      />
                    </label>
                  ) : l.basis === 'per_car' ? (
                    <label className="block">
                      <span className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">People per car</span>
                      <input
                        type="number" min={1} step="0.1" value={l.occupancy ?? DEFAULT_CAR_OCCUPANCY}
                        onChange={e => patch(l.id, { occupancy: parseFloat(e.target.value) || DEFAULT_CAR_OCCUPANCY })}
                        className="w-full bg-[#14171E] border border-[#2A3040] rounded-lg text-white text-sm px-3 py-2 outline-none focus:border-[#8FD3FF]"
                      />
                    </label>
                  ) : <div className="hidden sm:block" />}

                  <label className="block">
                    <span className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">Your share %</span>
                    <input
                      type="number" min={0} max={100} step="1" value={l.promoter_pct}
                      onChange={e => patch(l.id, { promoter_pct: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-[#14171E] border border-[#2A3040] rounded-lg text-white text-sm px-3 py-2 outline-none focus:border-[#8FD3FF]"
                    />
                  </label>
                </div>

                {l.basis === 'per_car' && (
                  <p className="text-gray-500 text-xs mt-3">
                    {expectedAttendance.toLocaleString()} people at {l.occupancy ?? DEFAULT_CAR_OCCUPANCY} to a car is about{' '}
                    <span className="text-gray-300">{carsFor(expectedAttendance, l.occupancy).toLocaleString()} cars</span>.
                  </p>
                )}
                {l.basis === 'per_unit' && (
                  <p className="text-gray-500 text-xs mt-3">
                    {(l.units ?? 0).toLocaleString()} &times; {formatCurrency(l.amount)}. This does not move with the crowd — set the count yourself.
                  </p>
                )}
                {l.basis === 'per_head' && (
                  <p className="text-gray-500 text-xs mt-3">
                    {formatCurrency(l.amount)} a head{l.promoter_pct < 100 ? `, you keep ${l.promoter_pct}%` : ''}:
                    {' '}<span className="text-gray-300">{formatCurrency(lineValueAt(l, expectedAttendance))}</span> at a sellout ({expectedAttendance.toLocaleString()}),
                    {' '}<span className="text-gray-300">{formatCurrency(lineValueAt(l, half))}</span> at half a house ({half.toLocaleString()}).
                  </p>
                )}
              </div>
            );
          })}

          <div className="flex flex-wrap gap-2 pt-1">
            {KINDS.map(k => (
              <button
                key={k.value}
                type="button"
                onClick={() => addLine(k.value)}
                className="inline-flex items-center gap-1.5 bg-[#22262F] hover:bg-[#2A3040] border border-[#2A3040] text-gray-200 text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
              >
                <Plus className="w-3 h-3 text-[#8FD3FF]" /> {k.label}
              </button>
            ))}
          </div>

          {rows.length > 0 && (
            <div className="bg-[#0B0D12] border border-[#8FD3FF]/30 rounded-xl p-4 mt-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-300 text-sm">
                  Your take at a sellout ({expectedAttendance.toLocaleString()})
                </span>
                <span className="text-[#8FD3FF] text-xl font-bold">{formatCurrency(total)}</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-gray-500 text-xs">At half a house ({half.toLocaleString()})</span>
                <span className="text-gray-300 text-sm font-semibold">{formatCurrency(totalAtHalf)}</span>
              </div>
              <p className="text-gray-500 text-xs mt-2">
                This is yours — it never goes into the artist's percentage. Per-person and per-car lines
                shrink on a slow night, so your break-even stays honest.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
