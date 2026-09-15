import { MapPin, Calendar, Info } from 'lucide-react';

interface EventDetailsTabProps {
  eventName?: string;
  setEventName?: (value: string) => void;
  artistName: string;
  setArtistName: (value: string) => void;
  venueName: string;
  setVenueName: (value: string) => void;
  eventDate: string;
  setEventDate: (value: string) => void;
  capacity: number;
  setCapacity: (value: number) => void;
  mode: 'estimate' | 'settlement';
  venueStreet?: string;
  setVenueStreet?: (value: string) => void;
  venueCity?: string;
  setVenueCity?: (value: string) => void;
  venueState?: string;
  setVenueState?: (value: string) => void;
  venueZip?: string;
  setVenueZip?: (value: string) => void;
  facilityFeePerTicket?: number;
  setFacilityFeePerTicket?: (value: number) => void;
  ageLimit?: string;
  setAgeLimit?: (value: string) => void;
  doorsTime?: string;
  setDoorsTime?: (value: string) => void;
  doorsDuration?: number;
  setDoorsDuration?: (value: number) => void;
  showTime?: string;
  setShowTime?: (value: string) => void;
  showDuration?: number;
  setShowDuration?: (value: number) => void;
  curfewTime?: string;
  setCurfewTime?: (value: string) => void;
}

