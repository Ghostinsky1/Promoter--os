import { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';
import { supabase } from '../../lib/supabase';

/**
 * Shows only to someone who registered for a live episode while its deal is open
 * (my_live_deal). The coupon itself is applied server-side at Pro checkout.
 */
export function LiveDealBanner() {
  const [deal, setDeal] = useState<{ episode: string; label: string; ends_at: string } | null>(null);
  useEffect(() => {
    supabase.rpc('my_live_deal').then(({ data }) => {
      const row = Array.isArray(data) ? data[0] : data;
      if (row?.ends_at && new Date(row.ends_at) > new Date()) setDeal(row);
    });
  }, []);
  if (!deal) return null;
  const ends = new Intl.DateTimeFormat('en-US', { weekday: 'long', hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' }).format(new Date(deal.ends_at));
  return (
    <div className="mb-10 bg-[#14171E] border-2 border-[#F2B640] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4 shadow-[0_0_30px_rgba(242,182,64,0.25)]">
      <Zap className="w-8 h-8 text-[#F2B640] shrink-0" />
      <div className="flex-1">
        <p className="font-label text-[11px] tracking-[0.22em] uppercase text-[#F2B640]">Your live deal · {deal.episode.toUpperCase()}</p>
        <p className="text-white text-xl font-bold mt-1">{deal.label}</p>
        <p className="text-gray-400 text-sm mt-0.5">Pick <b className="text-white">Pro</b> below — the discount comes off at checkout. Ends {ends} CT.</p>
      </div>
      <button
        onClick={() => document.getElementById('plans')?.scrollIntoView({ behavior: 'smooth' })}
        className="shrink-0 bg-[#F2B640] hover:bg-[#ffcb5c] text-[#14171E] rounded-xl px-5 py-3 font-bold"
        style={{ textTransform: 'none', letterSpacing: 0 }}
      >
        Show me Pro
      </button>
    </div>
  );
}
