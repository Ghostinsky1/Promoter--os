import { X, Crown, Music, Mic2, Speaker } from 'lucide-react';
import type { EventArtist } from '../../types';

interface ArtistTemplateModalProps {
  onApply: (template: Partial<EventArtist>) => void;
  onSkip: () => void;
}

const TEMPLATES: {
  name: string;
  icon: typeof Crown;
  description: string;
  color: string;
  values: Partial<EventArtist>;
}[] = [
  {
    name: 'Headliner',
    icon: Crown,
    description: 'Full production: flights, hotel, rider, hospitality buyout',
    color: 'text-[#C4FF0D]',
    values: {
      deposit_type: 'percentage',
      deposit_percentage: 50,
      flight_covered: true,
      hotel_covered: true,
      hotel_rooms: 2,
      hotel_nights: 2,
      ground_transport_covered: true,
      airport_pickup: true,
      rider_included: true,
      guest_list_spots: 20,
    },
  },
  {
    name: 'Direct Support',
    icon: Music,
    description: 'Hotel, ground transport, rider included',
    color: 'text-blue-400',
    values: {
      deposit_type: 'percentage',
      deposit_percentage: 50,
      flight_covered: false,
      hotel_covered: true,
      hotel_rooms: 1,
      hotel_nights: 1,
      ground_transport_covered: true,
      rider_included: true,
      guest_list_spots: 10,
    },
  },
  {
    name: 'Support',
    icon: Mic2,
    description: 'Basic deal with deposit, minimal accommodations',
    color: 'text-amber-400',
    values: {
      deposit_type: 'percentage',
      deposit_percentage: 50,
      flight_covered: false,
      hotel_covered: false,
      ground_transport_covered: false,
      rider_included: false,
      guest_list_spots: 4,
    },
  },
  {
    name: 'Local Opener',
    icon: Speaker,
    description: 'Flat fee, no travel or hospitality',
    color: 'text-gray-400',
    values: {
      deposit_type: 'fixed',
      deposit_percentage: 0,
      deposit_amount: 0,
      flight_covered: false,
      hotel_covered: false,
      ground_transport_covered: false,
      rider_included: false,
      guest_list_spots: 2,
    },
  },
];

export function ArtistTemplateModal({ onApply, onSkip }: ArtistTemplateModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1A1D1F] border border-gray-800 rounded-2xl shadow-2xl max-w-lg w-full">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-white">Start from Template</h2>
            <p className="text-xs text-gray-500 mt-0.5">Choose a starting point or skip to start blank</p>
          </div>
          <button onClick={onSkip} className="p-1 text-gray-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-2">
          {TEMPLATES.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.name}
                onClick={() => onApply(t.values)}
                className="w-full text-left p-4 bg-[#252A2E] border border-gray-800 rounded-xl hover:border-[#C4FF0D]/30 hover:bg-[#252A2E]/80 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg bg-[#1A1D1F] flex items-center justify-center ${t.color}`}>
                    <Icon className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white group-hover:text-[#C4FF0D] transition-colors">
                      {t.name} Template
                    </div>
                    <div className="text-[11px] text-gray-500">{t.description}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="p-5 border-t border-gray-800">
          <button
            onClick={onSkip}
            className="w-full py-2.5 text-sm text-gray-400 hover:text-white font-medium transition-colors"
          >
            Skip - Start Blank
          </button>
        </div>
      </div>
    </div>
  );
}
