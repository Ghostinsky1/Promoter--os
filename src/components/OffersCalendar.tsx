import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Calendar, Plus } from 'lucide-react';
import { OfferWithShow, OfferStatus } from '../types';
import { formatCurrency } from '../lib/calculations';
import { parseLocalDate } from '../lib/dateHelpers';

/**
 * PROMOTER OS — the offers calendar, in the CRT ad style. A tight grid of
 * little dark screens (scanlines, sky glow on today and on nights with a
 * show), brand colors only for the show chips, and the grid flickers in
 * like a TV picture when the month changes. Half the height it was.
 */

interface OffersCalendarProps {
  offers: OfferWithShow[];
}

// Brand palette only, no rainbow gradients.
const CHIP: Record<OfferStatus, string> = {
  planning: 'bg-[#1140F0]/50 text-white/80 border border-dashed border-[#5A8CFF]/60',
  offer_sent: 'bg-[#5A8CFF] text-[#0E1F5C]',
  confirmed: 'bg-[#8FD3FF] text-[#0E1F5C]',
  active: 'bg-[#F2B640] text-[#14171E]',
  settled: 'bg-[#0E1F5C] text-[#8FD3FF] border border-[#8FD3FF]/40',
  cancelled: 'bg-[#F0605A]/40 text-white line-through',
};

