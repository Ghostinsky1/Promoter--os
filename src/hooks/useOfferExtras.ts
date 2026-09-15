import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { OfferDeposit, OfferTask, OfferNotes, PinnedNote } from '../types';

export function useOfferExtras(offerId: string | undefined) {
  const [deposits, setDeposits] = useState<OfferDeposit[]>([]);
  const [tasks, setTasks] = useState<OfferTask[]>([]);
  const [notes, setNotes] = useState<OfferNotes | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const notesDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!offerId) return;
    loadAll();
  }, [offerId]);

  const getOrgId = async (): Promise<string | null> => {
    if (orgId) return orgId;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();
    if (data?.organization_id) {
      setOrgId(data.organization_id);
      return data.organization_id;
    }
    return null;
  };

  const loadAll = async () => {
    if (!offerId) return;
    setLoading(true);
    try {
      await getOrgId();
      const [dRes, tRes, nRes] = await Promise.all([
        supabase.from('offer_deposits').select('*').eq('offer_id', offerId).order('created_at'),
        supabase.from('offer_tasks').select('*').eq('offer_id', offerId).order('created_at'),
        supabase.from('offer_notes').select('*').eq('offer_id', offerId).maybeSingle(),
      ]);
      if (dRes.data) setDeposits(dRes.data);
      if (tRes.data) setTasks(tRes.data);
      if (nRes.data) setNotes(nRes.data);
    } catch (err) {
      console.error('Error loading offer extras:', err);
    } finally {
      setLoading(false);
    }
  };

  const addDeposit = useCallback(async (deposit: Partial<OfferDeposit>) => {
    if (!offerId) return;
    const oid = await getOrgId();
    if (!oid) return;
    const { data, error } = await supabase
      .from('offer_deposits')
      .insert({ ...deposit, offer_id: offerId, organization_id: oid })
      .select()
      .maybeSingle();
    if (!error && data) setDeposits(prev => [...prev, data]);
    return data;
  }, [offerId, orgId]);

  const updateDeposit = useCallback(async (id: string, patch: Partial<OfferDeposit>) => {
    const { data, error } = await supabase
      .from('offer_deposits')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .maybeSingle();
    if (!error && data) setDeposits(prev => prev.map(d => d.id === id ? data : d));
  }, []);

  const deleteDeposit = useCallback(async (id: string) => {
    const { error } = await supabase.from('offer_deposits').delete().eq('id', id);
    if (!error) setDeposits(prev => prev.filter(d => d.id !== id));
  }, []);

  const addTask = useCallback(async (task: Partial<OfferTask>) => {
    if (!offerId) return;
    const oid = await getOrgId();
    if (!oid) return;
    const { data, error } = await supabase
      .from('offer_tasks')
      .insert({ ...task, offer_id: offerId, organization_id: oid })
      .select()
      .maybeSingle();
    if (!error && data) setTasks(prev => [...prev, data]);
    return data;
  }, [offerId, orgId]);

  const updateTask = useCallback(async (id: string, patch: Partial<OfferTask>) => {
    const { data, error } = await supabase
      .from('offer_tasks')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .maybeSingle();
    if (!error && data) setTasks(prev => prev.map(t => t.id === id ? data : t));
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    const { error } = await supabase.from('offer_tasks').delete().eq('id', id);
    if (!error) setTasks(prev => prev.filter(t => t.id !== id));
  }, []);

  const ensureNotesRow = async (): Promise<OfferNotes | null> => {
    if (notes) return notes;
    if (!offerId) return null;
    const oid = await getOrgId();
    if (!oid) return null;
    const { data, error } = await supabase
      .from('offer_notes')
      .insert({ offer_id: offerId, organization_id: oid, event_notes: '', pinned_notes: [] })
      .select()
      .maybeSingle();
    if (!error && data) {
      setNotes(data);
      return data;
    }
    const { data: existing } = await supabase
      .from('offer_notes')
      .select('*')
      .eq('offer_id', offerId)
      .maybeSingle();
    if (existing) {
      setNotes(existing);
      return existing;
    }
    return null;
  };

  const updateEventNotes = useCallback(async (text: string) => {
    setNotes(prev => prev ? { ...prev, event_notes: text } : prev);
    if (notesDebounceRef.current) clearTimeout(notesDebounceRef.current);
    notesDebounceRef.current = setTimeout(async () => {
      const row = await ensureNotesRow();
      if (!row) return;
      await supabase
        .from('offer_notes')
        .update({ event_notes: text, updated_at: new Date().toISOString() })
        .eq('id', row.id);
    }, 800);
  }, [notes, offerId, orgId]);

  const addPinnedNote = useCallback(async (text: string) => {
    const row = await ensureNotesRow();
    if (!row) return;
    const newPin: PinnedNote = { id: crypto.randomUUID(), text, createdAt: new Date().toISOString() };
    const updated = [...(row.pinned_notes || []), newPin];
    setNotes(prev => prev ? { ...prev, pinned_notes: updated } : prev);
    await supabase
      .from('offer_notes')
      .update({ pinned_notes: updated, updated_at: new Date().toISOString() })
      .eq('id', row.id);
  }, [notes, offerId, orgId]);

  const removePinnedNote = useCallback(async (pinId: string) => {
    if (!notes) return;
    const updated = (notes.pinned_notes || []).filter(p => p.id !== pinId);
    setNotes(prev => prev ? { ...prev, pinned_notes: updated } : prev);
    await supabase
      .from('offer_notes')
      .update({ pinned_notes: updated, updated_at: new Date().toISOString() })
      .eq('id', notes.id);
  }, [notes]);

  const depositsPaidTotal = deposits.filter(d => d.paid).reduce((s, d) => s + d.amount, 0);
  const depositsDueTotal = deposits.filter(d => !d.paid).reduce((s, d) => s + d.amount, 0);

  return {
    deposits, tasks, notes, loading,
    depositsPaidTotal, depositsDueTotal,
    addDeposit, updateDeposit, deleteDeposit,
    addTask, updateTask, deleteTask,
    updateEventNotes, addPinnedNote, removePinnedNote,
  };
}
