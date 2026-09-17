import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  Calendar,
  MapPin,
  Plus,
  Sparkles
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useOrganization } from '../hooks/useOrganization';
import { AIInsights } from './AIInsights';
import { SubscriptionRequired } from './SubscriptionRequired';
import { TrialBanner } from './TrialBanner';
import { cancellationLoss, readCancellation } from '../lib/cancellation';

interface DashboardStats {
  totalProfit: number;
  revenue: number;
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
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [nextEvent, setNextEvent] = useState<UpcomingEvent | null>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [settledShows, setSettledShows] = useState(0);

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

      if (offers) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const activeOffers = offers.filter(o => o.status !== 'cancelled');

        const totalRevenue = activeOffers.reduce((sum, o) => sum + (o.calculations?.netGross || 0), 0);
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
  const upcomingProgress = Math.min(100, ((stats?.upcomingShows || 0) / (stats?.totalShows || 1)) * 100);
  const completedProgress = Math.min(100, ((stats?.completedShows || 0) / (stats?.totalShows || 1)) * 100);

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

  return (
    <>
      <TrialBanner />
      <div className="min-h-screen">
      <div className="px-6 pt-10 pb-2">
        <div className="flex flex-wrap items-end justify-between gap-6 max-w-7xl mx-auto">
          <div>
            <p className="font-label text-[#04214D] text-[11px] tracking-[0.22em] uppercase mb-2">
              [ 01 ] Today · {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
            <h1 className="text-[#08090D] text-4xl md:text-5xl leading-none">
              Welcome back, {firstName}.
            </h1>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <button onClick={() => navigate('/tours')} className="px-5 py-3 rounded-xl text-white text-sm border border-[#2A3040]" style={{ background: 'linear-gradient(180deg, #2A3040 0%, #14171E 100%)', boxShadow: '0 8px 20px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.12)' }}>
              View Tours
            </button>
            <button onClick={() => navigate('/offers')} className="px-5 py-3 rounded-xl text-white text-sm border border-[#2A3040]" style={{ background: 'linear-gradient(180deg, #2A3040 0%, #14171E 100%)', boxShadow: '0 8px 20px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.12)' }}>
              All Offers
            </button>
            <button onClick={() => navigate('/offers/create')} className="px-5 py-3 rounded-xl bg-[#8FD3FF] text-[#04214D] text-sm flex items-center gap-2">
              <Plus className="h-4 w-4" strokeWidth={2.5} /> New Offer
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 max-w-7xl mx-auto space-y-6">
        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Active events', value: `${stats?.activeEvents || 0}` },
            { label: 'Profit this month', value: `$${((stats?.monthProfit || 0) / 1000).toFixed(1)}K` },
            { label: 'Revenue', value: `$${((stats?.revenue || 0) / 1000).toFixed(1)}K` },
            { label: 'Margin', value: `${Math.round(stats?.margin || 0)}%` },
          ].map((k) => (
            <div key={k.label} className="bg-[#14171E] border border-gray-800 rounded-[22px] p-6">
              <p className="font-display text-4xl text-[#8FD3FF] mb-1" style={{ textShadow: '0 0 18px rgba(143,211,255,0.45)' }}>{k.value}</p>
              <p className="font-label text-[11px] tracking-[0.22em] uppercase text-gray-500">{k.label}</p>
            </div>
          ))}
        </div>

        {/* What cancellations have cost. Only shown when there is something to
            show -- a promoter with no dead shows does not need the reminder. */}
        {(stats?.yearCancelledLoss || 0) > 0 && (
          <div className="bg-[#14171E] border border-red-800/40 rounded-[22px] p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-label text-[11px] tracking-[0.22em] uppercase text-red-400 mb-2">
                  Cancellations this year
                </p>
                <p className="font-display text-4xl text-red-400 mb-1" style={{ textShadow: '0 0 18px rgba(248,113,113,0.35)' }}>
                  -${((stats?.yearCancelledLoss || 0) / 1000).toFixed(1)}K
                </p>
                <p className="text-xs text-gray-500">
                  {stats?.cancelledShows} {stats?.cancelledShows === 1 ? 'show' : 'shows'} called off
                  {(stats?.monthCancelledLoss || 0) > 0 &&
                    ` — $${Math.round(stats?.monthCancelledLoss || 0).toLocaleString()} of it this month`}
                </p>
              </div>
              <button
                onClick={() => navigate('/offers?status=cancelled')}
                className="text-[11px] text-gray-500 hover:text-[#8FD3FF] transition-colors whitespace-nowrap"
              >
                See them
              </button>
            </div>
          </div>
        )}