const STATUS_LABEL: Record<OfferStatus, string> = {
  planning: 'Planning · not counted', offer_sent: 'Offer sent', confirmed: 'Confirmed', active: 'Active', settled: 'Settled', cancelled: 'Cancelled',
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function OffersCalendar({ offers }: OffersCalendarProps) {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startingDayOfWeek = new Date(year, month, 1).getDay();
  const cells = startingDayOfWeek + daysInMonth;
  const trailing = (7 - (cells % 7)) % 7;

  const inMonth = (o: OfferWithShow) => {
    const d = parseLocalDate(o.show.event_date);
    return !!d && d.getFullYear() === year && d.getMonth() === month ? d : null;
  };
  const byDay = new Map<number, OfferWithShow[]>();
  for (const o of offers) {
    const d = inMonth(o);
    if (!d) continue;
    byDay.set(d.getDate(), [...(byDay.get(d.getDate()) || []), o]);
  }
  const monthOffers = offers.filter(inMonth).sort((a, b) => (parseLocalDate(a.show.event_date)?.getTime() ?? 0) - (parseLocalDate(b.show.event_date)?.getTime() ?? 0));

  const todayDate = new Date();
  const isThisMonth = todayDate.getFullYear() === year && todayDate.getMonth() === month;

  const nav = (delta: number) => setCurrentDate(new Date(year, month + delta, 1));

  return (
    <div className="space-y-4">
      <div className="bg-[#14171E] rounded-2xl border border-[#2A3040] overflow-hidden">
        {/* Header: month, today, arrows. Tight. */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2A3040]">
          <h2 className="font-display text-xl sm:text-2xl text-white uppercase tracking-wide">
            {MONTHS[month]} <span className="text-[#8FD3FF]">{year}</span>
          </h2>
          <div className="flex items-center gap-2">
            {!isThisMonth && (
              <button onClick={() => setCurrentDate(new Date())} className="crt-tab" style={{ padding: '6px 12px' }}>
                Today
              </button>
            )}
            <div className="flex items-center bg-[#0B0D12] rounded-lg border border-[#2A3040]">
              <button onClick={() => nav(-1)} className="text-gray-400 hover:text-white p-1.5" aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></button>
              <button onClick={() => nav(1)} className="text-gray-400 hover:text-white p-1.5" aria-label="Next month"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        </div>

        {/* Day names */}
        <div className="grid grid-cols-7 px-2 pt-2">
          {DAYS.map((d) => (
            <div key={d} className="text-center font-label text-[10px] tracking-[0.16em] uppercase text-gray-500 py-1">{d}</div>
          ))}
        </div>

        {/* The grid. key=month so it flickers in on every switch. */}
        <div key={`${year}-${month}`} className="crt-panel grid grid-cols-7 gap-1 p-2">
          {Array.from({ length: startingDayOfWeek }).map((_, i) => (
            <div key={`lead-${i}`} className="crt-cell dim" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dayOffers = byDay.get(day) || [];
            const isToday = isThisMonth && todayDate.getDate() === day;
            const isPast = new Date(year, month, day) < new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
            return (
              <div key={day} className={`crt-cell ${isToday ? 'today' : ''} ${dayOffers.length ? 'lit' : ''} ${isPast && !dayOffers.length ? 'dim' : ''}`}>
                <div className={`crt-day ${isToday ? 'text-[#8FD3FF]' : dayOffers.length ? 'text-white' : 'text-gray-500'}`}>{day}</div>
                <div className="flex flex-col gap-0.5 mt-0.5 min-w-0">
                  {dayOffers.slice(0, 3).map((o) => {
                    const status = (o.status || 'planning') as OfferStatus;
                    return (
                      <button
                        key={o.id}
                        onClick={() => navigate(`/offers/${o.id}`)}
                        className={`text-left text-[11px] leading-tight px-1.5 py-0.5 rounded font-semibold truncate ${CHIP[status]}`}
                        style={{ textTransform: 'none', letterSpacing: 0 }}
                        title={`${o.show.artist_name} at ${o.show.venue_name} · ${STATUS_LABEL[status]}`}
                      >
                        {o.show.event_name || o.show.artist_name}
                      </button>
                    );
                  })}
                  {dayOffers.length > 3 && <div className="text-[10px] text-[#8FD3FF] font-semibold px-1">+{dayOffers.length - 3} more</div>}
                </div>
              </div>
            );
          })}
          {Array.from({ length: trailing }).map((_, i) => (
            <div key={`trail-${i}`} className="crt-cell dim" />
          ))}
        </div>
      </div>

      {/* This month, one line each. */}
      {monthOffers.length > 0 ? (
        <div className="bg-[#14171E] rounded-2xl border border-[#2A3040] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#2A3040]">
            <h3 className="font-label text-[11px] tracking-[0.16em] uppercase text-[#8FD3FF]">This month · {monthOffers.length} show{monthOffers.length === 1 ? '' : 's'}</h3>
          </div>
          <div className="divide-y divide-[#2A3040]">
            {monthOffers.map((o) => {
              const status = (o.status || 'planning') as OfferStatus;
              const d = parseLocalDate(o.show.event_date);
              const profit = o.calculations?.netProfit ?? 0;
              return (
                <button
                  key={o.id}
                  onClick={() => navigate(`/offers/${o.id}`)}
                  className={`w-full grid grid-cols-[52px_1fr_auto] sm:grid-cols-[64px_1fr_120px_110px] items-center gap-3 px-4 py-2.5 text-left hover:bg-[#1A1E27] transition-colors ${status === 'cancelled' ? 'opacity-50' : ''}`}
                  style={{ textTransform: 'none', letterSpacing: 0 }}
                >
                  <div className="font-label text-[11px] tracking-[0.1em] uppercase text-gray-400 leading-tight">
                    {d ? d.toLocaleDateString('en-US', { weekday: 'short' }) : ''}<br />
                    <span className="text-white text-base font-bold tracking-normal">{d ? d.getDate() : '?'}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[15px] text-white font-semibold truncate">{o.show.event_name || o.show.artist_name}</div>
                    <div className="text-[12px] text-gray-400 truncate">{o.show.event_name ? `${o.show.artist_name} · ` : ''}{o.show.venue_name}</div>
                  </div>
                  <span className={`hidden sm:inline-block justify-self-start text-[11px] px-2 py-0.5 rounded font-semibold ${CHIP[status]}`}>{STATUS_LABEL[status]}</span>
                  <div className={`text-right font-bold ${profit >= 0 ? 'text-[#8FD3FF]' : 'text-[#F0605A]'}`}>{formatCurrency(profit)}</div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-[#14171E] rounded-2xl border border-[#2A3040] p-8 text-center">
          <Calendar className="h-8 w-8 text-gray-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-white mb-1">Nothing in {MONTHS[month]}</h3>
          <p className="text-gray-400 text-sm mb-4">No shows on the calendar this month.</p>
          <button onClick={() => navigate('/offers/create')} className="bg-[#8FD3FF] hover:bg-[#6FB8F2] text-[#04214D] px-5 py-2.5 rounded-xl font-bold inline-flex items-center gap-2 text-sm">
            <Plus className="h-4 w-4" /> Create offer
          </button>
        </div>
      )}
    </div>
  );
}
