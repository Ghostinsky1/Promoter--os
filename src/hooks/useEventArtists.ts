import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { calculateArtistCost } from '../lib/artistCalculations';
import type { EventArtist, EventArtistTask, ArtistRole, ArtistOfferStatus, OfferWithShow, SupportAct } from '../types';

const DEFAULT_ARTIST: Partial<EventArtist> = {
  artist_name: '',
  role: 'support',
  status: 'draft',
  agency: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  guarantee: 0,
  deposit_type: 'percentage',
  deposit_percentage: 0,
  deposit_amount: 0,
  balance_due: 0,
  payment_notes: '',
  flight_covered: false,
  flight_budget: 0,
  hotel_covered: false,
  hotel_rooms: 1,
  hotel_nights: 1,
  hotel_budget: 0,
  ground_transport_covered: false,
  ground_transport_budget: 0,
  airport_pickup: false,
  travel_notes: '',
  rider_included: false,
  hospitality_buyout: 0,
  dinner_buyout: 0,
  drink_tickets: 0,
  backstage_needs: '',
  hospitality_notes: '',
  set_length: 0,
  performance_time: '',
  soundcheck_time: '',
  guest_list_spots: 0,
  merch_cut: 0,
  meet_and_greet: false,
  special_terms: '',
  internal_notes: '',
  total_artist_cost: 0,
  sort_order: 0,
};

function mapSupportActRole(act: SupportAct): ArtistRole {
  if (act.role === 'headliner') return 'headliner';
  if (act.role === 'opener') return 'local_opener';
  return 'support';
}

function mapDepositType(act: SupportAct): 'percentage' | 'fixed' {
  return act.deposit_type === 'fixed' ? 'fixed' : 'percentage';
}

function buildArtistFromSupportAct(act: SupportAct, offerId: string, orgId: string, sortOrder: number): Record<string, unknown> {
  const depType = mapDepositType(act);
  const guarantee = act.guarantee || 0;
  let depositAmt = 0;
  let depositPct = 0;
  if (depType === 'percentage') {
    depositPct = act.deposit_value || 0;
    depositAmt = guarantee * (depositPct / 100);
  } else {
    depositAmt = act.deposit_value || 0;
  }
  const balance = Math.max(guarantee - depositAmt, 0);

  const flightCovered = act.include_flights || false;
  const hotelCovered = act.include_hotel || false;
  const transportCovered = act.include_transport || false;
  const riderIncluded = act.include_rider || false;

  const flightBudget = act.flight_budget || 0;
  const hotelBudget = act.hotel_budget || 0;
  const hotelNights = act.hotel_nights || 1;
  const transportBudget = act.transport_budget || 0;
  const riderCap = act.rider_cap || 0;

  const travelCost = (flightCovered ? flightBudget : 0) + (hotelCovered ? hotelBudget * hotelNights : 0) + (transportCovered ? transportBudget : 0);
  const totalCost = guarantee + travelCost;

  return {
    offer_id: offerId,
    organization_id: orgId,
    artist_name: act.name || '',
    role: mapSupportActRole(act),
    status: 'draft',
    agency: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    guarantee,
    deposit_type: depType,
    deposit_percentage: depositPct,
    deposit_amount: depositAmt,
    balance_due: balance,
    payment_notes: '',
    flight_covered: flightCovered,
    flight_budget: flightBudget,
    hotel_covered: hotelCovered,
    hotel_rooms: 1,
    hotel_nights: hotelNights,
    hotel_budget: hotelBudget,
    ground_transport_covered: transportCovered,
    ground_transport_budget: transportBudget,
    airport_pickup: false,
    travel_notes: act.flight_notes || act.transport_notes || '',
    rider_included: riderIncluded,
    hospitality_buyout: riderIncluded ? riderCap : 0,
    dinner_buyout: 0,
    drink_tickets: 0,
    backstage_needs: '',
    hospitality_notes: act.rider_notes || act.hotel_notes || '',
    set_length: act.set_length || 0,
    performance_time: '',
    soundcheck_time: '',
    guest_list_spots: 0,
    merch_cut: 0,
    meet_and_greet: false,
    special_terms: '',
    internal_notes: act.notes || '',
    total_artist_cost: totalCost,
    sort_order: sortOrder,
  };
}

