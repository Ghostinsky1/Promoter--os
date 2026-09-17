import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { OfferWithShow, OfferStatus } from '../types';
import { formatCurrency } from '../lib/calculations';
import { Search, Calendar, MapPin, Plus, DollarSign, FileText, CheckCircle, Send, Activity, CircleDollarSign, XCircle, LayoutGrid, Copy, Music, TrendingUp } from 'lucide-react';
import { OffersCalendar } from './OffersCalendar';
import { survivalRead } from '../lib/downside';
import { readCancellation } from '../lib/cancellation';
import { parseLocalDate } from '../lib/dateHelpers';

const STATUS_CONFIG: Record<OfferStatus, { label: string; icon: any; color: string; bgColor: string; borderColor: string }> = {
  planning: {
    label: 'Planning',
    icon: FileText,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30'
  },
  offer_sent: {
    label: 'Offer Sent',
    icon: Send,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30'
  },
  confirmed: {
    label: 'Confirmed',
    icon: CheckCircle,
    color: 'text-[#8FD3FF]',
    bgColor: 'bg-[#8FD3FF]/10',
    borderColor: 'border-[#8FD3FF]/30'
  },
  active: {
    label: 'Active',
    icon: Activity,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30'
  },
  settled: {
    label: 'Settled',
    icon: CircleDollarSign,
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30'
  },
  cancelled: {
    label: 'Cancelled',
    icon: XCircle,
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/10',
    borderColor: 'border-gray-500/30'
  }
};

