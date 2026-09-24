import { useEffect, useState } from 'react';
import { Zap, Loader2, Check } from 'lucide-react';
import { useAsk } from '../ask/AskProvider';
import { buyCredits, CREDIT_PACKS } from '../../lib/ask';

/**
 * AI credits: where they stand and how to get more.
 *
 * What burns a credit: a chat message (1), a chat message with photos (2), a
 * document scan (3). Deal Score and Insights are arithmetic on the promoter's
 * own numbers, not a model, and never cost a credit.
 */
export function CreditsCard() {
  const { credits, refresh } = useAsk();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const added = new URLSearchParams(window.location.search).get('credits') === 'added';

  useEffect(() => { if (added) refresh(); }, [added, refresh]);

  const buy = async (id: 'credits_100' | 'credits_500') => {
    setBusy(id); setError(null);
    try { await buyCredits(id); } catch (e: any) { setError(e?.message || 'Could not start checkout.'); setBusy(null); }
  };

  const pct = credits && credits.monthly_allowance > 0 ? Math.round((credits.monthly_left / credits.monthly_allowance) * 100) : 0;

  return (
    <div id="credits" className="bg-[#14171E] border border-gray-800 rounded-2xl p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="font-label text-[11px] tracking-[0.22em] uppercase text-[#8FD3FF] mb-1 flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> AI credits</p>
          <p className="font-display text-4xl text-white leading-none">{credits?.total_left ?? '—'}</p>
          <p className="text-xs text-gray-500 mt-1">
            {credits ? (
              credits.monthly_allowance > 0
                ? `${credits.monthly_left} of ${credits.monthly_allowance} this month${credits.topup > 0 ? ` + ${credits.topup} bought` : ''}`
                : `${credits.topup} left${credits.topup > 0 ? ' · never expire' : ''}`
            ) : 'Loading…'}
          </p>
        </div>
        {added && <span className="inline-flex items-center gap-1 text-xs text-emerald-300 bg-emerald-900/20 border border-emerald-800/40 rounded-full px-3 py-1"><Check className="w-3 h-3" /> Credits added</span>}
      </div>

      {credits && credits.monthly_allowance > 0 && (
        <div className="w-full h-1.5 bg-[#08090D] rounded-full overflow-hidden mb-4">
          <div className="h-full bg-[#8FD3FF]" style={{ width: `${pct}%` }} />
        </div>
      )}

      <p className="text-xs text-gray-400 mb-4">
        A chat message is 1 credit, 2 with photos attached. A document scan is 3. Deal Score and Insights are your own math and never cost anything.
        Monthly credits reset each billing cycle; bought credits never expire and are used after them.
      </p>

      <div className="grid sm:grid-cols-2 gap-3">
        {CREDIT_PACKS.map((p) => (
          <button
            key={p.id}
            onClick={() => buy(p.id)}
            disabled={!!busy}
            className="flex items-center justify-between gap-3 bg-[#08090D] border border-[#2A3040] hover:border-[#8FD3FF]/60 rounded-xl px-4 py-3 text-left disabled:opacity-60"
            style={{ textTransform: 'none', letterSpacing: 0 }}
          >
            <span>
              <span className="block text-white font-semibold">{p.label}</span>
              <span className="block text-[11px] text-gray-500">{p.blurb}</span>
            </span>
            <span className="font-display text-xl text-[#8FD3FF] whitespace-nowrap">{busy === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : `$${p.price}`}</span>
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-red-300 mt-3">{error}</p>}
    </div>
  );
}
