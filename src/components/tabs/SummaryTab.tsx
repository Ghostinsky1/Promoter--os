import { Calculations, TicketTier } from '../../types';
import { formatCurrency } from '../../lib/calculations';
import { CalculationsBreakdown } from '../CalculationsBreakdown';
import { DealAnalyzer } from '../DealAnalyzer';
import { TrendingUp, DollarSign, Users, Target } from 'lucide-react';

interface SummaryTabProps {
  calculations: Calculations;
  dealType: 'flat_guarantee' | 'promoter_profit';
  guarantee: number;
  taxWithholdingPct: number;
  depositPct: number;
  mode: 'estimate' | 'settlement';
  ticketTiers: TicketTier[];
  salesTaxPct: number;
  artistName: string;
  venueName: string;
  capacity: number;
}

export function SummaryTab({
  calculations,
  dealType,
  guarantee,
  taxWithholdingPct,
  depositPct,
  mode,
  ticketTiers,
  salesTaxPct,
  artistName,
  venueName,
  capacity,
}: SummaryTabProps) {
  const depositAmount = guarantee * (depositPct / 100);
  const taxWithholding = guarantee * (taxWithholdingPct / 100);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-3xl font-bold text-white mb-3">Offer Summary</h3>
        <p className="text-gray-400 mb-8">Review all calculations and projections</p>
      </div>

      <DealAnalyzer
        offerData={{
          artist_name: artistName,
          venue_name: venueName,
          capacity: capacity,
          guarantee: guarantee,
          gross_potential: calculations.netGross,
          net_profit: calculations.netProfit,
          total_costs: calculations.totalExpenses + guarantee,
          ticket_tiers: ticketTiers,
        }}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-2 border-blue-500/30 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-blue-400" />
            </div>
            <h3 className="text-xl font-bold text-white">Artist Payout Breakdown</h3>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Guarantee</span>
              <span className="font-semibold text-lg text-white">{formatCurrency(guarantee)}</span>
            </div>

            {dealType === 'promoter_profit' && calculations.artistBackend && calculations.artistBackend > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Backend (85%)</span>
                <span className="font-semibold text-lg text-green-400">+{formatCurrency(calculations.artistBackend)}</span>
              </div>
            )}

            <div className="flex justify-between items-center">
              <span className="text-gray-400">Tax Withholding ({taxWithholdingPct}%)</span>
              <span className="font-semibold text-lg text-red-400">-{formatCurrency(taxWithholding)}</span>
            </div>

            <div className="border-t-2 border-blue-500/30 pt-4 flex justify-between items-center">
              <span className="font-bold text-white text-lg">Artist Total Payout</span>
              <span className="font-bold text-blue-400 text-2xl">
                {formatCurrency(calculations.artistTotalPayout)}
              </span>
            </div>

            <div className="border-t border-gray-700 pt-4 mt-4 bg-[#1A1F1E] -mx-6 px-6 py-4 -mb-6 rounded-b-2xl">
              <div className="text-sm text-gray-400 mb-2">Deposit Due (30 days before)</div>
              <div className="font-bold text-white text-xl">{formatCurrency(depositAmount)}</div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#C4FF0D]/10 to-green-500/10 border-2 border-[#C4FF0D]/30 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-[#C4FF0D]/20 rounded-lg flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-[#C4FF0D]" />
            </div>
            <h3 className="text-xl font-bold text-white">Financial Summary</h3>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Net Gross Potential</span>
              <span className="font-semibold text-lg text-white">{formatCurrency(calculations.netGross)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Total Expenses</span>
              <span className="font-semibold text-lg text-red-400">-{formatCurrency(calculations.totalExpenses)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Artist Guarantee</span>
              <span className="font-semibold text-lg text-red-400">-{formatCurrency(guarantee)}</span>
            </div>

            {dealType === 'promoter_profit' && (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Promoter Profit (15%)</span>
                  <span className="font-semibold text-lg text-green-400">
                    +{formatCurrency(calculations.promoterProfit || 0)}
                  </span>
                </div>
                {calculations.promoterBackend && calculations.promoterBackend > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Promoter Backend (15%)</span>
                    <span className="font-semibold text-lg text-green-400">
                      +{formatCurrency(calculations.promoterBackend)}
                    </span>
                  </div>
                )}
              </>
            )}

            <div className={`border-t-2 border-[#C4FF0D]/30 pt-4 flex justify-between items-center`}>
              <span className="font-bold text-lg text-white">NET PROFIT</span>
              <span className={`font-bold text-2xl ${
                calculations.netProfit >= 0 ? 'text-[#C4FF0D]' : 'text-red-400'
              }`}>
                {formatCurrency(calculations.netProfit)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {dealType === 'promoter_profit' && calculations.splitPoint && (
        <div className={`border-2 rounded-2xl p-6 ${
          calculations.netGross > calculations.splitPoint
            ? 'bg-green-500/10 border-green-500/30'
            : 'bg-orange-500/10 border-orange-500/30'
        }`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              calculations.netGross > calculations.splitPoint
                ? 'bg-green-500/20'
                : 'bg-orange-500/20'
            }`}>
              <Target className={`h-5 w-5 ${
                calculations.netGross > calculations.splitPoint ? 'text-green-400' : 'text-orange-400'
              }`} />
            </div>
            <h3 className="text-xl font-bold text-white">Split Point Analysis</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Split Point</span>
              <span className="font-semibold text-white">{formatCurrency(calculations.splitPoint)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Net Gross</span>
              <span className="font-semibold text-white">{formatCurrency(calculations.netGross)}</span>
            </div>
            <div className="flex justify-between items-center border-t border-gray-700 pt-3">
              <span className="font-semibold text-white">Status</span>
              <span className={`font-bold text-lg ${
                calculations.netGross > calculations.splitPoint ? 'text-green-400' : 'text-orange-400'
              }`}>
                {calculations.netGross > calculations.splitPoint
                  ? `Split Point Hit! +${formatCurrency(calculations.backend || 0)} Backend`
                  : `Need ${formatCurrency(calculations.splitPoint - calculations.netGross)} more to hit split`
                }
              </span>
            </div>
          </div>
        </div>
      )}

      <CalculationsBreakdown
        ticketTiers={ticketTiers}
        salesTaxPct={salesTaxPct}
        calculations={calculations}
        guarantee={guarantee}
        mode={mode}
      />

      {mode === 'estimate' && calculations.projections && (
        <div className="bg-[#141716] border border-gray-700 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <Users className="h-5 w-5 text-purple-400" />
            </div>
            <h3 className="text-xl font-bold text-white">Capacity Projections</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: '70% Capacity', data: calculations.projections.capacity70 },
              { label: '85% Capacity', data: calculations.projections.capacity85 },
              { label: '100% Sellout', data: calculations.projections.capacity100 },
            ].map(({ label, data }) => (
              <div
                key={label}
                className={`border-2 rounded-xl p-5 ${
                  data.netProfit >= 0
                    ? 'bg-green-500/10 border-green-500/30'
                    : 'bg-red-500/10 border-red-500/30'
                }`}
              >
                <h4 className="font-bold text-white mb-4 text-lg">{label}</h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Tickets</span>
                    <span className="font-semibold text-white">{data.tickets}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Artist</span>
                    <span className="font-semibold text-white">{formatCurrency(data.artistPayout)}</span>
                  </div>
                  {dealType === 'promoter_profit' && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Promoter</span>
                      <span className="font-semibold text-white">{formatCurrency(data.promoterProfit)}</span>
                    </div>
                  )}
                  <div className={`flex justify-between items-center pt-3 border-t-2 ${
                    data.netProfit >= 0 ? 'border-green-500/30' : 'border-red-500/30'
                  }`}>
                    <span className="font-bold text-white">Profit</span>
                    <span className={`font-bold text-lg ${
                      data.netProfit >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {formatCurrency(data.netProfit)}
                    </span>
                  </div>
                  {dealType === 'promoter_profit' && (
                    <div className="text-xs text-center pt-2">
                      {data.splitPointHit ? (
                        <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full font-semibold">
                          Split Point Hit
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-orange-500/20 text-orange-400 rounded-full font-semibold">
                          Below Split Point
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
