import { useEffect, useRef, useState, Fragment, DragEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Send, Loader2, X, Home as HomeIcon, MessageCircle, Music, Receipt, Check, Zap, Paperclip, FileText, Image as ImageIcon,
  MessagesSquare, Plus, Trash2, ChevronLeft, Pencil, AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useAsk } from './AskProvider';
import { Mascot, type Mood } from './Mascot';
import type { AskThread } from '../../lib/ask';

/**
 * PROMOTER OS — the Ask bar, on every screen, bottom center. Tap it and the
 * chat slides up over whatever you're on. Every conversation is a thread;
 * files stay with their thread; the little one in the corner lives here.
 * On phones a four-tab bar sits under it: Home / Ask / Shows / Settle.
 */

const APP_PREFIXES = ['/dashboard', '/offers', '/tours', '/templates', '/settings', '/subscription', '/deal-estimator', '/artist-fee'];
const CHIPS = ['What needs me?', 'Cash I need', 'Unsettled shows', 'Coming up', 'Review a deal'];
const ACCEPT = '.pdf,image/png,image/jpeg,image/webp,image/gif';

/** Turn "[Open X](/offers/abc)" into a tappable link. Paths only. */
function renderText(text: string, go: (path: string) => void) {
  const parts: (string | { label: string; path: string })[] = [];
  const re = /\[([^\]]+)\]\((\/[^)\s]*)\)/g;
  let last = 0; let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push({ label: m[1], path: m[2] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.map((p, i) =>
    typeof p === 'string'
      ? <Fragment key={i}>{p}</Fragment>
      : <button key={i} onClick={() => go(p.path)} className="text-[#8FD3FF] font-semibold hover:underline" style={{ textTransform: 'none', letterSpacing: 0 }}>{p.label} →</button>,
  );
}

function when(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso); const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const isPdf = (n: string) => n.toLowerCase().endsWith('.pdf');

export function AskDock() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const ask = useAsk();
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [showThreads, setShowThreads] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const inApp = !!user && APP_PREFIXES.some((p) => location.pathname === p || location.pathname.startsWith(p + '/'));

  useEffect(() => { if (ask.open) { endRef.current?.scrollIntoView({ block: 'end' }); setTimeout(() => inputRef.current?.focus(), 150); } }, [ask.open, ask.messages.length, ask.sending, ask.thread?.id]);
  useEffect(() => { ask.setOpen(false); setShowThreads(false); /* close on navigation */ }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!inApp) return null;

  const go = (path: string) => { ask.setOpen(false); navigate(path); };
  const submit = async () => {
    const t = text; const f = files;
    if (!t.trim() && f.length === 0) return;
    setText(''); setFiles([]);
    await ask.send(t, f);
  };
  const addFiles = (list: FileList | File[] | null) => {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      const ok = isPdf(f.name) || f.type.startsWith('image/');
      if (!ok || next.length >= 4) continue;
      next.push(f);
    }
    setFiles(next);
    if (fileRef.current) fileRef.current.value = '';
    setTimeout(() => inputRef.current?.focus(), 50);
  };
  const onDrop = (e: DragEvent) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); };

  const creditsLeft = ask.credits?.total_left;
  const isActive = (p: string) => location.pathname === p || location.pathname.startsWith(p + '/');
  const typing = text.trim().length > 0 && !ask.sending;
  const mood: Mood = ask.sending ? ask.mood : typing ? 'listening' : ask.mood;
  const showChips = !ask.thread && ask.messages.length === 0 && !typing && files.length === 0;
  const deal = ask.thread?.deal_on_table;

  return (
    <>
      {/* The bar */}
      <div className="fixed left-0 right-0 z-40 px-4 pointer-events-none bottom-[88px] md:bottom-5">
        <button
          onClick={() => ask.setOpen(true)}
          className="pointer-events-auto mx-auto w-full max-w-xl flex items-center gap-3 h-14 rounded-full bg-[#14171E]/95 backdrop-blur border border-[#2A3040] px-3 text-left shadow-[0_12px_40px_rgba(0,0,0,0.55)]"
          style={{ textTransform: 'none', letterSpacing: 0 }}
        >
          <Mascot mood={ask.sending ? ask.mood : 'idle'} size={40} />
          <span className="flex-1 text-[15px] text-gray-300 truncate">
            {ask.brief?.needs_you?.length ? `${ask.brief.needs_you.length} thing${ask.brief.needs_you.length === 1 ? '' : 's'} need you · ask anything` : 'Ask anything, or drop a deal PDF'}
          </span>
          {creditsLeft != null && (
            <span className={`shrink-0 font-label text-[10px] tracking-[0.12em] uppercase px-2 py-1 rounded-full border ${creditsLeft <= 5 ? 'border-amber-600/50 text-amber-300' : 'border-[#2A3040] text-gray-400'}`}>
              {creditsLeft} cr
            </span>
          )}
        </button>
      </div>

      {/* Phone tabs */}
      <nav className="md:hidden fixed left-4 right-4 bottom-4 z-40 h-16 rounded-full bg-[#0E1117]/95 backdrop-blur border border-[#2A3040] flex items-center justify-around shadow-[0_12px_40px_rgba(0,0,0,0.55)]">
        {[
          { label: 'Home', icon: HomeIcon, on: isActive('/dashboard'), go: () => navigate('/dashboard') },
          { label: 'Ask', icon: MessageCircle, on: ask.open, go: () => ask.setOpen(true) },
          { label: 'Shows', icon: Music, on: isActive('/offers') && !location.search.includes('unsettled'), go: () => navigate('/offers') },
          { label: 'Settle', icon: Receipt, on: location.search.includes('unsettled'), go: () => navigate('/offers?status=unsettled') },
        ].map((t) => (
          <button key={t.label} onClick={t.go} className={`flex flex-col items-center gap-1 w-16 ${t.on ? 'text-white' : 'text-gray-500'}`} style={{ textTransform: 'none', letterSpacing: 0 }}>
            <span className={`w-9 h-7 rounded-lg flex items-center justify-center ${t.on ? 'bg-[#1140F0]' : ''}`}><t.icon className="w-4.5 h-4.5" size={18} /></span>
            <span className="font-label text-[10px] tracking-[0.08em] uppercase">{t.label}</span>
          </button>
        ))}
      </nav>

      {/* The sheet */}
      {ask.open && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => ask.setOpen(false)} />
          <div
            className={`relative w-full md:max-w-2xl md:mx-4 bg-[#0E1117] border rounded-t-[28px] md:rounded-[28px] flex flex-col h-[86vh] md:h-[80vh] shadow-[0_-10px_60px_rgba(0,0,0,0.6)] ${dragging ? 'border-[#8FD3FF]' : 'border-[#2A3040]'}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-[#2A3040]/70">
              <div className="w-11 h-1.5 rounded-full bg-[#2A3040] mx-auto md:hidden absolute left-1/2 -translate-x-1/2 top-2" />
              <div className="flex items-center gap-2.5 mt-2 md:mt-0 min-w-0">
                {showThreads ? (
                  <button onClick={() => setShowThreads(false)} className="p-1 text-gray-300 hover:text-white"><ChevronLeft className="w-5 h-5" /></button>
                ) : (
                  <Mascot mood={mood} size={40} powerOn />
                )}
                <div className="min-w-0">
                  <div className="text-white font-semibold leading-tight">{showThreads ? 'Your chats' : ask.thread ? ask.thread.title : 'Ask'}</div>
                  <div className="text-[11px] text-gray-500 truncate" style={{ textTransform: 'none', letterSpacing: 0 }}>
                    {showThreads ? `${ask.threads.length} saved` : ask.busy ? `${ask.busy}…` : ask.thread ? (deal ? 'Deal on the table · not saved' : 'Thread') : 'New chat'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-2 md:mt-0 shrink-0">
                {creditsLeft != null && <span className="font-label text-[10px] tracking-[0.12em] uppercase text-gray-400 mr-1">{creditsLeft} cr</span>}
                {!showThreads && (
                  <button onClick={() => setShowThreads(true)} className="relative p-2 text-gray-300 hover:text-white" title="Your chats">
                    <MessagesSquare className="w-4.5 h-4.5" size={18} />
                    {ask.threads.length > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#1140F0] text-[9px] text-white flex items-center justify-center">{ask.threads.length}</span>}
                  </button>
                )}
                <button onClick={() => { ask.newThread(); setShowThreads(false); setTimeout(() => inputRef.current?.focus(), 100); }} className="p-2 text-gray-300 hover:text-white" title="New chat"><Plus className="w-4.5 h-4.5" size={18} /></button>
                <button onClick={() => ask.setOpen(false)} className="p-2 text-gray-400 hover:text-white"><X className="w-4 h-4" /></button>
              </div>
            </div>

            {showThreads ? (
              <ThreadList
                threads={ask.threads}
                current={ask.thread?.id ?? null}
                renaming={renaming}
                setRenaming={setRenaming}
                onOpen={async (id) => { setShowThreads(false); await ask.openThread(id); }}
                onNew={() => { ask.newThread(); setShowThreads(false); }}
                onRename={ask.renameThread}
                onDelete={ask.deleteThread}
              />
            ) : (
              <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-3 space-y-3">
                {/* New chat: the brief is the first bubble, always. Free. */}
                {!ask.thread && ask.brief && (
                  <div className="max-w-[92%] rounded-2xl rounded-bl-md bg-[#14171E] border border-[#2A3040] px-4 py-3 text-[15px] leading-relaxed text-gray-100">
                    <p className="text-white font-semibold">{ask.brief.greeting}</p>
                    <p>{ask.brief.headline}</p>
                    {ask.brief.needs_you.slice(0, 4).map((n, i) => (
                      <p key={i} className="mt-1.5">
                        <span className={`font-label text-[9px] tracking-[0.12em] uppercase px-1.5 py-0.5 rounded mr-2 ${n.tone === 'red' ? 'bg-red-900/40 text-red-300' : n.tone === 'amber' ? 'bg-amber-900/40 text-amber-300' : 'bg-[#1140F0]/40 text-[#8FD3FF]'}`}>{n.tag}</span>
                        <button onClick={() => go(n.link)} className="text-left hover:text-[#8FD3FF]" style={{ textTransform: 'none', letterSpacing: 0 }}>{n.title} — {n.detail}</button>
                      </p>
                    ))}
                    {ask.brief.cash.total > 0 && (
                      <p className="mt-1.5 text-gray-400">Cash to have on hand: <span className="text-white">${Math.round(ask.brief.cash.total).toLocaleString()}</span> across {ask.brief.cash.shows} show{ask.brief.cash.shows === 1 ? '' : 's'}.</p>
                    )}
                    {ask.messages.length === 0 && <p className="mt-2 text-gray-400">Drop a deal PDF or a screenshot and I'll lay it out. Ask me anything about a show.</p>}
                  </div>
                )}
                {!ask.thread && !ask.brief && ask.loading && <Thinking label="Getting you up to speed" mood="thinking" />}
                {ask.loadingThread && <Thinking label="Opening" mood="thinking" />}

                {ask.messages.map((m) => (
                  <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap ${m.role === 'user' ? 'bg-[#1140F0] text-white rounded-br-md' : 'bg-[#14171E] border border-[#2A3040] text-gray-100 rounded-bl-md'}`}>
                      {m.attachments && m.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-1.5">
                          {m.attachments.map((a) => (
                            <span key={a.import_id} className="inline-flex items-center gap-1 text-[12px] bg-black/25 rounded-lg px-2 py-1 max-w-[220px]">
                              {isPdf(a.file_name) ? <FileText className="w-3.5 h-3.5 shrink-0" /> : <ImageIcon className="w-3.5 h-3.5 shrink-0" />}
                              <span className="truncate">{a.file_name}</span>
                            </span>
                          ))}
                        </div>
                      )}
                      {m.role === 'assistant' ? renderText(m.content, go) : m.content}
                      {m.changed && m.changed.length > 0 && (
                        <div className="mt-1.5 space-y-0.5">
                          {m.changed.map((c, i) => <div key={i} className="inline-flex items-center gap-1 text-[11px] text-emerald-300 mr-2"><Check className="w-3 h-3" />{c}</div>)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {ask.sending && <Thinking label={ask.busy || 'Thinking'} mood={ask.mood} />}

                {ask.error && (
                  <div className="text-xs text-red-300 bg-red-900/20 border border-red-800/40 rounded-xl px-3 py-2 flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>
                      {ask.error}
                      {ask.outOfCredits && (
                        <button onClick={() => go('/subscription#credits')} className="ml-2 inline-flex items-center gap-1 text-[#8FD3FF] font-semibold" style={{ textTransform: 'none', letterSpacing: 0 }}><Zap className="w-3 h-3" /> Get more credits</button>
                      )}
                    </span>
                  </div>
                )}
                <div ref={endRef} />
              </div>
            )}

            {!showThreads && (
              <>
                {/* The deal on the table, when there is one. Not saved until they say so. */}
                {deal && (
                  <div className="mx-4 sm:mx-5 mb-2 rounded-2xl border border-[#1140F0]/60 bg-[#1140F0]/10 px-3.5 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-label text-[9px] tracking-[0.14em] uppercase text-[#8FD3FF]">Deal on the table · not saved</div>
                        <div className="text-[14px] text-white truncate">{deal.title}</div>
                        {deal.missing?.length > 0 && <div className="text-[12px] text-amber-300/90 truncate">Still need: {deal.missing.join(', ')}</div>}
                        {deal.checks?.length > 0 && <div className="text-[12px] text-gray-300 truncate">{deal.checks[0]}{deal.checks.length > 1 ? ` (+${deal.checks.length - 1})` : ''}</div>}
                      </div>
                      <button
                        onClick={() => ask.send('Save it as a draft offer.')}
                        disabled={ask.sending || (deal.missing?.length ?? 0) > 0}
                        className="shrink-0 h-9 px-3 rounded-full bg-[#1140F0] text-white text-[13px] font-semibold disabled:opacity-40"
                        style={{ textTransform: 'none', letterSpacing: 0 }}
                        title={(deal.missing?.length ?? 0) > 0 ? 'Give it the missing numbers first' : 'Create a draft offer from this deal'}
                      >
                        Save draft
                      </button>
                    </div>
                  </div>
                )}

                {/* Presets fade the moment you start typing. */}
                <div className={`px-4 sm:px-5 overflow-hidden transition-all duration-200 ${showChips ? 'max-h-24 opacity-100 pb-2' : 'max-h-0 opacity-0'}`}>
                  <div className="flex flex-wrap gap-2">
                    {CHIPS.map((c) => (
                      <button key={c} onClick={() => (c === 'Review a deal' ? fileRef.current?.click() : ask.send(c))} disabled={ask.sending} className="text-[13px] text-gray-200 bg-[#14171E] border border-[#2A3040] rounded-full px-3 py-1.5 hover:border-[#8FD3FF]/50" style={{ textTransform: 'none', letterSpacing: 0 }}>
                        {c === 'Review a deal' ? <span className="inline-flex items-center gap-1"><Paperclip className="w-3 h-3" />{c}</span> : c}
                      </button>
                    ))}
                  </div>
                </div>

                {files.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 px-4 sm:px-5 pb-2">
                    {files.map((f, i) => (
                      <span key={`${f.name}-${i}`} className="inline-flex items-center gap-1.5 text-[12px] text-gray-100 bg-[#14171E] border border-[#2A3040] rounded-lg pl-2 pr-1 py-1 max-w-[240px]">
                        {isPdf(f.name) ? <FileText className="w-3.5 h-3.5 text-[#8FD3FF] shrink-0" /> : <ImageIcon className="w-3.5 h-3.5 text-[#8FD3FF] shrink-0" />}
                        <span className="truncate">{f.name}</span>
                        <button onClick={() => setFiles(files.filter((_, j) => j !== i))} className="p-0.5 text-gray-400 hover:text-white"><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-end gap-2 px-3 sm:px-4 py-3 border-t border-[#2A3040]" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
                  <input ref={fileRef} type="file" accept={ACCEPT} multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
                  <button onClick={() => fileRef.current?.click()} disabled={ask.sending} className="w-11 h-11 rounded-full bg-[#14171E] border border-[#2A3040] text-gray-300 hover:text-white hover:border-[#8FD3FF]/50 flex items-center justify-center disabled:opacity-40 shrink-0" title="Attach a PDF or a photo">
                    <Paperclip className="w-4.5 h-4.5" size={18} />
                  </button>
                  <textarea
                    ref={inputRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
                    placeholder={files.length ? 'What should I do with this?' : ask.thread ? 'Keep going…' : 'Ask, or drop a deal PDF…'}
                    rows={1}
                    disabled={ask.sending}
                    className="flex-1 resize-none bg-[#14171E] border border-[#2A3040] rounded-2xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#8FD3FF] disabled:opacity-50"
                    style={{ fontSize: 16 }}
                  />
                  <button onClick={submit} disabled={ask.sending || (!text.trim() && files.length === 0)} className="w-11 h-11 rounded-full bg-[#1140F0] text-white flex items-center justify-center disabled:opacity-40 shrink-0">
                    {ask.sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              </>
            )}

            {dragging && (
              <div className="absolute inset-0 rounded-t-[28px] md:rounded-[28px] bg-[#0E1117]/85 border-2 border-dashed border-[#8FD3FF] flex flex-col items-center justify-center pointer-events-none">
                <Mascot mood="happy" size={80} />
                <div className="text-white font-semibold mt-2">Drop it here</div>
                <div className="text-gray-400 text-sm">PDF or a photo</div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/** The little one, thinking. Replaces the spinner. */
function Thinking({ label, mood }: { label: string; mood: Mood }) {
  return (
    <div className="flex items-end gap-2">
      <Mascot mood={mood === 'idle' ? 'thinking' : mood} size={40} />
      <div className="rounded-2xl rounded-bl-md bg-[#14171E] border border-[#2A3040] px-4 py-2.5 text-[13px] text-gray-400 flex items-center gap-2">
        <span>{label}</span>
        <span className="inline-flex gap-1">
          {[0, 1, 2].map((i) => <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#8FD3FF] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
        </span>
      </div>
    </div>
  );
}

function ThreadList({ threads, current, renaming, setRenaming, onOpen, onNew, onRename, onDelete }: {
  threads: AskThread[];
  current: string | null;
  renaming: { id: string; title: string } | null;
  setRenaming: (r: { id: string; title: string } | null) => void;
  onOpen: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [confirm, setConfirm] = useState<string | null>(null);
  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-3 space-y-2">
      <button onClick={onNew} className="w-full flex items-center gap-3 rounded-2xl border border-dashed border-[#2A3040] hover:border-[#8FD3FF]/60 px-4 py-3 text-left text-gray-200" style={{ textTransform: 'none', letterSpacing: 0 }}>
        <span className="w-8 h-8 rounded-full bg-[#1140F0] flex items-center justify-center text-white"><Plus className="w-4 h-4" /></span>
        <span className="font-semibold">New chat</span>
      </button>
      {threads.length === 0 && <p className="text-sm text-gray-500 px-1 pt-2">Your chats will show up here. Each deal or show gets its own.</p>}
      {threads.map((t) => (
        <div key={t.id} className={`rounded-2xl border px-3.5 py-2.5 ${t.id === current ? 'border-[#8FD3FF]/60 bg-[#14171E]' : 'border-[#2A3040] bg-[#14171E]/60'}`}>
          {renaming?.id === t.id ? (
            <form className="flex items-center gap-2" onSubmit={async (e) => { e.preventDefault(); await onRename(t.id, renaming.title.trim() || t.title); setRenaming(null); }}>
              <input autoFocus value={renaming.title} onChange={(e) => setRenaming({ id: t.id, title: e.target.value })} className="flex-1 bg-[#0E1117] border border-[#2A3040] rounded-lg px-2 py-1.5 text-white text-[14px] focus:outline-none focus:border-[#8FD3FF]" style={{ fontSize: 16 }} />
              <button type="submit" className="text-[#8FD3FF] text-sm font-semibold" style={{ textTransform: 'none', letterSpacing: 0 }}>Save</button>
              <button type="button" onClick={() => setRenaming(null)} className="text-gray-400 text-sm" style={{ textTransform: 'none', letterSpacing: 0 }}>Cancel</button>
            </form>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={() => onOpen(t.id)} className="flex-1 min-w-0 text-left" style={{ textTransform: 'none', letterSpacing: 0 }}>
                <div className="text-[14px] text-white truncate">{t.title}</div>
                <div className="text-[11px] text-gray-500 flex items-center gap-2">
                  <span>{when(t.last_message_at)}</span>
                  {t.has_deal && <span className="font-label text-[9px] tracking-[0.12em] uppercase text-[#8FD3FF]">Deal on table</span>}
                  {t.offer_id && <span className="font-label text-[9px] tracking-[0.12em] uppercase text-emerald-300">Saved offer</span>}
                </div>
              </button>
              <button onClick={() => setRenaming({ id: t.id, title: t.title })} className="p-1.5 text-gray-500 hover:text-white" title="Rename"><Pencil className="w-3.5 h-3.5" /></button>
              {confirm === t.id ? (
                <button onClick={async () => { await onDelete(t.id); setConfirm(null); }} className="text-[12px] text-red-300 font-semibold px-1" style={{ textTransform: 'none', letterSpacing: 0 }}>Delete?</button>
              ) : (
                <button onClick={() => setConfirm(t.id)} className="p-1.5 text-gray-500 hover:text-red-300" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