function buildArtistFromHeadliner(offer: OfferWithShow, orgId: string): Record<string, unknown> {
  const guarantee = offer.guarantee || 0;
  const depositPct = offer.deposit_pct || 0;
  const depositAmt = guarantee * (depositPct / 100);
  const balance = Math.max(guarantee - depositAmt, 0);

  const flightCovered = offer.include_flights || false;
  const hotelCovered = offer.include_hotel || false;
  const transportCovered = offer.include_transport || false;
  const riderIncluded = offer.include_rider || false;

  const flightBudget = offer.flight_budget || 0;
  const hotelBudget = offer.hotel_budget || 0;
  const hotelNights = offer.hotel_nights || 1;
  const transportBudget = offer.transport_budget || 0;
  const riderCap = offer.rider_cap || 0;

  const travelCost = (flightCovered ? flightBudget : 0) + (hotelCovered ? hotelBudget * hotelNights : 0) + (transportCovered ? transportBudget : 0);
  const hospCost = riderIncluded ? riderCap : 0;
  const totalCost = guarantee + travelCost + hospCost;

  const paymentMethod = offer.payment_method || 'deposit_balance';
  let paymentNotes = '';
  if (paymentMethod === 'full_upfront') paymentNotes = 'Full payment upfront';
  else if (paymentMethod === 'day_of_settlement') paymentNotes = `Settlement: ${offer.settlement_days ?? 7} days after event`;

  return {
    offer_id: offer.id,
    organization_id: orgId,
    artist_name: offer.show.artist_name || '',
    role: 'headliner',
    status: offer.status === 'confirmed' ? 'accepted' : offer.status === 'settled' ? 'fully_paid' : 'draft',
    agency: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    guarantee,
    deposit_type: 'percentage',
    deposit_percentage: depositPct,
    deposit_amount: depositAmt,
    balance_due: balance,
    payment_notes: paymentNotes,
    flight_covered: flightCovered,
    flight_budget: flightBudget,
    hotel_covered: hotelCovered,
    hotel_rooms: 1,
    hotel_nights: hotelNights,
    hotel_budget: hotelBudget,
    ground_transport_covered: transportCovered,
    ground_transport_budget: transportBudget,
    airport_pickup: false,
    travel_notes: offer.flight_notes || offer.transport_notes || '',
    rider_included: riderIncluded,
    hospitality_buyout: riderIncluded ? riderCap : 0,
    dinner_buyout: 0,
    drink_tickets: 0,
    backstage_needs: '',
    hospitality_notes: offer.rider_notes || offer.hotel_notes || '',
    set_length: 0,
    performance_time: offer.show_time || '',
    soundcheck_time: '',
    guest_list_spots: offer.comps_artist || 0,
    merch_cut: offer.merch_rate_soft || 0,
    meet_and_greet: false,
    special_terms: '',
    internal_notes: '',
    total_artist_cost: totalCost,
    sort_order: 0,
  };
}

async function getOrgId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();
  return data?.organization_id || null;
}

