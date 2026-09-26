import { formatCurrency } from '../../lib/calculations';
import { SupportAct, TicketTier, Expenses } from '../../types';
import { SupportActCard } from './SupportActCard';
import { SortableList } from '../SortableList';
import { Plus, Music, Info, Hotel, Car, Plane, AlertCircle, DollarSign, Check, Banknote, CalendarCheck, Calendar } from 'lucide-react';
import { netGrossOf, computeDeal, calculateTotalExpenses, type FacilityFeeMode, type PctBasis, type DealType } from '../../lib/calculations';

interface ArtistDeduction {
  name: string;
  amount: number;
}

interface ArtistDealTabProps {
  dealType: string;
  setDealType: (value: string) => void;
  guarantee: number;
  setGuarantee: (value: number) => void;
  artistPercentage?: number;
  setArtistPercentage?: (value: number) => void;
  taxWithholdingPct: number;
  setTaxWithholdingPct: (value: number) => void;
  depositPct: number;
  setDepositPct: (value: number) => void;
  artistBackendPct: number;
  setArtistBackendPct: (value: number) => void;
  promoterBackendPct: number;
  setPromoterBackendPct: (value: number) => void;
  supportActs: SupportAct[];
  setSupportActs: (acts: SupportAct[]) => void;
  merchRateSoft?: number;
  setMerchRateSoft?: (value: number) => void;
  merchRateHard?: number;
  setMerchRateHard?: (value: number) => void;
  artistDeductions?: ArtistDeduction[];
  setArtistDeductions?: (value: ArtistDeduction[]) => void;
  ticketTiers?: TicketTier[];
  salesTaxPct?: number;
  expenses?: Expenses;
  facilityFeePerTicket?: number;
  facilityFeeMode?: FacilityFeeMode;
  setFacilityFeeMode?: (v: FacilityFeeMode) => void;
  artistPctBasis?: PctBasis;
  setArtistPctBasis?: (v: PctBasis) => void;
  doorSplitBasis?: PctBasis;
  setDoorSplitBasis?: (v: PctBasis) => void;
  ascapRate?: number;
  bmiRate?: number;
  sesacRate?: number;
  insurancePerAttendee?: number;
  ccFeeRate?: number;
  includeHotel?: boolean;
  setIncludeHotel?: (value: boolean) => void;
  hotelBudget?: number;
  setHotelBudget?: (value: number) => void;
  hotelNights?: number;
  setHotelNights?: (value: number) => void;
  hotelNotes?: string;
  setHotelNotes?: (value: string) => void;
  includeTransport?: boolean;
  setIncludeTransport?: (value: boolean) => void;
  transportBudget?: number;
  setTransportBudget?: (value: number) => void;
  transportNotes?: string;
  setTransportNotes?: (value: string) => void;
  includeFlights?: boolean;
  setIncludeFlights?: (value: boolean) => void;
  flightBudget?: number;
  setFlightBudget?: (value: number) => void;
  flightNotes?: string;
  setFlightNotes?: (value: string) => void;
  includeRider?: boolean;
  setIncludeRider?: (value: boolean) => void;
  riderCap?: number;
  setRiderCap?: (value: number) => void;
  riderNotes?: string;
  setRiderNotes?: (value: string) => void;
  paymentMethod?: string;
  setPaymentMethod?: (value: string) => void;
  settlementDays?: number;
  setSettlementDays?: (value: number) => void;
  fullPaymentDueDate?: string;
  setFullPaymentDueDate?: (value: string) => void;
  eventDate?: string;
}

