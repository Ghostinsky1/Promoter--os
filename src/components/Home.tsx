import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  Calendar,
  MapPin,
  Bell,
  Plus,
  Sparkles
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useOrganization } from '../hooks/useOrganization';
import { AIInsights } from './AIInsights';
import { SubscriptionRequired } from './SubscriptionRequired';
import { TrialBanner } from './TrialBanner';

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
        const monthProfit = activeOffers
          .filter(o => {
            const eventDate = new Date(o.show.event_date);
            return eventDate.getMonth() === thisMonth &&
                   eventDate.getFullYear() === thisYear;
          })
          .reduce((sum, o) => sum + (o.calculations?.netProfit || 0), 0);

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
          totalProfit,
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
      case 'confirmed': return 'bg-[#8FD3FF]/20 text-[#8FD3FF] border-0';
      case 'settled': return 'bg-green-500/20 text-green-400 border-0';
      case 'offer_sent': return 'bg-blue-500/20 text-blue-400 border-0';
      default: return 'bg-purple-500/20 text-purple-400 border-0';
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

  return (
    <>
      <TrialBanner />
      <div className="min-h-screen bg-black">
      <div className="sticky top-0 z-50 bg-black/95 backdrop-blur-lg border-b border-gray-900">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center gap-3">
              <img
                src="/untitled_project_-_standard_1_(13).png"
                alt="PROMTP Logo"
                className="w-12 h-12 object-contain"
              />
              <div>
                <p className="text-gray-500 text-xs">Welcome back,</p>
                <h1 className="text-white font-bold text-lg">{user?.email?.split('@')[0] || 'User'}</h1>
              </div>
            </div>

            <button className="w-10 h-10 rounded-full bg-[#14171E] border border-gray-800 p-0 hover:bg-[#22262F] flex items-center justify-center transition-colors">
              <Bell className="h-5 w-5 text-gray-400" />
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 max-w-7xl mx-auto space-y-6">
        <div>
          <div className="grid grid-cols-1 gap-2">
            <div
              onClick={() => navigate('/offers/create')}
              className="bg-gradient-to-r from-purple-600 to-purple-500 rounded-[20px] p-4 cursor-pointer hover:opacity-90 active:scale-[0.98] transition-all shadow-lg"
            >
              <div className="flex items-center justify-between">
                <div className="text-white">
                  <p className="text-[10px] font-medium opacity-80 mb-0.5">Quick Action</p>
                  <h4 className="text-lg font-bold leading-tight">Create New Offer</h4>
                </div>
                <div className="bg-white/20 rounded-full p-2 flex-shrink-0">
                  <Plus className="h-5 w-5 text-white" strokeWidth={2.5} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div
                onClick={() => navigate('/tours')}
                className="bg-gradient-to-br from-blue-600 to-cyan-500 rounded-[20px] p-4 cursor-pointer hover:opacity-90 active:scale-[0.98] transition-all shadow-lg"
              >
                <div className="text-white">
                  <p className="text-[10px] font-medium opacity-80 mb-0.5">Quick Action</p>
                  <h4 className="text-base font-bold leading-tight">View Tours</h4>
                </div>
              </div>

              <div
                onClick={() => navigate('/offers')}
                className="bg-gradient-to-br from-green-600 to-green-500 rounded-[20px] p-4 cursor-pointer hover:opacity-90 active:scale-[0.98] transition-all shadow-lg"
              >
                <div className="text-white">
                  <p className="text-[10px] font-medium opacity-80 mb-0.5">Quick Action</p>
                  <h4 className="text-base font-bold leading-tight">All Offers</h4>
                </div>
              </div>
            </div>
          </div>
        </div>

        {nextEvent && (
          <div
            onClick={() => navigate(`/offers/${nextEvent.id}`)}
            className="bg-gradient-to-br from-[#8FD3FF] to-[#6FB8F2] border-0 rounded-3xl p-6 relative overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
          >
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-black/20 text-[#04214D] border-0 text-xs font-bold px-3 py-1 rounded-full">
                  NEXT EVENT
                </div>
                <span className="text-[#04214D]/70 text-sm font-semibold">
                  IN {nextEvent.daysUntil} {nextEvent.daysUntil === 1 ? 'DAY' : 'DAYS'}
                </span>
              </div>

              <h2 className="text-3xl font-bold text-[#04214D] mb-2">{nextEvent.artist}</h2>
              <div className="flex items-center gap-2 text-[#04214D]/80 mb-1">
                <MapPin className="h-4 w-4" />
                <span className="font-semibold">{nextEvent.venue}</span>
              </div>
              <div className="flex items-center gap-2 text-[#04214D]/80 mb-6">
                <Calendar className="h-4 w-4" />
                <span className="font-semibold">{nextEvent.date}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-black/10 rounded-2xl p-4">
                  <p className="text-[#04214D]/70 text-xs mb-1">Expected Profit</p>
                  <p className="text-2xl font-bold text-[#04214D]">
                    ${(nextEvent.profit / 1000).toFixed(1)}K
                  </p>
                </div>
                <div className="bg-black/10 rounded-2xl p-4">
                  <p className="text-[#04214D]/70 text-xs mb-1">Capacity</p>
                  <p className="text-2xl font-bold text-[#04214D]">{nextEvent.capacity}</p>
                </div>
              </div>

              <button className="w-full mt-4 bg-black text-[#8FD3FF] hover:bg-gray-900 rounded-2xl py-4 font-bold transition-colors">
                View Event Details →
              </button>
            </div>

            <div className="absolute -right-12 -top-12 w-64 h-64 bg-white/20 rounded-full blur-3xl"></div>
          </div>
        )}

        <div>
          <h3 className="text-white font-bold text-lg mb-4">Today's Snapshot</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#14171E] border border-gray-800 rounded-3xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-blue-500" />
                </div>
              </div>
              <p className="text-gray-500 text-xs mb-1">Active Events</p>
              <p className="text-4xl font-bold text-white">{stats?.activeEvents || 0}</p>
            </div>

            <div className="bg-[#14171E] border border-gray-800 rounded-3xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </div>
              </div>
              <p className="text-gray-500 text-xs mb-1">This Month</p>
              <p className="text-4xl font-bold text-green-500">
                ${((stats?.monthProfit || 0) / 1000).toFixed(1)}K
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#14171E] border border-gray-800 rounded-2xl p-4 text-center">
            <p className="text-gray-500 text-xs mb-2">Revenue</p>
            <p className="text-xl font-bold text-white">
              ${((stats?.revenue || 0) / 1000).toFixed(1)}K
            </p>
          </div>

          <div className="bg-[#14171E] border border-gray-800 rounded-2xl p-4 text-center">
            <p className="text-gray-500 text-xs mb-2">Shows</p>
            <p className="text-xl font-bold text-white">{stats?.totalShows || 0}</p>
          </div>

          <div className="bg-[#14171E] border border-gray-800 rounded-2xl p-4 text-center">
            <p className="text-gray-500 text-xs mb-2">Margin</p>
            <p className="text-xl font-bold text-[#8FD3FF]">
              {Math.round(stats?.margin || 0)}%
            </p>
          </div>
        </div>

        {upcomingEvents.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold text-lg">Coming Up</h3>
              <button
                onClick={() => navigate('/offers')}
                className="text-[#8FD3FF] hover:text-[#6FB8F2] text-sm transition-colors"
              >
                View All →
              </button>
            </div>

            <div className="space-y-3">
              {upcomingEvents.map((event, index) => (
                <div
                  key={event.id}
                  onClick={() => navigate(`/offers/${event.id}`)}
                  className="bg-[#14171E] border border-gray-800 rounded-2xl p-4 active:bg-[#22262F] transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-2 h-2 rounded-full ${
                          event.daysUntil <= 3 ? 'bg-[#8FD3FF]' : 'bg-blue-500'
                        }`}></div>
                        <h4 className="text-white font-bold">{event.artist}</h4>
                      </div>
                      <p className="text-gray-500 text-sm mb-2">{event.venue}</p>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-gray-400">{event.date}</span>
                        <span className="text-[#8FD3FF] font-semibold">
                          {event.daysUntil} {event.daysUntil === 1 ? 'day' : 'days'}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-green-500 font-bold text-lg">
                        ${(event.profit / 1000).toFixed(1)}K
                      </p>
                      <div className={`mt-1 text-xs px-2 py-1 rounded-full inline-block ${getStatusBadgeColor(event.status)}`}>
                        {event.status.replace('_', ' ').toUpperCase()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-gradient-to-br from-blue-600 to-cyan-500 border-0 rounded-3xl p-6 relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-blue-100 text-sm mb-2">Revenue Forecast</p>
            <h3 className="text-5xl font-bold text-white mb-2">
              ${((stats?.forecastRevenue || 0) / 1000).toFixed(1)}K
            </h3>
            <p className="text-blue-100 text-sm mb-6">Next 30 days projection</p>

            <div className="flex items-end justify-around h-24 gap-2">
              <div className="w-full bg-white/40 rounded-t-xl" style={{height: '40%'}}></div>
              <div className="w-full bg-white/40 rounded-t-xl" style={{height: '60%'}}></div>
              <div className="w-full bg-white/60 rounded-t-xl" style={{height: '85%'}}></div>
              <div className="w-full bg-white/80 rounded-t-xl" style={{height: '100%'}}></div>
              <div className="w-full bg-white/60 rounded-t-xl" style={{height: '75%'}}></div>
            </div>
          </div>
        </div>

        <div className="bg-[#14171E] border border-gray-800 rounded-3xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center">
              <span className="text-2xl font-bold text-white">{stats?.activeTours || 0}</span>
            </div>
            <div>
              <p className="text-gray-500 text-sm">Active Tours</p>
              <h4 className="text-2xl font-bold text-white">{stats?.totalShows || 0} Shows</h4>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-white text-sm font-semibold">Upcoming</span>
                <span className="text-white font-bold">{stats?.upcomingShows || 0}</span>
              </div>
              <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-600 to-purple-500 rounded-full transition-all duration-1000"
                  style={{width: `${upcomingProgress}%`}}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-white text-sm font-semibold">Completed</span>
                <span className="text-green-500 font-bold">{stats?.completedShows || 0}</span>
              </div>
              <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all duration-1000"
                  style={{width: `${completedProgress}%`}}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {showAILearning && (
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 border-0 rounded-3xl p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#8FD3FF] to-[#6FB8F2] rounded-3xl mb-4">
              <Sparkles className="h-8 w-8 text-[#04214D]" />
            </div>

            <h4 className="text-2xl font-bold text-[#04214D] mb-2">AI Learning Mode</h4>
            <p className="text-gray-700 mb-6">
              Need {5 - settledShows} more settled {5 - settledShows === 1 ? 'show' : 'shows'} to generate insights
            </p>

            <div className="max-w-xs mx-auto">
              <div className="flex items-center justify-between mb-2 text-sm">
                <span className="text-gray-600 font-semibold">Progress</span>
                <span className="text-[#04214D] font-bold">{settledShows} / 5</span>
              </div>
              <div className="w-full h-3 bg-purple-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-600 to-pink-600 transition-all duration-1000"
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
