import React from 'react';
import { STRIPE_PRODUCTS } from '../stripe-config';
import { ProductCard } from '../components/subscription/ProductCard';
import { SubscriptionCard } from '../components/subscription/SubscriptionCard';
import { CreditCard, Crown, Check, Music, Calendar, DollarSign, TrendingUp } from 'lucide-react';

export function SubscriptionPage() {
  return (
    <div className="min-h-screen bg-[#0F1113]">
      <div className="bg-[#1A1F1E] border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <div className="w-20 h-20 bg-[#C4FF0D] rounded-2xl flex items-center justify-center mx-auto mb-6">
            <CreditCard className="h-10 w-10 text-black" />
          </div>
          <h1 className="text-4xl font-bold mb-3 text-white">Subscription Plans</h1>
          <p className="text-xl text-gray-400">
            Choose the plan that works best for your concert promotion needs
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6 text-white">Current Subscription</h2>
          <SubscriptionCard />
        </div>

        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6 text-white">Available Plans</h2>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {STRIPE_PRODUCTS.map((product, index) => {
              const isPopular = index === 0;

              return (
                <div
                  key={product.id}
                  className={`bg-[#1A1F1E] rounded-3xl p-8 transition-all ${
                    isPopular
                      ? 'border-4 border-[#C4FF0D] shadow-2xl shadow-[#C4FF0D]/20 relative'
                      : 'border-2 border-gray-800 hover:shadow-2xl hover:border-gray-700'
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-[#C4FF0D] text-black px-4 py-1 text-sm font-bold rounded-full">
                      RECOMMENDED
                    </div>
                  )}

                  <div className="text-center mb-6">
                    <h3 className="text-2xl font-bold mb-2 text-white">{product.name}</h3>
                    <div className={`text-5xl font-bold mb-2 ${isPopular ? 'text-[#C4FF0D]' : 'text-white'}`}>
                      ${product.price}
                    </div>
                    <div className="text-gray-400">per month</div>
                  </div>

                  <div className="space-y-4 mb-8">
                    {product.description?.split('\n').map((feature, idx) => (
                      <div key={idx} className="flex items-start gap-3">
                        <Check className="h-5 w-5 text-[#C4FF0D] flex-shrink-0 mt-0.5" />
                        <span className={`text-sm ${isPopular ? 'font-semibold text-white' : 'text-gray-300'}`}>
                          {feature.replace(/^[•-]\s*/, '')}
                        </span>
                      </div>
                    ))}
                  </div>

                  <ProductCard product={product} />
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-gradient-to-r from-[#1A1F1E] to-[#252A2E] border border-gray-800 rounded-3xl p-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="text-2xl font-bold mb-4 text-white">Offer Generator</h3>
              <p className="text-gray-300 mb-6">
                Generate professional concert offers with detailed financial projections
                and settlement tracking.
              </p>
              <ul className="space-y-2 text-gray-300">
                <li>• Professional PDF generation</li>
                <li>• Multiple ticket tiers</li>
                <li>• Expense tracking</li>
                <li>• Real-time profit calculations</li>
              </ul>
            </div>
            <div className="bg-[#141716] border border-gray-800 rounded-xl p-4 sm:p-6">
              <div className="bg-[#1A1F1E] rounded-lg border border-gray-700 p-4 sm:p-6">
                <div className="flex items-start justify-between mb-4 pb-4 border-b border-gray-700">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#C4FF0D]/10 rounded-lg flex items-center justify-center">
                      <Music className="h-5 w-5 text-[#C4FF0D]" />
                    </div>
                    <div>
                      <h4 className="text-white font-bold text-sm">Artist Name - Tour 2025</h4>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Calendar className="h-3 w-3" />
                        <span>Venue Name</span>
                      </div>
                    </div>
                  </div>
                  <div className="px-2 py-1 bg-[#C4FF0D]/10 rounded text-[10px] font-semibold text-[#C4FF0D]">
                    DRAFT
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="bg-[#252A2E] rounded-lg p-3 border border-gray-700">
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div>
                        <p className="text-[10px] text-gray-400 mb-1">Deal Type</p>
                        <p className="text-xs font-semibold text-white">Guarantee vs %</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 mb-1">Capacity</p>
                        <p className="text-xs font-semibold text-white">2,000</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 mb-1">Avg Ticket</p>
                        <p className="text-xs font-semibold text-white">$50.00</p>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-gray-700">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-gray-400">Projected Revenue</span>
                        <span className="text-xs font-semibold text-white">$100,000</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-gray-400">Total Expenses</span>
                        <span className="text-xs font-semibold text-white">$72,500</span>
                      </div>
                      <div className="h-px bg-gray-700 my-1"></div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-white">Net Profit</span>
                        <div className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3 text-[#C4FF0D]" />
                          <span className="text-sm font-bold text-[#C4FF0D]">$27,500</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-[#C4FF0D]/10 to-[#C4FF0D]/5 rounded-lg p-3 border border-[#C4FF0D]/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-[#C4FF0D] font-semibold mb-1">PROFIT MARGIN</p>
                        <p className="text-xl font-bold text-[#C4FF0D]">27.5%</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-gray-400 mb-1">Break-even</p>
                        <p className="text-sm font-semibold text-white">72.5%</p>
                      </div>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-1.5 mt-2">
                      <div className="bg-[#C4FF0D] h-1.5 rounded-full" style={{ width: '72%' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
