import { useState } from 'react';
import { SupportAct } from '../../types';
import { formatCurrency } from '../../lib/calculations';
import {
  ChevronDown, ChevronUp, Trash2, ArrowUp, ArrowDown,
  Music, Star, Users, DollarSign, Hotel, Car, Plane, AlertCircle, GripVertical } from 'lucide-react';

interface SupportActCardProps {
  act: SupportAct;
  index: number;
  total: number;
  onUpdate: (field: keyof SupportAct, value: any) => void;
  onRemove: () => void;
  onMove: (direction: 'up' | 'down') => void;
  /** Spread onto the grip so the card can be dragged into a new spot. */
  dragHandle?: Record<string, any>;
}

const ROLE_CONFIG = {
  headliner: { bg: 'bg-[#8FD3FF]/20', border: 'border-[#8FD3FF]/30', text: 'text-[#8FD3FF]', label: 'HEADLINER', Icon: Star },
  support: { bg: 'bg-blue-500/20', border: 'border-blue-500/30', text: 'text-blue-400', label: 'SUPPORT', Icon: Users },
  opener: { bg: 'bg-sky-500/20', border: 'border-sky-500/30', text: 'text-sky-400', label: 'OPENER', Icon: Music },
};

export function SupportActCard({ act, index, total, onUpdate, onRemove, onMove, dragHandle }: SupportActCardProps) {
  const [expanded, setExpanded] = useState(false);
  const role = act.role || 'support';
  const config = ROLE_CONFIG[role] || ROLE_CONFIG.support;
  const depositAmount = act.deposit_type === 'fixed'
    ? (act.deposit_value || 0)
    : (act.guarantee * ((act.deposit_value || 0) / 100));

  return (
    <div className={`bg-[#14171E] border ${config.border} rounded-2xl overflow-hidden transition-all`}>
      <div
        className="p-4 md:p-5 cursor-pointer hover:bg-[#0B0D12] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 md:gap-4">
          {dragHandle && (
            <span
              {...dragHandle}
              onClick={(e) => e.stopPropagation()}
              className="text-gray-600 hover:text-gray-300 cursor-grab active:cursor-grabbing touch-none -ml-1 flex-shrink-0"
              title="Drag to reorder"
            >
              <GripVertical className="h-4 w-4" />
            </span>
          )}
          <div className={`w-10 h-10 ${config.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
            <config.Icon className={`h-5 w-5 ${config.text}`} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h4 className="text-white font-bold truncate">
                {act.name || `Artist ${index + 1}`}
              </h4>
              <span className={`px-2 py-0.5 ${config.bg} ${config.text} rounded-md text-[10px] font-bold flex-shrink-0`}>
                {config.label}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span>{act.deal_type === 'flat_fee' ? 'Flat Fee' : act.deal_type === 'percentage' ? 'Percentage' : act.deal_type || 'Flat Fee'}</span>
              <span className="text-gray-600">|</span>
              <span className="text-[#8FD3FF] font-semibold">{formatCurrency(act.guarantee)}</span>
              {act.payment_method === 'deposit_balance' && act.deposit_value && (
                <>
                  <span className="text-gray-600">|</span>
                  <span>{act.deposit_type === 'fixed' ? formatCurrency(act.deposit_value) : `${act.deposit_value}%`} deposit</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <button type="button" onClick={(e) => { e.stopPropagation(); onMove('up'); }} disabled={index === 0}
              className="p-1.5 hover:bg-[#0B0D12] rounded-lg transition-colors disabled:opacity-30">
              <ArrowUp className="h-3.5 w-3.5 text-gray-400" />
            </button>
            <button type="button" onClick={(e) => { e.stopPropagation(); onMove('down'); }} disabled={index === total - 1}
              className="p-1.5 hover:bg-[#0B0D12] rounded-lg transition-colors disabled:opacity-30">
              <ArrowDown className="h-3.5 w-3.5 text-gray-400" />
            </button>
            <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors">
              <Trash2 className="h-3.5 w-3.5 text-red-500" />
            </button>
            {expanded ? <ChevronUp className="h-4 w-4 text-gray-400 ml-1" /> : <ChevronDown className="h-4 w-4 text-gray-400 ml-1" />}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-4 md:px-5 pb-5 space-y-5 border-t border-gray-700/50">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-5">
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">Artist Name *</label>
              <input type="text" value={act.name} onChange={(e) => onUpdate('name', e.target.value)} placeholder="Artist name"
                className="w-full px-3 py-2.5 bg-[#0B0D12] border border-gray-700 text-white text-sm rounded-xl focus:ring-2 focus:ring-[#8FD3FF] focus:border-[#8FD3FF]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">Role</label>
              <select value={role} onChange={(e) => onUpdate('role', e.target.value)}
                className="w-full px-3 py-2.5 bg-[#0B0D12] border border-gray-700 text-white text-sm rounded-xl focus:ring-2 focus:ring-[#8FD3FF] focus:border-[#8FD3FF]">
                <option value="headliner">Headliner</option>
                <option value="support">Support Act</option>
                <option value="opener">Opener</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">Type</label>
              <select value={act.type} onChange={(e) => onUpdate('type', e.target.value)}
                className="w-full px-3 py-2.5 bg-[#0B0D12] border border-gray-700 text-white text-sm rounded-xl focus:ring-2 focus:ring-[#8FD3FF] focus:border-[#8FD3FF]">
                <option value="dj">DJ</option>
                <option value="band">Band</option>
                <option value="artist">Solo Artist</option>
                <option value="special_guest">Special Guest</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">Set Length (min)</label>
              <input type="number" value={act.set_length || ''} onChange={(e) => onUpdate('set_length', parseInt(e.target.value) || 0)} placeholder="60"
                className="w-full px-3 py-2.5 bg-[#0B0D12] border border-gray-700 text-white text-sm rounded-xl focus:ring-2 focus:ring-[#8FD3FF] focus:border-[#8FD3FF]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">Genre</label>
              <input type="text" value={act.genre || ''} onChange={(e) => onUpdate('genre', e.target.value)} placeholder="e.g., Latin"
                className="w-full px-3 py-2.5 bg-[#0B0D12] border border-gray-700 text-white text-sm rounded-xl focus:ring-2 focus:ring-[#8FD3FF] focus:border-[#8FD3FF]" />
            </div>
            <div className="col-span-2 md:col-span-1">
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">Notes</label>
              <input type="text" value={act.notes || ''} onChange={(e) => onUpdate('notes', e.target.value)} placeholder="Special requirements..."
                className="w-full px-3 py-2.5 bg-[#0B0D12] border border-gray-700 text-white text-sm rounded-xl focus:ring-2 focus:ring-[#8FD3FF] focus:border-[#8FD3FF]" />
            </div>
          </div>

          {/* Deal Structure */}
          <div className="bg-[#0B0D12] rounded-xl p-4 space-y-3">
            <h5 className="text-white font-semibold text-sm">Deal Structure</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5">Deal Type</label>
                <select value={act.deal_type || 'flat_fee'} onChange={(e) => onUpdate('deal_type', e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#1140F0] border border-gray-700 text-white text-sm rounded-xl focus:ring-2 focus:ring-[#8FD3FF] focus:border-[#8FD3FF]">
                  <option value="flat_fee">Flat Fee</option>
                  <option value="percentage">Percentage</option>
                  <option value="door_deal">Door Deal</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5">Guarantee ($)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                  <input type="number" value={act.guarantee || ''} onChange={(e) => onUpdate('guarantee', parseFloat(e.target.value) || 0)} placeholder="0" min="0"
                    className="w-full pl-7 pr-3 py-2.5 bg-[#1140F0] border border-gray-700 text-white text-sm rounded-xl focus:ring-2 focus:ring-[#8FD3FF] focus:border-[#8FD3FF]" />
                </div>
              </div>
            </div>
          </div>

          {/* Payment Terms */}
          <div className="bg-[#0B0D12] rounded-xl p-4 space-y-3">
            <h5 className="text-white font-semibold text-sm">Payment Terms</h5>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">Payment Method</label>
              <select value={act.payment_method || 'deposit_balance'} onChange={(e) => onUpdate('payment_method', e.target.value)}
                className="w-full px-3 py-2.5 bg-[#1140F0] border border-gray-700 text-white text-sm rounded-xl focus:ring-2 focus:ring-[#8FD3FF] focus:border-[#8FD3FF]">
                <option value="deposit_balance">Deposit + Balance at Settlement</option>
                <option value="full_upfront">Full Payment Upfront</option>
                <option value="day_of_settlement">Day of Event Settlement</option>
              </select>
            </div>

            {act.payment_method === 'deposit_balance' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5">Deposit Type</label>
                  <select value={act.deposit_type || 'percentage'} onChange={(e) => onUpdate('deposit_type', e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#1140F0] border border-gray-700 text-white text-sm rounded-xl focus:ring-2 focus:ring-[#8FD3FF] focus:border-[#8FD3FF]">
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed Amount</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                    {act.deposit_type === 'fixed' ? 'Deposit Amount ($)' : 'Deposit (%)'}
                  </label>
                  <input type="number" value={act.deposit_value || ''} onChange={(e) => onUpdate('deposit_value', Number(e.target.value) || 0)}
                    placeholder={act.deposit_type === 'fixed' ? '0' : '50'} min="0"
                    className="w-full px-3 py-2.5 bg-[#1140F0] border border-gray-700 text-white text-sm rounded-xl focus:ring-2 focus:ring-[#8FD3FF] focus:border-[#8FD3FF]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5">Deposit Due Date</label>
                  <input type="date" value={act.deposit_due_date || ''} onChange={(e) => onUpdate('deposit_due_date', e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#1140F0] border border-gray-700 text-white text-sm rounded-xl focus:ring-2 focus:ring-[#8FD3FF] focus:border-[#8FD3FF]" />
                </div>
              </div>
            )}

            {act.payment_method === 'day_of_settlement' && (
              <div className="pt-2">
                <label className="block text-xs font-semibold text-gray-400 mb-1.5">Settlement Timeline</label>
                <select value={act.settlement_days ?? 7} onChange={(e) => onUpdate('settlement_days', Number(e.target.value))}
                  className="w-full px-3 py-2.5 bg-[#1140F0] border border-gray-700 text-white text-sm rounded-xl focus:ring-2 focus:ring-[#8FD3FF] focus:border-[#8FD3FF]">
                  <option value={0}>Same day as event</option>
                  <option value={1}>1 day after</option>
                  <option value={3}>3 days after</option>
                  <option value={7}>7 days after</option>
                  <option value={14}>14 days after</option>
                  <option value={30}>30 days after</option>
                </select>
              </div>
            )}

            {act.guarantee > 0 && (
              <div className="p-3 bg-[#8FD3FF]/10 border border-[#8FD3FF]/20 rounded-lg mt-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-400">Total Payment</span>
                  <span className="text-[#8FD3FF] font-bold">{formatCurrency(act.guarantee)}</span>
                </div>
                {(act.payment_method === 'deposit_balance' || !act.payment_method) && depositAmount > 0 && (
                  <>
                    <div className="flex justify-between items-center text-xs mt-1">
                      <span className="text-gray-400">Deposit</span>
                      <span className="text-white font-semibold">{formatCurrency(depositAmount)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs mt-1">
                      <span className="text-gray-400">Balance at Settlement</span>
                      <span className="text-white font-semibold">{formatCurrency(act.guarantee - depositAmount)}</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Accommodations */}
          <div className="bg-[#0B0D12] rounded-xl p-4 space-y-4">
            <h5 className="text-white font-semibold text-sm">Accommodations</h5>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <AccommodationToggle
                label="Hotel" icon={<Hotel className="h-4 w-4" />}
                active={act.include_hotel || false} color="purple"
                onToggle={() => onUpdate('include_hotel', !act.include_hotel)}
              />
              <AccommodationToggle
                label="Transport" icon={<Car className="h-4 w-4" />}
                active={act.include_transport || false} color="blue"
                onToggle={() => onUpdate('include_transport', !act.include_transport)}
              />
              <AccommodationToggle
                label="Flights" icon={<Plane className="h-4 w-4" />}
                active={act.include_flights || false} color="sky"
                onToggle={() => onUpdate('include_flights', !act.include_flights)}
              />
              <AccommodationToggle
                label="Rider" icon={<AlertCircle className="h-4 w-4" />}
                active={act.include_rider || false} color="orange"
                onToggle={() => onUpdate('include_rider', !act.include_rider)}
              />
            </div>

            {act.include_hotel && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Budget/Night</label>
                  <div className="relative">
                    <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
                    <input type="number" value={act.hotel_budget || ''} onChange={(e) => onUpdate('hotel_budget', Number(e.target.value) || 0)} placeholder="0"
                      className="w-full pl-7 pr-3 py-2 bg-[#1140F0] border border-gray-700 text-white text-xs rounded-lg focus:ring-1 focus:ring-[#8FD3FF]" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Nights</label>
                  <input type="number" value={act.hotel_nights || 1} onChange={(e) => onUpdate('hotel_nights', Number(e.target.value) || 1)} min="1"
                    className="w-full px-3 py-2 bg-[#1140F0] border border-gray-700 text-white text-xs rounded-lg focus:ring-1 focus:ring-[#8FD3FF]" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Notes</label>
                  <input type="text" value={act.hotel_notes || ''} onChange={(e) => onUpdate('hotel_notes', e.target.value)} placeholder="Hotel requirements"
                    className="w-full px-3 py-2 bg-[#1140F0] border border-gray-700 text-white text-xs rounded-lg focus:ring-1 focus:ring-[#8FD3FF]" />
                </div>
              </div>
            )}

            {act.include_transport && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Transport Budget</label>
                  <div className="relative">
                    <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
                    <input type="number" value={act.transport_budget || ''} onChange={(e) => onUpdate('transport_budget', Number(e.target.value) || 0)} placeholder="0"
                      className="w-full pl-7 pr-3 py-2 bg-[#1140F0] border border-gray-700 text-white text-xs rounded-lg focus:ring-1 focus:ring-[#8FD3FF]" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Notes</label>
                  <input type="text" value={act.transport_notes || ''} onChange={(e) => onUpdate('transport_notes', e.target.value)} placeholder="Transport details"
                    className="w-full px-3 py-2 bg-[#1140F0] border border-gray-700 text-white text-xs rounded-lg focus:ring-1 focus:ring-[#8FD3FF]" />
                </div>
              </div>
            )}

            {act.include_flights && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Flight Budget</label>
                  <div className="relative">
                    <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
                    <input type="number" value={act.flight_budget || ''} onChange={(e) => onUpdate('flight_budget', Number(e.target.value) || 0)} placeholder="0"
                      className="w-full pl-7 pr-3 py-2 bg-[#1140F0] border border-gray-700 text-white text-xs rounded-lg focus:ring-1 focus:ring-[#8FD3FF]" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Notes</label>
                  <input type="text" value={act.flight_notes || ''} onChange={(e) => onUpdate('flight_notes', e.target.value)} placeholder="Flight details"
                    className="w-full px-3 py-2 bg-[#1140F0] border border-gray-700 text-white text-xs rounded-lg focus:ring-1 focus:ring-[#8FD3FF]" />
                </div>
              </div>
            )}

            {act.include_rider && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Rider Cap</label>
                  <div className="relative">
                    <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
                    <input type="number" value={act.rider_cap || ''} onChange={(e) => onUpdate('rider_cap', Number(e.target.value) || 0)} placeholder="0"
                      className="w-full pl-7 pr-3 py-2 bg-[#1140F0] border border-gray-700 text-white text-xs rounded-lg focus:ring-1 focus:ring-[#8FD3FF]" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Notes</label>
                  <input type="text" value={act.rider_notes || ''} onChange={(e) => onUpdate('rider_notes', e.target.value)} placeholder="Rider requirements"
                    className="w-full px-3 py-2 bg-[#1140F0] border border-gray-700 text-white text-xs rounded-lg focus:ring-1 focus:ring-[#8FD3FF]" />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AccommodationToggle({ label, icon, active, color, onToggle }: {
  label: string; icon: React.ReactNode; active: boolean; color: string; onToggle: () => void;
}) {
  const colorMap: Record<string, { activeBg: string; activeBorder: string; activeText: string }> = {
    purple: { activeBg: 'bg-purple-500/10', activeBorder: 'border-purple-500/40', activeText: 'text-purple-400' },
    blue: { activeBg: 'bg-blue-500/10', activeBorder: 'border-blue-500/40', activeText: 'text-blue-400' },
    sky: { activeBg: 'bg-sky-500/10', activeBorder: 'border-sky-500/40', activeText: 'text-sky-400' },
    orange: { activeBg: 'bg-orange-500/10', activeBorder: 'border-orange-500/40', activeText: 'text-orange-400' },
  };
  const c = colorMap[color] || colorMap.blue;

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`p-3 rounded-xl border-2 text-center transition-all ${
        active
          ? `${c.activeBg} ${c.activeBorder}`
          : 'bg-[#1140F0] border-gray-700 hover:border-gray-600'
      }`}
    >
      <div className={`flex justify-center mb-1 ${active ? c.activeText : 'text-gray-500'}`}>
        {icon}
      </div>
      <span className={`text-xs font-semibold ${active ? c.activeText : 'text-gray-400'}`}>
        {label}
      </span>
    </button>
  );
}
