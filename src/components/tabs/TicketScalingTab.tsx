import { Plus, Trash2 } from 'lucide-react';
import { TicketTier } from '../../types';
import { formatCurrency } from '../../lib/calculations';

interface TicketScalingTabProps {
  ticketTiers: TicketTier[];
  setTicketTiers: (tiers: TicketTier[]) => void;
  salesTaxPct: number;
  setSalesTaxPct: (value: number) => void;
  mode: 'estimate' | 'settlement';
  compsArtist?: number;
  setCompsArtist?: (value: number) => void;
  compsVenue?: number;
  setCompsVenue?: (value: number) => void;
  compsPromoter?: number;
  setCompsPromoter?: (value: number) => void;
}

export function TicketScalingTab({
  ticketTiers,
  setTicketTiers,
  salesTaxPct,
  setSalesTaxPct,
  mode,
  compsArtist = 0,
  setCompsArtist = () => {},
  compsVenue = 0,
  setCompsVenue = () => {},
  compsPromoter = 0,
  setCompsPromoter = () => {},
}: TicketScalingTabProps) {
  const addTier = () => {
    setTicketTiers([...ticketTiers, { type: '', allotment: 0, comps: 0, price: 0 }]);
  };

  const removeTier = (index: number) => {
    if (ticketTiers.length > 1) {
      setTicketTiers(ticketTiers.filter((_, i) => i !== index));
    }
  };

  const updateTier = (index: number, field: keyof TicketTier, value: string | number) => {
    const updated = [...ticketTiers];
    updated[index] = { ...updated[index], [field]: value };
    setTicketTiers(updated);
  };

  const grossPotential = ticketTiers.reduce((sum, tier) => {
    const sellable = tier.allotment - tier.comps;
    return sum + (sellable * tier.price);
  }, 0);

  const salesTax = grossPotential * (salesTaxPct / 100);
  const netGross = grossPotential - salesTax;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-3xl font-bold text-white mb-3">Ticket Scaling</h3>
        <p className="text-gray-400 mb-8">Configure ticket tiers and pricing</p>
      </div>

      <div className="space-y-4">
        {ticketTiers.map((tier, index) => (
          <div key={index} className="bg-[#141716] border border-gray-700 rounded-2xl p-6">
            <div className="flex items-start justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Tier {index + 1}</h3>
              {ticketTiers.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeTier(index)}
                  className="text-red-500 hover:text-red-400 hover:bg-red-500/10 p-2 rounded-lg transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Type</label>
                <input
                  type="text"
                  value={tier.type}
                  onChange={(e) => updateTier(index, 'type', e.target.value)}
                  placeholder="GA, VIP, etc."
                  className="w-full px-4 py-3 bg-[#1A1F1E] border border-gray-600 text-white placeholder:text-gray-600 rounded-xl focus:ring-2 focus:ring-[#C4FF0D] focus:border-[#C4FF0D]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Allotment</label>
                <input
                  type="number"
                  value={tier.allotment || ''}
                  onChange={(e) => updateTier(index, 'allotment', Number(e.target.value))}
                  placeholder="0"
                  min="0"
                  className="w-full px-4 py-3 bg-[#1A1F1E] border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-[#C4FF0D] focus:border-[#C4FF0D]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Comps</label>
                <input
                  type="number"
                  value={tier.comps || ''}
                  onChange={(e) => updateTier(index, 'comps', Number(e.target.value))}
                  placeholder="0"
                  min="0"
                  className="w-full px-4 py-3 bg-[#1A1F1E] border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-[#C4FF0D] focus:border-[#C4FF0D]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Price</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    value={tier.price || ''}
                    onChange={(e) => updateTier(index, 'price', Number(e.target.value))}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="w-full pl-9 pr-4 py-3 bg-[#1A1F1E] border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-[#C4FF0D] focus:border-[#C4FF0D]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Sellable</label>
                <div className="px-4 py-3 bg-[#252A29] border border-gray-700 rounded-xl text-white font-semibold">
                  {tier.allotment - tier.comps}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-700 flex justify-between items-center">
              <span className="text-sm text-gray-400">Gross Potential</span>
              <span className="font-semibold text-lg text-[#C4FF0D]">
                {formatCurrency((tier.allotment - tier.comps) * tier.price)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addTier}
        className="w-full py-4 border-2 border-dashed border-gray-700 rounded-2xl text-gray-400 hover:border-[#C4FF0D] hover:text-[#C4FF0D] hover:bg-[#C4FF0D]/5 transition-colors flex items-center justify-center gap-2 font-medium"
      >
        <Plus className="w-5 h-5" />
        Add Ticket Tier
      </button>

      <div className="bg-[#141716] border border-gray-700 rounded-2xl p-6">
        <h3 className="text-xl font-bold text-white mb-6">Complimentary Tickets</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Artist Comps</label>
            <input
              type="number"
              value={compsArtist}
              onChange={(e) => setCompsArtist(parseInt(e.target.value))}
              className="w-full px-4 py-3 bg-[#1A1F1E] border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-[#C4FF0D] focus:border-[#C4FF0D]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Venue Comps</label>
            <input
              type="number"
              value={compsVenue}
              onChange={(e) => setCompsVenue(parseInt(e.target.value))}
              className="w-full px-4 py-3 bg-[#1A1F1E] border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-[#C4FF0D] focus:border-[#C4FF0D]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Promoter Comps</label>
            <input
              type="number"
              value={compsPromoter}
              onChange={(e) => setCompsPromoter(parseInt(e.target.value))}
              className="w-full px-4 py-3 bg-[#1A1F1E] border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-[#C4FF0D] focus:border-[#C4FF0D]"
            />
          </div>
        </div>
      </div>

      <div className="bg-[#141716] border border-gray-700 rounded-2xl p-6">
        <div className="max-w-md">
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Sales Tax (%)
          </label>
          <input
            type="number"
            value={salesTaxPct}
            onChange={(e) => setSalesTaxPct(Number(e.target.value))}
            placeholder="0"
            min="0"
            max="100"
            step="0.01"
            className="w-full px-4 py-3 bg-[#1A1F1E] border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-[#C4FF0D] focus:border-[#C4FF0D]"
          />
        </div>
      </div>

      <div className="bg-gradient-to-r from-[#C4FF0D]/10 to-[#C4FF0D]/5 border-2 border-[#C4FF0D]/30 rounded-2xl p-6">
        <h3 className="text-xl font-bold text-white mb-6">Revenue Summary</h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Gross Potential</span>
            <span className="font-semibold text-lg text-white">{formatCurrency(grossPotential)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Sales Tax ({salesTaxPct}%)</span>
            <span className="font-semibold text-lg text-red-400">-{formatCurrency(salesTax)}</span>
          </div>
          <div className="border-t-2 border-[#C4FF0D]/30 pt-4 flex justify-between items-center">
            <span className="text-xl font-bold text-white">Net Gross Potential</span>
            <span className="text-2xl font-bold text-[#C4FF0D]">{formatCurrency(netGross)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
