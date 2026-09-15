import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Clock, Plus, Save, Download, ArrowLeft, ArrowUp, ArrowDown, Trash2, Music, Eye, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { OfferWithShow, ScheduleItem, VenueContact, CompanySettings } from '../types';
import { useAuth } from '../hooks/useAuth';
import { generateRunOfShowPDF } from '../lib/generateRunOfShowPDF';
import { convertTo12Hour, addMinutesToTime } from '../lib/timeHelpers';

export function RunOfShow() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [offerData, setOfferData] = useState<OfferWithShow | null>(null);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [eventDate, setEventDate] = useState('');
  const [venueContact, setVenueContact] = useState<VenueContact>({ name: '', phone: '', email: '' });
  const [notes, setNotes] = useState('');
  const [runOfShowId, setRunOfShowId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [companySettings, setCompanySettings] = useState<CompanySettings | undefined>(undefined);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    if (!id) return;

    try {
      const { data: offerWithShow } = await supabase
        .from('offers')
        .select('*, show:shows(*)')
        .eq('id', id)
        .single();

      if (offerWithShow) {
        setOfferData(offerWithShow as any);
        setEventDate(offerWithShow.show.event_date);

        const { data: existingRos, error: rosError } = await supabase
          .from('run_of_show')
          .select('*')
          .eq('offer_id', id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (rosError) {
          console.error('Error loading run of show:', rosError);
        }

        if (existingRos) {
          setRunOfShowId(existingRos.id);
          setSchedule(existingRos.schedule || []);
          setVenueContact(existingRos.venue_contact || { name: '', phone: '', email: '' });
          setNotes(existingRos.notes || '');
          setEventDate(existingRos.event_date || offerWithShow.show.event_date);
        } else {
          setSchedule(generateDefaultSchedule(offerWithShow));
        }
      }

      const { data: settings } = await supabase
        .from('company_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (settings) {
        setCompanySettings(settings);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateDefaultSchedule = (data: any): ScheduleItem[] => {
    const schedule: ScheduleItem[] = [
      {
        id: crypto.randomUUID(),
        time: '14:00',
        duration: 120,
        title: 'Load-In',
        category: 'production',
        description: 'Production, sound, lighting load-in and setup',
        responsible: 'Production Manager'
      },
      {
        id: crypto.randomUUID(),
        time: '16:00',
        duration: 60,
        title: 'Sound Check',
        category: 'technical',
        description: 'Full sound check for all acts',
        responsible: 'Sound Engineer'
      },
      {
        id: crypto.randomUUID(),
        time: '17:00',
        duration: 60,
        title: 'Artist Arrival',
        category: 'artist',
        description: `${data.show.artist_name} and support acts arrive`,
        responsible: 'Artist Liaison'
      },
      {
        id: crypto.randomUUID(),
        time: '18:00',
        duration: 60,
        title: 'Doors Open',
        category: 'venue',
        description: 'Venue opens to public',
        responsible: 'Venue Manager'
      }
    ];

    let currentTime = '19:00';

    if (data.support_acts && data.support_acts.length > 0) {
      data.support_acts.forEach((act: any) => {
        schedule.push({
          id: crypto.randomUUID(),
          time: currentTime,
          duration: act.set_length || 30,
          title: `${act.name} - ${act.type}`,
          category: 'performance',
          description: `${act.genre || 'Support'} set`,
          responsible: act.name
        });

        currentTime = addMinutesToTime(currentTime, act.set_length + 15);
      });
    }

    schedule.push({
      id: crypto.randomUUID(),
      time: currentTime,
      duration: 90,
      title: `${data.show.artist_name} - HEADLINER`,
      category: 'performance',
      description: 'Main performance',
      responsible: data.show.artist_name
    });

    const endTime = addMinutesToTime(currentTime, 90);
    schedule.push({
      id: crypto.randomUUID(),
      time: endTime,
      duration: 30,
      title: 'Show End / Venue Clear',
      category: 'venue',
      description: 'Audience exits, venue clears',
      responsible: 'Security'
    });

    const loadOutTime = addMinutesToTime(endTime, 30);
    schedule.push({
      id: crypto.randomUUID(),
      time: loadOutTime,
      duration: 90,
      title: 'Load-Out',
      category: 'production',
      description: 'Equipment breakdown and load-out',
      responsible: 'Production Manager'
    });

    return schedule;
  };


  const calculateEndTime = (startTime: string, duration: number): string => {
    return addMinutesToTime(startTime, duration);
  };

  const calculateGapTime = (item1: ScheduleItem, item2: ScheduleItem): number => {
    const end1 = calculateEndTime(item1.time, item1.duration);
    const [h1, m1] = end1.split(':').map(Number);
    const [h2, m2] = item2.time.split(':').map(Number);

    const time1 = h1 * 60 + m1;
    const time2 = h2 * 60 + m2;

    return time2 - time1;
  };

  const addScheduleItem = () => {
    const lastItem = schedule[schedule.length - 1];
    const newTime = lastItem ? addMinutesToTime(lastItem.time, lastItem.duration) : '12:00';

    setSchedule([...schedule, {
      id: crypto.randomUUID(),
      time: newTime,
      duration: 30,
      title: 'New Event',
      category: 'other',
      description: '',
      responsible: ''
    }]);
  };

  const updateScheduleItem = (index: number, field: keyof ScheduleItem, value: any) => {
    const updated = [...schedule];
    updated[index] = { ...updated[index], [field]: value };
    setSchedule(updated);
  };

  const removeScheduleItem = (index: number) => {
    setSchedule(schedule.filter((_, i) => i !== index));
  };

  const moveScheduleItem = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= schedule.length) return;

    const updated = [...schedule];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setSchedule(updated);
  };

  const saveSchedule = async () => {
    if (!user || !id) return;

    setSaving(true);
    try {
      const rosData = {
        offer_id: id,
        event_date: eventDate,
        venue_contact: venueContact,
        schedule,
        notes,
        user_id: user.id
      };

      if (runOfShowId) {
        const { error } = await supabase
          .from('run_of_show')
          .update({ ...rosData, updated_at: new Date().toISOString() })
          .eq('id', runOfShowId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('run_of_show')
          .insert(rosData)
          .select()
          .single();

        if (error) throw error;
        if (data) setRunOfShowId(data.id);
      }

      alert('Run of Show saved successfully!');
    } catch (error) {
      console.error('Error saving:', error);
      alert('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const getCategoryColor = (category: string): string => {
    const colors: Record<string, string> = {
      production: 'bg-blue-900/20 border-blue-800/30',
      technical: 'bg-purple-900/20 border-purple-800/30',
      artist: 'bg-pink-900/20 border-pink-800/30',
      performance: 'bg-green-900/20 border-green-800/30',
      venue: 'bg-orange-900/20 border-orange-800/30',
      other: 'bg-[#22262F] border-gray-800'
    };
    return colors[category] || colors.other;
  };

  const calculateTotalDuration = (): string => {
    if (schedule.length === 0) return '0';
    const totalMinutes = schedule.reduce((sum, item) => sum + item.duration, 0);
    return (totalMinutes / 60).toFixed(1);
  };

  if (loading) {
    return <div className="min-h-screen bg-[#1140F0] flex items-center justify-center text-gray-400">Loading...</div>;
  }

  if (!offerData) {
    return <div className="min-h-screen bg-[#1140F0] flex items-center justify-center text-gray-400">Offer not found</div>;
  }

  return (
    <div className="min-h-screen bg-[#1140F0]">
      <div className="bg-[#14171E] border-b border-gray-800 sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(`/offers/${id}`)}
                className="p-2 hover:bg-[#22262F] rounded-lg transition-colors text-gray-400"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-white">Run of Show</h1>
                <p className="text-sm text-gray-400">
                  {offerData.show.artist_name} • {offerData.show.venue_name} • {new Date(eventDate).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={saveSchedule}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-[#22262F] border border-gray-800 text-white rounded-xl hover:bg-[#2A3040] transition-colors disabled:opacity-50 font-bold"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => setShowPreview(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[#22262F] border border-gray-800 text-white rounded-xl hover:bg-[#2A3040] transition-colors font-bold"
              >
                <Eye className="h-4 w-4" />
                Preview
              </button>
              <button
                onClick={() => generateRunOfShowPDF(offerData, schedule, venueContact, eventDate, companySettings)}
                className="flex items-center gap-2 px-4 py-2 bg-[#8FD3FF] text-[#04214D] rounded-xl hover:bg-[#6FB8F2] transition-colors font-bold"
              >
                <Download className="h-4 w-4" />
                Download PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-[#14171E] border border-gray-800 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">Event Details</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-400">Event Date</label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#22262F] border border-gray-800 text-white rounded-xl focus:ring-2 focus:ring-[#8FD3FF] focus:border-[#8FD3FF]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-400">Venue</label>
                  <div className="font-semibold text-white">{offerData.show.venue_name}</div>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-400">Capacity</label>
                  <div className="font-semibold text-white">{offerData.show.capacity}</div>
                </div>
              </div>
            </div>

            <div className="bg-[#14171E] border border-gray-800 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">Venue Contact</h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-semibold mb-1 text-gray-400">Name</label>
                  <input
                    type="text"
                    value={venueContact.name}
                    onChange={(e) => setVenueContact({...venueContact, name: e.target.value})}
                    placeholder="Contact name"
                    className="w-full px-3 py-2 bg-[#22262F] border border-gray-800 text-white placeholder-gray-500 rounded-xl focus:ring-2 focus:ring-[#8FD3FF] focus:border-[#8FD3FF]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1 text-gray-400">Phone</label>
                  <input
                    type="tel"
                    value={venueContact.phone}
                    onChange={(e) => setVenueContact({...venueContact, phone: e.target.value})}
                    placeholder="(555) 123-4567"
                    className="w-full px-3 py-2 bg-[#22262F] border border-gray-800 text-white placeholder-gray-500 rounded-xl focus:ring-2 focus:ring-[#8FD3FF] focus:border-[#8FD3FF]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1 text-gray-400">Email</label>
                  <input
                    type="email"
                    value={venueContact.email}
                    onChange={(e) => setVenueContact({...venueContact, email: e.target.value})}
                    placeholder="contact@venue.com"
                    className="w-full px-3 py-2 bg-[#22262F] border border-gray-800 text-white placeholder-gray-500 rounded-xl focus:ring-2 focus:ring-[#8FD3FF] focus:border-[#8FD3FF]"
                  />
                </div>
              </div>
            </div>

            <div className="bg-[#14171E] border border-gray-800 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">Quick Stats</h3>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Duration:</span>
                  <span className="font-bold text-white">
                    {calculateTotalDuration()} hours
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Performers:</span>
                  <span className="font-bold text-white">
                    {1 + (offerData.support_acts?.length || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Schedule Items:</span>
                  <span className="font-bold text-white">{schedule.length}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-[#14171E] border border-gray-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white">Event Timeline</h3>
                <button
                  onClick={addScheduleItem}
                  className="flex items-center gap-2 px-4 py-2 bg-[#8FD3FF] text-[#04214D] rounded-xl hover:bg-[#6FB8F2] transition-colors text-sm font-bold"
                >
                  <Plus className="h-4 w-4" />
                  Add Item
                </button>
              </div>

              <div className="space-y-4">
                {schedule.map((item, index) => (
                  <div
                    key={item.id}
                    className={`p-4 border rounded-lg ${getCategoryColor(item.category)}`}
                  >
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-32">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="h-4 w-4 text-gray-400" />
                          <input
                            type="time"
                            value={item.time}
                            onChange={(e) => updateScheduleItem(index, 'time', e.target.value)}
                            className="w-full px-2 py-1 bg-[#22262F] border border-gray-800 text-white rounded text-sm focus:ring-2 focus:ring-[#8FD3FF] focus:border-[#8FD3FF]"
                          />
                        </div>
                        <div className="text-xs text-gray-400">
                          {item.duration} min
                        </div>
                      </div>

                      <div className="flex-1">
                        <input
                          type="text"
                          value={item.title}
                          onChange={(e) => updateScheduleItem(index, 'title', e.target.value)}
                          className="w-full font-bold mb-2 text-lg px-2 py-1 bg-transparent text-white border border-transparent hover:border-gray-700 rounded focus:ring-2 focus:ring-[#8FD3FF] focus:border-[#8FD3FF]"
                          placeholder="Event title"
                        />

                        <textarea
                          value={item.description}
                          onChange={(e) => updateScheduleItem(index, 'description', e.target.value)}
                          className="w-full text-sm mb-2 px-2 py-1 bg-transparent text-gray-300 border border-transparent hover:border-gray-700 rounded focus:ring-2 focus:ring-[#8FD3FF] focus:border-[#8FD3FF]"
                          rows={2}
                          placeholder="Description..."
                        />

                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-xs mb-1 font-semibold text-gray-400">Category</label>
                            <select
                              value={item.category}
                              onChange={(e) => updateScheduleItem(index, 'category', e.target.value as any)}
                              className="w-full text-xs px-2 py-1 bg-[#22262F] border border-gray-800 text-white rounded focus:ring-2 focus:ring-[#8FD3FF] focus:border-[#8FD3FF]"
                            >
                              <option value="production">🔧 Production</option>
                              <option value="technical">🎚️ Technical</option>
                              <option value="artist">🎤 Artist</option>
                              <option value="performance">🎸 Performance</option>
                              <option value="venue">🏛️ Venue</option>
                              <option value="other">📋 Other</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs mb-1 font-semibold text-gray-400">Duration (min)</label>
                            <input
                              type="number"
                              value={item.duration}
                              onChange={(e) => updateScheduleItem(index, 'duration', parseInt(e.target.value) || 0)}
                              className="w-full text-xs px-2 py-1 bg-[#22262F] border border-gray-800 text-white rounded focus:ring-2 focus:ring-[#8FD3FF] focus:border-[#8FD3FF]"
                            />
                          </div>

                          <div>
                            <label className="block text-xs mb-1 font-semibold text-gray-400">Responsible</label>
                            <input
                              type="text"
                              value={item.responsible}
                              onChange={(e) => updateScheduleItem(index, 'responsible', e.target.value)}
                              className="w-full text-xs px-2 py-1 bg-[#22262F] border border-gray-800 text-white rounded focus:ring-2 focus:ring-[#8FD3FF] focus:border-[#8FD3FF]"
                              placeholder="Name/Role"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => moveScheduleItem(index, 'up')}
                          disabled={index === 0}
                          className="p-2 hover:bg-[#22262F] rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ArrowUp className="h-4 w-4 text-gray-400" />
                        </button>
                        <button
                          onClick={() => moveScheduleItem(index, 'down')}
                          disabled={index === schedule.length - 1}
                          className="p-2 hover:bg-[#22262F] rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ArrowDown className="h-4 w-4 text-gray-400" />
                        </button>
                        <button
                          onClick={() => removeScheduleItem(index)}
                          className="p-2 hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-2 text-xs text-gray-400 flex items-center gap-2 ml-36">
                      <span>Ends at: {convertTo12Hour(calculateEndTime(item.time, item.duration))}</span>
                      {index < schedule.length - 1 && (
                        <span className={calculateGapTime(item, schedule[index + 1]) < 0 ? 'text-red-400 font-semibold' : 'text-orange-400'}>
                          → {calculateGapTime(item, schedule[index + 1])} min gap
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showPreview && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1140F0] border-2 border-gray-800 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-800 bg-gradient-to-r from-[#14171E] to-[#0B0D12]">
              <div>
                <h2 className="text-2xl font-bold text-white">Run of Show Preview</h2>
                <p className="text-sm text-gray-400 mt-1">
                  {offerData?.show.artist_name} • {new Date(eventDate).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => setShowPreview(false)}
                className="p-2 hover:bg-[#22262F] rounded-xl transition-colors text-gray-400 hover:text-white"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="overflow-auto p-6 flex-1 bg-[#1140F0]">
              <div className="bg-[#14171E] border border-gray-800 rounded-2xl p-6 mb-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-bold text-white mb-3 flex items-center gap-2">
                      <Music className="h-4 w-4 text-[#8FD3FF]" />
                      Event Information
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div><span className="text-gray-400">Date:</span> <span className="font-medium text-white ml-2">{new Date(eventDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span></div>
                      <div><span className="text-gray-400">Venue:</span> <span className="font-medium text-white ml-2">{offerData?.show.venue_name}</span></div>
                      <div><span className="text-gray-400">Capacity:</span> <span className="font-medium text-white ml-2">{offerData?.show.capacity}</span></div>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-white mb-3 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-[#8FD3FF]" />
                      Venue Contact
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div><span className="text-gray-400">Name:</span> <span className="font-medium text-white ml-2">{venueContact.name || 'N/A'}</span></div>
                      <div><span className="text-gray-400">Phone:</span> <span className="font-medium text-white ml-2">{venueContact.phone || 'N/A'}</span></div>
                      <div><span className="text-gray-400">Email:</span> <span className="font-medium text-white ml-2">{venueContact.email || 'N/A'}</span></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {schedule.map((item, index) => (
                  <div
                    key={item.id}
                    className={`p-4 border-l-4 rounded-2xl ${getPreviewCategoryBorderColor(item.category)} bg-[#14171E] border border-gray-800`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-24">
                        <div className="text-lg font-bold text-[#8FD3FF]">{convertTo12Hour(item.time)}</div>
                        <div className="text-xs text-gray-500">{item.duration} min</div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-1">
                          <h4 className="font-bold text-white">{item.title}</h4>
                          <span className={`text-xs px-2 py-1 rounded-full ${getPreviewCategoryBadgeColor(item.category)}`}>
                            {item.category}
                          </span>
                        </div>
                        {item.description && (
                          <p className="text-sm text-gray-400 mb-2">{item.description}</p>
                        )}
                        {item.responsible && (
                          <p className="text-xs text-gray-500">
                            <span className="font-semibold">Responsible:</span> {item.responsible}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-gray-500 pl-28">
                      Ends: {convertTo12Hour(calculateEndTime(item.time, item.duration))}
                      {index < schedule.length - 1 && (
                        <>
                          {' • '}
                          <span className={calculateGapTime(item, schedule[index + 1]) < 0 ? 'text-red-400 font-semibold' : 'text-gray-400'}>
                            {Math.abs(calculateGapTime(item, schedule[index + 1]))} min {calculateGapTime(item, schedule[index + 1]) < 0 ? 'overlap' : 'until next'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-gradient-to-br from-[#8FD3FF]/10 to-green-500/10 border-2 border-[#8FD3FF]/30 rounded-2xl">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="h-4 w-4 text-[#8FD3FF]" />
                  <h4 className="font-bold text-white">Summary</h4>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-gray-400">Total Duration</div>
                    <div className="font-bold text-[#8FD3FF] text-lg">{calculateTotalDuration()} hours</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Schedule Items</div>
                    <div className="font-bold text-[#8FD3FF] text-lg">{schedule.length}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Performers</div>
                    <div className="font-bold text-[#8FD3FF] text-lg">{1 + (offerData?.support_acts?.length || 0)}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-800 bg-[#14171E] flex gap-3">
              <button
                onClick={() => setShowPreview(false)}
                className="flex-1 px-4 py-2 bg-[#22262F] border border-gray-700 text-white rounded-2xl hover:bg-[#2A3040] transition-colors font-semibold"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowPreview(false);
                  generateRunOfShowPDF(offerData!, schedule, venueContact, eventDate, companySettings);
                }}
                className="flex-1 px-4 py-2 bg-[#8FD3FF] text-[#04214D] rounded-2xl hover:bg-[#6FB8F2] transition-colors font-bold flex items-center justify-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getPreviewCategoryBorderColor(category: string): string {
  const colors: Record<string, string> = {
    production: 'border-l-blue-500',
    technical: 'border-l-purple-500',
    artist: 'border-l-pink-500',
    performance: 'border-l-[#8FD3FF]',
    venue: 'border-l-orange-500',
    other: 'border-l-gray-600'
  };
  return colors[category] || colors.other;
}

function getPreviewCategoryBadgeColor(category: string): string {
  const colors: Record<string, string> = {
    production: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    technical: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
    artist: 'bg-pink-500/20 text-pink-400 border border-pink-500/30',
    performance: 'bg-[#8FD3FF]/20 text-[#8FD3FF] border border-[#8FD3FF]/30',
    venue: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
    other: 'bg-gray-700/50 text-gray-400 border border-gray-600'
  };
  return colors[category] || colors.other;
}
