import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Plus, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useOrganization } from '../hooks/useOrganization';
import { AIInsights } from './AIInsights';
import { SubscriptionRequired } from './SubscriptionRequired';
import { TrialBanner } from './TrialBanner';
import { cancellationLoss, readCancellation } from '../lib/cancellation';
import { cashOnHand, type CashOnHand } from '../lib/upfrontCost';
import { CashOnHandPanel } from './CashOnHandPanel';
import { useAsk } from './ask/AskProvider';
import { NeedsYou } from './ask/NeedsYou';

interface DashboardStats {
  totalProfit: number;
  revenue: number;
  /** Money that actually came in, from settled shows. */
  actualRevenue: number;
  /** Projected gross on shows still to come. */
  projectedRevenue: number;
  /** Past shows never settled -- neither actual nor a forecast. */
  unsettledPast: number;
  costs: number;
  margin: number;
  activeEvents: number;
  forecastRevenue: number;
  activeTours: number;
  totalShows: number;
  upcomingShows: number;
  completedShows: number;
  monthProfit: number;
  /** What cancelled shows have actually cost, this month and this year. */
  monthCancelledLoss: number;
  yearCancelledLoss: number;
  cancelledShows: number;
}

interface UpcomingEvent {
  id: string;
  artist: string;
  venue: string;
  date: string;
  daysUntil: number;
  profit: number;
  status: string;
  capacity: number;
}

