import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Calendar, MapPin, DollarSign, FileText, Plus } from 'lucide-react';
import { OfferWithShow, OfferStatus } from '../types';
import { formatCurrency } from '../lib/calculations';
import { parseLocalDate } from '../lib/dateHelpers';

interface OffersCalendarProps {
  offers: OfferWithShow[];
}

const STATUS_COLORS: Record<OfferStatus, string> = {
  planning: 'from-blue-500 to-cyan-500',
  offer_sent: 'from-purple-500 to-pink-500',
  confirmed: 'from-green-500 to-emerald-500',
  active: 'from-orange-500 to-amber-500',
  settled: 'from-teal-500 to-cyan-500',
  cancelled: 'from-red-500 to-rose-500'
};

const STATUS_BADGES: Record<OfferStatus, { label: string; color: string }> = {
  planning: { label: 'Planning', color: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' },
  offer_sent: { label: 'Offer Sent', color: 'bg-purple-500/20 text-purple-400 border border-purple-500/30' },
  confirmed: { label: 'Confirmed', color: 'bg-green-500/20 text-green-400 border border-green-500/30' },
  active: { label: 'Active', color: 'bg-orange-500/20 text-orange-400 border border-orange-500/30' },
  settled: { label: 'Settled', color: 'bg-teal-500/20 text-teal-400 border border-teal-500/30' },
  cancelled: { label: 'Cancelled', color: 'bg-red-500/20 text-red-400 border border-red-500/30' }
};

export function OffersCalendar({ offers }: OffersCalendarProps) {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentDate);

  const getOffersForDay = (day: number) => {
    return offers.filter(offer => {
      const offerDate = parseLocalDate(offer.show.event_date);
      if (!offerDate) return false;
      return (
        offerDate.getFullYear() === year &&
        offerDate.getMonth() === month &&
        offerDate.getDate() === day
      );
    });
  };

  const getOffersInMonth = () => {
    return offers.filter(offer => {
      const offerDate = parseLocalDate(offer.show.event_date);
      if (!offerDate) return false;
      return (
        offerDate.getFullYear() === year &&
        offerDate.getMonth() === month
      );
    });
  };

  const previousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const today = () => {
    setCurrentDate(new Date());
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const monthOffers = getOffersInMonth();

  return (
    <div className="space-y-6">
      <div className="bg-[#14171E] rounded-3xl shadow-sm border border-gray-800 overflow-hidden">
        <div className="bg-gradient-to-r from-[#14171E] to-[#22262F] text-white p-6 border-b border-gray-800">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-bold text-white">
              {monthNames[month]} {year}
            </h2>

            <div className="flex items-center gap-2">
              <button
                onClick={today}
                className="bg-[#8FD3FF] hover:bg-[#6FB8F2] text-[#04214D] px-4 py-2 rounded-xl font-medium transition-colors"
              >
                Today
              </button>

              <div className="flex items-center gap-1 bg-[#0B0D12] rounded-xl p-1 border border-gray-700">
                <button
                  onClick={previousMonth}
                  className="text-gray-400 hover:text-white hover:bg-[#22262F] p-2 rounded-lg transition-colors"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={nextMonth}
                  className="text-gray-400 hover:text-white hover:bg-[#22262F] p-2 rounded-lg transition-colors"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {dayNames.map(day => (
              <div key={day} className="text-center font-semibold py-2 text-gray-400">
                {day}
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 bg-[#1140F0]">
          <div className="grid grid-cols-7 gap-3">
            {Array.from({ length: startingDayOfWeek }).map((_, index) => (
              <div key={`empty-${index}`} className="aspect-square" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, index) => {
              const day = index + 1;
              const dayOffers = getOffersForDay(day);
              const todayDate = new Date();
              const isToday =
                todayDate.getFullYear() === year &&
                todayDate.getMonth() === month &&
                todayDate.getDate() === day;

              return (
                <div
                  key={day}
                  className={`aspect-square border-2 rounded-2xl p-2 transition-all ${
                    isToday
                      ? 'bg-[#8FD3FF]/10 border-[#8FD3FF] shadow-lg ring-2 ring-[#8FD3FF]/30'
                      : dayOffers.length > 0
                      ? 'bg-[#14171E] border-gray-700 hover:border-[#8FD3FF]/50 hover:shadow-md cursor-pointer'
                      : 'bg-[#0B0D12] border-gray-800'
                  }`}
                >
                  <div className="flex flex-col h-full">
                    <div className={`text-sm font-bold mb-1 ${
                      isToday
                        ? 'text-[#8FD3FF]'
                        : dayOffers.length > 0
                        ? 'text-white'
                        : 'text-gray-600'
                    }`}>
                      {day}
                    </div>

                    <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                      {dayOffers.slice(0, 2).map((offer, i) => {
                        const status = (offer.status || 'planning') as OfferStatus;
                        const isCancelled = status === 'cancelled';
                        return (
                          <div
                            key={i}
                            className={`text-xs px-2 py-1 rounded-lg bg-gradient-to-r ${STATUS_COLORS[status]} text-white truncate font-semibold cursor-pointer hover:scale-105 transition-transform ${
                              isCancelled ? 'opacity-40' : ''
                            }`}
                            onClick={() => navigate(`/offers/${offer.id}`)}
                            title={`${offer.show.artist_name} at ${offer.show.venue_name}${isCancelled ? ' (CANCELLED)' : ''}`}
                          >
                            {offer.show.artist_name}
                          </div>
                        );
                      })}
                      {dayOffers.length > 2 && (
                        <div className="text-xs text-[#8FD3FF] font-bold px-2">
                          +{dayOffers.length - 2} more
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {monthOffers.length > 0 && (
        <div className="bg-[#14171E] rounded-3xl shadow-sm border border-gray-800 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-white">
              Offers This Month ({monthOffers.length})
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {monthOffers
              .sort((a, b) => {
                const dateA = parseLocalDate(a.show.event_date);
                const dateB = parseLocalDate(b.show.event_date);
                if (!dateA || !dateB) return 0;
                return dateA.getTime() - dateB.getTime();
              })
              .map((offer) => {
                const status = (offer.status || 'planning') as OfferStatus;
                const statusBadge = STATUS_BADGES[status];
                const isCancelled = status === 'cancelled';
                const offerDate = parseLocalDate(offer.show.event_date);
                const dateDisplay = offerDate ? offerDate.toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                }) : 'Invalid date';
                return (
                  <div
                    key={offer.id}
                    className={`bg-[#0B0D12] border-2 border-gray-700 hover:border-[#8FD3FF]/50 rounded-2xl p-4 hover:shadow-lg transition-all cursor-pointer border-l-4 border-l-[#8FD3FF] ${
                      isCancelled ? 'opacity-40 hover:opacity-60' : ''
                    }`}
                    onClick={() => navigate(`/offers/${offer.id}`)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-lg mb-1 truncate text-white">{offer.show.artist_name}</h4>
                        <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
                          <Calendar className="h-4 w-4 flex-shrink-0" />
                          <span>{dateDisplay}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <MapPin className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">{offer.show.venue_name}</span>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-xl text-xs font-semibold ${statusBadge.color}`}>
                        {statusBadge.label}
                      </span>
                    </div>

                    <div className="pt-3 border-t border-gray-700 flex items-center justify-between">
                      <div className="text-sm text-gray-400">Net Profit</div>
                      <div className={`text-xl font-bold ${
                        offer.calculations.netProfit >= 0 ? 'text-[#8FD3FF]' : 'text-red-500'
                      }`}>
                        {formatCurrency(offer.calculations.netProfit)}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {monthOffers.length === 0 && (
        <div className="bg-[#14171E] rounded-3xl shadow-sm border border-gray-800 p-12 text-center">
          <div className="w-20 h-20 bg-[#0B0D12] border border-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Calendar className="h-10 w-10 text-gray-600" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No Offers in {monthNames[month]}</h3>
          <p className="text-gray-400 mb-6">Create your first offer for this month</p>
          <button
            onClick={() => navigate('/offers/create')}
            className="bg-[#8FD3FF] hover:bg-[#6FB8F2] text-[#04214D] px-6 py-3 rounded-2xl font-bold hover:shadow-lg transition-all inline-flex items-center gap-2"
          >
            <Plus className="h-5 w-5" />
            Create Offer
          </button>
        </div>
      )}
    </div>
  );
}