export function ArtistDealTab({
  dealType,
  setDealType,
  guarantee,
  setGuarantee,
  artistPercentage = 100,
  setArtistPercentage = () => {},
  taxWithholdingPct,
  setTaxWithholdingPct,
  depositPct,
  setDepositPct,
  artistBackendPct,
  setArtistBackendPct,
  promoterBackendPct,
  setPromoterBackendPct,
  supportActs,
  setSupportActs,
  merchRateSoft = 100,
  setMerchRateSoft = () => {},
  merchRateHard = 100,
  setMerchRateHard = () => {},
  artistDeductions = [],
  setArtistDeductions = () => {},
  ticketTiers = [],
  salesTaxPct = 0,
  expenses = { talent: {}, production: {}, marketing: {}, general: {} },
  facilityFeePerTicket = 2,
  facilityFeeMode = 'on_top',
  setFacilityFeeMode = () => {},
  artistPctBasis = 'net_after_costs',
  setArtistPctBasis = () => {},
  doorSplitBasis = 'net_after_costs',
  setDoorSplitBasis = () => {},
  ascapRate = 0.0023,
  bmiRate = 0.003,
  sesacRate = 0.000214,
  insurancePerAttendee = 0.62,
  ccFeeRate = 0.012,
  includeHotel = false,
  setIncludeHotel = () => {},
  hotelBudget = 0,
  setHotelBudget = () => {},
  hotelNights = 1,
  setHotelNights = () => {},
  hotelNotes = '',
  setHotelNotes = () => {},
  includeTransport = false,
  setIncludeTransport = () => {},
  transportBudget = 0,
  setTransportBudget = () => {},
  transportNotes = '',
  setTransportNotes = () => {},
  includeFlights = false,
  setIncludeFlights = () => {},
  flightBudget = 0,
  setFlightBudget = () => {},
  flightNotes = '',
  setFlightNotes = () => {},
  includeRider = false,
  setIncludeRider = () => {},
  riderCap = 100,
  setRiderCap = () => {},
  riderNotes = '',
  setRiderNotes = () => {},
  paymentMethod = 'deposit_balance',
  setPaymentMethod = () => {},
  settlementDays = 7,
  setSettlementDays = () => {},
  fullPaymentDueDate = '',
  setFullPaymentDueDate = () => {},
  eventDate = '',
}: ArtistDealTabProps) {
  const taxWithholding = guarantee * (taxWithholdingPct / 100);
  const totalPayout = guarantee - taxWithholding;
  const depositAmount = guarantee * (depositPct / 100);

  const calculateDealPayouts = () => {
    // This tab used to carry its own copy of the deal math -- the only copy
    // that knew what a percentage deal was, and not the one that got saved.
    // It reads the shared engine now, so the preview here is the number that
    // lands on the offer, the PDF, and the bad-night test.
    const totalSellable = ticketTiers.reduce((sum, tier) => sum + (tier.allotment - tier.comps), 0);
    const grossPotential = ticketTiers.reduce((sum, tier) => sum + ((tier.allotment - tier.comps) * tier.price), 0);
    const g = netGrossOf(grossPotential, totalSellable, salesTaxPct, facilityFeePerTicket, facilityFeeMode);
    const netGross = g.netGross;

    const fixedExpenses = calculateTotalExpenses(expenses) + supportActs.reduce((sum, act) => sum + (act.guarantee || 0), 0);
    const variableExpenses =
      netGross * ascapRate + netGross * bmiRate + netGross * sesacRate +
      totalSellable * insurancePerAttendee + netGross * ccFeeRate;
    const totalExpenses = fixedExpenses + variableExpenses;
    const netRevenue = netGross - totalExpenses;

    const deal = computeDeal(netGross, totalExpenses, {
      dealType: dealType as DealType,
      guarantee,
      taxWithholdingPct,
      artistPercentage,
      artistPctBasis,
      doorSplitBasis,
      artistBackendPct,
      promoterBackendPct,
    });

    return {
      grossPotential,
      netGross,
      netRevenue,
      artistPayout: deal.artistCost,
      promoterProfit: deal.netProfit,
      totalExpenses,
      describe: deal.describe,
    };
  };

  const { netRevenue, artistPayout, promoterProfit } = calculateDealPayouts();

  const addSupportAct = () => {
    setSupportActs([...supportActs, {
      name: '',
      type: 'artist',
      role: 'support',
      guarantee: 0,
      set_length: 30,
      genre: '',
      notes: '',
      deal_type: 'flat_fee',
      payment_method: 'deposit_balance',
      deposit_type: 'percentage',
      deposit_value: 50,
      settlement_days: 7,
    }]);
  };

  const updateSupportAct = (index: number, field: keyof SupportAct, value: any) => {
    const updated = [...supportActs];
    updated[index] = { ...updated[index], [field]: value };
    setSupportActs(updated);
  };

  const removeSupportAct = (index: number) => {
    setSupportActs(supportActs.filter((_, i) => i !== index));
  };

  const moveSupportAct = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= supportActs.length) return;

    const updated = [...supportActs];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setSupportActs(updated);
  };

  const totalSupportCost = supportActs.reduce((sum, act) => sum + (act.guarantee || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-3xl font-bold text-white mb-3">Artist Deal Structure</h3>
        <p className="text-gray-400 mb-8">Configure the artist's financial terms</p>
      </div>

      <div className="bg-[#0B0D12] border border-gray-700 rounded-2xl p-6">
        <h3 className="text-xl font-bold text-white mb-4">Deal Structure</h3>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-400 mb-3">Deal Type</label>
          <select
            value={dealType}
            onChange={(e) => setDealType(e.target.value)}
            className="w-full bg-[#14171E] border-gray-600 text-white rounded-2xl px-4 py-4 focus:border-[#8FD3FF] focus:ring-[#8FD3FF] border"
          >
            <option value="flat_fee" className="bg-[#14171E]">Flat Fee - I pay artist flat amount, I keep profit</option>
            <option value="guarantee_vs_percentage" className="bg-[#14171E]">Guarantee vs Percentage - Artist gets higher</option>
            <option value="percentage_only" className="bg-[#14171E]">Percentage Only - No guarantee</option>
            <option value="door_deal" className="bg-[#14171E]">Door Deal - Split after covering costs</option>
          </select>
        </div>

        {dealType === 'flat_fee' && (
          <div className="p-6 bg-[#8FD3FF]/10 border-2 border-[#8FD3FF]/30 rounded-2xl">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-[#8FD3FF] mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-bold text-[#8FD3FF] mb-1">Flat Fee Deal</div>
                <div className="text-sm text-gray-300">
                  You pay the artist a fixed amount regardless of how the show does.
                  You keep all profit after paying the artist and covering expenses.
                </div>
                {netRevenue > 0 && (
                  <div className="text-sm text-white font-semibold mt-2">
                    Example: Pay artist {formatCurrency(guarantee)} → Show makes {formatCurrency(netRevenue)} net → You keep {formatCurrency(promoterProfit)} profit
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {dealType === 'guarantee_vs_percentage' && (
          <div className="p-6 bg-purple-500/10 border-2 border-purple-500/30 rounded-2xl">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-purple-400 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-bold text-purple-400 mb-1">Guarantee vs Percentage</div>
                <div className="text-sm text-gray-300">
                  Artist gets whichever is higher: the guarantee OR their percentage of net revenue.
                  This is the standard deal for bigger artists who want protection but also upside.
                </div>
              </div>
            </div>
          </div>
        )}

        {dealType === 'percentage_only' && (
          <div className="p-6 bg-green-500/10 border-2 border-green-500/30 rounded-2xl">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-green-400 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-bold text-green-400 mb-1">Percentage Only</div>
                <div className="text-sm text-gray-300">
                  No guarantee - artist only gets their percentage of net revenue.
                  Lower risk for you, higher risk for artist. Good for emerging artists.
                </div>
              </div>
            </div>
          </div>
        )}

        {dealType === 'door_deal' && (
          <div className="p-6 bg-orange-500/10 border-2 border-orange-500/30 rounded-2xl">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-orange-400 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-bold text-orange-400 mb-1">Door Deal</div>
                <div className="text-sm text-gray-300">
                  Split the door proceeds after covering expenses. Common for co-promotions
                  or when sharing risk/reward with the artist.
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              {dealType === 'flat_fee'
                ? 'Flat Fee Amount'
                : dealType === 'percentage_only'
                ? 'No Guarantee'
                : 'Guarantee Amount'}
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                value={guarantee || ''}
                onChange={(e) => setGuarantee(Number(e.target.value))}
                placeholder="2500"
                min="0"
                step="100"
                disabled={dealType === 'percentage_only'}
                className="w-full pl-8 pr-4 py-3 bg-[#14171E] border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-[#8FD3FF] focus:border-[#8FD3FF] disabled:opacity-50"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {dealType === 'flat_fee'
                ? 'Fixed amount you pay the artist'
                : 'Guaranteed minimum payment'}
            </p>
          </div>

          {dealType !== 'flat_fee' && dealType !== 'flat_guarantee' && dealType !== 'promoter_profit' && (
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Artist Percentage</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={artistPercentage}
                  onChange={(e) => setArtistPercentage(Number(e.target.value))}
                  placeholder="100"
                  className="w-full px-4 py-3 bg-[#14171E] border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-[#8FD3FF] focus:border-[#8FD3FF]"
                />
                <span className="text-gray-400 font-medium">%</span>
              </div>

              {/* The switch. Of what? After your costs is the default because
                  that is how these deals are actually written; gross is there
                  for the agent who insists. */}
              {dealType === 'door_deal' ? (
                <BasisSwitch
                  label="Split the door"
                  value={doorSplitBasis}
                  onChange={setDoorSplitBasis}
                  afterLabel="after your costs"
                  grossLabel="before costs (gross)"
                />
              ) : (
                <BasisSwitch
                  label="Percentage of"
                  value={artistPctBasis}
                  onChange={setArtistPctBasis}
                  afterLabel="net after your costs"
                  grossLabel="gross"
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Facility fee: on top by default. The venue charges the fan and keeps
          it, so it never touches your gross. Switch it when the fee is carved
          out of the face price instead. */}
      <div className="bg-[#0B0D12] border border-gray-700 rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h4 className="text-sm font-bold text-white">Facility fee</h4>
            <p className="text-xs text-gray-500 mt-0.5">
              {facilityFeePerTicket > 0
                ? `$${facilityFeePerTicket.toFixed(2)} a ticket. ${facilityFeeMode === 'inside'
                    ? 'Carved out of your ticket price — it comes off your gross first.'
                    : 'Added on top of the price by the venue, who keeps it. Not your money either way.'}`
                : 'No facility fee on this show.'}
            </p>
          </div>
          <div className="flex rounded-lg overflow-hidden border border-gray-700 shrink-0">
            {(['on_top', 'inside'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setFacilityFeeMode(m)}
                style={{ textTransform: 'none', letterSpacing: 0 }}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  facilityFeeMode === m ? 'bg-[#8FD3FF] text-[#04214D]' : 'bg-[#14171E] text-gray-400 hover:text-white'
                }`}
              >
                {m === 'on_top' ? 'On top' : 'Inside price'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {(netRevenue > 0 || guarantee > 0) && (
        <div className="bg-gradient-to-r from-[#8FD3FF]/10 to-[#8FD3FF]/5 border-2 border-[#8FD3FF]/30 rounded-2xl p-6">
          <h3 className="text-xl font-bold text-white mb-4">Deal Summary</h3>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Net Revenue (after costs):</span>
              <span className="font-bold text-lg text-white">
                {formatCurrency(Math.max(0, netRevenue))}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-400">
                Artist {dealType === 'flat_fee' ? 'Flat Fee' : 'Payout'}:
              </span>
              <span className="font-bold text-lg text-green-400">
                {formatCurrency(Math.max(0, artistPayout))}
              </span>
            </div>

            <div className="border-t-2 border-[#8FD3FF]/30 pt-3">
              <div className="flex justify-between items-center">
                <span className="text-xl font-bold text-white">Your Profit:</span>
                <span className={`text-2xl font-bold ${promoterProfit >= 0 ? 'text-[#8FD3FF]' : 'text-red-500'}`}>
                  {formatCurrency(promoterProfit)}
                </span>
              </div>
            </div>

            {dealType === 'guarantee_vs_percentage' && netRevenue > 0 && (
              <div className="mt-4 p-3 bg-[#14171E] rounded-xl text-sm border border-gray-700">
                <div className="font-semibold mb-2 text-white">Artist Gets Higher Of:</div>
                <div className="flex justify-between text-gray-400">
                  <span>Guarantee:</span>
                  <span className="font-medium text-white">{formatCurrency(guarantee)}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>{artistPercentage}% of Net:</span>
                  <span className="font-medium text-white">{formatCurrency(netRevenue * (artistPercentage / 100))}</span>
                </div>
                <div className="border-t border-gray-700 mt-2 pt-2 flex justify-between font-bold">
                  <span className="text-white">Artist Receives:</span>
                  <span className="text-green-400">{formatCurrency(Math.max(guarantee, netRevenue * (artistPercentage / 100)))}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {(dealType === 'flat_guarantee' || dealType === 'promoter_profit') && (
        <div className="space-y-4">
          {dealType === 'promoter_profit' && (
            <div>
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-4">
                <p className="text-sm text-gray-300">
                  <span className="font-semibold text-orange-400">Backend Split:</span> After expenses and {promoterBackendPct}% promoter profit, artist receives {artistBackendPct}% of remaining revenue.
                </p>
              </div>

              <div className="bg-[#0B0D12] border border-gray-700 rounded-2xl p-4">
                <h3 className="font-semibold text-white mb-4">Customize Backend Split</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Artist Backend (%)
                    </label>
                    <input
                      type="number"
                      value={artistBackendPct}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (val >= 0 && val <= 100) {
                          setArtistBackendPct(val);
                          setPromoterBackendPct(100 - val);
                        }
                      }}
                      placeholder="85"
                      min="0"
                      max="100"
                      step="1"
                      className="w-full px-4 py-3 bg-[#14171E] border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-[#8FD3FF] focus:border-[#8FD3FF]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Promoter Backend (%)
                    </label>
                    <input
                      type="number"
                      value={promoterBackendPct}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (val >= 0 && val <= 100) {
                          setPromoterBackendPct(val);
                          setArtistBackendPct(100 - val);
                        }
                      }}
                      placeholder="15"
                      min="0"
                      max="100"
                      step="1"
                      className="w-full px-4 py-3 bg-[#14171E] border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-[#8FD3FF] focus:border-[#8FD3FF]"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Total must equal 100%. Adjusting one will automatically update the other.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Tax Withholding (%)
          </label>
          <input
            type="number"
            value={taxWithholdingPct}
            onChange={(e) => {
              const val = e.target.value === '' ? 0 : Number(e.target.value);
              setTaxWithholdingPct(isNaN(val) ? 0 : val);
            }}
            placeholder="0"
            min="0"
            max="100"
            step="0.1"
            className="w-full px-4 py-3 bg-[#0B0D12] border border-gray-700 text-white rounded-xl focus:ring-2 focus:ring-[#8FD3FF] focus:border-[#8FD3FF]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Deposit (%)
          </label>
          <input
            type="number"
            value={depositPct}
            onChange={(e) => {
              const val = e.target.value === '' ? 0 : Number(e.target.value);
              setDepositPct(isNaN(val) ? 0 : val);
            }}
            placeholder="0"
            min="0"
            max="100"
            step="1"
            className="w-full px-4 py-3 bg-[#0B0D12] border border-gray-700 text-white rounded-xl focus:ring-2 focus:ring-[#8FD3FF] focus:border-[#8FD3FF]"
          />
        </div>
      </div>

      {(dealType === 'flat_fee' || dealType === 'flat_guarantee') && (
        <div className="bg-[#0B0D12] border border-gray-700 rounded-2xl p-6">
          <h3 className="font-semibold text-white mb-4">Calculated Payout</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Guarantee</span>
              <span className="font-medium text-white">{formatCurrency(guarantee)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Tax Withholding ({taxWithholdingPct}%)</span>
              <span className="font-medium text-red-400">-{formatCurrency(taxWithholding)}</span>
            </div>
            <div className="border-t border-gray-700 pt-3 flex justify-between">
              <span className="font-semibold text-white">Total Potential Payout</span>
              <span className="font-semibold text-white text-lg">{formatCurrency(totalPayout)}</span>
            </div>
            <div className="border-t border-gray-700 pt-3 mt-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Deposit Due (30 days before)</span>
                <span className="font-medium text-white">{formatCurrency(depositAmount)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Terms Section */}
      <div className="bg-[#0B0D12] border border-gray-700 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-white">Payment Terms</h3>
          <div className="px-3 py-1 bg-[#8FD3FF]/20 border border-[#8FD3FF]/30 rounded-full">
            <span className="text-[#8FD3FF] text-xs font-semibold">IMPORTANT</span>
          </div>
        </div>

        {/* Payment Method Selection */}
        <div className="space-y-4 mb-6">
          {/* Option 1: Deposit + Balance */}
          <div
            className={`p-5 rounded-2xl border-2 transition-all cursor-pointer ${
              paymentMethod === 'deposit_balance'
                ? 'bg-[#8FD3FF]/10 border-[#8FD3FF]'
                : 'bg-[#14171E] border-gray-700 hover:border-gray-600'
            }`}
            onClick={() => setPaymentMethod('deposit_balance')}
          >
            <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                    paymentMethod === 'deposit_balance' ? 'bg-[#8FD3FF]/20' : 'bg-gray-700'
                  }`}>
                    <DollarSign className={`h-6 w-6 ${
                      paymentMethod === 'deposit_balance' ? 'text-[#8FD3FF]' : 'text-gray-400'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <h4 className={`font-bold mb-1 ${
                      paymentMethod === 'deposit_balance' ? 'text-[#8FD3FF]' : 'text-white'
                    }`}>
                      Deposit + Balance
                    </h4>
                    <p className="text-gray-400 text-sm mb-2">
                      Split payment into deposit and balance
                    </p>
                    <div className="inline-flex items-center gap-2 text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded-lg">
                      Most Common
                    </div>
                  </div>
                </div>
                {paymentMethod === 'deposit_balance' && (
                  <div className="w-6 h-6 bg-[#8FD3FF] rounded-full flex items-center justify-center flex-shrink-0">
                    <Check className="h-4 w-4 text-[#04214D]" />
                  </div>
                )}
              </div>
          </div>

          {/* Option 2: Full Payment Upfront */}
          <div
            className={`p-5 rounded-2xl border-2 transition-all cursor-pointer ${
              paymentMethod === 'full_upfront'
                ? 'bg-[#8FD3FF]/10 border-[#8FD3FF]'
                : 'bg-[#14171E] border-gray-700 hover:border-gray-600'
            }`}
            onClick={() => setPaymentMethod('full_upfront')}
          >
            <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                    paymentMethod === 'full_upfront' ? 'bg-[#8FD3FF]/20' : 'bg-gray-700'
                  }`}>
                    <Banknote className={`h-6 w-6 ${
                      paymentMethod === 'full_upfront' ? 'text-[#8FD3FF]' : 'text-gray-400'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <h4 className={`font-bold mb-1 ${
                      paymentMethod === 'full_upfront' ? 'text-[#8FD3FF]' : 'text-white'
                    }`}>
                      Full Payment Upfront
                    </h4>
                    <p className="text-gray-400 text-sm mb-2">
                      Pay artist entire amount before show
                    </p>
                    <div className="inline-flex items-center gap-2 text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded-lg">
                      Artist Preferred
                    </div>
                  </div>
                </div>
                {paymentMethod === 'full_upfront' && (
                  <div className="w-6 h-6 bg-[#8FD3FF] rounded-full flex items-center justify-center flex-shrink-0">
                    <Check className="h-4 w-4 text-[#04214D]" />
                  </div>
                )}
              </div>
          </div>

          {/* Option 3: Day of Event Settlement */}
          <div
            className={`p-5 rounded-2xl border-2 transition-all cursor-pointer ${
              paymentMethod === 'day_of_settlement'
                ? 'bg-[#8FD3FF]/10 border-[#8FD3FF]'
                : 'bg-[#14171E] border-gray-700 hover:border-gray-600'
            }`}
            onClick={() => setPaymentMethod('day_of_settlement')}
          >
            <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                    paymentMethod === 'day_of_settlement' ? 'bg-[#8FD3FF]/20' : 'bg-gray-700'
                  }`}>
                    <CalendarCheck className={`h-6 w-6 ${
                      paymentMethod === 'day_of_settlement' ? 'text-[#8FD3FF]' : 'text-gray-400'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <h4 className={`font-bold mb-1 ${
                      paymentMethod === 'day_of_settlement' ? 'text-[#8FD3FF]' : 'text-white'
                    }`}>
                      Day of Event Settlement
                    </h4>
                    <p className="text-gray-400 text-sm mb-2">
                      Pay artist after show is settled and revenue is counted
                    </p>
                    <div className="inline-flex items-center gap-2 text-xs px-2 py-1 bg-purple-500/20 text-purple-400 rounded-lg">
                      Cash Flow Friendly
                    </div>
                  </div>
                </div>
                {paymentMethod === 'day_of_settlement' && (
                  <div className="w-6 h-6 bg-[#8FD3FF] rounded-full flex items-center justify-center flex-shrink-0">
                    <Check className="h-4 w-4 text-[#04214D]" />
                  </div>
                )}
              </div>
          </div>
        </div>

        {/* Conditional Fields Based on Payment Method */}
        {paymentMethod === 'full_upfront' && (
          <div className="space-y-4 pt-4 border-t border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-[#8FD3FF]/20 rounded-2xl flex items-center justify-center">
                <Banknote className="h-6 w-6 text-[#8FD3FF]" />
              </div>
              <div>
                <h4 className="text-white font-semibold text-lg">Full Payment</h4>
                <p className="text-gray-500 text-sm">Artist receives entire amount upfront</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Payment Due Date</label>
              <div className="relative">
                <input
                  type="date"
                  className="w-full px-4 py-3 bg-[#14171E] border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-[#8FD3FF] focus:border-[#8FD3FF]"
                  value={fullPaymentDueDate}
                  onChange={(e) => setFullPaymentDueDate(e.target.value)}
                />
                <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500 pointer-events-none" />
              </div>
            </div>

            {totalPayout > 0 && (
              <div className="p-5 bg-[#8FD3FF]/10 border-2 border-[#8FD3FF]/30 rounded-2xl">
                <div className="flex items-center justify-between">
                  <span className="text-[#8FD3FF] font-semibold">Full Payment Amount</span>
                  <span className="text-[#8FD3FF] font-bold text-2xl">
                    {formatCurrency(totalPayout)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {paymentMethod === 'day_of_settlement' && (
          <div className="space-y-4 pt-4 border-t border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-purple-500/20 rounded-2xl flex items-center justify-center">
                <CalendarCheck className="h-6 w-6 text-purple-500" />
              </div>
              <div>
                <h4 className="text-white font-semibold text-lg">Settlement Terms</h4>
                <p className="text-gray-500 text-sm">Pay artist after event settlement</p>
              </div>
            </div>

            <div className="p-5 bg-purple-500/10 border-2 border-purple-500/30 rounded-2xl">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-purple-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-purple-400 font-semibold text-sm mb-2">
                    Day of Event Settlement
                  </p>
                  <div className="space-y-2 text-xs text-gray-400">
                    <p>Artist will be paid <span className="text-white font-semibold">{formatCurrency(totalPayout)}</span> after:</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Event completes</li>
                      <li>Revenue is counted</li>
                      <li>Expenses are tallied</li>
                      <li>Settlement is finalized</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-[#0B0D12] border border-gray-700 rounded-2xl p-6">
        <h3 className="text-xl font-bold text-white mb-4">Merchandise</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Soft Merch % (Artist Keeps)</label>
            <input
              type="number"
              value={merchRateSoft}
              onChange={(e) => setMerchRateSoft(parseInt(e.target.value))}
              className="w-full px-4 py-3 bg-[#14171E] border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-[#8FD3FF] focus:border-[#8FD3FF]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Hard Merch % (Artist Keeps)</label>
            <input
              type="number"
              value={merchRateHard}
              onChange={(e) => setMerchRateHard(parseInt(e.target.value))}
              className="w-full px-4 py-3 bg-[#14171E] border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-[#8FD3FF] focus:border-[#8FD3FF]"
            />
          </div>
        </div>
      </div>

      <div className="bg-[#0B0D12] border border-gray-700 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-white">Artist Lineup</h3>
            <p className="text-sm text-gray-400 mt-1">Add support acts with individual deals, payments, and accommodations</p>
          </div>
          <button
            type="button"
            onClick={addSupportAct}
            className="flex items-center gap-2 px-4 py-2 bg-[#8FD3FF] text-[#04214D] rounded-xl hover:bg-[#6FB8F2] transition-colors text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            Add Artist
          </button>
        </div>

        {supportActs.length === 0 ? (
          <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-700 rounded-2xl bg-[#14171E]">
            <Music className="h-12 w-12 mx-auto mb-3 text-gray-600" />
            <p className="font-medium text-gray-400">No support acts added yet</p>
            <button
              type="button"
              onClick={addSupportAct}
              className="mt-3 text-[#8FD3FF] hover:text-[#6FB8F2] font-medium text-sm"
            >
              Add your first artist
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <SortableList
              ids={supportActs.map((_, i) => `act-${i}`)}
              onMove={(from, to) => {
                const next = [...supportActs];
                const [item] = next.splice(from, 1);
                next.splice(to, 0, item);
                setSupportActs(next);
              }}
              className="space-y-3"
              renderItem={(id, handle) => {
                const index = Number(id.replace('act-', ''));
                const act = supportActs[index];
                if (!act) return null;
                return (
                  <SupportActCard
                    act={act}
                    index={index}
                    total={supportActs.length}
                    onUpdate={(field, value) => updateSupportAct(index, field, value)}
                    onRemove={() => removeSupportAct(index)}
                    onMove={(dir) => moveSupportAct(index, dir)}
                    dragHandle={handle}
                  />
                );
              }}
            />

            {totalSupportCost > 0 && (
              <div className="p-4 bg-[#8FD3FF]/10 border border-[#8FD3FF]/30 rounded-2xl">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-lg text-white">Total Artist Lineup Cost:</span>
                  <span className="text-2xl font-bold text-[#8FD3FF]">
                    {formatCurrency(totalSupportCost)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Artist Accommodations Section */}
      <div className="bg-[#0B0D12] border border-gray-700 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-white">Artist Accommodations</h3>
            <p className="text-sm text-gray-400 mt-1">Hotel, transport, flights, and rider requirements</p>
          </div>
          <div className="px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded-full">
            <span className="text-blue-400 text-xs font-semibold">OPTIONAL</span>
          </div>
        </div>

        <div className="space-y-6">
          {/* Hotel Section */}
          <div className="pb-6 border-b border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-500/20 rounded-2xl flex items-center justify-center">
                  <Hotel className="h-6 w-6 text-purple-500" />
                </div>
                <div>
                  <div className="text-white font-semibold">Hotel Accommodation</div>
                  <p className="text-gray-500 text-sm">Provide lodging for artist</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeHotel}
                  onChange={(e) => setIncludeHotel(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#8FD3FF] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8FD3FF]"></div>
              </label>
            </div>

            {includeHotel && (
              <div className="ml-0 md:ml-14 space-y-4 pt-4 border-t border-gray-700">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Budget Per Night</label>
                    <div className="relative">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                      <input
                        type="number"
                        placeholder="0"
                        className="w-full pl-12 pr-4 py-3 bg-[#14171E] border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-[#8FD3FF] focus:border-[#8FD3FF]"
                        value={hotelBudget || ''}
                        onChange={(e) => setHotelBudget(Number(e.target.value) || 0)}
                      />
                    </div>
                    <p className="text-gray-500 text-xs mt-1">Per night budget</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Number of Nights</label>
                    <input
                      type="number"
                      placeholder="1"
                      min="1"
                      className="w-full px-4 py-3 bg-[#14171E] border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-[#8FD3FF] focus:border-[#8FD3FF]"
                      value={hotelNights || 1}
                      onChange={(e) => setHotelNights(Number(e.target.value) || 1)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Hotel Requirements / Notes</label>
                  <textarea
                    placeholder="e.g., 4-star hotel near venue, non-smoking rooms, 2 rooms needed"
                    className="w-full px-4 py-3 bg-[#14171E] border border-gray-600 text-white rounded-xl placeholder:text-gray-600 min-h-24 focus:ring-2 focus:ring-[#8FD3FF] focus:border-[#8FD3FF]"
                    value={hotelNotes}
                    onChange={(e) => setHotelNotes(e.target.value)}
                  />
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="px-3 py-1.5 bg-[#14171E] border border-gray-600 text-gray-400 hover:border-[#8FD3FF] hover:text-[#8FD3FF] rounded-lg text-xs transition-colors"
                    onClick={() => setHotelNotes('4-star hotel near venue')}
                  >
                    4-Star Hotel
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1.5 bg-[#14171E] border border-gray-600 text-gray-400 hover:border-[#8FD3FF] hover:text-[#8FD3FF] rounded-lg text-xs transition-colors"
                    onClick={() => setHotelNotes('5-star luxury hotel')}
                  >
                    5-Star Luxury
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1.5 bg-[#14171E] border border-gray-600 text-gray-400 hover:border-[#8FD3FF] hover:text-[#8FD3FF] rounded-lg text-xs transition-colors"
                    onClick={() => setHotelNotes('Budget hotel, clean and comfortable')}
                  >
                    Budget Hotel
                  </button>
                </div>

                {/* Total Hotel Cost Preview */}
                {hotelBudget > 0 && (
                  <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl">
                    <div className="flex items-center justify-between">
                      <span className="text-purple-400 text-sm font-semibold">Total Hotel Cost</span>
                      <span className="text-purple-400 text-lg font-bold">
                        {formatCurrency(hotelBudget * (hotelNights || 1))}
                      </span>
                    </div>
                    <p className="text-gray-500 text-xs mt-1">
                      {formatCurrency(hotelBudget)}/night × {hotelNights || 1} night(s)
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Ground Transport Section */}
          <div className="pb-6 border-b border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center">
                  <Car className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <div className="text-white font-semibold">Ground Transport</div>
                  <p className="text-gray-500 text-sm">Airport pickup, venue transport</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeTransport}
                  onChange={(e) => setIncludeTransport(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#8FD3FF] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8FD3FF]"></div>
              </label>
            </div>

            {includeTransport && (
              <div className="ml-0 md:ml-14 space-y-4 pt-4 border-t border-gray-700">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Transport Budget</label>
                  <div className="relative">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                    <input
                      type="number"
                      placeholder="0"
                      className="w-full pl-12 pr-4 py-3 bg-[#14171E] border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-[#8FD3FF] focus:border-[#8FD3FF]"
                      value={transportBudget || ''}
                      onChange={(e) => setTransportBudget(Number(e.target.value) || 0)}
                    />
                  </div>
                  <p className="text-gray-500 text-xs mt-1">Total transport budget</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Transport Details / Notes</label>
                  <textarea
                    placeholder="e.g., Airport pickup, hotel to venue transport, return to airport"
                    className="w-full px-4 py-3 bg-[#14171E] border border-gray-600 text-white rounded-xl placeholder:text-gray-600 min-h-24 focus:ring-2 focus:ring-[#8FD3FF] focus:border-[#8FD3FF]"
                    value={transportNotes}
                    onChange={(e) => setTransportNotes(e.target.value)}
                  />
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="px-3 py-1.5 bg-[#14171E] border border-gray-600 text-gray-400 hover:border-[#8FD3FF] hover:text-[#8FD3FF] rounded-lg text-xs transition-colors"
                    onClick={() => setTransportNotes('Airport pickup and return')}
                  >
                    Airport Pickup/Return
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1.5 bg-[#14171E] border border-gray-600 text-gray-400 hover:border-[#8FD3FF] hover:text-[#8FD3FF] rounded-lg text-xs transition-colors"
                    onClick={() => setTransportNotes('Hotel to venue shuttle')}
                  >
                    Hotel to Venue
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1.5 bg-[#14171E] border border-gray-600 text-gray-400 hover:border-[#8FD3FF] hover:text-[#8FD3FF] rounded-lg text-xs transition-colors"
                    onClick={() => setTransportNotes('Private car service, full day')}
                  >
                    Private Car
                  </button>
                </div>

                {/* Transport Cost Preview */}
                {transportBudget > 0 && (
                  <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                    <div className="flex items-center justify-between">
                      <span className="text-blue-400 text-sm font-semibold">Transport Budget</span>
                      <span className="text-blue-400 text-lg font-bold">
                        {formatCurrency(transportBudget)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Flights Section */}
          <div className="pb-6 border-b border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-sky-500/20 rounded-2xl flex items-center justify-center">
                  <Plane className="h-6 w-6 text-sky-500" />
                </div>
                <div>
                  <div className="text-white font-semibold">Flights</div>
                  <p className="text-gray-500 text-sm">Airfare for artist and crew</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeFlights}
                  onChange={(e) => setIncludeFlights(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#8FD3FF] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8FD3FF]"></div>
              </label>
            </div>

            {includeFlights && (
              <div className="ml-0 md:ml-14 space-y-4 pt-4 border-t border-gray-700">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Flight Budget</label>
                  <div className="relative">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                    <input
                      type="number"
                      placeholder="0"
                      className="w-full pl-12 pr-4 py-3 bg-[#14171E] border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-[#8FD3FF] focus:border-[#8FD3FF]"
                      value={flightBudget || ''}
                      onChange={(e) => setFlightBudget(Number(e.target.value) || 0)}
                    />
                  </div>
                  <p className="text-gray-500 text-xs mt-1">Total budget for all flights</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Flight Details / Notes</label>
                  <textarea
                    placeholder="e.g., Round-trip flights for 4 people from LAX, economy class"
                    className="w-full px-4 py-3 bg-[#14171E] border border-gray-600 text-white rounded-xl placeholder:text-gray-600 min-h-24 focus:ring-2 focus:ring-[#8FD3FF] focus:border-[#8FD3FF]"
                    value={flightNotes}
                    onChange={(e) => setFlightNotes(e.target.value)}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="px-3 py-1.5 bg-[#14171E] border border-gray-600 text-gray-400 hover:border-[#8FD3FF] hover:text-[#8FD3FF] rounded-lg text-xs transition-colors"
                    onClick={() => setFlightNotes('Round-trip economy flights')}
                  >
                    Economy
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1.5 bg-[#14171E] border border-gray-600 text-gray-400 hover:border-[#8FD3FF] hover:text-[#8FD3FF] rounded-lg text-xs transition-colors"
                    onClick={() => setFlightNotes('Round-trip business class flights')}
                  >
                    Business Class
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1.5 bg-[#14171E] border border-gray-600 text-gray-400 hover:border-[#8FD3FF] hover:text-[#8FD3FF] rounded-lg text-xs transition-colors"
                    onClick={() => setFlightNotes('Artist books own flights, promoter reimburses')}
                  >
                    Reimbursement
                  </button>
                </div>

                {flightBudget > 0 && (
                  <div className="p-4 bg-sky-500/10 border border-sky-500/30 rounded-xl">
                    <div className="flex items-center justify-between">
                      <span className="text-sky-400 text-sm font-semibold">Flight Budget</span>
                      <span className="text-sky-400 text-lg font-bold">
                        {formatCurrency(flightBudget)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Rider Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-orange-500/20 rounded-2xl flex items-center justify-center">
                  <span className="text-2xl">🍔</span>
                </div>
                <div>
                  <div className="text-white font-semibold">Rider (Food & Beverages)</div>
                  <p className="text-gray-500 text-sm">Backstage hospitality requirements</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeRider}
                  onChange={(e) => setIncludeRider(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#8FD3FF] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8FD3FF]"></div>
              </label>
            </div>

            {includeRider && (
              <div className="ml-0 md:ml-14 space-y-4 pt-4 border-t border-gray-700">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Rider Budget Cap</label>
                  <div className="relative">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                    <input
                      type="number"
                      placeholder="100"
                      className="w-full pl-12 pr-4 py-3 bg-[#14171E] border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-[#8FD3FF] focus:border-[#8FD3FF]"
                      value={riderCap || ''}
                      onChange={(e) => setRiderCap(Number(e.target.value) || 0)}
                    />
                  </div>
                  <p className="text-gray-500 text-xs mt-1">Maximum amount to spend on rider</p>
                </div>

                {/* Quick Cap Presets */}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="px-3 py-1.5 bg-[#14171E] border border-gray-600 text-gray-400 hover:border-[#8FD3FF] hover:text-[#8FD3FF] rounded-lg text-xs transition-colors"
                    onClick={() => setRiderCap(50)}
                  >
                    $50 Cap
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1.5 bg-[#14171E] border border-gray-600 text-gray-400 hover:border-[#8FD3FF] hover:text-[#8FD3FF] rounded-lg text-xs transition-colors"
                    onClick={() => setRiderCap(100)}
                  >
                    $100 Cap
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1.5 bg-[#14171E] border border-gray-600 text-gray-400 hover:border-[#8FD3FF] hover:text-[#8FD3FF] rounded-lg text-xs transition-colors"
                    onClick={() => setRiderCap(200)}
                  >
                    $200 Cap
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1.5 bg-[#14171E] border border-gray-600 text-gray-400 hover:border-[#8FD3FF] hover:text-[#8FD3FF] rounded-lg text-xs transition-colors"
                    onClick={() => setRiderCap(500)}
                  >
                    $500 Cap
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Rider Requirements / Notes</label>
                  <textarea
                    placeholder="e.g., Standard rider: water, soft drinks, fresh fruit, deli platter"
                    className="w-full px-4 py-3 bg-[#14171E] border border-gray-600 text-white rounded-xl placeholder:text-gray-600 min-h-24 focus:ring-2 focus:ring-[#8FD3FF] focus:border-[#8FD3FF]"
                    value={riderNotes}
                    onChange={(e) => setRiderNotes(e.target.value)}
                  />
                </div>

                {/* Rider Cap Warning */}
                {riderCap > 0 && (
                  <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-orange-500 font-semibold text-sm mb-1">
                          Budget Cap: {formatCurrency(riderCap)}
                        </p>
                        <p className="text-gray-400 text-xs">
                          Actual rider cost may not exceed this amount. Work with artist to ensure requirements fit within budget.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Total Accommodations Summary */}
      {(includeHotel || includeTransport || includeFlights || includeRider) && (hotelBudget > 0 || transportBudget > 0 || flightBudget > 0 || riderCap > 0) && (
        <div className="bg-gradient-to-r from-[#8FD3FF]/10 to-[#6FB8F2]/10 border-2 border-[#8FD3FF]/30 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-[#8FD3FF]/20 rounded-2xl flex items-center justify-center flex-shrink-0">
              <Info className="h-6 w-6 text-[#8FD3FF]" />
            </div>
            <div className="flex-1">
              <h4 className="text-white font-bold mb-3">Accommodations Summary</h4>
              <div className="space-y-2 text-sm">
                {includeHotel && hotelBudget > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Hotel ({hotelNights || 1} night{(hotelNights || 1) > 1 ? 's' : ''})</span>
                    <span className="text-white font-semibold">
                      {formatCurrency(hotelBudget * (hotelNights || 1))}
                    </span>
                  </div>
                )}
                {includeTransport && transportBudget > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Ground Transport</span>
                    <span className="text-white font-semibold">{formatCurrency(transportBudget)}</span>
                  </div>
                )}
                {includeFlights && flightBudget > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Flights</span>
                    <span className="text-white font-semibold">{formatCurrency(flightBudget)}</span>
                  </div>
                )}
                {includeRider && riderCap > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Rider (up to)</span>
                    <span className="text-white font-semibold">{formatCurrency(riderCap)}</span>
                  </div>
                )}
                <div className="h-px bg-[#8FD3FF]/30 my-2"></div>
                <div className="flex justify-between">
                  <span className="text-[#8FD3FF] font-bold">Total Accommodations</span>
                  <span className="text-[#8FD3FF] font-bold text-lg">
                    {formatCurrency(
                      (includeHotel ? hotelBudget * (hotelNights || 1) : 0) +
                      (includeTransport ? transportBudget : 0) +
                      (includeFlights ? flightBudget : 0) +
                      (includeRider ? riderCap : 0)
                    )}
                  </span>
                </div>
              </div>
              <p className="text-gray-500 text-xs mt-3">
                These costs will be added to your expenses automatically
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function BasisSwitch({
  label, value, onChange, afterLabel, grossLabel,
}: {
  label: string;
  value: PctBasis;
  onChange: (v: PctBasis) => void;
  afterLabel: string;
  grossLabel: string;
}) {
  return (
    <div className="mt-3">
      <p className="text-xs text-gray-500 mb-1.5">{label}</p>
      <div className="flex rounded-lg overflow-hidden border border-gray-700 w-fit">
        {([['net_after_costs', afterLabel], ['gross', grossLabel]] as const).map(([v, text]) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            style={{ textTransform: 'none', letterSpacing: 0 }}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              value === v ? 'bg-[#8FD3FF] text-[#04214D]' : 'bg-[#14171E] text-gray-400 hover:text-white'
            }`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