export function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { needsSubscription, loading: orgLoading } = useOrganization();
  const ask = useAsk();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [nextEvent, setNextEvent] = useState<UpcomingEvent | null>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [settledShows, setSettledShows] = useState(0);
  const [cash, setCash] = useState<CashOnHand | null>(null);

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    try {
      const { data: offers } = await supabase
        .from('offers')
        .select('*, show:shows(*)')
        .order('created_at', { ascending: false });

      const { data: tours } = await supabase
        .from('tours')
        .select('*');

      const { data: settledData } = await supabase
        .from('settlements')
        .select('offer_id, actual_revenue');
      const settledRows = settledData || [];

      if (offers) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const activeOffers = offers.filter(o => o.status !== 'cancelled');

        const totalRevenue = activeOffers.reduce((sum, o) => sum + (o.calculations?.netGross || 0), 0);

        // The old "Revenue" ticker summed projected gross across every offer
        // that was not cancelled -- settled shows, upcoming shows, and 25 past
        // shows nobody ever settled, which were 61% of the figure. $605K on a
        // dashboard where $29K had actually arrived. Split it into what came
        // in, what is projected, and what is just sitting there.
        const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
        const isPast = (o: any) => new Date(o.show?.event_date).getTime() < dayStart.getTime();
        const actualRevenue = settledRows.reduce((sum, s) => sum + (Number(s.actual_revenue) || 0), 0);
        const projectedRevenue = activeOffers
          .filter(o => o.status !== 'settled' && !isPast(o))
          .reduce((sum, o) => sum + (o.calculations?.netGross || 0), 0);
        const unsettledPast = activeOffers
          .filter(o => o.status !== 'settled' && isPast(o))
          .reduce((sum, o) => sum + (o.calculations?.netGross || 0), 0);
        const totalCosts = activeOffers.reduce((sum, o) => sum + (o.calculations?.totalExpenses || 0), 0);
        const totalProfit = activeOffers.reduce((sum, o) => sum + (o.calculations?.netProfit || 0), 0);

        const activeEvents = activeOffers.filter(o =>
          new Date(o.show.event_date) >= today
        ).length;

        const thisMonth = today.getMonth();
        const thisYear = today.getFullYear();

        // A cancelled show used to just vanish here: its projected profit
        // stopped counting and nothing replaced it, so a month with two dead
        // shows read the same as a quiet month. Cancelling costs real money --
        // deposits paid, ads already run, refund fees -- and that money is
        // subtracted now. The loss lands in the month the show was cancelled,
        // not the month it was going to happen, because that is when it left.
        // What is committed before any of these rooms open: deposits and ads.
        setCash(cashOnHand(offers as any));

        const cancelledOffers = offers.filter(o => o.status === 'cancelled');
        const lossOf = (o: any) =>
          Number(o.cancellation_loss) || cancellationLoss(readCancellation(o));
        const cancelDate = (o: any) =>
          o.cancelled_at ? new Date(o.cancelled_at) : new Date(o.show.event_date);

        const monthCancelledLoss = cancelledOffers
          .filter(o => {
            const d = cancelDate(o);
            return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
          })
          .reduce((sum, o) => sum + lossOf(o), 0);

        const yearCancelledLoss = cancelledOffers
          .filter(o => cancelDate(o).getFullYear() === thisYear)
          .reduce((sum, o) => sum + lossOf(o), 0);

        const monthProfit = activeOffers
          .filter(o => {
            const eventDate = new Date(o.show.event_date);
            return eventDate.getMonth() === thisMonth &&
                   eventDate.getFullYear() === thisYear;
          })
          .reduce((sum, o) => sum + (o.calculations?.netProfit || 0), 0) - monthCancelledLoss;

        const upcomingOffers = activeOffers
          .filter(o => new Date(o.show.event_date) >= today)
          .sort((a, b) => new Date(a.show.event_date).getTime() - new Date(b.show.event_date).getTime());

        const forecastRevenue = upcomingOffers.reduce((sum, o) => sum + (o.calculations?.grossPotential || 0), 0);

        const settled = activeOffers.filter(o => o.status === 'settled').length;
        setSettledShows(settled);

        const events: UpcomingEvent[] = upcomingOffers.slice(0, 5).map(o => {
          const eventDate = new Date(o.show.event_date);
          const daysUntil = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

          return {
            id: o.id,
            artist: o.show.artist_name || 'Unknown Artist',
            venue: o.show.venue_name || 'Unknown Venue',
            date: eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            daysUntil,
            profit: o.calculations?.netProfit || 0,
            status: o.status || 'planning',
            capacity: o.show.venue_capacity || 0
          };
        });

        setNextEvent(events[0] || null);
        setUpcomingEvents(events);

        setStats({
          totalProfit: totalProfit - yearCancelledLoss,
          monthCancelledLoss,
          yearCancelledLoss,
          cancelledShows: cancelledOffers.length,
          revenue: totalRevenue,
          actualRevenue,
          projectedRevenue,
          unsettledPast,
          costs: totalCosts,
          margin: totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100) : 0,
          activeEvents,
          forecastRevenue,
          activeTours: tours?.filter(t => t.status === 'active').length || 0,
          totalShows: activeOffers.length,
          upcomingShows: upcomingOffers.length,
          completedShows: settled,
          monthProfit
        });
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#8FD3FF] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-[#1140F0] text-white';
      case 'settled': return 'bg-[#8FD3FF] text-[#04214D]';
      case 'offer_sent': return 'bg-[#8FD3FF]/15 text-[#8FD3FF] border border-[#8FD3FF]/40';
      default: return 'bg-[#2A3040] text-gray-300';
    }
  };

  const showAILearning = settledShows < 5;

  if (orgLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8FD3FF]"></div>
      </div>
    );
  }

  if (needsSubscription()) {
    return <SubscriptionRequired />;
  }

  const firstName = (() => {
    const meta = (user as any)?.user_metadata || {};
    const full = String(meta.full_name || meta.name || '').trim();
    if (full) return full.split(/\s+/)[0];
    const local = (user?.email || '').split('@')[0];
    return local ? local.charAt(0).toUpperCase() + local.slice(1) : 'there';
  })();

  const k = (v: number) => `$${(v / 1000).toFixed(1)}K`;
  const verdictOf = (id: string) => ask.brief?.upcoming.find((u) => u.offer_id === id)?.verdict;
  const verdictCls: Record<string, string> = {
    SAFE: 'bg-emerald-900/30 text-emerald-300', TIGHT: 'bg-[#1140F0]/30 text-[#8FD3FF]',
    FRAGILE: 'bg-amber-900/30 text-amber-300', UNDERWATER: 'bg-red-900/30 text-red-300',
  };

  return (
    <>
      <TrialBanner />
      <div className="min-h-screen">
      <div className="px-5 sm:px-6 pt-7 pb-1">
        <div className="flex flex-wrap items-end justify-between gap-4 max-w-7xl mx-auto">
          <div>
            <p className="font-label text-[#04214D] text-[11px] tracking-[0.22em] uppercase mb-1.5">
              [ 01 ] Today · {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
            <h1 className="text-[#08090D] text-3xl md:text-5xl leading-none">
              Welcome back, {firstName}.
            </h1>
            {ask.brief && <p className="text-[#04214D] text-sm mt-1.5">{ask.brief.headline}</p>}
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <button onClick={() => navigate('/tours')} className="px-4 py-2.5 rounded-xl text-white text-xs border border-[#2A3040]" style={{ background: 'linear-gradient(180deg, #2A3040 0%, #14171E 100%)', boxShadow: '0 8px 20px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.12)' }}>
              Tours
            </button>
            <button onClick={() => navigate('/offers')} className="px-4 py-2.5 rounded-xl text-white text-xs border border-[#2A3040]" style={{ background: 'linear-gradient(180deg, #2A3040 0%, #14171E 100%)', boxShadow: '0 8px 20px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.12)' }}>
              All Offers
            </button>
            <button onClick={() => navigate('/offers/create')} className="px-4 py-2.5 rounded-xl bg-[#8FD3FF] text-[#04214D] text-xs flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} /> New Offer
            </button>
          </div>
        </div>
      </div>

      <div className="px-5 sm:px-6 py-5 max-w-7xl mx-auto space-y-4">
        {/* [02] What needs the promoter. Same rows the Ask bar reads. */}
        <NeedsYou brief={ask.brief} loading={ask.loading} onOpen={(link) => navigate(link)} />

        {/* Four numbers, one row. */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          {[
            { label: 'Active events', value: `${stats?.activeEvents || 0}`, sub: `${ask.brief?.next30 ?? stats?.upcomingShows ?? 0} in the next 30 days` },
            { label: 'Profit this month', value: k(stats?.monthProfit || 0), sub: (stats?.monthCancelledLoss || 0) > 0 ? `after $${Math.round(stats?.monthCancelledLoss || 0).toLocaleString()} cancelled` : null },
            { label: 'Actual revenue', value: k(stats?.actualRevenue || 0), sub: 'from settled shows' },
            { label: 'Projected revenue', value: k(stats?.projectedRevenue || 0), sub: 'upcoming, at a sellout' },
          ].map((t) => (
            <div key={t.label} className="bg-[#14171E] border border-gray-800 rounded-2xl px-4 py-3.5 min-w-0">
              <p className="font-display text-2xl sm:text-[28px] text-[#8FD3FF] leading-none truncate" style={{ textShadow: '0 0 18px rgba(143,211,255,0.45)' }}>{t.value}</p>
              <p className="font-label text-[10px] tracking-[0.18em] uppercase text-gray-500 mt-1.5 leading-snug">{t.label}</p>
              {t.sub && <p className="text-[10px] text-gray-600 mt-0.5 truncate">{t.sub}</p>}
            </div>
          ))}
        </div>

        {/* Two things worth watching, one line each. */}
        {((stats?.unsettledPast || 0) > 0 || (stats?.yearCancelledLoss || 0) > 0) && (
          <div className="bg-[#14171E] border border-gray-800 rounded-2xl divide-y divide-[#1F2430]">
            {(stats?.unsettledPast || 0) > 0 && (
              <button onClick={() => navigate('/offers?status=unsettled')} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left" style={{ textTransform: 'none', letterSpacing: 0 }}>
                <span className="text-xs text-gray-300"><span className="font-label text-[10px] tracking-[0.18em] uppercase text-amber-400 mr-2">Not counted</span>${Math.round((stats?.unsettledPast || 0) / 1000)}K sits on shows that happened and were never settled</span>
                <span className="text-[11px] text-gray-500 whitespace-nowrap">Settle them →</span>
              </button>
            )}
            {(stats?.yearCancelledLoss || 0) > 0 && (
              <button onClick={() => navigate('/offers?status=cancelled')} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left" style={{ textTransform: 'none', letterSpacing: 0 }}>
                <span className="text-xs text-gray-300"><span className="font-label text-[10px] tracking-[0.18em] uppercase text-red-400 mr-2">Cancelled</span>-${Math.round(stats?.yearCancelledLoss || 0).toLocaleString()} lost this year on {stats?.cancelledShows} {stats?.cancelledShows === 1 ? 'show' : 'shows'}</span>
                <span className="text-[11px] text-gray-500 whitespace-nowrap">See them →</span>
              </button>
            )}
          </div>
        )}

        {cash && <CashOnHandPanel cash={cash} onOpenShow={(id) => navigate(`/offers/${id}`)} />}

        {/* Next event, one compact card. */}
        {nextEvent && (
          <div
            onClick={() => navigate(`/offers/${nextEvent.id}`)}
            className="bg-[#14171E] border border-gray-800 rounded-2xl p-5 relative overflow-hidden cursor-pointer active:scale-[0.99] transition-transform"
          >
            <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-[#8FD3FF]" style={{ boxShadow: '0 0 10px #8FD3FF' }}></div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-label text-[11px] tracking-[0.22em] uppercase text-[#8FD3FF]">[ 03 ] Next event</span>
              <span className="font-label text-[11px] tracking-[0.22em] uppercase text-gray-500 mr-4">{nextEvent.daysUntil === 0 ? 'Tonight' : `In ${nextEvent.daysUntil} ${nextEvent.daysUntil === 1 ? 'day' : 'days'}`}</span>
            </div>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-2xl md:text-3xl text-white leading-none mb-2 truncate">{nextEvent.artist}</h2>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-400">
                  <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-[#8FD3FF]" />{nextEvent.venue}</span>
                  <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-[#8FD3FF]" />{nextEvent.date}</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div>
                  <p className="font-label text-[10px] tracking-[0.18em] uppercase text-gray-500">Expected profit</p>
                  <p className="font-display text-2xl text-[#8FD3FF] leading-none mt-1">{k(nextEvent.profit)}</p>
                </div>
                {verdictOf(nextEvent.id) && (
                  <span className={`font-label text-[10px] tracking-[0.16em] uppercase px-2.5 py-1 rounded-md ${verdictCls[verdictOf(nextEvent.id) as string]}`}>{verdictOf(nextEvent.id)}</span>
                )}
                <span className="text-[#8FD3FF] text-sm">Open →</span>
              </div>
            </div>
          </div>
        )}

        {/* Coming up */}
        {upcomingEvents.length > 1 && (
          <div className="bg-[#14171E] border border-gray-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-baseline gap-3">
                <span className="font-label text-[11px] tracking-[0.22em] uppercase text-[#8FD3FF]">[ 04 ]</span>
                <h2 className="text-xl text-white">Coming up</h2>
              </div>
              <button onClick={() => navigate('/offers')} className="text-[#8FD3FF] hover:text-white text-xs transition-colors">
                View all →
              </button>
            </div>
            <div>
              {upcomingEvents.slice(1).map((event) => (
                <div
                  key={event.id}
                  onClick={() => navigate(`/offers/${event.id}`)}
                  className="grid grid-cols-[1fr_auto] md:grid-cols-[2fr_1.6fr_1fr_1fr_auto] gap-3 items-center px-2 py-3 border-t border-[#1F2430] hover:bg-white/[0.03] cursor-pointer transition-colors"
                >
                  <div className="min-w-0">
                    <span className="block text-white font-semibold truncate">{event.artist}</span>
                    <span className="md:hidden block text-xs text-gray-400 truncate">{event.venue} · {event.date}</span>
                  </div>
                  <span className="hidden md:block text-gray-400 truncate">{event.venue}</span>
                  <span className="hidden md:block text-gray-400">{event.date} <span className="text-[#8FD3FF] text-xs ml-1">{event.daysUntil}d</span></span>
                  <span className="hidden md:block text-[#8FD3FF] font-semibold">{k(event.profit)}</span>
                  <div className="flex items-center gap-2 justify-self-end">
                    <span className="md:hidden text-[#8FD3FF] text-sm font-semibold">{k(event.profit)}</span>
                    {verdictOf(event.id) ? (
                      <span className={`font-label text-[10px] tracking-[0.16em] uppercase px-2 py-1 rounded-md ${verdictCls[verdictOf(event.id) as string]}`}>{verdictOf(event.id)}</span>
                    ) : (
                      <span className={`font-label text-[10px] tracking-[0.16em] uppercase px-2 py-1 rounded-md ${getStatusBadgeColor(event.status)}`}>{event.status.replace('_', ' ')}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {showAILearning && (
          <div className="bg-[#14171E] border border-gray-800 rounded-2xl p-5 flex items-center gap-4">
            <div className="w-11 h-11 shrink-0 bg-gradient-to-br from-[#8FD3FF] to-[#6FB8F2] rounded-2xl flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-[#04214D]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold">Insights unlock at 5 settled shows</p>
              <p className="text-xs text-gray-400">{settledShows} of 5 settled. {5 - settledShows} more and this reads your own numbers back to you.</p>
              <div className="w-full h-1.5 bg-[#08090D] rounded-full overflow-hidden mt-2">
                <div className="h-full bg-[#8FD3FF] transition-all duration-1000" style={{ width: `${(settledShows / 5) * 100}%` }}></div>
              </div>
            </div>
          </div>
        )}

        {!showAILearning && (
          <div className="mt-2">
            <AIInsights />
          </div>
        )}
      </div>

    </div>
    </>
  );
}
