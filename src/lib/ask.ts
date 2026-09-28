import { supabase, SUPABASE_URL } from './supabase';

/**
 * PROMOTER OS — the Ask bar's wire format.
 *
 * `fetchBrief` is free and runs on every app open. `fetchThread` is free.
 * `sendAsk` costs 1 credit (2 with files). All of them return the brief when
 * they have one, because an answer that changed something changes it.
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

export interface Attachment { import_id: string; file_name: string }

export interface AskMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  changed?: string[];
  attachments?: Attachment[];
  created_at: string;
}

export interface DealOnTable {
  title: string;
  source: string;
  deal: Record<string, unknown>;
  missing: string[];
  checks: string[];
  updated_at: string;
}

export interface AskThread {
  id: string;
  title: string;
  offer_id: string | null;
  last_message_at?: string;
  has_deal?: boolean;
  deal_on_table?: DealOnTable | null;
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

export async function fetchBrief(): Promise<{ brief: Brief; credits: CreditStatus | null; threads: AskThread[] }> {
  const p = await call({});
  return { brief: p.brief, credits: p.credits ?? null, threads: p.threads ?? [] };
}

export async function fetchThread(threadId: string): Promise<{ thread: AskThread; messages: AskMessage[] }> {
  const p = await call({ action: 'thread', thread_id: threadId });
  return { thread: p.thread, messages: p.messages ?? [] };
}

export const MAX_ASK_FILES = 4;
export const MAX_ASK_FILE_MB = 12;

/** Put the files in the same bucket and table the scanner uses, and hand back their ids. */
export async function uploadAskFiles(organizationId: string, files: File[], onProgress?: (label: string) => void): Promise<Attachment[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new AskError('Sign in first.');
  const out: Attachment[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    onProgress?.(files.length > 1 ? `Uploading ${i + 1} of ${files.length}` : 'Uploading');
    const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${organizationId}/ask/${Date.now()}-${i}-${safe}`;
    const { error: upErr } = await supabase.storage.from('imports').upload(path, f, { contentType: f.type || 'application/octet-stream', upsert: false });
    if (upErr) throw new AskError(`Could not upload ${f.name}.`);
    const { data: row, error: rowErr } = await supabase.from('document_imports').insert({
      organization_id: organizationId, user_id: user.id, offer_id: null,
      storage_path: path, file_name: f.name, file_size: f.size, kind: 'ask', status: 'uploaded',
    }).select('id').single();
    if (rowErr || !row) throw new AskError(`Could not record ${f.name}.`);
    out.push({ import_id: row.id, file_name: f.name });
  }
  return out;
}

export async function sendAsk(args: { threadId: string | null; message: string; importIds?: string[]; offerId?: string | null }): Promise<{
  reply: string; changed: string[]; brief: Brief; creditsLeft: number | null; thread: AskThread; threads: AskThread[];
}> {
  const p = await call({ thread_id: args.threadId, message: args.message, import_ids: args.importIds ?? [], offer_id: args.offerId ?? null });
  return { reply: p.reply, changed: p.changed ?? [], brief: p.brief, creditsLeft: p.credits_left ?? null, thread: p.thread, threads: p.threads ?? [] };
}

export async function renameThread(threadId: string, title: string) {
  await supabase.from('ask_threads').update({ title: title.slice(0, 60) }).eq('id', threadId);
}

export async function deleteThread(threadId: string) {
  await supabase.from('ask_threads').delete().eq('id', threadId);
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
