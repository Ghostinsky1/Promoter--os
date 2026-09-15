export interface ProfitIndicator {
  badge: {
    text: string;
    bgColor: string;
    textColor: string;
  };
  emoji: string;
  borderColor: string;
  meterColor: string;
  meterPercentage: number;
}

export function getProfitIndicator(netProfit: number, netGross: number): ProfitIndicator {
  if (netGross === 0) {
    return {
      badge: { text: 'No Revenue', bgColor: 'bg-slate-100', textColor: 'text-slate-700' },
      emoji: '⚪',
      borderColor: 'border-l-slate-400',
      meterColor: 'bg-slate-400',
      meterPercentage: 0,
    };
  }

  const profitMargin = (netProfit / netGross) * 100;

  if (profitMargin >= 30) {
    return {
      badge: { text: 'Strong Profit', bgColor: 'bg-green-100', textColor: 'text-green-800' },
      emoji: '💰',
      borderColor: 'border-l-green-500',
      meterColor: 'bg-green-500',
      meterPercentage: Math.min(profitMargin, 100),
    };
  }

  if (profitMargin >= 10) {
    return {
      badge: { text: 'Profitable', bgColor: 'bg-green-100', textColor: 'text-green-700' },
      emoji: '✅',
      borderColor: 'border-l-green-400',
      meterColor: 'bg-green-400',
      meterPercentage: profitMargin,
    };
  }

  if (profitMargin >= -5 && profitMargin < 10) {
    return {
      badge: { text: 'Break Even', bgColor: 'bg-yellow-100', textColor: 'text-yellow-800' },
      emoji: '⚖️',
      borderColor: 'border-l-yellow-400',
      meterColor: 'bg-yellow-400',
      meterPercentage: 50,
    };
  }

  if (profitMargin >= -20) {
    return {
      badge: { text: 'Small Loss', bgColor: 'bg-orange-100', textColor: 'text-orange-700' },
      emoji: '⚠️',
      borderColor: 'border-l-orange-400',
      meterColor: 'bg-orange-400',
      meterPercentage: 30,
    };
  }

  return {
    badge: { text: 'Big Loss', bgColor: 'bg-red-100', textColor: 'text-red-800' },
    emoji: '❌',
    borderColor: 'border-l-red-500',
    meterColor: 'bg-red-500',
    meterPercentage: 20,
  };
}
