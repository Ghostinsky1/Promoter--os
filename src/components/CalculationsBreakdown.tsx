import { Calculations, TicketTier } from '../types';
import { formatCurrency, getExpenseBreakdown } from '../lib/calculations';
import { CheckCircle2 } from 'lucide-react';

interface CalculationsBreakdownProps {
  ticketTiers: TicketTier[];
  salesTaxPct: number;
  calculations: Calculations;
  guarantee: number;
  mode: 'estimate' | 'settlement';
  depositsPaidTotal?: number;
  depositsDueTotal?: number;
}

export function CalculationsBreakdown({
  ticketTiers,
  salesTaxPct,
  calculations,
  guarantee,
  mode,
  depositsPaidTotal = 0,
  depositsDueTotal = 0,
}: CalculationsBreakdownProps) {
  const steps = [];

  steps.push({
    label: 'Gross Revenue (All Ticket Tiers)',
    value: calculations.grossPotential,
    isPositive: true,
    details: ticketTiers.map((tier) => {
      const tickets = mode === 'settlement' && tier.actualSold !== undefined
        ? tier.actualSold
        : (tier.allotment - tier.comps);
      return `${tier.type}: ${tickets} × ${formatCurrency(tier.price)} = ${formatCurrency(tickets * tier.price)}`;
    }),
  });

  steps.push({
    label: `Sales Tax (${salesTaxPct}%)`,
    value: -calculations.salesTax,
    isPositive: false,
    details: [`${salesTaxPct}% of ${formatCurrency(calculations.grossPotential)}`],
  });

  steps.push({
    label: 'Net Gross Revenue',
    value: calculations.netGross,
    isSubtotal: true,
    details: [`${formatCurrency(calculations.grossPotential)} - ${formatCurrency(calculations.salesTax)}`],
  });

  const eb = getExpenseBreakdown(calculations, guarantee);

  steps.push({
    label: 'Total Expenses (Incl. Artist Guarantee)',
    value: -eb.totalExpenses,
    isPositive: false,
    details: [
      `Artist Guarantee: ${formatCurrency(guarantee)}`,
      `Show Expenses: ${formatCurrency(eb.fixedExpensesTotal + eb.variableExpensesTotal)}`,
    ],
  });

  steps.push({
    label: 'NET PROFIT',
    value: calculations.netProfit,
    isFinal: true,
    details: [
      `${formatCurrency(calculations.netGross)} (Net Gross)`,
      `- ${formatCurrency(eb.totalExpenses)} (Total Expenses)`,
    ],
  });

  return (
    <div className="bg-[#1A1F1E] border border-gray-800 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle2 className="w-5 h-5 text-[#C4FF0D]" />
        <h2 className="text-base font-bold text-white">Verified Calculations</h2>
      </div>

      <div className="space-y-2">
        {steps.map((step, index) => (
          <div key={index}>
            <div className={`flex justify-between items-start p-3 rounded-xl ${
              step.isFinal
                ? step.value >= 0
                  ? 'bg-green-900/20 border-2 border-green-600'
                  : 'bg-red-900/20 border-2 border-red-600'
                : step.isSubtotal
                ? 'bg-[#C4FF0D]/10 border border-[#C4FF0D]/30'
                : 'bg-[#252A29]'
            }`}>
              <div className="flex-1">
                <div className={`font-semibold ${
                  step.isFinal
                    ? 'text-base'
                    : step.isSubtotal
                    ? 'text-sm'
                    : 'text-xs'
                } ${
                  step.isFinal
                    ? step.value >= 0
                      ? 'text-green-300'
                      : 'text-red-300'
                    : 'text-white'
                }`}>
                  {step.label}
                </div>
                {step.details && step.details.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {step.details.map((detail, i) => (
                      <div key={i} className="text-[10px] text-gray-400">
                        {detail}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className={`font-bold text-right ml-4 ${
                step.isFinal
                  ? step.value >= 0
                    ? 'text-green-400 text-lg'
                    : 'text-red-400 text-lg'
                  : step.isSubtotal
                  ? 'text-[#C4FF0D] text-sm'
                  : step.isPositive
                  ? 'text-green-400 text-xs'
                  : 'text-red-400 text-xs'
              }`}>
                {step.value >= 0 ? '+' : ''}{formatCurrency(step.value)}
              </div>
            </div>

            {!step.isFinal && (
              <div className="flex justify-center my-1">
                <div className="w-px h-3 bg-gray-700" />
              </div>
            )}
          </div>
        ))}
      </div>

      {(depositsPaidTotal > 0 || depositsDueTotal > 0) && (
        <div className="mt-3 p-3 bg-[#252A29] rounded-xl space-y-1.5">
          <div className="text-xs text-gray-400 font-semibold mb-1">Cash Flow (Deposits)</div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Cash Out So Far (Deposits Paid)</span>
            <span className="text-green-400 font-medium">{formatCurrency(depositsPaidTotal)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Cash Still Due (Deposits Unpaid)</span>
            <span className="text-yellow-400 font-medium">{formatCurrency(depositsDueTotal)}</span>
          </div>
        </div>
      )}

      <div className="mt-4 p-3 bg-[#252A29] rounded-xl">
        <div className="text-xs text-gray-400 mb-1">Formula Verification</div>
        <div className="text-[10px] font-mono text-gray-300 space-y-0.5">
          <div>Net Gross = Gross Revenue - Sales Tax</div>
          <div>Net Profit = Net Gross - Total Expenses</div>
          <div className="text-gray-500 mt-1">(Total Expenses includes Artist Guarantee + Show Costs)</div>
        </div>
      </div>
    </div>
  );
}
