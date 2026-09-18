import { useState } from 'react';
import { Wallet, ChevronDown, ChevronUp } from 'lucide-react';
import { formatCurrency } from '../lib/calculations';
import { CashOnHand } from '../lib/upfrontCost';

/**
 * What you need in the bank today, across every show still to come.
 *
 * Deposits and marketing go out before a ticket is sold and do not come back.
 * The guarantee balance, security and production are paid on the night out of
 * the door, so they are not on this list.
 */
export function CashOnHandPanel({ cash, onOpenShow }: { cash: CashOnHand; onOpenShow: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  if (cash.shows.length === 0) return null;

  return (
    <div className="bg-[#14171E] border border-gray-800 rounded-[22px] p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-[#8FD3FF]" />
          <p className="font-label text-[11px] tracking-[0.22em] uppercase text-[#8FD3FF]">
            Cash you need on hand
          </p>
        </div>
        <span className="text-[11px] text-gray-500">
          {cash.shows.length} show{cash.shows.length === 1 ? '' : 's'} committed
        </span>
      </div>

      <p className="font-display text-4xl text-white mb-1" style={{ textShadow: '0 0 18px rgba(143,211,255,0.35)' }}>
        {formatCurrency(cash.stillToPay)}
      </p>
      <p className="text-xs text-gray-500 mb-5">
        still to go out before these rooms open
        {cash.alreadyPaid > 0 && <> · {formatCurrency(cash.alreadyPaid)} already paid</>}
      </p>

      <div className="grid grid-cols-3 gap-3 mb-4">
        {([
          ['Artist deposits', cash.artistDeposits],
          ['Venue deposits', cash.venueDeposits],
          ['Marketing', cash.marketing],
        ] as const).map(([label, amount]) => (
          <div key={label} className="bg-[#0B0D12] border border-gray-800 rounded-xl p-3">
            <p className="text-[10px] text-gray-500 mb-1">{label}</p>
            <p className="text-base font-bold text-white">{formatCurrency(amount)}</p>
          </div>
        ))}
      </div>

      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-center gap-1 py-2 text-[11px] text-gray-500 hover:text-[#8FD3FF] transition-colors"
      >
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {open ? 'Hide the breakdown' : 'Show me where it goes'}
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {cash.shows.map((s) => (
            <button
              key={s.offerId}
              onClick={() => onOpenShow(s.offerId)}
              className="w-full text-left bg-[#0B0D12] border border-gray-800 hover:border-[#8FD3FF]/40 rounded-xl p-3 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{s.name}</p>
                  <p className="text-[10px] text-gray-500 truncate">
                    {s.venue}
                    {s.daysAway >= 0 && <> · in {s.daysAway} day{s.daysAway === 1 ? '' : 's'}</>}
                  </p>
                </div>
                <p className="text-sm font-bold text-white shrink-0">{formatCurrency(s.stillToPay)}</p>
              </div>
              <div className="flex gap-3 mt-2 text-[10px] text-gray-500">
                {s.artistDeposit > 0 && (
                  <span className={s.artistDepositPaid ? 'line-through opacity-50' : ''}>
                    artist {formatCurrency(s.artistDeposit)}
                  </span>
                )}
                {s.venueDeposit > 0 && (
                  <span className={s.venueDepositPaid ? 'line-through opacity-50' : ''}>
                    venue {formatCurrency(s.venueDeposit)}
                  </span>
                )}
                {s.marketing > 0 && <span>marketing {formatCurrency(s.marketing)}</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