export function OffersList() {
  const navigate = useNavigate();
  const [offers, setOffers] = useState<OfferWithShow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<OfferStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  useEffect(() => {
    loadOffers();
    const savedView = localStorage.getItem('offersViewMode');
    if (savedView === 'list' || savedView === 'calendar') {
      setViewMode(savedView);
    }
  }, []);

  const loadOffers = async () => {
    try {
      console.log('🔍 Loading offers...');

      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError) {
        console.error('❌ Auth error:', authError);
        throw authError;
      }

      if (!user) {
        console.log('⚠️ No user logged in');
        setOffers([]);
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
        setOffers([]);
        setLoading(false);
        return;
      }

      console.log('🏢 Organization ID:', memberData.organization_id);

      const { data: offersData, error: offersError } = await supabase
        .from('offers')
        .select('*')
        .eq('organization_id', memberData.organization_id)
        .order('created_at', { ascending: false });

      console.log('📊 Offers response:', { count: offersData?.length || 0, offersError });

      if (offersError) throw offersError;

      if (!offersData || offersData.length === 0) {
        console.log('📭 No offers found');
        setOffers([]);
        setLoading(false);
        return;
      }

      const showIds = [...new Set(offersData.map(o => o.show_id))];
      console.log('🎭 Fetching shows:', showIds.length);

      const { data: showsData, error: showsError } = await supabase
        .from('shows')
        .select('*')
        .in('id', showIds);

      console.log('🎪 Shows response:', { count: showsData?.length || 0, showsError });

      if (showsError) throw showsError;

      const showsMap = new Map(showsData?.map(s => [s.id, s]) || []);

      const combined = offersData
        .map(offer => ({
          ...offer,
          show: showsMap.get(offer.show_id),
        }))
        .filter(o => o.show) as OfferWithShow[];

      console.log('✅ Combined offers loaded:', combined.length);
      setOffers(combined);
    } catch (error) {
      console.error('❌ Error loading offers:', error);
      setOffers([]);
    } finally {
      setLoading(false);
    }
  };

  const updateOfferStatus = async (offerId: string, newStatus: OfferStatus) => {
    try {
      // Stamp the cancellation date the first time a show dies, so the loss
      // lands in the right month even if the sheet is filled in later.
      const existing = offers.find(o => o.id === offerId) as any;
      const patch: Record<string, any> =
        newStatus === 'cancelled' && !existing?.cancelled_at
          ? { status: newStatus, cancelled_at: new Date().toISOString() }
          : { status: newStatus };

      const { error } = await supabase
        .from('offers')
        .update(patch)
        .eq('id', offerId);

      if (error) throw error;

      setOffers(offers.map(offer =>
        offer.id === offerId ? { ...offer, ...patch } as typeof offer : offer
      ));
    } catch (error) {
      console.error('Error updating offer status:', error);
      alert('Failed to update status');
    }
  };

  const duplicateOffer = async (offer: OfferWithShow) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('You must be logged in to duplicate an offer');
        return;
      }

      const { data: memberData } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!memberData?.organization_id) {
        alert('No organization found');
        return;
      }

      const newShowId = `show_${Date.now()}`;
      const newOfferId = `offer_${Date.now()}`;

      const newEventName = offer.show.event_name
        ? `${offer.show.event_name} (Copy)`
        : null;
      const newArtistName = `${offer.show.artist_name} (Copy)`;

      const { error: showError } = await supabase.from('shows').insert({
        id: newShowId,
        event_name: newEventName,
        artist_name: newArtistName,
        venue_name: offer.show.venue_name,
        event_date: offer.show.event_date,
        capacity: offer.show.capacity,
        user_id: user.id,
        organization_id: memberData.organization_id,
      });

      if (showError) throw showError;

      const { error: offerError } = await supabase.from('offers').insert({
        id: newOfferId,
        show_id: newShowId,
        mode: offer.mode,
        status: 'planning',
        deal_type: offer.deal_type,
        guarantee: offer.guarantee,
        tax_withholding_pct: offer.tax_withholding_pct,
        deposit_pct: offer.deposit_pct,
        artist_backend_pct: offer.artist_backend_pct,
        promoter_backend_pct: offer.promoter_backend_pct,
        deposit_due_timing: offer.deposit_due_timing,
        deposit_due_date: offer.deposit_due_date,
        venue_street: offer.venue_street,
        venue_city: offer.venue_city,
        venue_state: offer.venue_state,
        venue_zip: offer.venue_zip,
        venue_full_address: offer.venue_full_address,
        artist_deposit_status: 'pending',
        venue_deposit: offer.venue_deposit,
        venue_deposit_due_date: offer.venue_deposit_due_date,
        venue_deposit_status: 'pending',
        ticket_tiers: offer.ticket_tiers,
        sales_tax_pct: offer.sales_tax_pct,
        expenses: offer.expenses,
        calculations: offer.calculations,
        support_acts: offer.support_acts,
        user_id: user.id,
        organization_id: memberData.organization_id,
        facility_fee_per_ticket: offer.facility_fee_per_ticket,
        comps_artist: offer.comps_artist,
        comps_venue: offer.comps_venue,
        comps_promoter: offer.comps_promoter,
        doors_time: offer.doors_time,
        doors_duration: offer.doors_duration,
        show_time: offer.show_time,
        show_duration: offer.show_duration,
        curfew_time: offer.curfew_time,
        age_limit: offer.age_limit,
        merch_rate_soft: offer.merch_rate_soft,
        merch_rate_hard: offer.merch_rate_hard,
        artist_deductions: offer.artist_deductions,
        ascap_rate: offer.ascap_rate,
        bmi_rate: offer.bmi_rate,
        sesac_rate: offer.sesac_rate,
        insurance_per_attendee: offer.insurance_per_attendee,
        cc_fee_rate: offer.cc_fee_rate,
        offer_sent_date: new Date().toISOString().split('T')[0],
      });

      if (offerError) throw offerError;

      await loadOffers();
      alert('Offer duplicated successfully!');
    } catch (error) {
      console.error('Error duplicating offer:', error);
      alert('Failed to duplicate offer');
    }
  };

  const filteredOffers = offers.filter(offer => {
    const matchesStatus = selectedStatus === 'all' || (offer.status || 'planning') === selectedStatus;
    const matchesSearch = !searchQuery ||
      (offer.show.event_name && offer.show.event_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      offer.show.artist_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      offer.show.venue_name.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesStatus && matchesSearch;
  });

  const statusCounts = offers.reduce((acc, offer) => {
    const status = offer.status || 'planning';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const handleViewChange = (mode: 'list' | 'calendar') => {
    setViewMode(mode);
    localStorage.setItem('offersViewMode', mode);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1140F0] flex items-center justify-center">
        <div className="text-gray-400">Loading offers...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1140F0] p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Offers</h1>
            <p className="text-gray-400">Manage your event offers and track their progress</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleViewChange('list')}
              className={`px-3 sm:px-6 py-2 sm:py-3 rounded-2xl font-semibold transition-all flex items-center gap-2 ${
                viewMode === 'list'
                  ? 'bg-[#8FD3FF] text-[#04214D]'
                  : 'bg-[#14171E] border border-gray-800 text-gray-400 hover:text-white hover:bg-[#22262F]'
              }`}
            >
              <LayoutGrid className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden sm:inline">List</span>
            </button>
            <button
              onClick={() => handleViewChange('calendar')}
              className={`px-3 sm:px-6 py-2 sm:py-3 rounded-2xl font-semibold transition-all flex items-center gap-2 ${
                viewMode === 'calendar'
                  ? 'bg-[#8FD3FF] text-[#04214D]'
                  : 'bg-[#14171E] border border-gray-800 text-gray-400 hover:text-white hover:bg-[#22262F]'
              }`}
            >
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden sm:inline">Calendar</span>
            </button>

            <button
              onClick={() => navigate('/offers/create')}
              className="bg-[#8FD3FF] text-[#04214D] hover:bg-[#6FB8F2] rounded-2xl px-4 sm:px-8 py-2 sm:py-3 font-bold transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Create Offer</span>
              <span className="sm:hidden">Create</span>
            </button>
          </div>
        </div>

        {viewMode === 'calendar' ? (
          <OffersCalendar offers={offers} />
        ) : (
          <>
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by artist or venue..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-6 bg-[#14171E] border border-gray-800 text-white placeholder:text-gray-500 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#8FD3FF] focus:border-[#8FD3FF]"
                />
              </div>
            </div>

            <div className="mb-6 overflow-x-auto">
              <div className="flex gap-3 pb-2">
                <button
                  onClick={() => setSelectedStatus('all')}
                  className={`flex-shrink-0 px-6 py-2 rounded-full font-bold whitespace-nowrap transition-colors ${
                    selectedStatus === 'all'
                      ? 'bg-[#8FD3FF] text-[#04214D]'
                      : 'bg-[#14171E] border border-gray-800 text-gray-400 hover:text-white hover:bg-[#22262F]'
                  }`}
                >
                  All ({offers.length})
                </button>
                {(Object.keys(STATUS_CONFIG) as OfferStatus[]).map((status) => {
                  const config = STATUS_CONFIG[status];
                  const Icon = config.icon;
                  const count = statusCounts[status] || 0;

                  return (
                    <button
                      key={status}
                      onClick={() => setSelectedStatus(status)}
                      className={`flex-shrink-0 px-6 py-2 rounded-full font-semibold whitespace-nowrap transition-colors flex items-center gap-2 ${
                        selectedStatus === status
                          ? 'bg-[#8FD3FF] text-[#04214D]'
                          : 'bg-[#14171E] border border-gray-800 text-gray-400 hover:text-white hover:bg-[#22262F]'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {config.label} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedStatus !== 'all' && (
              <div className="h-1 bg-[#8FD3FF] rounded-full mb-8"></div>
            )}

            {filteredOffers.length === 0 ? (
              <div className="bg-[#14171E] border border-gray-800 rounded-3xl p-16 text-center">
                <div className="max-w-md mx-auto">
                  <div className="w-20 h-20 bg-[#8FD3FF]/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <FileText className="h-10 w-10 text-[#8FD3FF]" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">
                    {searchQuery || selectedStatus !== 'all' ? 'No offers found' : 'No offers yet'}
                  </h3>
                  <p className="text-gray-400 mb-8">
                    {searchQuery || selectedStatus !== 'all'
                      ? 'Try adjusting your filters or search terms'
                      : 'Create your first offer to start managing your events'}
                  </p>
                  {!searchQuery && selectedStatus === 'all' && (
                    <button
                      onClick={() => navigate('/offers/create')}
                      className="bg-[#8FD3FF] text-[#04214D] hover:bg-[#6FB8F2] rounded-2xl px-8 py-3 font-bold transition-colors inline-flex items-center gap-2"
                    >
                      <Plus className="w-5 h-5" />
                      Create Your First Offer
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredOffers.map((offer) => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);

                  const eventDate = parseLocalDate(offer.show.event_date);
                  const formattedDate = eventDate ? eventDate.toLocaleDateString('en-US', {
                    year: 'numeric',
                    day: 'numeric',
                    month: 'short'
                  }) : 'Invalid date';

                  const currentStatus = (offer.status || 'planning') as OfferStatus;
                  const statusConfig = STATUS_CONFIG[currentStatus];

                  const totalTickets = offer.ticket_tiers?.reduce((sum, tier) => sum + (tier.allotment || 0), 0) || 0;
                  const totalRevenue = offer.ticket_tiers?.reduce((sum, tier) => sum + ((tier.allotment || 0) * (tier.price || 0)), 0) || 0;
                  const avgTicketPrice = totalTickets > 0 ? totalRevenue / totalTickets : 0;

                  const grossRevenue = offer.calculations.grossPotential || offer.calculations.netGross || totalRevenue || 0;
                  const totalExpenses = offer.calculations.totalExpenses || 0;
                  const netProfit = offer.calculations.netProfit || 0;
                  const profitMargin = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;
                  const breakEvenPct = grossRevenue > 0 ? (totalExpenses / grossRevenue) * 100 : 0;

                  const artistPayment = offer.calculations.artistPayment || offer.guarantee || 0;
                  const depositAmount = artistPayment * ((offer.deposit_pct || 0) / 100);
                  const balanceDue = artistPayment - depositAmount;
                  const hasDeposit = depositAmount > 0;

                  const isCancelled = currentStatus === 'cancelled';

                  // The bad-night read. Computed here rather than fetched --
                  // it's arithmetic on the offer we already have in hand.
                  const survival = survivalRead(offer as any);

                  return (
                    <div
                      key={offer.id}
                      className={`relative rounded-3xl p-6 transition-all cursor-pointer group bg-[#14171E] border border-gray-800 hover:border-[#8FD3FF]/50 hover:shadow-lg ${
                        isCancelled ? 'opacity-40 hover:opacity-60' : ''
                      }`}
                      onClick={() => navigate(`/offers/${offer.id}`)}
                    >
                      <div className="flex items-start justify-between mb-6 pb-6 border-b border-gray-800">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-[#8FD3FF]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                            <Music className="h-6 w-6 text-[#8FD3FF]" />
                          </div>
                          <div>
                            <h3 className="text-white font-bold text-xl mb-1">
                              {offer.show.artist_name}
                            </h3>
                            <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
                              <MapPin className="h-3 w-3" />
                              <span>{offer.show.venue_name}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-400">
                              <Calendar className="h-3 w-3" />
                              <span>{formattedDate}</span>
                            </div>
                          </div>
                        </div>
                        <select
                          value={currentStatus}
                          onChange={(e) => {
                            e.stopPropagation();
                            updateOfferStatus(offer.id, e.target.value as OfferStatus);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors focus:outline-none ${statusConfig.borderColor} ${statusConfig.bgColor} ${statusConfig.color}`}
                        >
                          {(Object.keys(STATUS_CONFIG) as OfferStatus[]).map((status) => (
                            <option key={status} value={status}>
                              {STATUS_CONFIG[status].label.toUpperCase()}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-4">
                        {isCancelled
                          ? <CancelledBadge offer={offer as any} />
                          : <SurvivalBadge survival={survival} />}

                        <div className="bg-[#22262F] rounded-xl p-4 border border-gray-800">
                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <p className="text-xs text-gray-400 mb-1">Deal Type</p>
                              <p className="text-sm font-bold text-white capitalize">
                                {offer.deal_type.replace('_', ' ')}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400 mb-1">Capacity</p>
                              <p className="text-sm font-bold text-white">
                                {offer.show.capacity.toLocaleString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400 mb-1">Avg Ticket</p>
                              <p className="text-sm font-bold text-white">
                                {formatCurrency(avgTicketPrice)}
                              </p>
                            </div>
                          </div>
                        </div>

                        {offer.deal_type === 'flat_fee' && offer.guarantee > 0 && (
                          <div className="bg-gradient-to-br from-[#8FD3FF]/20 to-[#8FD3FF]/10 rounded-xl p-4 border border-[#8FD3FF]/30">
                            <p className="text-xs text-[#8FD3FF] font-bold mb-1">GUARANTEE AMOUNT</p>
                            <p className="text-2xl font-bold text-white">{formatCurrency(offer.guarantee)}</p>
                          </div>
                        )}

                        <div className="bg-[#22262F] rounded-xl p-4 border border-gray-800">
                          <p className="text-xs text-gray-400 font-bold mb-3">PAYMENT SCHEDULE</p>
                          <div className="space-y-2.5">
                            {hasDeposit && (
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-300">Deposit ({offer.deposit_pct}%)</span>
                                <div className="text-right">
                                  <p className="text-sm font-bold text-white">{formatCurrency(depositAmount)}</p>
                                  {offer.artist_deposit_status === 'paid' && (
                                    <p className="text-xs text-[#8FD3FF] font-semibold">Paid</p>
                                  )}
                                </div>
                              </div>
                            )}
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-300">Balance Due at Settlement</span>
                              <span className="text-sm font-bold text-white">{formatCurrency(balanceDue)}</span>
                            </div>
                            <div className="h-px bg-gray-700 my-2"></div>
                            <div className="flex justify-between items-center">
                              <span className="text-base font-bold text-white">Total Artist Payment</span>
                              <span className="text-xl font-bold text-[#8FD3FF]">{formatCurrency(artistPayment)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 mt-6">
                        <button
                          onClick={() => navigate(`/offers/${offer.id}`)}
                          className="flex-1 bg-[#22262F] text-white hover:bg-[#2A3040] rounded-2xl py-3 font-semibold transition-colors"
                        >
                          View Details
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            duplicateOffer(offer);
                          }}
                          className="bg-[#22262F] hover:bg-[#2A3040] rounded-2xl p-3 transition-colors"
                          title="Duplicate offer"
                        >
                          <Copy className="h-5 w-5 text-gray-400" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}


/**
 * The bad-night flag. A promoter should be able to see a fragile show from the
 * list without opening it -- that's the whole point of stress-testing at 50%.
 */
function SurvivalBadge({ survival }: { survival: ReturnType<typeof survivalRead> }) {
  const style = {
    SAFE: { label: 'SURVIVES A BAD NIGHT', box: 'bg-green-900/20 border-green-800/40', text: 'text-green-400' },
    TIGHT: { label: 'NEEDS A REAL CROWD', box: 'bg-yellow-900/20 border-yellow-800/40', text: 'text-yellow-400' },
    FRAGILE: { label: 'FRAGILE', box: 'bg-orange-900/20 border-orange-800/40', text: 'text-orange-400' },
    UNDERWATER: { label: 'LOSES AT A SELLOUT', box: 'bg-red-900/20 border-red-800/40', text: 'text-red-400' },
  }[survival.verdict];

  const cell = (label: string, profit: number, tickets: number) => (
    <div>
      <p className="text-[10px] text-gray-500 mb-0.5">{label}</p>
      <p className={`text-sm font-bold ${profit >= 0 ? 'text-white' : 'text-red-400'}`}>
        {profit >= 0 ? formatCurrency(profit) : `-${formatCurrency(Math.abs(profit))}`}
      </p>
      <p className="text-[10px] text-gray-600">{tickets.toLocaleString()} tix</p>
    </div>
  );

  return (
    <div className={`rounded-xl p-4 border ${style.box}`}>
      <div className="flex items-center justify-between mb-3">
        <span className={`text-[10px] font-bold tracking-wide ${style.text}`}>{style.label}</span>
        <span className="text-[10px] text-gray-500">
          {survival.breakEvenTickets >= 0
            ? `break-even ${Math.round(survival.breakEvenPct)}%`
            : 'no break-even'}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {cell('Sellout', survival.atFull.profit, survival.atFull.tickets)}
        {cell('70% sold', survival.at70.profit, survival.at70.tickets)}
        {cell('Half house', survival.at50.profit, survival.at50.tickets)}
      </div>
    </div>
  );
}


/**
 * A cancelled show reports what it cost, not the profit it will never make.
 * An empty sheet is called out, because an unrecorded loss is a loss the
 * month never sees.
 */
function CancelledBadge({ offer }: { offer: any }) {
  const c = readCancellation(offer);
  const loss = Number(offer.cancellation_loss) || 0;

  if (!c.completed && loss === 0) {
    return (
      <div className="rounded-xl p-4 border bg-[#22262F] border-gray-700">
        <p className="text-[10px] font-bold tracking-wide text-gray-400 mb-1">CANCELLED</p>
        <p className="text-xs text-gray-500">
          Open it and put in what you spent, or this show costs your month nothing on paper.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl p-4 border bg-red-900/20 border-red-800/40">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold tracking-wide text-red-400 mb-1">CANCELLED — COST YOU</p>
          <p className="text-xl font-bold text-red-400">-{formatCurrency(loss)}</p>
        </div>
        {c.notes && <p className="text-[10px] text-gray-500 max-w-[45%] text-right">{c.notes}</p>}
      </div>
    </div>
  );
}
