import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Music2, MapPin, Users, Plus, Download, Edit, ChevronRight, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { TourWithDates } from '../types';
import { formatCurrency } from '../lib/calculations';
import { parseLocalDate } from '../lib/dateHelpers';

export function TourDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tour, setTour] = useState<TourWithDates | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddShow, setShowAddShow] = useState(false);
  const [availableOffers, setAvailableOffers] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);

  useEffect(() => {
    if (id) {
      loadTourData();
      loadAvailableOffers();
      loadSettlements();
    }
  }, [id]);

  useEffect(() => {
    const handleClickOutside = () => {
      if (statusMenuOpen) {
        setStatusMenuOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [statusMenuOpen]);

  const loadTourData = async () => {
    try {
      const { data: tourData } = await supabase
        .from('tours')
        .select('*')
        .eq('id', id)
        .single();

      if (tourData) {
        const { data: offers } = await supabase
          .from('offers')
          .select('*, show:shows(*)')
          .eq('tour_id', id)
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

        console.log('=== TOUR CALCULATIONS ===');
        console.log('Number of shows:', dates.length);
        console.log('Projected Revenue:', projected_revenue);
        console.log('Total Costs:', total_costs);
        console.log('Net Profit:', net_profit);
        console.log('Shows data:', dates);

        setTour({
          ...tourData,
          dates,
          projected_revenue,
          total_costs,
          net_profit
        });
      }
    } catch (error) {
      console.error('Error loading tour:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableOffers = async () => {
    try {
      const { data } = await supabase
        .from('offers')
        .select('*, show:shows(*)')
        .is('tour_id', null);

      if (data) {
        setAvailableOffers(data);
      }
    } catch (error) {
      console.error('Error loading offers:', error);
    }
  };

  const loadSettlements = async () => {
    try {
      const { data: offers } = await supabase
        .from('offers')
        .select('id')
        .eq('tour_id', id);

      if (offers && offers.length > 0) {
        const offerIds = offers.map(o => o.id);

        const { data: settlementsData } = await supabase
          .from('settlements')
          .select('*')
          .in('offer_id', offerIds);

        if (settlementsData) {
          setSettlements(settlementsData);
        }
      }
    } catch (error) {
      console.error('Error loading settlements:', error);
    }
  };

  const calculateSettlementTotals = () => {
    if (settlements.length === 0) {
      return null;
    }

    const actual_revenue = settlements.reduce((sum, s) => {
      const revenue = parseFloat(s.actual_revenue) || 0;
      return sum + revenue;
    }, 0);

    const actual_expenses = settlements.reduce((sum, s) => {
      const expenses = parseFloat(s.actual_total_expenses) || 0;
      return sum + expenses;
    }, 0);

    const actual_profit = settlements.reduce((sum, s) => {
      const profit = parseFloat(s.actual_net_profit) || 0;
      return sum + profit;
    }, 0);

    const projected_revenue = settlements.reduce((sum, s) => {
      const revenue = parseFloat(s.projected_revenue) || 0;
      return sum + revenue;
    }, 0);

    const projected_expenses = settlements.reduce((sum, s) => {
      const expenses = parseFloat(s.projected_expenses) || 0;
      return sum + expenses;
    }, 0);

    const projected_profit = settlements.reduce((sum, s) => {
      const profit = parseFloat(s.projected_profit) || 0;
      return sum + profit;
    }, 0);

    return {
      actual_revenue,
      actual_expenses,
      actual_profit,
      projected_revenue,
      projected_expenses,
      projected_profit,
      variance_revenue: actual_revenue - projected_revenue,
      variance_expenses: actual_expenses - projected_expenses,
      variance_profit: actual_profit - projected_profit,
      settled_count: settlements.length
    };
  };

  const addShowToTour = async (offerId: string) => {
    try {
      const nextShowNumber = (tour?.dates?.length || 0) + 1;

      const { error } = await supabase
        .from('offers')
        .update({
          tour_id: id,
          show_number: nextShowNumber
        })
        .eq('id', offerId);

      if (error) throw error;

      loadTourData();
      loadAvailableOffers();
      setShowAddShow(false);
    } catch (error) {
      console.error('Error adding show to tour:', error);
      alert('Failed to add show to tour');
    }
  };

  const updateTourStatus = async (newStatus: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (!tour) return;

    try {
      const { error } = await supabase
        .from('tours')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

      setTour({ ...tour, status: newStatus });
      setStatusMenuOpen(false);
    } catch (error) {
      console.error('Error updating tour status:', error);
      alert('Failed to update tour status');
    }
  };

  const toggleStatusMenu = (event: React.MouseEvent) => {
    event.stopPropagation();
    setStatusMenuOpen(!statusMenuOpen);
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

  const statusOptions = ['planning', 'booking', 'confirmed', 'active', 'completed', 'cancelled'];

  if (loading) {
    return <div className="min-h-screen bg-[#1140F0] flex items-center justify-center text-white">Loading...</div>;
  }

  if (!tour) {
    return <div className="min-h-screen bg-[#1140F0] flex items-center justify-center text-white">Tour not found</div>;
  }

  return (
    <div className="min-h-screen bg-[#1140F0]">
      <div className="bg-[#14171E] border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex items-start gap-3 sm:gap-4 mb-6">
            <button
              onClick={() => navigate('/tours')}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0"
            >
              <ArrowLeft className="h-5 w-5 text-gray-400" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold mb-2 truncate text-white">{tour.name}</h1>
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-400">
                <span className="flex items-center gap-1.5">
                  <Music2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="truncate">{tour.artist_name}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="truncate">
                    {new Date(tour.start_date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' })} - {new Date(tour.end_date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' })}
                  </span>
                </span>
                <div className="relative">
                  <button
                    onClick={toggleStatusMenu}
                    className={`px-3 py-1 rounded-xl text-xs font-medium hover:opacity-80 transition-opacity ${getTourStatusColor(tour.status)}`}
                  >
                    {tour.status}
                  </button>
                  {statusMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 bg-[#14171E] border border-gray-700 rounded-xl shadow-xl z-10 min-w-[140px]">
                      {statusOptions.map((status) => (
                        <button
                          key={status}
                          onClick={(e) => updateTourStatus(status, e)}
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
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#1140F0] border border-gray-800 rounded-2xl p-4 hover:border-blue-500/50 transition-colors">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-500/10 rounded-xl">
                  <Calendar className="h-5 w-5 text-blue-400" />
                </div>
                <div className="text-3xl font-bold text-white">{tour.dates?.length || 0}</div>
              </div>
              <div className="text-sm text-gray-400">Total Shows</div>
            </div>

            <div className="bg-[#1140F0] border border-gray-800 rounded-2xl p-4 hover:border-green-500/50 transition-colors">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-green-500/10 rounded-xl">
                  <DollarSign className="h-5 w-5 text-green-400" />
                </div>
                <div className="text-xl sm:text-2xl font-bold text-white truncate">
                  {formatCurrency(tour.projected_revenue || 0)}
                </div>
              </div>
              <div className="text-sm text-gray-400">Projected Revenue</div>
            </div>

            <div className="bg-[#1140F0] border border-gray-800 rounded-2xl p-4 hover:border-orange-500/50 transition-colors">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-orange-500/10 rounded-xl">
                  <TrendingDown className="h-5 w-5 text-orange-400" />
                </div>
                <div className="text-xl sm:text-2xl font-bold text-white truncate">
                  {formatCurrency(tour.total_costs || 0)}
                </div>
              </div>
              <div className="text-sm text-gray-400">Total Costs</div>
            </div>

            <div className="bg-[#1140F0] border border-gray-800 rounded-2xl p-4 hover:border-[#8FD3FF]/50 transition-colors col-span-2 sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-green-500/10 rounded-xl">
                  <TrendingUp className="h-5 w-5 text-green-400" />
                </div>
                <div className={`text-xl sm:text-2xl font-bold truncate ${
                  (tour.net_profit || 0) >= 0 ? 'text-[#8FD3FF]' : 'text-red-400'
                }`}>
                  {(tour.net_profit || 0) >= 0 ? '+' : ''}{formatCurrency(tour.net_profit || 0)}
                </div>
              </div>
              <div className="text-sm text-gray-400">Net Profit</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {calculateSettlementTotals() && (
          <div className="bg-[#14171E] border border-gray-800 rounded-2xl p-4 sm:p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-white">Settlement Overview</h3>
                <p className="text-sm text-gray-400 mt-1">
                  {calculateSettlementTotals()!.settled_count} of {tour?.dates?.length || 0} shows settled
                </p>
              </div>
              <span className="px-3 py-1 bg-green-500/20 text-green-400 border border-green-500/30 rounded-xl text-sm font-medium">
                Settled Events
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Revenue Comparison */}
              <div className="p-4 bg-green-500/10 rounded-xl border border-green-500/30">
                <div className="text-sm font-semibold text-green-400 mb-3">Revenue</div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">Projected:</span>
                    <span className="text-sm font-bold text-gray-300">
                      {formatCurrency(calculateSettlementTotals()!.projected_revenue)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">Actual:</span>
                    <span className="text-sm font-bold text-green-400">
                      {formatCurrency(calculateSettlementTotals()!.actual_revenue)}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-green-500/30">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-gray-300">Variance:</span>
                      <span className={`text-sm font-bold ${
                        calculateSettlementTotals()!.variance_revenue >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {calculateSettlementTotals()!.variance_revenue >= 0 ? '+' : ''}
                        {formatCurrency(calculateSettlementTotals()!.variance_revenue)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Expenses Comparison */}
              <div className="p-4 bg-orange-500/10 rounded-xl border border-orange-500/30">
                <div className="text-sm font-semibold text-orange-400 mb-3">Expenses</div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">Projected:</span>
                    <span className="text-sm font-bold text-gray-300">
                      {formatCurrency(calculateSettlementTotals()!.projected_expenses)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">Actual:</span>
                    <span className="text-sm font-bold text-orange-400">
                      {formatCurrency(calculateSettlementTotals()!.actual_expenses)}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-orange-500/30">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-gray-300">Variance:</span>
                      <span className={`text-sm font-bold ${
                        calculateSettlementTotals()!.variance_expenses <= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {calculateSettlementTotals()!.variance_expenses >= 0 ? '+' : ''}
                        {formatCurrency(calculateSettlementTotals()!.variance_expenses)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Profit Comparison */}
              <div className="p-4 bg-purple-500/10 rounded-xl border border-purple-500/30">
                <div className="text-sm font-semibold text-purple-400 mb-3">Net Profit</div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">Projected:</span>
                    <span className="text-sm font-bold text-gray-300">
                      {formatCurrency(calculateSettlementTotals()!.projected_profit)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">Actual:</span>
                    <span className={`text-sm font-bold ${
                      calculateSettlementTotals()!.actual_profit >= 0 ? 'text-[#8FD3FF]' : 'text-red-400'
                    }`}>
                      {formatCurrency(calculateSettlementTotals()!.actual_profit)}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-purple-500/30">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-gray-300">Variance:</span>
                      <span className={`text-sm font-bold ${
                        calculateSettlementTotals()!.variance_profit >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {calculateSettlementTotals()!.variance_profit >= 0 ? '+' : ''}
                        {formatCurrency(calculateSettlementTotals()!.variance_profit)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Overall Performance Indicator */}
            <div className="mt-4 p-4 bg-[#1140F0] border border-gray-800 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-white">Overall Performance</div>
                  <div className="text-xs text-gray-400 mt-1">
                    Settled shows performing {calculateSettlementTotals()!.variance_profit >= 0 ? 'better' : 'worse'} than projected
                  </div>
                </div>
                <div className={`text-2xl font-bold ${
                  calculateSettlementTotals()!.variance_profit >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {((calculateSettlementTotals()!.actual_profit / Math.max(calculateSettlementTotals()!.projected_profit, 1)) * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-[#14171E] border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white">Tour Dates</h3>
            <button
              onClick={() => setShowAddShow(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#8FD3FF] hover:bg-[#6FB8F2] text-[#04214D] rounded-xl font-bold text-sm transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Show</span>
            </button>
          </div>

          <div className="space-y-3">
            {tour.dates && tour.dates.length > 0 ? (
              tour.dates.map((show, index) => {
                const isCancelled = show.status === 'cancelled';
                return (
                  <div
                    key={show.offer_id}
                    className={`p-4 bg-[#1140F0] border border-gray-800 rounded-xl hover:border-[#8FD3FF]/50 transition-all cursor-pointer ${
                      isCancelled ? 'opacity-40 hover:opacity-60' : ''
                    }`}
                    onClick={() => navigate(`/offers/${show.offer_id}`)}
                  >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-[#8FD3FF] to-[#6FB8F2] text-[#04214D] rounded-xl flex flex-col items-center justify-center flex-shrink-0 font-bold">
                      {(() => {
                        const eventDate = parseLocalDate(show.event_date);
                        return eventDate ? (
                          <>
                            <div className="text-xs">
                              {eventDate.toLocaleDateString('en-US', { month: 'short' })}
                            </div>
                            <div className="text-xl font-bold">
                              {eventDate.getDate()}
                            </div>
                          </>
                        ) : (
                          <div className="text-xs">Invalid</div>
                        );
                      })()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-bold text-white text-base truncate">{show.venue_name}</h4>
                        <span className="text-xs px-2.5 py-1 rounded-xl bg-gray-700/50 text-gray-300 border border-gray-600/30 font-medium whitespace-nowrap">
                          {show.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <span className="flex items-center gap-1.5">
                          <MapPin className="h-4 w-4" />
                          {show.city}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Users className="h-4 w-4" />
                          {show.capacity}
                        </span>
                      </div>
                    </div>

                    <div className="hidden sm:flex items-center gap-6 text-right">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Revenue</div>
                        <div className="text-base font-bold text-green-400">
                          {formatCurrency(show.gross_potential || 0)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Costs</div>
                        <div className="text-base font-bold text-orange-400">
                          {formatCurrency(show.total_expenses || 0)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Profit</div>
                        <div className={`text-base font-bold ${
                          (show.net_profit || 0) >= 0 ? 'text-[#8FD3FF]' : 'text-red-400'
                        }`}>
                          {formatCurrency(show.net_profit || 0)}
                        </div>
                      </div>
                    </div>

                    <ChevronRight className="h-5 w-5 text-gray-600 hidden sm:block flex-shrink-0" />
                  </div>

                  <div className="grid grid-cols-3 gap-3 mt-4 sm:hidden">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Revenue</div>
                      <div className="text-sm font-bold text-green-400 truncate">
                        {formatCurrency(show.gross_potential || 0)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Costs</div>
                      <div className="text-sm font-bold text-orange-400 truncate">
                        {formatCurrency(show.total_expenses || 0)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Profit</div>
                      <div className={`text-sm font-bold truncate ${
                        (show.net_profit || 0) >= 0 ? 'text-[#8FD3FF]' : 'text-red-400'
                      }`}>
                        {formatCurrency(show.net_profit || 0)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
            ) : (
              <div className="text-center py-12 text-gray-400">
                <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-600" />
                <p>No shows added yet</p>
                <button
                  onClick={() => setShowAddShow(true)}
                  className="mt-2 text-[#8FD3FF] hover:text-[#6FB8F2] font-medium"
                >
                  Add your first show
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showAddShow && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#14171E] border border-gray-800 rounded-2xl max-w-4xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-white">Add Show to Tour</h2>
                <button
                  onClick={() => setShowAddShow(false)}
                  className="p-2 hover:bg-gray-800 rounded-lg text-2xl leading-none text-gray-400"
                >
                  ×
                </button>
              </div>

              <div className="space-y-3">
                {availableOffers.length > 0 ? (
                  availableOffers.map((offer) => (
                    <div
                      key={offer.id}
                      className="p-4 bg-[#1140F0] border border-gray-800 rounded-xl hover:border-[#8FD3FF]/50 cursor-pointer transition-all"
                      onClick={() => addShowToTour(offer.id)}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-white text-sm sm:text-base truncate">{offer.show.venue_name}</h4>
                          <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-gray-400 mt-1">
                            <span>{(() => {
                              const eventDate = parseLocalDate(offer.show.event_date);
                              return eventDate ? eventDate.toLocaleDateString() : 'Invalid date';
                            })()}</span>
                            <span>{offer.show.capacity} capacity</span>
                          </div>
                        </div>
                        <div className="text-left sm:text-right">
                          <div className="text-xs sm:text-sm text-gray-400">Projected Profit</div>
                          <div className="text-lg sm:text-xl font-bold text-[#8FD3FF]">
                            ${Math.round(offer.calculations.netProfit / 1000)}K
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-gray-400">
                    <p>No available offers</p>
                    <button
                      onClick={() => navigate('/offers/create')}
                      className="mt-4 text-[#8FD3FF] hover:text-[#6FB8F2] font-medium"
                    >
                      Create a new offer first
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
