import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { TourStatus } from '../types';
import { useAuth } from '../hooks/useAuth';

export function CreateTourPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [tourData, setTourData] = useState({
    name: '',
    artist_name: '',
    start_date: '',
    end_date: '',
    description: '',
    status: 'planning' as TourStatus
  });

  const createTour = async () => {
    if (!user || !tourData.name || !tourData.artist_name || !tourData.start_date || !tourData.end_date) {
      alert('Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('tours')
        .insert([{
          ...tourData,
          user_id: user.id
        }])
        .select()
        .single();

      if (error) throw error;

      navigate(`/tours/${data.id}`);
    } catch (error) {
      console.error('Error creating tour:', error);
      alert('Failed to create tour. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1113] pb-24">
      <div className="bg-[#1A1F1E] border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/tours')}
              className="p-2 hover:bg-[#252A29] text-gray-400 hover:text-white rounded-xl transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white">Create New Tour</h1>
              <p className="text-gray-400">Set up a multi-city tour</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-[#1A1F1E] border border-gray-800 rounded-3xl p-8">
          <div className="space-y-6">
            <div>
              <label className="block text-base font-semibold mb-2 text-white">Tour Name *</label>
              <input
                type="text"
                value={tourData.name}
                onChange={(e) => setTourData({...tourData, name: e.target.value})}
                placeholder="e.g., Summer 2025 World Tour"
                className="w-full text-lg px-4 py-3 bg-[#141716] border border-gray-700 text-white placeholder-gray-500 rounded-xl focus:ring-2 focus:ring-[#C4FF0D] focus:border-[#C4FF0D] transition-all"
              />
            </div>

            <div>
              <label className="block text-base font-semibold mb-2 text-white">Artist Name *</label>
              <input
                type="text"
                value={tourData.artist_name}
                onChange={(e) => setTourData({...tourData, artist_name: e.target.value})}
                placeholder="e.g., Drake"
                className="w-full text-lg px-4 py-3 bg-[#141716] border border-gray-700 text-white placeholder-gray-500 rounded-xl focus:ring-2 focus:ring-[#C4FF0D] focus:border-[#C4FF0D] transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-base font-semibold mb-2 text-white">Start Date *</label>
                <input
                  type="date"
                  value={tourData.start_date}
                  onChange={(e) => setTourData({...tourData, start_date: e.target.value})}
                  className="w-full px-4 py-3 bg-[#141716] border border-gray-700 text-white rounded-xl focus:ring-2 focus:ring-[#C4FF0D] focus:border-[#C4FF0D] transition-all [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="block text-base font-semibold mb-2 text-white">End Date *</label>
                <input
                  type="date"
                  value={tourData.end_date}
                  onChange={(e) => setTourData({...tourData, end_date: e.target.value})}
                  className="w-full px-4 py-3 bg-[#141716] border border-gray-700 text-white rounded-xl focus:ring-2 focus:ring-[#C4FF0D] focus:border-[#C4FF0D] transition-all [color-scheme:dark]"
                />
              </div>
            </div>

            <div>
              <label className="block text-base font-semibold mb-2 text-white">Description</label>
              <textarea
                value={tourData.description}
                onChange={(e) => setTourData({...tourData, description: e.target.value})}
                placeholder="Tour details, themes, special notes..."
                rows={4}
                className="w-full px-4 py-3 bg-[#141716] border border-gray-700 text-white placeholder-gray-500 rounded-xl focus:ring-2 focus:ring-[#C4FF0D] focus:border-[#C4FF0D] transition-all"
              />
            </div>

            <div>
              <label className="block text-base font-semibold mb-2 text-white">Tour Status</label>
              <select
                value={tourData.status}
                onChange={(e) => setTourData({...tourData, status: e.target.value as TourStatus})}
                className="w-full px-4 py-3 bg-[#141716] border border-gray-700 text-white rounded-xl focus:ring-2 focus:ring-[#C4FF0D] focus:border-[#C4FF0D] transition-all"
              >
                <option value="planning">📋 Planning</option>
                <option value="booking">📞 Booking</option>
                <option value="confirmed">✅ Confirmed</option>
                <option value="active">🎸 Active</option>
                <option value="completed">✓ Completed</option>
                <option value="cancelled">❌ Cancelled</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-[#1A1F1E] border-t border-gray-800 p-4">
        <div className="max-w-4xl mx-auto flex justify-end gap-3">
          <button
            onClick={() => navigate('/tours')}
            className="px-6 py-3 border border-gray-700 text-gray-300 rounded-2xl hover:bg-[#252A29] hover:border-gray-600 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={createTour}
            disabled={saving}
            className="px-6 py-3 bg-[#C4FF0D] hover:bg-[#A3D60A] text-black rounded-2xl transition-colors font-bold disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create Tour'}
          </button>
        </div>
      </div>
    </div>
  );
}
