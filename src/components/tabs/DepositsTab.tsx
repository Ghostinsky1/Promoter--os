import { Calendar, MapPin, DollarSign } from 'lucide-react';
import { calculateDepositDueDate, getDaysUntil, formatDate } from '../../lib/dateHelpers';

interface DepositsTabProps {
  guarantee: number;
  taxWithholdingPct: number;
  setTaxWithholdingPct: (value: number) => void;
  depositPct: number;
  setDepositPct: (value: number) => void;
  depositDueTiming: string;
  setDepositDueTiming: (value: string) => void;
  customDepositDate: string;
  setCustomDepositDate: (value: string) => void;
  artistDepositStatus: string;
  setArtistDepositStatus: (value: string) => void;
  balanceDueTiming: string;
  setBalanceDueTiming: (value: string) => void;
  customBalanceDueDate: string;
  setCustomBalanceDueDate: (value: string) => void;
  venueDeposit: number;
  setVenueDeposit: (value: number) => void;
  venueDepositDueDate: string;
  setVenueDepositDueDate: (value: string) => void;
  venueDepositStatus: string;
  setVenueDepositStatus: (value: string) => void;
  eventDate: string;
}

export function DepositsTab(props: DepositsTabProps) {
  const {
    guarantee,
    taxWithholdingPct,
    setTaxWithholdingPct,
    depositPct,
    setDepositPct,
    depositDueTiming,
    setDepositDueTiming,
    customDepositDate,
    setCustomDepositDate,
    artistDepositStatus,
    setArtistDepositStatus,
    balanceDueTiming,
    setBalanceDueTiming,
    customBalanceDueDate,
    setCustomBalanceDueDate,
    venueDeposit,
    setVenueDeposit,
    venueDepositDueDate,
    setVenueDepositDueDate,
    venueDepositStatus,
    setVenueDepositStatus,
    eventDate
  } = props;

  const calculatedArtistDepositDueDate = calculateDepositDueDate(eventDate, depositDueTiming, customDepositDate);
  const calculatedBalanceDueDate = calculateDepositDueDate(eventDate, balanceDueTiming, customBalanceDueDate);
  const artistDepositAmount = (guarantee * depositPct) / 100;
  const balanceAmount = guarantee - artistDepositAmount;
  const taxWithholdingAmount = (guarantee * taxWithholdingPct) / 100;
  const totalPayout = guarantee - taxWithholdingAmount;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-3xl font-bold text-white mb-3">Deposit Information</h3>
        <p className="text-gray-400 mb-8">Manage artist and venue deposit details</p>
      </div>

      {/* Tax Withholding Section */}
      <div className="bg-[#0B0D12] border border-gray-700 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center">
            <DollarSign className="h-5 w-5 text-red-500" />
          </div>
          <h4 className="text-xl font-bold text-white">Tax Withholding</h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Tax Withholding %</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={taxWithholdingPct}
                onChange={(e) => {
                  const val = e.target.value === '' ? 0 : Number(e.target.value);
                  setTaxWithholdingPct(isNaN(val) ? 0 : val);
                }}
                placeholder="2"
                step="0.1"
                className="flex-1 py-3 px-4 bg-[#14171E] border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-[#8FD3FF] focus:border-[#8FD3FF]"
              />
              <span className="text-gray-400 text-lg font-medium">%</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Withholding Amount</label>
            <div className="text-3xl font-bold text-red-400 py-3">
              -${taxWithholdingAmount.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Artist Deposit Card */}
      <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-2 border-blue-500/30 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
            <Calendar className="h-5 w-5 text-blue-400" />
          </div>
          <h4 className="text-xl font-bold text-white">Artist Deposit</h4>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Deposit Percentage</label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={depositPct}
                  onChange={(e) => {
                    const val = e.target.value === '' ? 0 : Number(e.target.value);
                    setDepositPct(isNaN(val) ? 0 : val);
                  }}
                  placeholder="20"
                  className="w-full text-center text-lg font-bold py-3 px-4 bg-[#14171E] border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <span className="text-gray-400 text-lg font-medium">%</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Deposit Amount</label>
              <div className="text-2xl font-bold text-blue-400 py-3">
                ${artistDepositAmount.toLocaleString()}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Payment Status</label>
              <select
                value={artistDepositStatus}
                onChange={(e) => setArtistDepositStatus(e.target.value)}
                className="w-full py-3 px-4 bg-[#14171E] border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="pending" className="bg-[#14171E]">⏳ Pending</option>
                <option value="paid" className="bg-[#14171E]">✅ Paid</option>
                <option value="overdue" className="bg-[#14171E]">⚠️ Overdue</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-3 text-red-400">
              Due Date * (Required)
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <select
                value={depositDueTiming}
                onChange={(e) => setDepositDueTiming(e.target.value)}
                className="w-full py-3 px-4 bg-[#14171E] border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="30_days_before" className="bg-[#14171E]">30 days before show</option>
                <option value="60_days_before" className="bg-[#14171E]">60 days before show</option>
                <option value="upon_signing" className="bg-[#14171E]">Upon contract signing</option>
                <option value="custom" className="bg-[#14171E]">Custom date</option>
              </select>

              {depositDueTiming === 'custom' && (
                <input
                  type="date"
                  value={customDepositDate}
                  onChange={(e) => setCustomDepositDate(e.target.value)}
                  className="w-full py-3 px-4 bg-[#14171E] border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              )}
            </div>

            {calculatedArtistDepositDueDate && (
              <div className="mt-4 p-4 bg-[#14171E] border border-blue-500/30 rounded-xl flex items-start gap-3">
                <Calendar className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <span className="font-semibold text-gray-300">Due date: </span>
                  <span className="text-blue-400 font-bold text-base">
                    {formatDate(calculatedArtistDepositDueDate)}
                  </span>
                  <span className="text-gray-400"> ({getDaysUntil(calculatedArtistDepositDueDate)})</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Balance Payment Card */}
      <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-2 border-green-500/30 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
            <DollarSign className="h-5 w-5 text-green-400" />
          </div>
          <h4 className="text-xl font-bold text-white">Balance Payment</h4>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Balance Amount</label>
              <div className="text-2xl font-bold text-green-400 py-3">
                ${balanceAmount.toLocaleString()}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Balance Percentage</label>
              <div className="text-2xl font-bold text-green-400 py-3">
                {(100 - depositPct).toFixed(0)}%
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-3 text-red-400">
              Due Date * (Required)
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <select
                value={balanceDueTiming}
                onChange={(e) => setBalanceDueTiming(e.target.value)}
                className="w-full py-3 px-4 bg-[#14171E] border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                <option value="at_settlement" className="bg-[#14171E]">At Event Settlement</option>
                <option value="5_days_before" className="bg-[#14171E]">5 days before show</option>
                <option value="30_days_before" className="bg-[#14171E]">30 days before show</option>
                <option value="60_days_before" className="bg-[#14171E]">60 days before show</option>
                <option value="upon_signing" className="bg-[#14171E]">Upon contract signing</option>
                <option value="custom" className="bg-[#14171E]">Custom date</option>
              </select>

              {balanceDueTiming === 'custom' && (
                <input
                  type="date"
                  value={customBalanceDueDate}
                  onChange={(e) => setCustomBalanceDueDate(e.target.value)}
                  className="w-full py-3 px-4 bg-[#14171E] border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              )}
            </div>

            {calculatedBalanceDueDate && (
              <div className="mt-4 p-4 bg-[#14171E] border border-green-500/30 rounded-xl flex items-start gap-3">
                <Calendar className="h-5 w-5 text-green-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <span className="font-semibold text-gray-300">Due date: </span>
                  <span className="text-green-400 font-bold text-base">
                    {formatDate(calculatedBalanceDueDate)}
                  </span>
                  <span className="text-gray-400"> ({getDaysUntil(calculatedBalanceDueDate)})</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Venue Deposit Card */}
      <div className="bg-gradient-to-br from-orange-500/10 to-yellow-500/10 border-2 border-orange-500/30 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
            <MapPin className="h-5 w-5 text-orange-400" />
          </div>
          <h4 className="text-xl font-bold text-white">Venue Deposit</h4>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Deposit Amount</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg">$</span>
                <input
                  type="number"
                  value={venueDeposit}
                  onChange={(e) => {
                    const val = e.target.value === '' ? 0 : Number(e.target.value);
                    setVenueDeposit(isNaN(val) ? 0 : val);
                  }}
                  placeholder="5000"
                  className="w-full text-lg font-bold py-3 pl-9 pr-4 bg-[#14171E] border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2 text-red-400">
                Due Date * (Required)
              </label>
              <input
                type="date"
                value={venueDepositDueDate}
                onChange={(e) => setVenueDepositDueDate(e.target.value)}
                className="w-full py-3 px-4 bg-[#14171E] border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Payment Status</label>
              <select
                value={venueDepositStatus}
                onChange={(e) => setVenueDepositStatus(e.target.value)}
                className="w-full py-3 px-4 bg-[#14171E] border border-gray-600 text-white rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="pending" className="bg-[#14171E]">⏳ Pending</option>
                <option value="paid" className="bg-[#14171E]">✅ Paid</option>
                <option value="overdue" className="bg-[#14171E]">⚠️ Overdue</option>
              </select>
            </div>
          </div>

          {venueDepositDueDate && (
            <div className="p-4 bg-[#14171E] border border-orange-500/30 rounded-xl flex items-start gap-3">
              <Calendar className="h-5 w-5 text-orange-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <span className="font-semibold text-gray-300">Due date: </span>
                <span className="text-orange-400 font-bold text-base">
                  {formatDate(venueDepositDueDate)}
                </span>
                <span className="text-gray-400"> ({getDaysUntil(venueDepositDueDate)})</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Total Payout Summary */}
      <div className="bg-gradient-to-r from-[#8FD3FF]/10 to-green-500/10 border-2 border-[#8FD3FF]/30 rounded-2xl p-6">
        <div className="flex justify-between items-center">
          <div>
            <div className="text-sm text-gray-400 mb-1">Total Artist Payout</div>
            <div className="text-xs text-gray-500">After tax withholding</div>
          </div>
          <div className="text-4xl font-bold text-[#8FD3FF]">
            ${totalPayout.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}