export function useEventArtists(offerId: string | null) {
  const [artists, setArtists] = useState<EventArtist[]>([]);
  const [artistTasks, setArtistTasks] = useState<Record<string, EventArtistTask[]>>({});
  const [loading, setLoading] = useState(true);
  const orgIdRef = useRef<string | null>(null);
  const importedRef = useRef<string | null>(null);

  const ensureOrgId = useCallback(async () => {
    if (orgIdRef.current) return orgIdRef.current;
    const id = await getOrgId();
    orgIdRef.current = id;
    return id;
  }, []);

  const loadArtists = useCallback(async () => {
    if (!offerId) { setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from('event_artists')
        .select('*')
        .eq('offer_id', offerId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setArtists((data as EventArtist[]) || []);

      if (data && data.length > 0) {
        const ids = data.map(a => a.id);
        const { data: tasks } = await supabase
          .from('event_artist_tasks')
          .select('*')
          .in('event_artist_id', ids)
          .order('created_at', { ascending: true });

        const grouped: Record<string, EventArtistTask[]> = {};
        for (const t of (tasks || [])) {
          if (!grouped[t.event_artist_id]) grouped[t.event_artist_id] = [];
          grouped[t.event_artist_id].push(t as EventArtistTask);
        }
        setArtistTasks(grouped);
      }
    } catch (err) {
      console.error('Error loading event artists:', err);
    } finally {
      setLoading(false);
    }
  }, [offerId]);

  useEffect(() => {
    loadArtists();
  }, [loadArtists]);

  const importFromOffer = useCallback(async (offer: OfferWithShow) => {
    if (!offerId || importedRef.current === offerId) return;
    if (artists.length > 0) {
      importedRef.current = offerId;
      return;
    }

    const orgId = await ensureOrgId();
    if (!orgId) return;

    importedRef.current = offerId;

    const rows: Record<string, unknown>[] = [];

    const hasHeadlinerData = offer.guarantee > 0 || offer.show.artist_name;
    if (hasHeadlinerData) {
      rows.push(buildArtistFromHeadliner(offer, orgId));
    }

    const supportActs = offer.support_acts || [];
    for (let i = 0; i < supportActs.length; i++) {
      rows.push(buildArtistFromSupportAct(supportActs[i], offerId, orgId, rows.length));
    }

    if (rows.length === 0) return;

    const { data, error } = await supabase
      .from('event_artists')
      .insert(rows)
      .select();

    if (error) {
      console.error('Error importing artists from offer:', error);
      return;
    }

    if (data) {
      setArtists(data as EventArtist[]);
    }
  }, [offerId, artists.length, ensureOrgId]);

  const addArtist = useCallback(async (role: ArtistRole = 'support') => {
    if (!offerId) return;
    const orgId = await ensureOrgId();
    if (!orgId) return;

    const sortOrder = artists.length;
    const { data, error } = await supabase
      .from('event_artists')
      .insert({
        ...DEFAULT_ARTIST,
        offer_id: offerId,
        organization_id: orgId,
        role,
        sort_order: sortOrder,
      })
      .select()
      .maybeSingle();

    if (error) { console.error('Error adding artist:', error); return; }
    if (data) setArtists(prev => [...prev, data as EventArtist]);
    return data as EventArtist;
  }, [offerId, artists.length, ensureOrgId]);

  const updateArtist = useCallback(async (id: string, patch: Partial<EventArtist>) => {
    const current = artists.find(a => a.id === id);
    if (!current) return;

    const merged = { ...current, ...patch };
    const costs = calculateArtistCost(merged as EventArtist);

    const update = {
      ...patch,
      deposit_amount: costs.deposit,
      balance_due: costs.balance,
      total_artist_cost: costs.totalCost,
      updated_at: new Date().toISOString(),
    };

    setArtists(prev => prev.map(a => a.id === id ? { ...a, ...update } : a));

    const { error } = await supabase
      .from('event_artists')
      .update(update)
      .eq('id', id);

    if (error) {
      console.error('Error updating artist:', error);
      loadArtists();
    }
  }, [artists, loadArtists]);

  const deleteArtist = useCallback(async (id: string) => {
    setArtists(prev => prev.filter(a => a.id !== id));
    const { error } = await supabase
      .from('event_artists')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting artist:', error);
      loadArtists();
    }
  }, [loadArtists]);

  const duplicateArtist = useCallback(async (id: string) => {
    const source = artists.find(a => a.id === id);
    if (!source || !offerId) return;
    const orgId = await ensureOrgId();
    if (!orgId) return;

    const { id: _id, created_at, updated_at, ...rest } = source;
    const { data, error } = await supabase
      .from('event_artists')
      .insert({
        ...rest,
        artist_name: `${rest.artist_name} (Copy)`,
        status: 'draft' as ArtistOfferStatus,
        sort_order: artists.length,
      })
      .select()
      .maybeSingle();

    if (error) { console.error('Error duplicating artist:', error); return; }
    if (data) setArtists(prev => [...prev, data as EventArtist]);
  }, [artists, offerId, ensureOrgId]);

  const reorderArtists = useCallback(async (fromIndex: number, toIndex: number) => {
    const reordered = [...artists];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    const updated = reordered.map((a, i) => ({ ...a, sort_order: i }));
    setArtists(updated);

    for (const a of updated) {
      await supabase
        .from('event_artists')
        .update({ sort_order: a.sort_order })
        .eq('id', a.id);
    }
  }, [artists]);

  const addTask = useCallback(async (artistId: string, title: string, dueDate?: string) => {
    const orgId = await ensureOrgId();
    if (!orgId) return;

    const { data, error } = await supabase
      .from('event_artist_tasks')
      .insert({
        event_artist_id: artistId,
        organization_id: orgId,
        title,
        due_date: dueDate || null,
        completed: false,
      })
      .select()
      .maybeSingle();

    if (error) { console.error('Error adding task:', error); return; }
    if (data) {
      setArtistTasks(prev => ({
        ...prev,
        [artistId]: [...(prev[artistId] || []), data as EventArtistTask],
      }));
    }
  }, [ensureOrgId]);

  const updateTask = useCallback(async (taskId: string, artistId: string, patch: Partial<EventArtistTask>) => {
    setArtistTasks(prev => ({
      ...prev,
      [artistId]: (prev[artistId] || []).map(t => t.id === taskId ? { ...t, ...patch } : t),
    }));

    const { error } = await supabase
      .from('event_artist_tasks')
      .update(patch)
      .eq('id', taskId);

    if (error) console.error('Error updating task:', error);
  }, []);

  const deleteTask = useCallback(async (taskId: string, artistId: string) => {
    setArtistTasks(prev => ({
      ...prev,
      [artistId]: (prev[artistId] || []).filter(t => t.id !== taskId),
    }));

    const { error } = await supabase
      .from('event_artist_tasks')
      .delete()
      .eq('id', taskId);

    if (error) console.error('Error deleting task:', error);
  }, []);

  return {
    artists,
    artistTasks,
    loading,
    importFromOffer,
    addArtist,
    updateArtist,
    deleteArtist,
    duplicateArtist,
    reorderArtists,
    addTask,
    updateTask,
    deleteTask,
    reload: loadArtists,
  };
}
