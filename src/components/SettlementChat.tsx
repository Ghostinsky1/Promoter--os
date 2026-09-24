import { useEffect, useRef, useState } from 'react';
import { Paperclip, Send, Loader2, MessageSquare, X, HelpCircle, Check, Trash2 } from 'lucide-react';
import { supabase, SUPABASE_URL } from '../lib/supabase';
import { formatCurrency } from '../lib/calculations';
import { OfferWithShow } from '../types';

/**
 * PROMOTER OS — the settlement chat.
 *
 * Drop receipts, payment screenshots, or type "paid security $200 cash". The
 * assistant sorts everything into the show's categories on the working list
 * (right side / below on phones), asks when it isn't sure, and writes to the
 * settlement only when the promoter tells it to in the chat.
 *
 * The conversation and the list are saved per show, so closing the page
 * loses nothing.
 */

export interface LedgerItem {
  id: string;
  label: string;
  amount: number | null;
  category: string;
  source: string;
  status: 'ok' | 'question';
  question?: string | null;
  note?: string | null;
  kind: 'expense' | 'ticket_count' | 'revenue_channel';
  fees?: number | null;
}

export interface ChatApply {
  expenses: { label: string; amount: number; category: string }[];
  ticket_counts: { type: string; sold: number }[];
  revenue_channels: { label: string; gross: number; fees: number }[];
}

interface Msg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments: { import_id: string; file_name: string }[];
  applied?: boolean;
  created_at: string;
}

const KIND_LABEL: Record<LedgerItem['kind'], string> = {
  expense: 'Expenses',
  ticket_count: 'Tickets sold',
  revenue_channel: 'Money in',
};

