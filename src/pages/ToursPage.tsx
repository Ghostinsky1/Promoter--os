import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, MapPin, Calendar, DollarSign, Music2, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Tour, TourWithDates } from '../types';
import { useAuth } from '../hooks/useAuth';
import { formatCurrency } from '../lib/calculations';
import { FeatureGate } from '../components/FeatureGate';

export function ToursPage() {
  return (
    <FeatureGate feature="tours">
      <ToursPageContent />
    </FeatureGate>
  );
}

function ToursPageContent() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tours, setTours] = useState<TourWithDates[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusMenuOpen, setStatusMenuOpen] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadTours();
    }
  }, [user]);

  useEffect(() => {
    const handleClickOutside = () => {
      if (statusMenuOpen) {
        setStatusMenuOpen(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [statusMenuOpen]);

  const loadTours = async () => {
    try {
      console.log('🔍 Loading tours...');

      if (!user) {
        console.log('⚠️ No user logged in');
        setTours([]);
        setLoading(false);
        return;
      }

      console.log('✅ User authenticated:', user.id);

      const { data: memberData } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!memberData?.organization_id) {
        console.log('⚠️ No organization found for user');
        setTours([]);
        setLoading(false);
        return;
      }

      console.log('🏢 Organization ID:', memberData.organization_id);

      const { data: toursData, error: toursError } = await supabase
        .from('tours')
        .select('*')
        .eq('organization_id', memberData.organization_id)
        .order('created_at', { ascending: false });

      if (toursError) {
        console.error('❌ Tours error:', toursError);
        throw toursError;
      }

      console.log('📊 Tours loaded:', toursData?.length || 0);

      if (toursData) {
        const toursWithDates = await Promise.all(
          toursData.map(async (tour) => {
            const { data: offers } = await supabase
              .from('offers')
              .select('*, show:shows(*)')
              .eq('tour_id', tour.id)
              .eq('organization_id', memberData.organization_id)
              .order('show_number', { ascending: true });

            const dates = offers?.map((offer: any) => ({
              offer_id: offer.id,
              event_date: offer.show.event_date,
              venue_name: offer.show.venue_name,
              city: offer.show.venue_name.split(',')[1]?.trim() || 'TBD',
              capacity: offer.show.capacity,
              net_profit: offer.calculations?.netProfit || 0,
              gross_potential: offer.calculations?.grossPotential || 0,
              total_expenses: offer.calculations?.totalExpenses || 0,
              status: offer.status || 'planning',
              show_number: offer.show_number || 0
            })) || [];

            const activeDates = dates.filter(d => d.status !== 'cancelled');

            const projected_revenue = activeDates.reduce((sum, d) => {
              const revenue = parseFloat(d.gross_potential) || 0;
              return sum + revenue;
            }, 0);

            const total_costs = activeDates.reduce((sum, d) => {
              const costs = parseFloat(d.total_expenses) || 0;
              return sum + costs;
            }, 0);

            const net_profit = activeDates.reduce((sum, d) => {
              const profit = parseFloat(d.net_profit) || 0;
              return sum + profit;
            }, 0);

            const settled_count = activeDates.filter(d => d.status === 'settled' || d.status === 'completed').length;

            console.log(`Tour: ${tour.name}`);
            console.log(`  Shows: ${dates.length}`);
            console.log(`  Revenue: ${projected_revenue}`);
            console.log(`  Costs: ${total_costs}`);
            console.log(`  Profit: ${net_profit}`);

            return {
              ...tour,
              dates,
              projected_revenue,
              total_costs,
              net_profit,
              settled_count
            };
          })
        );

        console.log('✅ Tours with dates loaded:', toursWithDates.length);
        setTours(toursWithDates);
      }
    } catch (error) {
      console.error('❌ Error loading tours:', error);
      setTours([]);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalProjectedProfit = () => {
    return tours.reduce((sum, tour) => sum + (tour.net_profit || 0), 0);
  };

  const getUniqueCities = () => {
    const cities = new Set<string>();
    tours.forEach(tour => {
      tour.dates?.forEach(date => cities.add(date.city));
    });
    return cities.size;
  };

  const getTotalShows = () => {
    return tours.reduce((sum, tour) => sum + (tour.dates?.length || 0), 0);
  };

  const getTourStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      planning: 'bg-slate-500/20 text-slate-400 border border-slate-500/30',
      booking: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
      confirmed: 'bg-green-500/20 text-green-400 border border-green-500/30',
      active: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
      completed: 'bg-gray-500/20 text-gray-400 border border-gray-500/30',
      cancelled: 'bg-red-500/20 text-red-400 border border-red-500/30'
    };
    return colors[status] || colors.planning;
  };

  const getTourProgress = (tour: TourWithDates) => {
    if (!tour.dates || tour.dates.length === 0) return 0;
    const completed = tour.dates.filter(d => d.status === 'settled' || d.status === 'completed').length;
    return Math.round((completed / tour.dates.length) * 100);
  };

  const updateTourStatus = async (tourId: string, newStatus: string, event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      const { error } = await supabase
        .from('tours')
        .update({ status: newStatus })
        .eq('id', tourId);

      if (error) throw error;

      setTours(tours.map(tour =>
        tour.id === tourId ? { ...tour, status: newStatus } : tour
      ));
      setStatusMenuOpen(null);
    } catch (error) {
      console.error('Error updating tour status:', error);
      alert('Failed to update tour status');
    }
  };

  const toggleStatusMenu = (tourId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setStatusMenuOpen(statusMenuOpen === tourId ? null : tourId);
  };

  const statusOptions = ['planning', 'booking', 'confirmed', 'active', 'completed', 'cancelled'];

  if (loading) {
    return <div className="min-h-screen bg-[#1140F0] flex items-center justify-center text-white">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-[#1140F0]">
      <div className="bg-[#14171E] border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Tours</h1>
              <p className="text-gray-400 mt-1">Manage multi-city tours and track performance</p>
            </div>
            <button
              onClick={() => navigate('/tours/create')}
              className="flex items-center gap-2 px-4 py-2 bg-[#8FD3FF] hover:bg-[#6FB8F2] text-[#04214D] rounded-2xl font-bold transition-colors"
            >
              <Plus className="h-5 w-5" />
              Create Tour
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-[#14171E] border border-gray-800 text-white rounded-2xl hover:border-[#8FD3FF]/50 transition-colors">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-[#8FD3FF]/10 rounded-xl">
                <Music2 className="h-6 w-6 text-[#8FD3FF]" />
              </div>
              <div className="text-3xl font-bold text-white">{tours.length}</div>
            </div>
            <div className="text-sm text-gray-400">Active Tours</div>
          </div>

          <div className="p-4 bg-[#14171E] border border-gray-800 text-white rounded-2xl hover:border-blue-500/50 transition-colors">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-500/10 rounded-xl">
                <Calendar className="h-6 w-6 text-blue-400" />
              </div>
              <div className="text-3xl font-bold text-white">{getTotalShows()}</div>
            </div>
            <div className="text-sm text-gray-400">Total Shows</div>
          </div>

          <div className="p-4 bg-[#14171E] border border-gray-800 text-white rounded-2xl hover:border-green-500/50 transition-colors">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-green-500/10 rounded-xl">
                <DollarSign className="h-6 w-6 text-green-400" />
              </div>
              <div className="text-3xl font-bold text-white">
                ${Math.round(calculateTotalProjectedProfit() / 1000)}K
              </div>
            </div>
            <div className="text-sm text-gray-400">Projected Profit</div>
          </div>

          <div className="p-4 bg-[#14171E] border border-gray-800 text-white rounded-2xl hover:border-orange-500/50 transition-colors">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-orange-500/10 rounded-xl">
                <MapPin className="h-6 w-6 text-orange-400" />
              </div>
              <div className="text-3xl font-bold text-white">{getUniqueCities()}</div>
            </div>
            <div className="text-sm text-gray-400">Cities</div>
          </div>
        </div>

        {tours.length === 0 ? (
          <div className="bg-[#14171E] border border-gray-800 rounded-3xl p-12 text-center">
            <div className="w-20 h-20 bg-[#0B0D12] border border-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Music2 className="h-10 w-10 text-gray-600" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No Tours Yet</h3>
            <p className="text-gray-400 mb-6">
              Create your first tour to manage multiple shows
            </p>
            <button
              onClick={() => navigate('/tours/create')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#8FD3FF] hover:bg-[#6FB8F2] text-[#04214D] rounded-2xl font-bold transition-colors"
            >
              <Plus className="h-5 w-5" />
              Create Tour
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {tours.map((tour) => (
              <div
                key={tour.id}
                className="bg-[#14171E] border-2 border-gray-700 rounded-3xl p-6 hover:shadow-xl hover:border-[#8FD3FF]/50 transition-all cursor-pointer"
                onClick={() => navigate(`/tours/${tour.id}`)}
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-[#8FD3FF] to-[#6FB8F2] rounded-2xl flex items-center justify-center text-[#04214D] text-2xl font-bold flex-shrink-0">
                    {tour.artist_name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold text-white mb-1 truncate">{tour.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Music2 className="h-4 w-4" />
                      <span>{tour.artist_name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-400 mt-1">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {new Date(tour.start_date).toLocaleDateString()} - {new Date(tour.end_date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="relative">
                    <button
                      onClick={(e) => toggleStatusMenu(tour.id, e)}
                      className={`text-xs px-2.5 py-1 rounded-xl font-medium hover:opacity-80 transition-opacity ${getTourStatusColor(tour.status)}`}
                    >
                      {tour.status}
                    </button>
                    {statusMenuOpen === tour.id && (
                      <div className="absolute right-0 top-full mt-2 bg-[#14171E] border border-gray-700 rounded-xl shadow-xl z-10 min-w-[140px]">
                        {statusOptions.map((status) => (
                          <button
                            key={status}
                            onClick={(e) => updateTourStatus(tour.id, status, e)}
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-800 transition-colors first:rounded-t-xl last:rounded-b-xl ${
                              status === tour.status ? 'bg-gray-800' : ''
                            }`}
                          >
                            <span className={`inline-block px-2 py-0.5 rounded-lg text-xs font-medium ${getTourStatusColor(status)}`}>
                              {status}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3 mb-4">
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 text-center">
                    <div className="text-xl font-bold text-blue-400">
                      {tour.dates?.length || 0}
                    </div>
                    <div className="text-xs text-gray-400">Shows</div>
                  </div>
                  <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 text-center">
                    <div className="text-lg font-bold text-green-400">
                      ${Math.round((tour.projected_revenue || 0) / 1000)}K
                    </div>
                    <div className="text-xs text-gray-400">Revenue</div>
                  </div>
                  <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-3 text-center">
                    <div className="text-lg font-bold text-orange-400">
                      ${Math.round((tour.total_costs || 0) / 1000)}K
                    </div>
                    <div className="text-xs text-gray-400">Costs</div>
                  </div>
                  <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-3 text-center">
                    <div className={`text-lg font-bold ${
                      (tour.net_profit || 0) >= 0 ? 'text-[#8FD3FF]' : 'text-red-500'
                    }`}>
                      ${Math.round((tour.net_profit || 0) / 1000)}K
                    </div>
                    <div className="text-xs text-gray-400">Profit</div>
                  </div>
                </div>

                <div className="mb-3">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Tour Progress</span>
                    <span>{getTourProgress(tour)}%</span>
                  </div>
                  <div className="w-full h-2 bg-[#0B0D12] border border-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#8FD3FF] to-[#6FB8F2] transition-all"
                      style={{ width: `${getTourProgress(tour)}%` }}
                    />
                  </div>
                </div>

                {tour.dates && tour.dates.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <MapPin className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">
                      {tour.dates.slice(0, 3).map(d => d.city).join(', ')}
                      {tour.dates.length > 3 && ` +${tour.dates.length - 3} more`}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
