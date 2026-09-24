import { supabase, SUPABASE_URL } from './supabase';

/**
 * PROMOTER OS — the Ask bar's wire format.
 *
 * `fetchBrief` is free and runs on every app open. `sendAsk` costs 1 credit.
 * Both return the brief, because an answer that checked a task off changes it.
 */

export interface NeedsItem {
  offer_id: string | null;
  title: string;
  detail: string;
  tag: string;
  tone: 'red' | 'amber' | 'blue';
  link: string;
}

export interface UpcomingItem {
  offer_id: string;
  title: string;
  venue: string;
  date: string;
  when: string;
  days: number;
  verdict: 'SAFE' | 'TIGHT' | 'FRAGILE' | 'UNDERWATER';
  profit_full: number;
  profit_50: number;
  link: string;
}

export interface Brief {
  greeting: string;
  headline: string;
  needs_you: NeedsItem[];
  upcoming: UpcomingItem[];
  next30: number;
  cash: { total: number; artist: number; venue: number; marketing: number; shows: number };
  open_tasks: { id: string; offer_id: string | null; title: string; due_date: string | null; priority: string }[];
}

export interface CreditStatus {
  monthly_allowance: number;
  monthly_left: number;
  topup: number;
  total_left: number;
  period_start: string;
}

export interface AskMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  changed?: string[];
  created_at: string;
}

export class AskError extends Error {
  credits: boolean;
  creditsLeft: number;
  constructor(message: string, credits = false, creditsLeft = 0) {
    super(message);
    this.credits = credits;
    this.creditsLeft = creditsLeft;
  }
}

async function call(body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new AskError('Sign in first.');
  const res = await fetch(`${SUPABASE_URL}/functions/v1/ask`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new AskError(payload?.error || 'Ask could not answer.', !!payload?.credits, payload?.credits_left ?? 0);
  return payload;
}

export async function fetchBrief(): Promise<{ brief: Brief; credits: CreditStatus | null; history: AskMessage[] }> {
  const p = await call({});
  return { brief: p.brief, credits: p.credits ?? null, history: p.history ?? [] };
}

export async function sendAsk(message: string): Promise<{ reply: string; changed: string[]; brief: Brief; creditsLeft: number | null }> {
  const p = await call({ message });
  return { reply: p.reply, changed: p.changed ?? [], brief: p.brief, creditsLeft: p.credits_left ?? null };
}

/** Start a Stripe checkout for a credit pack. Redirects to Stripe. */
export async function buyCredits(pack: 'credits_100' | 'credits_500') {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Sign in first.');
  const res = await fetch(`${SUPABASE_URL}/functions/v1/stripe-checkout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pack,
      mode: 'payment',
      success_url: `${window.location.origin}/subscription?credits=added`,
      cancel_url: `${window.location.origin}/subscription`,
    }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || !payload?.url) throw new Error(payload?.error || 'Could not start checkout.');
  window.location.href = payload.url;
}

export const CREDIT_PACKS = [
  { id: 'credits_100' as const, credits: 100, price: 9, label: '100 credits', blurb: 'About 50 chat messages with photos, or 30 scans.' },
  { id: 'credits_500' as const, credits: 500, price: 35, label: '500 credits', blurb: 'A busy season. Never expires.' },
];