export function SettlementChat({
  offer,
  organizationId,
  onApply,
}: {
  offer: OfferWithShow;
  organizationId: string;
  /** Called when the assistant writes. The parent puts the numbers in and saves. */
  onApply: (a: ChatApply) => Promise<void> | void;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [ledger, setLedger] = useState<LedgerItem[]>([]);
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState(false);
  const [open, setOpen] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const [{ data: m }, { data: l }] = await Promise.all([
        supabase.from('settlement_chat_messages').select('*').eq('offer_id', offer.id).order('created_at', { ascending: true }),
        supabase.from('settlement_chat_ledgers').select('items').eq('offer_id', offer.id).maybeSingle(),
      ]);
      setMessages((m as Msg[]) || []);
      setLedger(Array.isArray(l?.items) ? (l!.items as LedgerItem[]) : []);
    })();
  }, [offer.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages.length, busy]);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      if (f.size > 25 * 1024 * 1024) { setError(`${f.name} is over 25MB.`); continue; }
      if (next.length >= 10) break;
      next.push(f);
    }
    setFiles(next);
    if (fileRef.current) fileRef.current.value = '';
  };

  const send = async () => {
    const message = text.trim();
    if (!message && files.length === 0) return;
    setError(null); setUpgrade(false);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sign in first.');

      // Upload each file and record it, same bucket and table as the scanner.
      const importIds: string[] = [];
      const attachments: Msg['attachments'] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setBusy(files.length > 1 ? `Uploading ${i + 1} of ${files.length}` : 'Uploading');
        const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${organizationId}/${offer.id}/${Date.now()}-${i}-${safe}`;
        const { error: upErr } = await supabase.storage.from('imports').upload(path, f, {
          contentType: f.type || 'application/octet-stream', upsert: false,
        });
        if (upErr) throw upErr;
        const { data: row, error: rowErr } = await supabase.from('document_imports').insert({
          organization_id: organizationId, user_id: user.id, offer_id: offer.id,
          storage_path: path, file_name: f.name, file_size: f.size, kind: 'chat', status: 'uploaded',
        }).select().single();
        if (rowErr) throw rowErr;
        importIds.push(row.id);
        attachments.push({ import_id: row.id, file_name: f.name });
      }

      // Show the promoter's message right away.
      const tempId = `tmp_${Date.now()}`;
      setMessages((m) => [...m, { id: tempId, role: 'user', content: message, attachments, created_at: new Date().toISOString() }]);
      setText(''); setFiles([]);

      setBusy(importIds.length ? 'Reading' : 'Thinking');
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/settlement-chat`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ offer_id: offer.id, message, import_ids: importIds }),
      });
      const payload = await res.json();
      if (!res.ok) {
        if (payload?.upgrade) setUpgrade(true);
        throw new Error(payload?.error || 'The assistant could not answer.');
      }

      setLedger(Array.isArray(payload.ledger) ? payload.ledger : []);
      setMessages((m) => [...m, {
        id: `a_${Date.now()}`, role: 'assistant', content: payload.reply || '',
        attachments: [], applied: !!payload.apply, created_at: new Date().toISOString(),
      }]);

      if (payload.apply) {
        setBusy('Writing to the settlement');
        await onApply(payload.apply as ChatApply);
      }
    } catch (e: any) {
      setError(e?.message || 'Something went wrong.');
    } finally {
      setBusy(null);
    }
  };

  const clearChat = async () => {
    if (!confirm('Clear this show\'s chat and working list? Anything already written to the settlement stays.')) return;
    await supabase.from('settlement_chat_messages').delete().eq('offer_id', offer.id);
    await supabase.from('settlement_chat_ledgers').delete().eq('offer_id', offer.id);
    setMessages([]); setLedger([]);
  };

  const questions = ledger.filter((i) => i.status === 'question');
  const grouped = (['expense', 'ticket_count', 'revenue_channel'] as const)
    .map((kind) => ({ kind, items: ledger.filter((i) => i.kind === kind && i.status === 'ok') }))
    .filter((g) => g.items.length > 0);
  const byCategory = (items: LedgerItem[]) => {
    const m: Record<string, LedgerItem[]> = {};
    for (const it of items) (m[it.category] ||= []).push(it);
    return Object.entries(m);
  };
  const total = ledger.filter((i) => i.kind === 'expense' && i.status === 'ok').reduce((s, i) => s + (i.amount || 0), 0);

  return (
    <div className="bg-[#14171E] border border-gray-800 rounded-3xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 sm:px-6 py-4"
        style={{ textTransform: 'none', letterSpacing: 0 }}
      >
        <span className="flex items-center gap-2 text-white font-bold text-lg">
          <MessageSquare className="w-5 h-5 text-[#8FD3FF]" />
          Settle it in chat
        </span>
        <span className="text-xs text-gray-400">
          {ledger.length ? `${ledger.length} on the list${questions.length ? ` · ${questions.length} waiting on you` : ''}` : 'Drop receipts, ask questions'}
        </span>
      </button>

      {open && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] border-t border-gray-800">
          {/* Conversation */}
          <div className="flex flex-col min-h-[360px] max-h-[70vh]">
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-3">
              {messages.length === 0 && (
                <div className="text-sm text-gray-400 leading-relaxed">
                  <p className="text-white font-medium mb-1">Drop what you've got.</p>
                  <p>Photos of receipts, the venue's sheet, Venmo or Zelle screenshots, or just type it: "paid security $200 cash, $850 to the sound guy on Zelle." It sorts everything into your categories and asks when it isn't sure. Say "looks good" when you want it written into the settlement.</p>
                </div>
              )}
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === 'user' ? 'bg-[#0E58FF] text-white' : 'bg-[#1C2029] text-gray-100 border border-gray-800'
                  }`}>
                    {m.attachments?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-1.5">
                        {m.attachments.map((a) => (
                          <span key={a.import_id} className="inline-flex items-center gap-1 text-[11px] bg-black/20 rounded-md px-1.5 py-0.5">
                            <Paperclip className="w-3 h-3" />{a.file_name}
                          </span>
                        ))}
                      </div>
                    )}
                    {m.content}
                    {m.applied && (
                      <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-emerald-300">
                        <Check className="w-3 h-3" /> Written to the settlement
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {busy && (
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> {busy}…
                </div>
              )}
              <div ref={endRef} />
            </div>

            {error && (
              <div className="mx-4 sm:mx-6 mb-2 text-xs text-red-300 bg-red-900/20 border border-red-800/40 rounded-xl px-3 py-2">
                {error}
                {upgrade && <span className="block text-gray-300 mt-1">The settlement chat is on the Pro and Agency Scale plans.</span>}
              </div>
            )}

            {files.length > 0 && (
              <div className="flex flex-wrap gap-1.5 px-4 sm:px-6 pb-2">
                {files.map((f, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-[11px] bg-[#1C2029] border border-gray-700 rounded-md px-2 py-1 text-gray-200">
                    <Paperclip className="w-3 h-3" />{f.name}
                    <button onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-gray-400 hover:text-white">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-end gap-2 px-3 sm:px-4 py-3 border-t border-gray-800">
              <input
                ref={fileRef} type="file" multiple accept=".pdf,image/*" className="hidden"
                onChange={(e) => addFiles(e.target.files)}
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={!!busy}
                className="p-2.5 rounded-xl bg-[#1C2029] border border-gray-700 text-gray-300 hover:text-white disabled:opacity-50"
                title="Attach receipts or screenshots"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Type what you paid, or drop files…"
                rows={1}
                disabled={!!busy}
                className="flex-1 resize-none bg-[#0E1117] border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#8FD3FF] disabled:opacity-50"
                style={{ fontSize: 16 }}
              />
              <button
                onClick={send}
                disabled={!!busy || (!text.trim() && files.length === 0)}
                className="p-2.5 rounded-xl bg-[#0E58FF] text-white disabled:opacity-40"
                title="Send"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Working list */}
          <div className="border-t lg:border-t-0 lg:border-l border-gray-800 px-4 sm:px-5 py-4 text-sm max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold">Working list</h3>
              {(messages.length > 0 || ledger.length > 0) && (
                <button onClick={clearChat} className="text-gray-500 hover:text-red-300" title="Clear chat and list">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {ledger.length === 0 && <p className="text-gray-500 text-xs">Nothing yet.</p>}

            {questions.length > 0 && (
              <div className="mb-4">
                <p className="text-[11px] uppercase tracking-wide text-amber-300 mb-1.5 flex items-center gap-1">
                  <HelpCircle className="w-3 h-3" /> Waiting on you
                </p>
                <div className="space-y-1.5">
                  {questions.map((it) => (
                    <div key={it.id} className="rounded-xl border border-amber-700/40 bg-amber-900/10 px-3 py-2">
                      <div className="flex justify-between gap-2 text-gray-100">
                        <span>{it.label}</span>
                        <span className="text-gray-400">{it.amount == null ? '—' : formatCurrency(it.amount)}</span>
                      </div>
                      {it.question && <p className="text-xs text-amber-200 mt-0.5">{it.question}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {grouped.map((g) => (
              <div key={g.kind} className="mb-4">
                <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-1.5">{KIND_LABEL[g.kind]}</p>
                {g.kind === 'expense' ? byCategory(g.items).map(([cat, items]) => (
                  <div key={cat} className="mb-2">
                    <p className="text-xs text-[#8FD3FF] capitalize mb-1">{cat.replace(/_/g, ' ')}</p>
                    {items.map((it) => (
                      <div key={it.id} className="flex justify-between gap-2 text-gray-200 py-0.5">
                        <span className="truncate">{it.label}{it.note ? ' *' : ''}</span>
                        <span className="text-gray-400 shrink-0">{formatCurrency(it.amount || 0)}</span>
                      </div>
                    ))}
                  </div>
                )) : g.items.map((it) => (
                  <div key={it.id} className="flex justify-between gap-2 text-gray-200 py-0.5">
                    <span className="truncate">{it.label}</span>
                    <span className="text-gray-400 shrink-0">
                      {g.kind === 'ticket_count' ? `${it.amount ?? 0} sold` : formatCurrency(it.amount || 0)}
                    </span>
                  </div>
                ))}
              </div>
            ))}

            {ledger.some((i) => i.note) && (
              <div className="mt-2 space-y-1">
                {ledger.filter((i) => i.note).map((i) => (
                  <p key={i.id} className="text-[11px] text-amber-200">* {i.note}</p>
                ))}
              </div>
            )}

            {total > 0 && (
              <div className="flex justify-between border-t border-gray-800 pt-2 mt-2 text-white font-semibold">
                <span>Expenses on the list</span><span>{formatCurrency(total)}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
