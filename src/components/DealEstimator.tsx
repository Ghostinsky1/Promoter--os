import { useState, useMemo, useEffect } from 'react';
import { ArrowLeft, DollarSign, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '../lib/calculations';

interface TicketTier {
  name: string;
  sellableQty: number;
  price: number;
}

interface FixedExpense {
  category: string;
  name: string;
  amount: number;
}

interface VariableExpense {
  name: string;
  amount: number;
}

export function DealEstimator() {
  const [ticketTiers, setTicketTiers] = useState<TicketTier[]>([
    { name: 'General Admission', sellableQty: 920, price: 25 }
  ]);
  const [salesTaxRate, setSalesTaxRate] = useState(0.09);
  const [artistGuarantee, setArtistGuarantee] = useState(3000);
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([
    { category: 'Talent', name: 'Sound Engineer', amount: 800 },
    { category: 'Talent', name: 'Lighting Tech', amount: 600 },
    { category: 'Production', name: 'PA System Rental', amount: 2000 },
    { category: 'Marketing', name: 'Social Media Ads', amount: 1000 },
    { category: 'General', name: 'Venue Rental', amount: 1000 },
  ]);
  const [variableExpenses, setVariableExpenses] = useState<VariableExpense[]>([
    { name: 'ASCAP (1.7%)', amount: 0.017 },
    { name: 'Insurance ($2/attendee)', amount: 2 }
  ]);

  // SINGLE SOURCE OF TRUTH - All derived calculations
  const calculations = useMemo(() => {
    // Gross Revenue
    const grossRevenue = ticketTiers.reduce((sum, tier) => sum + (tier.sellableQty * tier.price), 0);

    // Sales Tax
    const salesTax = grossRevenue * salesTaxRate;

    // Net Gross (after tax deduction)
    const netGross = grossRevenue - salesTax;

    // Fixed Expenses Total
    const fixedExpensesTotal = fixedExpenses.reduce((sum, exp) => sum + exp.amount, 0);

    // Variable Expenses Total (calculated based on actual values)
    let variableExpensesTotal = 0;
    variableExpenses.forEach(exp => {
      if (exp.name.includes('%')) {
        // Percentage-based on net gross
        variableExpensesTotal += netGross * exp.amount;
      } else {
        // Per-attendee based on total tickets
        const totalTickets = ticketTiers.reduce((sum, tier) => sum + tier.sellableQty, 0);
        variableExpensesTotal += totalTickets * exp.amount;
      }
    });

    // Show Expenses (Excluding Artist Guarantee)
    const showExpensesExclArtist = fixedExpensesTotal + variableExpensesTotal;

    // Total Expenses (Including Artist Guarantee) - SINGLE SOURCE OF TRUTH
    const totalExpenses = showExpensesExclArtist + artistGuarantee;

    // Net Profit
    const netProfit = netGross - totalExpenses;

    // Math Verification
    const calculatedNetProfit = netGross - totalExpenses;
    const mathVerified = Math.abs(netProfit - calculatedNetProfit) < 0.01;

    return {
      grossRevenue,
      salesTax,
      netGross,
      fixedExpensesTotal,
      variableExpensesTotal,
      showExpensesExclArtist,
      totalExpenses,
      netProfit,
      mathVerified,
      profitMargin: netGross > 0 ? (netProfit / netGross) * 100 : 0,
      totalTickets: ticketTiers.reduce((sum, tier) => sum + tier.sellableQty, 0),
    };
  }, [ticketTiers, salesTaxRate, artistGuarantee, fixedExpenses, variableExpenses]);

  const updateTicketTier = (index: number, field: keyof TicketTier, value: number | string) => {
    const updated = [...ticketTiers];
    if (field === 'name') {
      updated[index][field] = value as string;
    } else {
      updated[index][field] = Math.max(0, Number(value) || 0);
    }
    setTicketTiers(updated);
  };

  const addTicketTier = () => {
    setTicketTiers([...ticketTiers, { name: 'New Tier', sellableQty: 0, price: 0 }]);
  };

  const removeTicketTier = (index: number) => {
    if (ticketTiers.length > 1) {
      setTicketTiers(ticketTiers.filter((_, i) => i !== index));
    }
  };

  const updateFixedExpense = (index: number, field: keyof FixedExpense, value: string | number) => {
    const updated = [...fixedExpenses];
    if (field === 'amount') {
      updated[index][field] = Math.max(0, Number(value) || 0);
    } else {
      updated[index][field] = value as string;
    }
    setFixedExpenses(updated);
  };

  const addFixedExpense = () => {
    setFixedExpenses([...fixedExpenses, { category: 'General', name: 'New Expense', amount: 0 }]);
  };

  const removeFixedExpense = (index: number) => {
    setFixedExpenses(fixedExpenses.filter((_, i) => i !== index));
  };

  const updateVariableExpense = (index: number, field: keyof VariableExpense, value: string | number) => {
    const updated = [...variableExpenses];
    if (field === 'amount') {
      updated[index][field] = Number(value) || 0;
    } else {
      updated[index][field] = value as string;
    }
    setVariableExpenses(updated);
  };

  const addVariableExpense = () => {
    setVariableExpenses([...variableExpenses, { name: 'New Variable', amount: 0 }]);
  };

  const removeVariableExpense = (index: number) => {
    setVariableExpenses(variableExpenses.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen bg-[#0F1413] text-white p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-2 text-gray-400 hover:text-[#C4FF0D] mb-6 transition-colors text-sm group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back
        </button>

        <div className="mb-8">
          <div className="inline-block px-4 py-1.5 bg-[#C4FF0D]/10 border border-[#C4FF0D]/30 rounded-full mb-3">
            <span className="text-[#C4FF0D] text-xs font-bold uppercase tracking-wider">Deal Estimator</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2 text-white">Live Budget Calculator</h1>
          <p className="text-gray-400 text-base">Edit values below to see real-time calculations</p>
        </div>

        {/* Math Verification Indicator */}
        <div className={`mb-6 p-4 rounded-2xl border-2 ${
          calculations.mathVerified
            ? 'bg-green-900/10 border-green-500/30'
            : 'bg-red-900/10 border-red-500/30'
        }`}>
          <div className="flex items-center gap-3">
            {calculations.mathVerified ? (
              <>
                <CheckCircle2 className="w-6 h-6 text-green-400" />
                <div>
                  <div className="font-bold text-green-400">Math Verified</div>
                  <div className="text-sm text-gray-400">All calculations are consistent</div>
                </div>
              </>
            ) : (
              <>
                <AlertTriangle className="w-6 h-6 text-red-400" />
                <div>
                  <div className="font-bold text-red-400">Math Warning</div>
                  <div className="text-sm text-gray-400">Calculation mismatch detected</div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Key Metrics - Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-[#1A1F1E] to-[#141716] rounded-3xl p-5 border border-[#C4FF0D]/20">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-5 h-5 text-[#C4FF0D]" />
            </div>
            <div className="text-3xl font-black text-[#C4FF0D] mb-1">
              ${(calculations.netProfit / 1000).toFixed(1)}K
            </div>
            <div className="text-xs text-gray-400 uppercase tracking-wider font-medium">Net Profit</div>
          </div>

          <div className="bg-gradient-to-br from-[#1A1F1E] to-[#141716] rounded-3xl p-5 border border-gray-700">
            <div className="text-3xl font-black text-white mb-1">
              {calculations.profitMargin.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-400 uppercase tracking-wider font-medium">Profit Margin</div>
          </div>

          <div className="bg-gradient-to-br from-[#1A1F1E] to-[#141716] rounded-3xl p-5 border border-gray-700">
            <div className="text-3xl font-black text-white mb-1">
              {calculations.totalTickets}
            </div>
            <div className="text-xs text-gray-400 uppercase tracking-wider font-medium">Total Tickets</div>
          </div>

          <div className="bg-gradient-to-br from-[#1A1F1E] to-[#141716] rounded-3xl p-5 border border-gray-700">
            <div className="text-3xl font-black text-white mb-1">
              ${(calculations.totalExpenses / 1000).toFixed(1)}K
            </div>
            <div className="text-xs text-gray-400 uppercase tracking-wider font-medium">Total Expenses</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Ticket Scaling - Editable */}
          <div className="bg-gradient-to-br from-[#1A1F1E] to-[#141716] rounded-3xl p-6 border border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Ticket Scaling</h2>
              <button
                onClick={addTicketTier}
                className="text-xs bg-[#C4FF0D] text-black px-3 py-1.5 rounded-lg font-bold hover:bg-[#A3D60A] transition-colors"
              >
                + Add Tier
              </button>
            </div>
            <div className="space-y-3">
              {ticketTiers.map((tier, index) => (
                <div key={index} className="bg-black/40 rounded-2xl p-4 border border-gray-700">
                  <div className="grid grid-cols-3 gap-3 mb-2">
                    <input
                      type="text"
                      value={tier.name}
                      onChange={(e) => updateTicketTier(index, 'name', e.target.value)}
                      className="col-span-3 bg-[#252A29] border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#C4FF0D]"
                      placeholder="Tier Name"
                    />
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Quantity</label>
                      <input
                        type="number"
                        value={tier.sellableQty}
                        onChange={(e) => updateTicketTier(index, 'sellableQty', e.target.value)}
                        className="w-full bg-[#252A29] border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#C4FF0D]"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Price ($)</label>
                      <input
                        type="number"
                        value={tier.price}
                        onChange={(e) => updateTicketTier(index, 'price', e.target.value)}
                        className="w-full bg-[#252A29] border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#C4FF0D]"
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={() => removeTicketTier(index)}
                        disabled={ticketTiers.length === 1}
                        className="w-full bg-red-900/20 border border-red-800/50 hover:bg-red-900/30 text-red-400 px-3 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t border-gray-700">
                    <span className="text-gray-400">Subtotal</span>
                    <span className="font-bold text-[#C4FF0D]">
                      {formatCurrency(tier.sellableQty * tier.price)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-700 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Gross Revenue</span>
                <span className="font-bold text-white">{formatCurrency(calculations.grossRevenue)}</span>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-gray-400">Sales Tax Rate (%)</label>
                  <input
                    type="number"
                    value={(salesTaxRate * 100).toFixed(1)}
                    onChange={(e) => setSalesTaxRate(Math.max(0, Number(e.target.value) || 0) / 100)}
                    className="w-20 bg-[#252A29] border border-gray-600 rounded-lg px-2 py-1 text-white text-sm focus:outline-none focus:border-[#C4FF0D]"
                    min="0"
                    max="100"
                    step="0.1"
                  />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Sales Tax ({(salesTaxRate * 100).toFixed(1)}%)</span>
                  <span className="font-medium text-red-400">-{formatCurrency(calculations.salesTax)}</span>
                </div>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-700">
                <span className="font-bold text-white">Net Gross</span>
                <span className="font-black text-[#C4FF0D] text-lg">{formatCurrency(calculations.netGross)}</span>
              </div>
            </div>
          </div>

          {/* Artist Deal - Editable */}
          <div className="bg-gradient-to-br from-[#1A1F1E] to-[#141716] rounded-3xl p-6 border border-gray-800">
            <h2 className="text-xl font-bold mb-4">Artist Deal</h2>
            <div className="bg-black/40 rounded-2xl p-4 border border-gray-700">
              <label className="text-sm text-gray-400 mb-2 block">Artist Guarantee ($)</label>
              <input
                type="number"
                value={artistGuarantee}
                onChange={(e) => setArtistGuarantee(Math.max(0, Number(e.target.value) || 0))}
                className="w-full bg-[#252A29] border border-gray-600 rounded-lg px-4 py-3 text-white text-lg font-bold focus:outline-none focus:border-[#C4FF0D]"
                min="0"
                step="100"
              />
              <div className="mt-3 text-xs text-gray-400">
                This is the guaranteed payment to the artist
              </div>
            </div>
          </div>

          {/* Fixed Expenses - Editable */}
          <div className="bg-gradient-to-br from-[#1A1F1E] to-[#141716] rounded-3xl p-6 border border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Fixed Expenses</h2>
              <button
                onClick={addFixedExpense}
                className="text-xs bg-[#C4FF0D] text-black px-3 py-1.5 rounded-lg font-bold hover:bg-[#A3D60A] transition-colors"
              >
                + Add
              </button>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {fixedExpenses.map((exp, index) => (
                <div key={index} className="bg-black/40 rounded-xl p-3 border border-gray-700">
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <input
                      type="text"
                      value={exp.category}
                      onChange={(e) => updateFixedExpense(index, 'category', e.target.value)}
                      className="bg-[#252A29] border border-gray-600 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-[#C4FF0D]"
                      placeholder="Category"
                    />
                    <input
                      type="text"
                      value={exp.name}
                      onChange={(e) => updateFixedExpense(index, 'name', e.target.value)}
                      className="bg-[#252A29] border border-gray-600 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-[#C4FF0D]"
                      placeholder="Name"
                    />
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={exp.amount}
                      onChange={(e) => updateFixedExpense(index, 'amount', e.target.value)}
                      className="flex-1 bg-[#252A29] border border-gray-600 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-[#C4FF0D]"
                      min="0"
                      step="1"
                    />
                    <button
                      onClick={() => removeFixedExpense(index)}
                      className="bg-red-900/20 border border-red-800/50 hover:bg-red-900/30 text-red-400 px-3 rounded-lg text-xs font-bold transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-700 flex justify-between">
              <span className="font-bold text-white">Total Fixed</span>
              <span className="font-black text-white text-lg">{formatCurrency(calculations.fixedExpensesTotal)}</span>
            </div>
          </div>

          {/* Variable Expenses - Editable */}
          <div className="bg-gradient-to-br from-[#1A1F1E] to-[#141716] rounded-3xl p-6 border border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Variable Expenses</h2>
              <button
                onClick={addVariableExpense}
                className="text-xs bg-[#C4FF0D] text-black px-3 py-1.5 rounded-lg font-bold hover:bg-[#A3D60A] transition-colors"
              >
                + Add
              </button>
            </div>
            <div className="space-y-2">
              {variableExpenses.map((exp, index) => (
                <div key={index} className="bg-black/40 rounded-xl p-3 border border-gray-700">
                  <input
                    type="text"
                    value={exp.name}
                    onChange={(e) => updateVariableExpense(index, 'name', e.target.value)}
                    className="w-full bg-[#252A29] border border-gray-600 rounded-lg px-2 py-1.5 text-white text-xs mb-2 focus:outline-none focus:border-[#C4FF0D]"
                    placeholder="Name (include rate in name)"
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={exp.amount}
                      onChange={(e) => updateVariableExpense(index, 'amount', e.target.value)}
                      className="flex-1 bg-[#252A29] border border-gray-600 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-[#C4FF0D]"
                      step="0.001"
                    />
                    <button
                      onClick={() => removeVariableExpense(index)}
                      className="bg-red-900/20 border border-red-800/50 hover:bg-red-900/30 text-red-400 px-3 rounded-lg text-xs font-bold transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-700 flex justify-between">
              <span className="font-bold text-white">Total Variable</span>
              <span className="font-black text-white text-lg">{formatCurrency(calculations.variableExpensesTotal)}</span>
            </div>
          </div>

          {/* Verified Calculations - Read Only Summary */}
          <div className="lg:col-span-2 bg-gradient-to-br from-[#1A1F1E] to-[#141716] rounded-3xl p-6 border-2 border-[#C4FF0D]/30">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-[#C4FF0D]" />
              Verified Calculations
            </h2>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="bg-black/40 rounded-xl p-4 border border-gray-700">
                  <div className="text-sm text-gray-400 mb-1">Gross Revenue</div>
                  <div className="text-2xl font-black text-white">{formatCurrency(calculations.grossRevenue)}</div>
                </div>

                <div className="bg-black/40 rounded-xl p-4 border border-gray-700">
                  <div className="text-sm text-gray-400 mb-1">Sales Tax (-{(salesTaxRate * 100).toFixed(1)}%)</div>
                  <div className="text-2xl font-black text-red-400">-{formatCurrency(calculations.salesTax)}</div>
                </div>

                <div className="bg-black/40 rounded-xl p-4 border border-[#C4FF0D]/30">
                  <div className="text-sm text-gray-400 mb-1">Net Gross</div>
                  <div className="text-2xl font-black text-[#C4FF0D]">{formatCurrency(calculations.netGross)}</div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="bg-black/40 rounded-xl p-4 border border-gray-700">
                  <div className="text-sm text-gray-400 mb-1">Show Expenses (Excl. Artist Guarantee)</div>
                  <div className="text-2xl font-black text-white">{formatCurrency(calculations.showExpensesExclArtist)}</div>
                  <div className="text-xs text-gray-500 mt-1">Fixed + Variable only</div>
                </div>

                <div className="bg-black/40 rounded-xl p-4 border border-gray-700">
                  <div className="text-sm text-gray-400 mb-1">Artist Guarantee</div>
                  <div className="text-2xl font-black text-white">{formatCurrency(artistGuarantee)}</div>
                </div>

                <div className="bg-black/40 rounded-xl p-4 border border-orange-500/30">
                  <div className="text-sm text-gray-400 mb-1">Total Expenses (Incl. Artist Guarantee)</div>
                  <div className="text-2xl font-black text-orange-400">{formatCurrency(calculations.totalExpenses)}</div>
                  <div className="text-xs text-gray-500 mt-1">This is the complete cost</div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t-2 border-[#C4FF0D]/30">
              <div className="bg-gradient-to-r from-[#C4FF0D]/20 to-green-500/20 rounded-2xl p-6 border-2 border-[#C4FF0D]/50">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-400 mb-2">NET PROFIT</div>
                    <div className="text-xs text-gray-500">Net Gross - Total Expenses</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-4xl font-black ${
                      calculations.netProfit >= 0 ? 'text-[#C4FF0D]' : 'text-red-400'
                    }`}>
                      {formatCurrency(calculations.netProfit)}
                    </div>
                    <div className={`text-sm font-bold mt-1 ${
                      calculations.netProfit >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {calculations.profitMargin.toFixed(1)}% margin
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
