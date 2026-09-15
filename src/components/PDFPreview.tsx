import { useState } from 'react';
import { PDFMode, PDF_MODES } from '../lib/pdfModes';
import { generateOfferPDF } from '../lib/generateOfferPDF';
import { Offer, CompanySettings } from '../types';
import { X, FileText, Download, Eye, Lock, DollarSign, TrendingUp, AlertCircle } from 'lucide-react';

interface PDFPreviewProps {
  offer: Offer;
  companySettings: CompanySettings | null;
  costsOnly: boolean;
  onClose: () => void;
}

export function PDFPreview({ offer, companySettings, costsOnly, onClose }: PDFPreviewProps) {
  const [selectedMode, setSelectedMode] = useState<PDFMode>('artist_offer');

  const currentMode = PDF_MODES[selectedMode];

  const handleGenerate = () => {
    generateOfferPDF(offer, companySettings || undefined, false, costsOnly, selectedMode);
  };

  const handlePreview = () => {
    generateOfferPDF(offer, companySettings || undefined, true, costsOnly, selectedMode);
  };

  const totalTickets = offer.ticket_tiers.reduce((sum, t) => sum + t.allotment, 0);
  const totalComps = offer.ticket_tiers.reduce((sum, t) => sum + t.comps, 0);
  const totalSellable = totalTickets - totalComps;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="bg-[#1140F0] border border-gray-800 rounded-3xl max-w-6xl w-full max-h-[90vh] overflow-hidden shadow-2xl">

        <div className="bg-[#14171E] border-b border-gray-800 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Generate PDF</h2>
              <p className="text-gray-400">Choose mode and preview before generating</p>
            </div>
            <button
              className="text-gray-400 hover:text-white transition-colors"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex h-[calc(90vh-200px)]">

          <div className="w-80 bg-[#14171E] border-r border-gray-800 p-6 overflow-y-auto">
            <h3 className="text-white font-bold mb-4">Select Mode</h3>

            <div className="space-y-3">
              <label
                className={`block cursor-pointer transition-all ${
                  selectedMode === 'artist_offer' ? 'scale-105' : ''
                }`}
              >
                <input
                  type="radio"
                  name="pdfMode"
                  value="artist_offer"
                  checked={selectedMode === 'artist_offer'}
                  onChange={(e) => setSelectedMode(e.target.value as PDFMode)}
                  className="sr-only"
                />
                <div className={`p-5 rounded-2xl transition-all ${
                  selectedMode === 'artist_offer'
                    ? 'bg-[#8FD3FF]/10 border-2 border-[#8FD3FF]'
                    : 'bg-[#0B0D12] border border-gray-700 hover:border-gray-600'
                }`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 bg-[#8FD3FF]/20 rounded-xl flex items-center justify-center">
                        <FileText className="h-5 w-5 text-[#8FD3FF]" />
                      </div>
                      {selectedMode === 'artist_offer' && (
                        <div className="w-5 h-5 bg-[#8FD3FF] rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-[#04214D]" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                          </svg>
                        </div>
                      )}
                    </div>
                    <span className="bg-[#8FD3FF] text-[#04214D] px-2 py-1 rounded-lg text-xs font-bold">
                      RECOMMENDED
                    </span>
                  </div>

                  <h4 className={`font-bold mb-1 ${
                    selectedMode === 'artist_offer' ? 'text-[#8FD3FF]' : 'text-white'
                  }`}>
                    Artist Offer
                  </h4>
                  <p className="text-gray-400 text-sm mb-4">
                    Clean offer for artist/agent
                  </p>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-green-500">
                      <Eye className="h-3 w-3" />
                      <span>Shows deal structure</span>
                    </div>
                    <div className="flex items-center gap-2 text-green-500">
                      <Eye className="h-3 w-3" />
                      <span>Shows ticket scaling</span>
                    </div>
                    <div className="flex items-center gap-2 text-green-500">
                      <Eye className="h-3 w-3" />
                      <span>Shows artist payment</span>
                    </div>
                    <div className="flex items-center gap-2 text-red-500">
                      <Lock className="h-3 w-3" />
                      <span>Hides YOUR profit</span>
                    </div>
                    <div className="flex items-center gap-2 text-red-500">
                      <Lock className="h-3 w-3" />
                      <span>Hides break-even</span>
                    </div>
                    <div className="flex items-center gap-2 text-red-500">
                      <Lock className="h-3 w-3" />
                      <span>Hides expense details</span>
                    </div>
                  </div>
                </div>
              </label>

              <label
                className={`block cursor-pointer transition-all ${
                  selectedMode === 'estimate' ? 'scale-105' : ''
                }`}
              >
                <input
                  type="radio"
                  name="pdfMode"
                  value="estimate"
                  checked={selectedMode === 'estimate'}
                  onChange={(e) => setSelectedMode(e.target.value as PDFMode)}
                  className="sr-only"
                />
                <div className={`p-5 rounded-2xl transition-all ${
                  selectedMode === 'estimate'
                    ? 'bg-blue-500/10 border-2 border-blue-500'
                    : 'bg-[#0B0D12] border border-gray-700 hover:border-gray-600'
                }`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                        <DollarSign className="h-5 w-5 text-blue-500" />
                      </div>
                      {selectedMode === 'estimate' && (
                        <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                          </svg>
                        </div>
                      )}
                    </div>
                    <span className="bg-gray-700 text-gray-300 px-2 py-1 rounded-lg text-xs font-bold">
                      INTERNAL
                    </span>
                  </div>

                  <h4 className={`font-bold mb-1 ${
                    selectedMode === 'estimate' ? 'text-blue-500' : 'text-white'
                  }`}>
                    Estimate (Internal)
                  </h4>
                  <p className="text-gray-400 text-sm mb-4">
                    Full financial breakdown
                  </p>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-green-500">
                      <Eye className="h-3 w-3" />
                      <span>Shows everything</span>
                    </div>
                    <div className="flex items-center gap-2 text-green-500">
                      <TrendingUp className="h-3 w-3" />
                      <span>Shows YOUR profit</span>
                    </div>
                    <div className="flex items-center gap-2 text-green-500">
                      <TrendingUp className="h-3 w-3" />
                      <span>Shows break-even</span>
                    </div>
                    <div className="flex items-center gap-2 text-green-500">
                      <TrendingUp className="h-3 w-3" />
                      <span>Shows expense details</span>
                    </div>
                    <div className="flex items-center gap-2 text-green-500">
                      <TrendingUp className="h-3 w-3" />
                      <span>Shows margins</span>
                    </div>
                  </div>
                </div>
              </label>
            </div>

            {selectedMode === 'estimate' && (
              <div className="mt-6 p-4 bg-orange-500/10 border border-orange-500/30 rounded-2xl">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-orange-500 font-semibold text-sm mb-1">
                      Internal Use Only
                    </p>
                    <p className="text-gray-400 text-xs">
                      This shows your profit and break-even. Do not send to artists or agents.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {selectedMode === 'artist_offer' && (
              <div className="mt-6 p-4 bg-[#8FD3FF]/10 border border-[#8FD3FF]/30 rounded-2xl">
                <div className="flex items-start gap-3">
                  <svg className="h-5 w-5 text-[#8FD3FF] mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                  </svg>
                  <div>
                    <p className="text-[#8FD3FF] font-semibold text-sm mb-1">
                      Artist-Friendly
                    </p>
                    <p className="text-gray-400 text-xs">
                      Clean, professional offer without revealing your internal margins.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 bg-black p-6 overflow-y-auto">
            <div className="max-w-3xl mx-auto">

              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-[#8FD3FF]"></div>
                  <h3 className="text-white font-bold">Preview</h3>
                </div>
                <span className={`px-3 py-1 rounded-lg text-xs font-bold ${
                  selectedMode === 'artist_offer'
                    ? 'bg-[#8FD3FF]/20 text-[#8FD3FF]'
                    : 'bg-blue-500/20 text-blue-500'
                }`}>
                  {currentMode.name}
                </span>
              </div>

              <div className="bg-white border-4 border-gray-800 rounded-2xl p-8 shadow-2xl">

                <div className="bg-black rounded-xl p-6 mb-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-3xl font-bold text-white mb-2">
                        {offer.event_name || offer.artist}
                      </h2>
                      <p className="text-gray-400">{offer.venue_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-400 text-sm">Date</p>
                      <p className="text-white font-bold">{offer.event_date}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <p className="text-gray-600 text-xs mb-1">DEAL TYPE</p>
                    <p className="text-[#04214D] font-bold text-sm">
                      {offer.deal_type === 'flat_guarantee'
                        ? 'Flat Fee'
                        : `${offer.artist_backend_pct || 85}/${offer.promoter_backend_pct || 15} Split`
                      }
                    </p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <p className="text-gray-600 text-xs mb-1">GUARANTEE</p>
                    <p className="text-[#04214D] font-bold">${offer.guarantee.toLocaleString()}</p>
                  </div>
                  <div className={`p-4 rounded-xl border-2 ${
                    selectedMode === 'artist_offer'
                      ? 'bg-green-50 border-green-300'
                      : 'bg-gray-50 border-gray-200'
                  }`}>
                    <p className="text-gray-600 text-xs mb-1">ARTIST GETS</p>
                    <p className="text-green-600 font-bold text-lg">
                      ${offer.calculations.artistTotalPayout.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="mb-6">
                  <h3 className="text-[#04214D] font-bold mb-3 text-sm">TICKET SCALING</h3>
                  <div className="overflow-hidden rounded-xl border border-gray-200">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-black text-white text-xs">
                          <th className="text-left p-3">Type</th>
                          <th className="text-left p-3">Qty</th>
                          <th className="text-left p-3">Price</th>
                          {currentMode.showBreakEven && (
                            <th className="text-left p-3">Break Even</th>
                          )}
                          <th className="text-right p-3">Gross</th>
                        </tr>
                      </thead>
                      <tbody>
                        {offer.ticket_tiers.map((tier, i) => (
                          <tr key={i} className="border-b border-gray-200 text-sm">
                            <td className="p-3 text-[#04214D]">{tier.type}</td>
                            <td className="p-3 text-gray-600">{tier.allotment - tier.comps}</td>
                            <td className="p-3 text-gray-600">${tier.price}</td>
                            {currentMode.showBreakEven && (
                              <td className="p-3 text-blue-600 font-semibold">
                                {Math.ceil(totalSellable * 0.7)}
                              </td>
                            )}
                            <td className="p-3 text-right text-[#04214D] font-semibold">
                              ${((tier.allotment - tier.comps) * tier.price).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <h4 className="text-[#04214D] font-bold mb-3 text-sm">REVENUE</h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Gross</span>
                        <span className="text-[#04214D] font-semibold">
                          ${offer.calculations.grossPotential.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Tax</span>
                        <span className="text-orange-600">
                          -${offer.calculations.salesTax.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-gray-300">
                        <span className="text-[#04214D] font-bold">Net Revenue</span>
                        <span className="text-[#04214D] font-bold">
                          ${offer.calculations.netGross.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {currentMode.showProfit ? (
                    <div className="p-4 bg-green-50 rounded-xl border-2 border-green-300">
                      <h4 className="text-[#04214D] font-bold mb-3 text-sm">EXPENSES & PROFIT</h4>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Expenses</span>
                          <span className="text-orange-600">
                            ${offer.calculations.totalExpenses.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Artist</span>
                          <span className="text-orange-600">
                            ${offer.calculations.artistTotalPayout.toLocaleString()}
                          </span>
                        </div>
                        <div className="h-px bg-green-400 my-2"></div>
                        <div className="flex justify-between">
                          <span className="text-green-700 font-bold">YOUR PROFIT</span>
                          <span className="text-green-600 font-bold text-base">
                            ${offer.calculations.netProfit.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-green-50 rounded-xl border-2 border-green-300">
                      <h4 className="text-[#04214D] font-bold mb-3 text-sm">ARTIST PAYMENT</h4>
                      <div className="space-y-3">
                        <div>
                          <p className="text-gray-600 text-xs mb-1">Deal Structure</p>
                          <p className="text-[#04214D] font-semibold text-sm">
                            {offer.deal_type === 'flat_guarantee'
                              ? 'Flat Fee Guarantee'
                              : `${offer.artist_backend_pct || 85}/${offer.promoter_backend_pct || 15} Profit Split`
                            }
                          </p>
                        </div>
                        {offer.deal_type === 'promoter_profit' && offer.calculations.profitPool ? (
                          <>
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-600">Guarantee (Base)</span>
                              <span className="text-[#04214D] font-semibold">
                                ${offer.guarantee.toLocaleString()}
                              </span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-600">
                                + Profit Share ({offer.artist_backend_pct || 85}%)
                              </span>
                              <span className="text-green-600 font-semibold">
                                ${(offer.calculations.artistBackend || 0).toLocaleString()}
                              </span>
                            </div>
                            <div className="pt-2 border-t border-green-300">
                              <div className="flex justify-between">
                                <span className="text-[#04214D] font-bold text-xs">Total Amount</span>
                                <span className="text-green-600 font-bold text-lg">
                                  ${offer.calculations.artistTotalPayout.toLocaleString()}
                                </span>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div>
                            <p className="text-gray-600 text-xs mb-1">Amount</p>
                            <p className="text-green-600 font-bold text-xl">
                              ${offer.calculations.artistTotalPayout.toLocaleString()}
                            </p>
                          </div>
                        )}
                        <div className="pt-3 border-t border-green-200">
                          <p className="text-gray-600 text-xs">Payment due at event settlement</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-gray-100 rounded-xl">
                  <h4 className="text-[#04214D] font-bold mb-2 text-sm">SHOW DETAILS</h4>
                  <div className="text-xs text-gray-600 space-y-1">
                    <p>Doors: {offer.doors_time} • Show: {offer.show_time} • Curfew: {offer.curfew_time}</p>
                    <p>Age: {offer.age_limit} • Merch: {offer.merch_rate_soft}% Artist • Comps: {totalComps}</p>
                  </div>
                </div>

                {currentMode.watermark && (
                  <div className="mt-6 text-center">
                    <p className="text-gray-400 text-xs font-bold tracking-wider">
                      {currentMode.watermark}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#14171E] border-t border-gray-800 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-semibold">Ready to generate?</p>
              <p className="text-gray-400 text-sm">
                {selectedMode === 'artist_offer'
                  ? 'Clean offer without your profit margins'
                  : 'Full financial breakdown for internal use'
                }
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                className="text-gray-400 hover:text-white transition-colors rounded-2xl px-6 py-2"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                className="bg-gray-700 hover:bg-gray-600 text-white transition-colors rounded-2xl px-6 py-2 font-semibold"
                onClick={handlePreview}
              >
                <Eye className="h-4 w-4 inline mr-2" />
                Preview
              </button>
              <button
                className={`${
                  selectedMode === 'artist_offer'
                    ? 'bg-[#8FD3FF] hover:bg-[#6FB8F2]'
                    : 'bg-blue-500 hover:bg-blue-600'
                } text-[#04214D] transition-colors rounded-2xl px-8 py-2 font-bold`}
                onClick={handleGenerate}
              >
                <Download className="h-4 w-4 inline mr-2" />
                Download PDF
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
