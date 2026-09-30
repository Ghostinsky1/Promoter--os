import { Loader2 } from 'lucide-react';
import type { Brief } from '../../lib/ask';

/**
 * [ 02 ] Needs you — the dashboard's first card. The same rows the Ask bar
 * opens with: unpaid deposits with the show close, past shows not settled,
 * shows that lose money on a bad night, overdue tasks. Every row is a tap.
 */
export function NeedsYou({ brief, loading, onOpen }: { brief: Brief | null; loading: boolean; onOpen: (link: string) => void }) {
  const toneCls = { red: 'bg-red-900/30 text-red-300', amber: 'bg-amber-900/30 text-amber-300', blue: 'bg-[#1140F0]/30 text-[#8FD3FF]' };
  const rows = brief?.needs_you ?? [];

  return (
    <div className="bg-[#14171E] border border-gray-800 rounded-2xl px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="font-label text-[11px] tracking-[0.22em] uppercase text-[#8FD3FF]">[ 02 ] Needs you</span>
        {brief && brief.cash.total > 0 && (
          <span className="font-label text-[10px] tracking-[0.16em] uppercase text-gray-500">
            Cash on hand needed <span className="text-white">${Math.round(brief.cash.total).toLocaleString()}</span>
          </span>
        )}
      </div>

      {loading && !brief && (
        <div className="flex items-center gap-2 text-xs text-gray-500 py-3"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Reading your shows…</div>
      )}
      {brief && rows.length === 0 && (
        <p className="text-sm text-gray-400 py-2">Nothing needs you right now. Deposits are paid, nothing is overdue, and every upcoming show clears a soft night.</p>
      )}
      {/* Two columns on a wide screen, tag first, one tight line each. Eight
          rows used to span the full width and leave a field of nothing. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6">
        {rows.map((n, i) => (
          <button
            key={i}
            onClick={() => onOpen(n.link)}
            className="w-full grid grid-cols-[auto_1fr] items-center gap-2.5 py-2 border-t border-[#1F2430] first:border-t-0 lg:[&:nth-child(2)]:border-t-0 text-left hover:bg-white/[0.02] -mx-1 px-1 rounded-md"
            style={{ textTransform: 'none', letterSpacing: 0 }}
          >
            <span className={`font-label text-[9px] tracking-[0.14em] uppercase px-2 py-1 rounded whitespace-nowrap w-[92px] text-center ${toneCls[n.tone]}`}>{n.tag}</span>
            <span className="min-w-0">
              <span className="block text-[14px] text-white font-semibold truncate leading-tight">{n.title}</span>
              <span className="block text-[11px] text-gray-400 truncate leading-tight">{n.detail}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