        {/* Next event */}
        {nextEvent && (
          <div
            onClick={() => navigate(`/offers/${nextEvent.id}`)}
            className="bg-[#14171E] border border-gray-800 rounded-[22px] p-7 relative overflow-hidden cursor-pointer active:scale-[0.99] transition-transform"
          >
            <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-[#8FD3FF]" style={{ boxShadow: '0 0 10px #8FD3FF' }}></div>
            <div className="absolute bottom-4 left-4 w-2 h-2 rounded-full bg-[#3A4150]"></div>
            <div className="flex items-center justify-between mb-5">
              <span className="font-label text-[11px] tracking-[0.22em] uppercase text-[#8FD3FF]">[ 02 ] Next event</span>
              <span className="font-label text-[11px] tracking-[0.22em] uppercase text-gray-500">In {nextEvent.daysUntil} {nextEvent.daysUntil === 1 ? 'day' : 'days'}</span>
            </div>
            <h2 className="text-3xl md:text-4xl text-white mb-3 leading-none">{nextEvent.artist}</h2>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-gray-400 mb-6">
              <span className="flex items-center gap-2"><MapPin className="h-4 w-4 text-[#8FD3FF]" />{nextEvent.venue}</span>
              <span className="flex items-center gap-2"><Calendar className="h-4 w-4 text-[#8FD3FF]" />{nextEvent.date}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-[#08090D] border border-[#2A3040] rounded-2xl p-4">
                <p className="font-label text-[10px] tracking-[0.2em] uppercase text-gray-500 mb-1">Expected profit</p>
                <p className="font-display text-2xl text-[#8FD3FF]">${(nextEvent.profit / 1000).toFixed(1)}K</p>
              </div>
              <div className="bg-[#08090D] border border-[#2A3040] rounded-2xl p-4">
                <p className="font-label text-[10px] tracking-[0.2em] uppercase text-gray-500 mb-1">Capacity</p>
                <p className="font-display text-2xl text-white">{nextEvent.capacity}</p>
              </div>
            </div>
            <button className="w-full bg-[#8FD3FF] text-[#04214D] rounded-xl py-4 text-sm">
              View event details →
            </button>
          </div>
        )}

        {/* Coming up */}
        {upcomingEvents.length > 0 && (
          <div className="bg-[#14171E] border border-gray-800 rounded-[22px] p-7">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-baseline gap-3">
                <span className="font-label text-[11px] tracking-[0.22em] uppercase text-[#8FD3FF]">[ 03 ]</span>
                <h2 className="text-2xl text-white">Coming up</h2>
              </div>
              <button onClick={() => navigate('/offers')} className="text-[#8FD3FF] hover:text-white text-xs transition-colors">
                View all →
              </button>
            </div>
            <div className="hidden md:grid grid-cols-[2fr_1.6fr_1fr_1fr_1.1fr] gap-3 px-3 pb-2 font-label text-[11px] tracking-[0.2em] uppercase text-gray-500">
              <span>Artist</span><span>Venue</span><span>Date</span><span>Net profit</span><span>Status</span>
            </div>
            <div>
              {upcomingEvents.map((event) => (
                <div
                  key={event.id}
                  onClick={() => navigate(`/offers/${event.id}`)}
                  className="grid grid-cols-2 md:grid-cols-[2fr_1.6fr_1fr_1fr_1.1fr] gap-3 items-center px-3 py-4 border-t border-[#1F2430] hover:bg-white/[0.03] cursor-pointer transition-colors"
                >
                  <span className="text-white font-semibold">{event.artist}</span>
                  <span className="text-gray-400">{event.venue}</span>
                  <span className="text-gray-400">{event.date} <span className="text-[#8FD3FF] text-xs ml-1">{event.daysUntil}d</span></span>
                  <span className="text-[#8FD3FF] font-semibold">${(event.profit / 1000).toFixed(1)}K</span>
                  <span className={`justify-self-start font-label text-[10px] tracking-[0.16em] uppercase px-2.5 py-1 rounded-md ${getStatusBadgeColor(event.status)}`}>
                    {event.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Forecast + tours */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-[#14171E] border border-gray-800 rounded-[22px] p-7 relative overflow-hidden">
            <p className="font-label text-[11px] tracking-[0.22em] uppercase text-gray-500 mb-2">Revenue forecast · next 30 days</p>
            <h3 className="font-display text-5xl text-[#8FD3FF] mb-6" style={{ textShadow: '0 0 18px rgba(143,211,255,0.45)' }}>
              ${((stats?.forecastRevenue || 0) / 1000).toFixed(1)}K
            </h3>
            <div className="flex items-end justify-around h-24 gap-2">
              {[40, 60, 85, 100, 75].map((h, i) => (
                <div key={i} className="w-full rounded-t-lg" style={{ height: `${h}%`, background: i === 3 ? '#8FD3FF' : 'rgba(143,211,255,0.28)' }}></div>
              ))}
            </div>
          </div>

          <div className="bg-[#14171E] border border-gray-800 rounded-[22px] p-7">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-2xl bg-[#08090D] border border-[#2A3040] flex items-center justify-center">
                <span className="font-display text-2xl text-[#8FD3FF]">{stats?.activeTours || 0}</span>
              </div>
              <div>
                <p className="font-label text-[11px] tracking-[0.22em] uppercase text-gray-500">Active tours</p>
                <h4 className="text-2xl text-white">{stats?.totalShows || 0} shows</h4>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-label text-[11px] tracking-[0.2em] uppercase text-gray-400">Upcoming</span>
                  <span className="text-white font-semibold">{stats?.upcomingShows || 0}</span>
                </div>
                <div className="w-full h-2 bg-[#08090D] rounded-full overflow-hidden">
                  <div className="h-full bg-[#8FD3FF] rounded-full transition-all duration-1000" style={{ width: `${upcomingProgress}%` }}></div>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-label text-[11px] tracking-[0.2em] uppercase text-gray-400">Completed</span>
                  <span className="text-white font-semibold">{stats?.completedShows || 0}</span>
                </div>
                <div className="w-full h-2 bg-[#08090D] rounded-full overflow-hidden">
                  <div className="h-full bg-[#6FB8F2] rounded-full transition-all duration-1000" style={{ width: `${completedProgress}%` }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {showAILearning && (
          <div className="bg-[#14171E] border border-gray-800 rounded-[22px] p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#8FD3FF] to-[#6FB8F2] rounded-3xl mb-4">
              <Sparkles className="h-8 w-8 text-[#04214D]" />
            </div>

            <h4 className="text-2xl text-white mb-2">AI Learning Mode</h4>
            <p className="text-gray-400 mb-6">
              Need {5 - settledShows} more settled {5 - settledShows === 1 ? 'show' : 'shows'} to generate insights
            </p>

            <div className="max-w-xs mx-auto">
              <div className="flex items-center justify-between mb-2 text-sm">
                <span className="text-gray-400 font-semibold">Progress</span>
                <span className="text-[#8FD3FF] font-bold">{settledShows} / 5</span>
              </div>
              <div className="w-full h-2 bg-[#08090D] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#8FD3FF] transition-all duration-1000"
                  style={{width: `${(settledShows / 5) * 100}%`}}
                ></div>
              </div>
            </div>
          </div>
        )}

        {!showAILearning && (
          <div className="mt-8">
            <AIInsights />
          </div>
        )}
      </div>

    </div>
    </>
  );
}
