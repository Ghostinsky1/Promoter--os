import { supabase } from './supabase';
import type { Expenses } from '../types';

export type CostCategory = 'general' | 'production' | 'marketing' | 'talent';
export interface VenueCost { label: string; amount: number; category: CostCategory }

export interface Venue {
  id: string;
  organization_id: string;
  name: string;
  name_key: string;
  alias_keys: string[];
  street: string | null; city: string | null; state: string | null; zip: string | null; country: string | null;
  capacity: number | null;
  contact_name: string | null; contact_email: string | null; contact_phone: string | null; contact_ig: string | null;
  costs: VenueCost[];
  facility_fee_per_ticket: number | null;
  notes: string | null;
  lat: number | null; lng: number | null;
  created_at: string; updated_at: string;
}

/** Same rule as the database's venue_key(): lowercase letters and digits only. */
export const venueKey = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

export async function loadVenues(): Promise<Venue[]> {
  const { data } = await supabase.from('venues').select('*').order('name');
  return (data || []) as Venue[];
}

export const costTotal = (costs: VenueCost[] | null | undefined) => (costs || []).reduce((s, c) => s + (Number(c.amount) || 0), 0);

/** A cost label as an expense key the offer form uses ("Bar staff" → "bar_staff"). */
export const costKey = (label: string) => label.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

/** Lay the venue's costs over an offer's expenses: same-named lines take the venue's number. */
export function withVenueCosts(expenses: Expenses, costs: VenueCost[]): Expenses {
  const out: Expenses = {
    talent: { ...(expenses.talent || {}) }, general: { ...(expenses.general || {}) },
    marketing: { ...(expenses.marketing || {}) }, production: { ...(expenses.production || {}) },
  };
  for (const c of costs || []) {
    const k = costKey(c.label);
    if (!k) continue;
    const cat: CostCategory = (['general', 'production', 'marketing', 'talent'] as const).includes(c.category) ? c.category : 'general';
    out[cat][k] = Number(c.amount) || 0;
  }
  return out;
}

export function venueCityLine(v: Pick<Venue, 'city' | 'state'>) {
  return [v.city, v.state].filter(Boolean).join(', ');
}

// ───────── "is this the same room?" ─────────
function lev(a: string, b: string) {
  if (a === b) return 0;
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]; dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

/** Pairs of saved venues whose names look like typos of each other. */
export function likelyDuplicates(venues: Venue[]): [Venue, Venue][] {
  const out: [Venue, Venue][] = [];
  for (let i = 0; i < venues.length; i++) {
    for (let j = i + 1; j < venues.length; j++) {
      const a = venues[i].name_key, b = venues[j].name_key;
      if (!a || !b || Math.min(a.length, b.length) < 4) continue;
      const d = lev(a, b);
      const close = d <= Math.max(1, Math.floor(Math.min(a.length, b.length) * 0.2));
      const inside = Math.min(a.length, b.length) >= 6 && (a.includes(b) || b.includes(a));
      if (close || inside) out.push([venues[i], venues[j]]);
    }
  }
  return out;
}

/**
 * Fold `drop` into `keep`: its offers move over, the old spelling is remembered so new offers
 * typed that way land on `keep`, and any blanks on `keep` are filled from `drop`.
 */
export async function mergeVenues(keep: Venue, drop: Venue) {
  const { error: e1 } = await supabase.from('offers').update({ venue_id: keep.id }).eq('venue_id', drop.id);
  if (e1) throw e1;
  const aliases = [...new Set([...(keep.alias_keys || []), ...(drop.alias_keys || []), drop.name_key])].filter((k) => k && k !== keep.name_key);
  const fill = <K extends keyof Venue>(k: K) => (keep[k] ?? drop[k]) as Venue[K];
  const { error: e2 } = await supabase.from('venues').delete().eq('id', drop.id);
  if (e2) throw e2;
  const { error: e3 } = await supabase.from('venues').update({
    alias_keys: aliases,
    street: fill('street'), city: fill('city'), state: fill('state'), zip: fill('zip'), capacity: fill('capacity'),
    contact_name: fill('contact_name'), contact_email: fill('contact_email'), contact_phone: fill('contact_phone'), contact_ig: fill('contact_ig'),
    costs: keep.costs?.length ? keep.costs : drop.costs,
    facility_fee_per_ticket: fill('facility_fee_per_ticket'),
    lat: fill('lat'), lng: fill('lng'),
    notes: [keep.notes, drop.notes].filter(Boolean).join('\n') || null,
    updated_at: new Date().toISOString(),
  }).eq('id', keep.id);
  if (e3) throw e3;
}