export function EventDetailsTab({
  eventName = '',
  setEventName = () => {},
  artistName,
  setArtistName,
  venueName,
  setVenueName,
  eventDate,
  setEventDate,
  capacity,
  setCapacity,
  mode,
  venueStreet = '',
  setVenueStreet = () => {},
  venueCity = '',
  setVenueCity = () => {},
  venueState = '',
  setVenueState = () => {},
  venueZip = '',
  setVenueZip = () => {},
  facilityFeePerTicket = 2.00,
  setFacilityFeePerTicket = () => {},
  ageLimit = 'All Ages',
  setAgeLimit = () => {},
  doorsTime = '20:00',
  setDoorsTime = () => {},
  doorsDuration = 60,
  setDoorsDuration = () => {},
  showTime = '21:00',
  setShowTime = () => {},
  showDuration = 240,
  setShowDuration = () => {},
  curfewTime = '01:00',
  setCurfewTime = () => {},
}: EventDetailsTabProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-3xl font-bold text-white mb-3">Event Information</h3>
        <p className="text-gray-400 mb-8">Enter the basic details for this show</p>
      </div>

      <div>
        <label className="text-white font-semibold mb-2 block">
          Event Name
        </label>
        <input
          type="text"
          value={eventName || ''}
          onChange={(e) => setEventName(e.target.value)}
          placeholder="e.g., Summer Festival 2024, Holiday Show (optional)"
          className="w-full bg-[#0B0D12] border-gray-700 text-white placeholder:text-gray-600 rounded-2xl px-4 py-6 text-lg focus:border-[#8FD3FF] focus:ring-[#8FD3FF] border"
        />
        <p className="text-gray-500 text-sm mt-2">
          Optional - Give this event a custom name for easy identification
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label className="text-white font-semibold mb-2 block">
            Artist Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={artistName || ''}
            onChange={(e) => setArtistName(e.target.value)}
            placeholder="Enter artist name"
            className="w-full bg-[#0B0D12] border-gray-700 text-white placeholder:text-gray-600 rounded-2xl px-4 py-6 text-lg focus:border-[#8FD3FF] focus:ring-[#8FD3FF] border"
            required
          />
        </div>

        <div>
          <label className="text-white font-semibold mb-2 block">
            Venue Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={venueName || ''}
            onChange={(e) => setVenueName(e.target.value)}
            placeholder="Enter venue name"
            className="w-full bg-[#0B0D12] border-gray-700 text-white placeholder:text-gray-600 rounded-2xl px-4 py-6 text-lg focus:border-[#8FD3FF] focus:ring-[#8FD3FF] border"
            required
          />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label className="text-white font-semibold mb-2 block">
            Event Date <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="date"
              value={eventDate || ''}
              onChange={(e) => setEventDate(e.target.value)}
              className="w-full bg-[#0B0D12] border-gray-700 text-white rounded-2xl px-4 py-6 text-lg focus:border-[#8FD3FF] focus:ring-[#8FD3FF] border"
              required
            />
            <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500 pointer-events-none" />
          </div>
        </div>

        <div>
          <label className="text-white font-semibold mb-2 block">
            Venue Capacity <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            value={capacity || ''}
            onChange={(e) => setCapacity(Number(e.target.value))}
            placeholder="0"
            min="0"
            className="w-full bg-[#0B0D12] border-gray-700 text-white placeholder:text-gray-600 rounded-2xl px-4 py-6 text-lg focus:border-[#8FD3FF] focus:ring-[#8FD3FF] border"
            required
          />
        </div>
      </div>

      <div>
        <label className="text-white font-semibold mb-2 block">
          Venue Address <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={venueStreet || ''}
          onChange={(e) => setVenueStreet(e.target.value)}
          placeholder="Street Address"
          className="w-full bg-[#0B0D12] border-gray-700 text-white placeholder:text-gray-600 rounded-2xl px-4 py-6 text-lg focus:border-[#8FD3FF] focus:ring-[#8FD3FF] mb-4 border"
          required
        />
        <div className="grid grid-cols-3 gap-4">
          <input
            type="text"
            value={venueCity || ''}
            onChange={(e) => setVenueCity(e.target.value)}
            placeholder="City"
            className="bg-[#0B0D12] border-gray-700 text-white placeholder:text-gray-600 rounded-2xl px-4 py-4 focus:border-[#8FD3FF] focus:ring-[#8FD3FF] border"
          />
          <input
            type="text"
            value={venueState || ''}
            onChange={(e) => setVenueState(e.target.value)}
            placeholder="State"
            className="bg-[#0B0D12] border-gray-700 text-white placeholder:text-gray-600 rounded-2xl px-4 py-4 focus:border-[#8FD3FF] focus:ring-[#8FD3FF] border"
          />
          <input
            type="text"
            value={venueZip || ''}
            onChange={(e) => setVenueZip(e.target.value)}
            placeholder="ZIP"
            className="bg-[#0B0D12] border-gray-700 text-white placeholder:text-gray-600 rounded-2xl px-4 py-4 focus:border-[#8FD3FF] focus:ring-[#8FD3FF] border"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400 bg-[#8FD3FF]/10 border border-[#8FD3FF]/30 rounded-2xl p-4 mt-4">
          <MapPin className="h-4 w-4 flex-shrink-0 text-[#8FD3FF]" />
          <span>This address will appear on offer PDFs and Run of Show documents</span>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label className="text-white font-semibold mb-2 block">
            Facility Fee Per Ticket
          </label>
          <div className="flex items-center gap-2">
            <span className="text-gray-400">$</span>
            <input
              type="number"
              step="0.50"
              value={facilityFeePerTicket}
              onChange={(e) => setFacilityFeePerTicket(parseFloat(e.target.value))}
              className="flex-1 bg-[#0B0D12] border-gray-700 text-white rounded-2xl px-4 py-4 focus:border-[#8FD3FF] focus:ring-[#8FD3FF] border"
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">Standard: $1.50-$3.00</p>
        </div>

        <div>
          <label className="text-white font-semibold mb-2 block">
            Age Limit
          </label>
          <select
            value={ageLimit}
            onChange={(e) => setAgeLimit(e.target.value)}
            className="w-full bg-[#0B0D12] border-gray-700 text-white rounded-2xl px-4 py-4 focus:border-[#8FD3FF] focus:ring-[#8FD3FF] border"
          >
            <option value="All Ages" className="bg-[#14171E]">All Ages</option>
            <option value="18+" className="bg-[#14171E]">18+</option>
            <option value="21+" className="bg-[#14171E]">21+</option>
          </select>
        </div>
      </div>

      <div className="bg-[#0B0D12] border border-gray-700 rounded-2xl p-6">
        <h3 className="text-xl font-bold text-white mb-4">Show Schedule</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Doors Time</label>
            <input
              type="time"
              value={doorsTime}
              onChange={(e) => setDoorsTime(e.target.value)}
              className="w-full bg-[#14171E] border-gray-600 text-white rounded-xl px-4 py-3 focus:border-[#8FD3FF] focus:ring-[#8FD3FF] border"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Doors Duration (min)</label>
            <input
              type="number"
              value={doorsDuration}
              onChange={(e) => setDoorsDuration(parseInt(e.target.value))}
              className="w-full bg-[#14171E] border-gray-600 text-white rounded-xl px-4 py-3 focus:border-[#8FD3FF] focus:ring-[#8FD3FF] border"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Show Time</label>
            <input
              type="time"
              value={showTime}
              onChange={(e) => setShowTime(e.target.value)}
              className="w-full bg-[#14171E] border-gray-600 text-white rounded-xl px-4 py-3 focus:border-[#8FD3FF] focus:ring-[#8FD3FF] border"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Show Duration (min)</label>
            <input
              type="number"
              value={showDuration}
              onChange={(e) => setShowDuration(parseInt(e.target.value))}
              className="w-full bg-[#14171E] border-gray-600 text-white rounded-xl px-4 py-3 focus:border-[#8FD3FF] focus:ring-[#8FD3FF] border"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Curfew</label>
            <input
              type="time"
              value={curfewTime}
              onChange={(e) => setCurfewTime(e.target.value)}
              className="w-full bg-[#14171E] border-gray-600 text-white rounded-xl px-4 py-3 focus:border-[#8FD3FF] focus:ring-[#8FD3FF] border"
            />
          </div>
        </div>
      </div>

      <div className="bg-[#8FD3FF]/10 border border-[#8FD3FF]/30 rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <Info className="h-5 w-5 text-[#8FD3FF] flex-shrink-0" />
          <p className="text-sm text-gray-300">
            <span className="font-semibold text-[#8FD3FF]">Mode:</span> {mode === 'estimate' ? 'Estimate (Pre-Show)' : 'Settlement (Post-Show)'}
          </p>
        </div>
      </div>
    </div>
  );
}
