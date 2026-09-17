import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { OfferWithShow } from '../types';
import { formatCurrency } from '../lib/calculations';
import { parseLocalDate } from '../lib/dateHelpers';
import {
  calculateBreakEven,
  calculateScenarios,
  calculateCapitalRequired,
  calculateRiskScore,
  getDaysUntilEvent,
  getConfidenceLevel,
  getRiskAngle
} from '../lib/breakEvenCalculations';
import { Target, AlertCircle, ArrowLeft, TrendingUp, DollarSign, Calendar, Users, Wallet, PieChart, BarChart3, AlertTriangle } from 'lucide-react';
import { readCancellation } from '../lib/cancellation';

export function Analytics() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [offer, setOffer] = useState<OfferWithShow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadOffer(id);
    }
  }, [id]);

  const loadOffer = async (offerId: string) => {
    try {
      const { data: offerData, error: offerError } = await supabase
        .from('offers')
        .select('*')
        .eq('id', offerId)
        .maybeSingle();

      if (offerError) throw offerError;
      if (!offerData) {
        navigate('/offers');
        return;
      }

      const { data: showData, error: showError } = await supabase
        .from('shows')
        .select('*')
        .eq('id', offerData.show_id)
        .maybeSingle();

      if (showError) throw showError;
      if (!showData) {
        navigate('/offers');
        return;
      }

      setOffer({
        ...offerData,
        show: showData,
      });
    } catch (error) {
      console.error('Error loading offer:', error);
      navigate('/offers');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1140F0] flex items-center justify-center">
        <div className="text-gray-400">Loading analytics...</div>
      </div>
    );
  }

  if (!offer) {
    return null;
  }

  const breakEven = calculateBreakEven(offer);
  const scenarios = calculateScenarios(offer);
  const capital = calculateCapitalRequired(offer);
  const riskScore = calculateRiskScore(offer);
  const daysUntil = getDaysUntilEvent(offer.show.event_date);
  const confidence = getConfidenceLevel(breakEven.percentage);

  const totalSellable = offer.ticket_tiers.reduce((sum, tier) => sum + (tier.allotment - tier.comps), 0);
  const artistTotal = offer.calculations.artistTotalPayout;
  const totalExpenses = offer.calculations.totalExpenses;
  const grossRevenue = offer.calculations.netGross;
  const netProfit = offer.calculations.netProfit;

  const expenseCategories = [
    { title: 'Talent', total: Object.values(offer.expenses.talent || {}).reduce((s, v) => s + v, 0), color: '#8FD3FF' },
    { title: 'Production', total: Object.values(offer.expenses.production || {}).reduce((s, v) => s + v, 0), color: '#ffffff' },
    { title: 'Marketing', total: Object.values(offer.expenses.marketing || {}).reduce((s, v) => s + v, 0), color: '#9ca3af' },
    { title: 'General', total: Object.values(offer.expenses.general || {}).reduce((s, v) => s + v, 0), color: '#6b7280' },
  ].filter(cat => cat.total > 0);

  return (
    <div className="min-h-screen bg-[#1140F0] text-white p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        <button
          onClick={() => navigate(`/offers/${id}`)}
          className="flex items-center gap-2 text-gray-400 hover:text-[#8FD3FF] mb-6 transition-colors text-sm group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to Offer
        </button>

        {/* Every projection below is for a show that is not happening. Say so
            before the promoter reads any of it as real money. */}
        {offer.status === 'cancelled' && (
          <div className="mb-6 bg-red-900/20 border border-red-800/40 rounded-2xl p-4">
            <p className="text-red-400 font-bold text-sm mb-1">This show was cancelled</p>
            <p className="text-xs text-gray-400">
              {(Number((offer as any).cancellation_loss) || 0) > 0
                ? `It cost you ${formatCurrency(Number((offer as any).cancellation_loss))}. Every projection below is what would have happened, not what did.`
                : readCancellation(offer).completed
                  ? 'Every projection below is what would have happened, not what did.'
                  : 'Nothing has been recorded for what it cost you. Open the offer and fill that in, or your month never sees the loss.'}
            </p>
          </div>
        )}

        <div className="mb-8">
          <div className="inline-block px-4 py-1.5 bg-[#8FD3FF]/10 border border-[#8FD3FF]/30 rounded-full mb-3">
            <span className="text-[#8FD3FF] text-xs font-bold uppercase tracking-wider">Deal Analytics</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2 text-white">{offer.show.artist_name}</h1>
          <p className="text-gray-400 text-base flex items-center gap-2">
            <span>{offer.show.venue_name}</span>
            <span className="w-1 h-1 rounded-full bg-gray-600"></span>
            <span>{(() => {
              const eventDate = parseLocalDate(offer.show.event_date);
              return eventDate ? eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Invalid date';
            })()}</span>
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Key Metrics - Full Width */}
        <div className="lg:col-span-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="bg-gradient-to-br from-[#14171E] to-[#0B0D12] rounded-3xl p-5 border border-[#8FD3FF]/20 hover:border-[#8FD3FF]/40 transition-all group">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-[#8FD3FF]/10 rounded-xl group-hover:bg-[#8FD3FF]/20 transition-colors">
                  <DollarSign className="w-5 h-5 text-[#8FD3FF]" />
                </div>
              </div>
              <div className="text-3xl font-black text-[#8FD3FF] mb-1">
                ${(netProfit / 1000).toFixed(1)}K
              </div>
              <div className="text-xs text-gray-400 uppercase tracking-wider font-medium">Net Profit</div>
              <div className="text-[10px] text-gray-600 mt-1">at 100% sold</div>
            </div>

            <div className="bg-gradient-to-br from-[#14171E] to-[#0B0D12] rounded-3xl p-5 border border-gray-700 hover:border-gray-600 transition-all group">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-white/5 rounded-xl group-hover:bg-white/10 transition-colors">
                  <Target className="w-5 h-5 text-gray-300" />
                </div>
              </div>
              <div className="text-3xl font-black text-white mb-1">
                {breakEven.percentage.toFixed(0)}%
              </div>
              <div className="text-xs text-gray-400 uppercase tracking-wider font-medium">Break-Even</div>
              <div className="text-[10px] text-gray-600 mt-1">{breakEven.tickets} tickets</div>
            </div>

            <div className="bg-gradient-to-br from-[#14171E] to-[#0B0D12] rounded-3xl p-5 border border-gray-700 hover:border-gray-600 transition-all group">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-white/5 rounded-xl group-hover:bg-white/10 transition-colors">
                  <Wallet className="w-5 h-5 text-gray-300" />
                </div>
              </div>
              <div className="text-3xl font-black text-white mb-1">
                ${(capital.total / 1000).toFixed(1)}K
              </div>
              <div className="text-xs text-gray-400 uppercase tracking-wider font-medium">Capital</div>
              <div className="text-[10px] text-gray-600 mt-1">upfront needed</div>
            </div>

            <div className="bg-gradient-to-br from-[#14171E] to-[#0B0D12] rounded-3xl p-5 border border-gray-700 hover:border-gray-600 transition-all group">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-white/5 rounded-xl group-hover:bg-white/10 transition-colors">
                  <Users className="w-5 h-5 text-gray-300" />
                </div>
              </div>
              <div className="text-3xl font-black text-white mb-1">
                {totalSellable}
              </div>
              <div className="text-xs text-gray-400 uppercase tracking-wider font-medium">Capacity</div>
              <div className="text-[10px] text-gray-600 mt-1">sellable tickets</div>
            </div>

            <div className="bg-gradient-to-br from-[#14171E] to-[#0B0D12] rounded-3xl p-5 border border-gray-700 hover:border-gray-600 transition-all group">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-white/5 rounded-xl group-hover:bg-white/10 transition-colors">
                  <Calendar className="w-5 h-5 text-gray-300" />
                </div>
              </div>
              <div className="text-3xl font-black text-white mb-1">
                {daysUntil}
              </div>
              <div className="text-xs text-gray-400 uppercase tracking-wider font-medium">Days Until</div>
              <div className="text-[10px] text-gray-600 mt-1">{daysUntil === 1 ? 'day' : 'days'} away</div>
            </div>
          </div>
        </div>

        {/* Break-Even Analysis */}
        <div className="lg:col-span-2 bg-gradient-to-br from-[#14171E] to-[#0B0D12] rounded-3xl p-6 border border-gray-800">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-[#8FD3FF]/10 rounded-xl">
              <Target className="h-6 w-6 text-[#8FD3FF]" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Break-Even Analysis</h2>
              <p className="text-xs text-gray-500">Minimum tickets to break even</p>
            </div>
          </div>

          <div className="flex items-center justify-center mb-6">
            <div className="relative w-56 h-56">
              <svg viewBox="0 0 200 200" className="w-full h-full">
                <circle
                  cx="100"
                  cy="100"
                  r="80"
                  fill="none"
                  stroke="#1f2937"
                  strokeWidth="24"
                />
                <circle
                  cx="100"
                  cy="100"
                  r="80"
                  fill="none"
                  stroke="#8FD3FF"
                  strokeWidth="24"
                  strokeDasharray={`${(breakEven.tickets / totalSellable) * 502} 502`}
                  strokeLinecap="round"
                  transform="rotate(-90 100 100)"
                  className="transition-all duration-1000 drop-shadow-[0_0_8px_rgba(196,255,13,0.5)]"
                />
                <text x="100" y="90" textAnchor="middle" className="text-5xl font-black fill-white">
                  {breakEven.tickets}
                </text>
                <text x="100" y="115" textAnchor="middle" className="text-sm fill-gray-400 uppercase tracking-widest font-bold">
                  Tickets
                </text>
              </svg>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-black/40 rounded-2xl p-4 border border-[#8FD3FF]/20">
              <div className="text-sm text-gray-400 mb-1 uppercase tracking-wide font-medium">Break-Even</div>
              <div className="text-2xl font-black text-[#8FD3FF]">
                {breakEven.percentage.toFixed(0)}%
              </div>
            </div>
            <div className="bg-black/40 rounded-2xl p-4 border border-gray-700">
              <div className="text-sm text-gray-400 mb-1 uppercase tracking-wide font-medium">Capacity</div>
              <div className="text-2xl font-black text-white">
                {totalSellable}
              </div>
            </div>
            <div className="bg-black/40 rounded-2xl p-4 border border-gray-700">
              <div className="text-sm text-gray-400 mb-1 uppercase tracking-wide font-medium">Buffer</div>
              <div className="text-2xl font-black text-white">
                {breakEven.buffer}
              </div>
            </div>
          </div>

          {breakEven.percentage > 70 && (
            <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-200">
                High break-even point. Consider reducing costs or increasing ticket prices.
              </div>
            </div>
          )}
        </div>

        {/* Profit Forecast */}
        <div className="bg-gradient-to-br from-[#14171E] to-[#0B0D12] rounded-3xl p-6 border border-gray-800">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-[#8FD3FF]/10 rounded-xl">
              <TrendingUp className="h-6 w-6 text-[#8FD3FF]" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Profit Forecast</h2>
              <p className="text-xs text-gray-500">At 100% capacity</p>
            </div>
          </div>

          <div className="text-center mb-6 py-6 bg-black/40 rounded-2xl border border-[#8FD3FF]/20">
            <div className="text-5xl font-black text-[#8FD3FF] mb-2">
              ${(netProfit / 1000).toFixed(1)}K
            </div>
            <div className="text-sm text-gray-400 uppercase tracking-wider">Projected Net Profit</div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center p-4 bg-black/40 rounded-2xl border border-gray-700">
              <span className="text-gray-300 text-sm font-medium">Profit Margin</span>
              <span className="font-black text-white text-lg">
                {((netProfit / grossRevenue) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between items-center p-4 bg-black/40 rounded-2xl border border-gray-700">
              <span className="text-gray-300 text-sm font-medium">Confidence</span>
              <span className={`font-black text-lg ${confidence.color}`}>
                {confidence.emoji} {confidence.text}
              </span>
            </div>
            <div className="flex justify-between items-center p-4 bg-black/40 rounded-2xl border border-gray-700">
              <span className="text-gray-300 text-sm font-medium">Risk Score</span>
              <span className={`font-black text-lg ${riskScore < 40 ? 'text-[#8FD3FF]' : riskScore < 70 ? 'text-yellow-400' : 'text-red-400'}`}>
                {riskScore.toFixed(0)}/100
              </span>
            </div>
          </div>
        </div>

        {/* Revenue Split */}
        <div className="lg:col-span-3 bg-gradient-to-br from-[#14171E] to-[#0B0D12] rounded-3xl p-6 border border-gray-800">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-[#8FD3FF]/10 rounded-xl">
              <PieChart className="h-6 w-6 text-[#8FD3FF]" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Revenue Split</h2>
              <p className="text-xs text-gray-500">Distribution of gross revenue</p>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            <div className="flex items-center justify-center">
              <div className="relative w-64 h-64">
                <svg viewBox="0 0 200 200" className="w-full h-full transform -rotate-90">
                  <circle
                    cx="100"
                    cy="100"
                    r="70"
                    fill="none"
                    stroke="#8FD3FF"
                    strokeWidth="48"
                    strokeDasharray={`${(artistTotal / grossRevenue) * 440} 440`}
                    className="drop-shadow-[0_0_8px_rgba(196,255,13,0.5)]"
                  />
                  <circle
                    cx="100"
                    cy="100"
                    r="70"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="48"
                    strokeDasharray={`${(totalExpenses / grossRevenue) * 440} 440`}
                    strokeDashoffset={`-${(artistTotal / grossRevenue) * 440}`}
                  />
                  <circle
                    cx="100"
                    cy="100"
                    r="70"
                    fill="none"
                    stroke="#6b7280"
                    strokeWidth="48"
                    strokeDasharray={`${(netProfit / grossRevenue) * 440} 440`}
                    strokeDashoffset={`-${((artistTotal + totalExpenses) / grossRevenue) * 440}`}
                  />
                  <circle cx="100" cy="100" r="46" fill="#1140F0" />
                </svg>

                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-4xl font-black text-white">
                      ${(grossRevenue / 1000).toFixed(1)}K
                    </div>
                    <div className="text-xs text-gray-400 uppercase tracking-wider mt-1">Total</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-center space-y-4">
              <div className="flex items-center justify-between p-5 bg-black/40 rounded-2xl border border-[#8FD3FF]/20">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-lg bg-[#8FD3FF] shadow-[0_0_12px_rgba(196,255,13,0.5)]"></div>
                  <span className="text-white font-bold">Artist Payout</span>
                </div>
                <div className="text-right">
                  <div className="font-black text-[#8FD3FF] text-xl">
                    ${(artistTotal / 1000).toFixed(1)}K
                  </div>
                  <div className="text-xs text-gray-500 font-medium">
                    {((artistTotal / grossRevenue) * 100).toFixed(1)}%
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-5 bg-black/40 rounded-2xl border border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-lg bg-white"></div>
                  <span className="text-white font-bold">Total Expenses</span>
                </div>
                <div className="text-right">
                  <div className="font-black text-white text-xl">
                    ${(totalExpenses / 1000).toFixed(1)}K
                  </div>
                  <div className="text-xs text-gray-500 font-medium">
                    {((totalExpenses / grossRevenue) * 100).toFixed(1)}%
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-5 bg-black/40 rounded-2xl border border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-lg bg-gray-500"></div>
                  <span className="text-white font-bold">Net Profit</span>
                </div>
                <div className="text-right">
                  <div className="font-black text-white text-xl">
                    ${(netProfit / 1000).toFixed(1)}K
                  </div>
                  <div className="text-xs text-gray-500 font-medium">
                    {((netProfit / grossRevenue) * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sell-Through Scenarios */}
        <div className="lg:col-span-3 bg-gradient-to-br from-[#14171E] to-[#0B0D12] rounded-3xl p-6 border border-gray-800">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-[#8FD3FF]/10 rounded-xl">
              <BarChart3 className="h-6 w-6 text-[#8FD3FF]" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Sell-Through Scenarios</h2>
              <p className="text-xs text-gray-500">Profit at different capacity levels</p>
            </div>
          </div>

          <div className="mb-6 p-4 sm:p-6 bg-black/40 rounded-2xl border border-gray-700 overflow-x-auto">
            <div className="min-w-[600px]">
              <svg viewBox="0 0 600 200" className="w-full" style={{ height: '200px' }}>
                {[0, 25, 50, 75, 100].map((value, i) => (
                  <g key={i}>
                    <line
                      x1="60"
                      y1={165 - (value * 1.3)}
                      x2="580"
                      y2={165 - (value * 1.3)}
                      stroke="#374151"
                      strokeWidth="1"
                      strokeDasharray="4"
                    />
                    <text
                      x="50"
                      y={169 - (value * 1.3)}
                      textAnchor="end"
                      className="text-xs fill-gray-500 font-medium"
                    >
                      {value}%
                    </text>
                  </g>
                ))}

                {scenarios.map((scenario, index) => {
                  const colors = ['#ef4444', '#f59e0b', '#ffffff', '#8FD3FF'];
                  const xPos = 100 + (index * 120);
                  const height = scenario.percentage * 1.3;
                  const yPos = 165 - height;

                  return (
                    <g key={index}>
                      <rect
                        x={xPos}
                        y={yPos}
                        width="80"
                        height={height}
                        fill={colors[index]}
                        opacity={index === 3 ? "1" : "0.7"}
                        rx="12"
                      />
                      <text
                        x={xPos + 40}
                        y="185"
                        textAnchor="middle"
                        className="text-sm fill-white font-black"
                      >
                        {scenario.percentage}%
                      </text>
                      <text
                        x={xPos + 40}
                        y={Math.max(yPos - 8, 20)}
                        textAnchor="middle"
                        className="text-sm fill-white font-black"
                      >
                        ${(scenario.profit / 1000).toFixed(1)}K
                      </text>
                    </g>
                  );
                })}

                <line
                  x1="60"
                  y1={165 - (breakEven.percentage * 1.3)}
                  x2="580"
                  y2={165 - (breakEven.percentage * 1.3)}
                  stroke="#f59e0b"
                  strokeWidth="3"
                  strokeDasharray="10"
                />
                <text
                  x="585"
                  y={169 - (breakEven.percentage * 1.3)}
                  className="text-xs fill-orange-400 font-black"
                >
                  BE
                </text>
              </svg>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {scenarios.map((scenario, i) => {
              const colors = [
                'border-red-500/30 bg-red-500/5',
                'border-orange-500/30 bg-orange-500/5',
                'border-gray-700 bg-black/20',
                'border-[#8FD3FF]/30 bg-[#8FD3FF]/5'
              ];
              const textColors = ['text-red-400', 'text-orange-400', 'text-white', 'text-[#8FD3FF]'];

              return (
                <div key={i} className={`rounded-2xl p-4 border ${colors[i]}`}>
                  <div className="text-xs text-gray-400 mb-2 uppercase tracking-wider font-bold">{scenario.percentage}% SOLD</div>
                  <div className="text-2xl font-black text-white mb-1">{scenario.tickets}</div>
                  <div className={`text-sm font-black ${scenario.isProfit ? textColors[i] : 'text-red-400'}`}>
                    ${(scenario.profit / 1000).toFixed(1)}K
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Capital Required */}
        <div className="lg:col-span-2 bg-gradient-to-br from-[#14171E] to-[#0B0D12] rounded-3xl p-6 border border-gray-800">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-[#8FD3FF]/10 rounded-xl">
              <Wallet className="h-6 w-6 text-[#8FD3FF]" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Capital Required</h2>
              <p className="text-xs text-gray-500">Upfront investment needed</p>
            </div>
          </div>

          <div className="text-center mb-6 py-8 bg-black/40 rounded-2xl border border-[#8FD3FF]/20">
            <div className="text-5xl font-black text-[#8FD3FF] mb-2">
              ${(capital.total / 1000).toFixed(1)}K
            </div>
            <div className="text-sm text-gray-400 uppercase tracking-wider">Total Needed</div>
          </div>

          <div className="space-y-3">
            <div className="bg-[#8FD3FF]/10 border border-[#8FD3FF]/30 rounded-2xl p-4">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-gray-300 font-bold">Artist Deposit</span>
                <span className="font-black text-[#8FD3FF] text-lg">
                  {formatCurrency(capital.artistDeposit)}
                </span>
              </div>
              {offer.deposit_due_date && (
                <div className="text-xs text-gray-500">
                  Due: {new Date(offer.deposit_due_date).toLocaleDateString()}
                </div>
              )}
            </div>

            {capital.venueDeposit > 0 && (
              <div className="bg-black/40 border border-gray-700 rounded-2xl p-4">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-300 font-bold">Venue Deposit</span>
                  <span className="font-black text-white text-lg">
                    {formatCurrency(capital.venueDeposit)}
                  </span>
                </div>
                {offer.venue_deposit_due_date && (
                  <div className="text-xs text-gray-500">
                    Due: {new Date(offer.venue_deposit_due_date).toLocaleDateString()}
                  </div>
                )}
              </div>
            )}

            {capital.marketing > 0 && (
              <div className="bg-black/40 border border-gray-700 rounded-2xl p-4">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-300 font-bold">Marketing Budget</span>
                  <span className="font-black text-white text-lg">
                    {formatCurrency(capital.marketing)}
                  </span>
                </div>
                <div className="text-xs text-gray-500">Ongoing campaign</div>
              </div>
            )}
          </div>
        </div>

        {/* Risk Gauge */}
        <div className="bg-gradient-to-br from-[#14171E] to-[#0B0D12] rounded-3xl p-6 border border-gray-800">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-[#8FD3FF]/10 rounded-xl">
              <AlertCircle className="h-6 w-6 text-[#8FD3FF]" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Risk Gauge</h2>
              <p className="text-xs text-gray-500">Overall deal risk</p>
            </div>
          </div>

          <div className="flex items-center justify-center mb-6">
            <div className="relative w-full max-w-xs">
              <svg viewBox="0 0 200 120" className="w-full" style={{ height: '120px' }}>
                <defs>
                  <linearGradient id="gauge-gradient-green" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#8FD3FF" />
                    <stop offset="100%" stopColor="#6FB8F2" />
                  </linearGradient>
                  <linearGradient id="gauge-gradient-white" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="100%" stopColor="#e5e7eb" />
                  </linearGradient>
                  <linearGradient id="gauge-gradient-yellow" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#fbbf24" />
                    <stop offset="100%" stopColor="#f59e0b" />
                  </linearGradient>
                  <linearGradient id="gauge-gradient-red" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#ef4444" />
                    <stop offset="100%" stopColor="#dc2626" />
                  </linearGradient>
                </defs>

                <path
                  d="M 20 100 A 80 80 0 0 1 180 100"
                  fill="none"
                  stroke="#1f2937"
                  strokeWidth="24"
                  strokeLinecap="round"
                />

                <path
                  d="M 20 100 A 80 80 0 0 1 60 44"
                  fill="none"
                  stroke="url(#gauge-gradient-green)"
                  strokeWidth="24"
                  strokeLinecap="round"
                />
                <path
                  d="M 60 44 A 80 80 0 0 1 100 20"
                  fill="none"
                  stroke="url(#gauge-gradient-white)"
                  strokeWidth="24"
                  strokeLinecap="round"
                />
                <path
                  d="M 100 20 A 80 80 0 0 1 140 44"
                  fill="none"
                  stroke="url(#gauge-gradient-yellow)"
                  strokeWidth="24"
                  strokeLinecap="round"
                />
                <path
                  d="M 140 44 A 80 80 0 0 1 180 100"
                  fill="none"
                  stroke="url(#gauge-gradient-red)"
                  strokeWidth="24"
                  strokeLinecap="round"
                />

                <line
                  x1="100"
                  y1="100"
                  x2={100 + Math.cos(getRiskAngle(riskScore)) * 70}
                  y2={100 + Math.sin(getRiskAngle(riskScore)) * 70}
                  stroke="white"
                  strokeWidth="4"
                  strokeLinecap="round"
                  className="transition-all duration-1000 drop-shadow-[0_0_4px_rgba(255,255,255,0.8)]"
                />
                <circle cx="100" cy="100" r="8" fill="white" />
              </svg>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-4 bg-black/40 rounded-2xl border border-gray-700">
              <div className="text-2xl font-black text-white">
                {((breakEven.buffer / totalSellable) * 100).toFixed(0)}%
              </div>
              <div className="text-xs text-gray-400 mt-1 uppercase tracking-wide font-medium">Buffer</div>
            </div>
            <div className="text-center p-4 bg-black/40 rounded-2xl border border-gray-700">
              <div className="text-2xl font-black text-white">
                {daysUntil}
              </div>
              <div className="text-xs text-gray-400 mt-1 uppercase tracking-wide font-medium">Days</div>
            </div>
            <div className="text-center p-4 bg-black/40 rounded-2xl border border-gray-700">
              <div className={`text-2xl font-black ${
                (capital.marketing / totalExpenses * 100) >= 15 ? 'text-[#8FD3FF]' : 'text-yellow-400'
              }`}>
                {(capital.marketing / totalExpenses * 100).toFixed(0)}%
              </div>
              <div className="text-xs text-gray-400 mt-1 uppercase tracking-wide font-medium">Marketing</div>
            </div>
          </div>
        </div>

        {/* Expense Breakdown */}
        {expenseCategories.length > 0 && (
          <div className="lg:col-span-3 bg-gradient-to-br from-[#14171E] to-[#0B0D12] rounded-3xl p-6 border border-gray-800">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-[#8FD3FF]/10 rounded-xl">
                <BarChart3 className="h-6 w-6 text-[#8FD3FF]" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Expense Breakdown</h2>
                <p className="text-xs text-gray-500">Cost distribution by category</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              {expenseCategories.map((category, index) => {
                const percentage = (category.total / totalExpenses) * 100;

                return (
                  <div key={index} className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-white text-base">{category.title}</span>
                      <span className="font-black text-white text-lg">
                        ${(category.total / 1000).toFixed(1)}K
                      </span>
                    </div>
                    <div className="w-full h-4 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
                      <div
                        className="h-full rounded-full transition-all duration-1000"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: category.color,
                          boxShadow: category.color === '#8FD3FF' ? '0 0 12px rgba(196, 255, 13, 0.5)' : 'none'
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-400 font-medium">
                      <span>{percentage.toFixed(1)}% of total</span>
                      <span>{formatCurrency(category.total)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>

      <div className="max-w-7xl mx-auto mt-8">
        <button
          onClick={() => navigate(`/offers/${id}`)}
          className="w-full bg-[#8FD3FF] hover:bg-[#6FB8F2] text-[#04214D] py-5 rounded-2xl font-black text-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(196,255,13,0.3)] hover:shadow-[0_0_30px_rgba(196,255,13,0.5)]"
        >
          BACK TO OFFER
        </button>
      </div>
    </div>
  );
}
