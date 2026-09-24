import { useEffect, useRef, useState, Fragment } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Send, Loader2, X, Sparkles, Home as HomeIcon, MessageCircle, Music, Receipt, Check, Zap } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useAsk } from './AskProvider';

/**
 * PROMOTER OS — the Ask bar, on every screen, bottom center, like the search
 * bar Jose pointed at. Tap it and the chat slides up over whatever you're on.
 * On phones a four-tab bar sits under it: Home / Ask / Shows / Settle.
 */

const APP_PREFIXES = ['/dashboard', '/offers', '/tours', '/templates', '/settings', '/subscription', '/deal-estimator', '/artist-fee'];
const CHIPS = ['What needs me?', 'Cash I need', 'Unsettled shows', 'Coming up'];

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

export function AskDock() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const ask = useAsk();
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const inApp = !!user && APP_PREFIXES.some((p) => location.pathname === p || location.pathname.startsWith(p + '/'));

  useEffect(() => { if (ask.open) { endRef.current?.scrollIntoView({ block: 'end' }); setTimeout(() => inputRef.current?.focus(), 150); } }, [ask.open, ask.messages.length, ask.sending]);
  useEffect(() => { ask.setOpen(false); /* close on navigation */ }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!inApp) return null;

  const go = (path: string) => { ask.setOpen(false); navigate(path); };
  const submit = async () => { const t = text; setText(''); await ask.send(t); };
  const creditsLeft = ask.credits?.total_left;
  const isActive = (p: string) => location.pathname === p || location.pathname.startsWith(p + '/');

  return (
    <>
      {/* The bar */}
      <div className="fixed left-0 right-0 z-40 px-4 pointer-events-none bottom-[88px] md:bottom-5">
        <button
          onClick={() => ask.setOpen(true)}
          className="pointer-events-auto mx-auto w-full max-w-xl flex items-center gap-3 h-14 rounded-full bg-[#14171E]/95 backdrop-blur border border-[#2A3040] px-4 text-left shadow-[0_12px_40px_rgba(0,0,0,0.55)]"
          style={{ textTransform: 'none', letterSpacing: 0 }}
        >
          <span className="w-7 h-7 rounded-full shrink-0" style={{ background: 'radial-gradient(circle at 30% 30%, #8FD3FF, #1140F0)', boxShadow: '0 0 14px rgba(143,211,255,0.6)' }} />
          <span className="flex-1 text-[15px] text-gray-300 truncate">
            {ask.brief?.needs_you?.length ? `${ask.brief.needs_you.length} thing${ask.brief.needs_you.length === 1 ? '' : 's'} need you · ask anything` : 'Ask "what needs me today"'}
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
          <div className="relative w-full md:max-w-2xl md:mx-4 bg-[#0E1117] border border-[#2A3040] rounded-t-[28px] md:rounded-[28px] flex flex-col h-[86vh] md:h-[80vh] shadow-[0_-10px_60px_rgba(0,0,0,0.6)]">
            <div className="flex items-center justify-between px-5 pt-3 pb-2">
              <div className="w-11 h-1.5 rounded-full bg-[#2A3040] mx-auto md:hidden absolute left-1/2 -translate-x-1/2 top-2" />
              <span className="flex items-center gap-2 text-white font-semibold mt-2 md:mt-0"><Sparkles className="w-4 h-4 text-[#8FD3FF]" /> Ask</span>
              <div className="flex items-center gap-2 mt-2 md:mt-0">
                {creditsLeft != null && <span className="font-label text-[10px] tracking-[0.12em] uppercase text-gray-400">{creditsLeft} credits</span>}
                <button onClick={() => ask.setOpen(false)} className="p-1.5 text-gray-400 hover:text-white"><X className="w-4 h-4" /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-3 space-y-3">
              {/* The brief is the first bubble, always. Free. */}
              {ask.brief && (
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
                </div>
              )}
              {ask.messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap ${m.role === 'user' ? 'bg-[#1140F0] text-white rounded-br-md' : 'bg-[#14171E] border border-[#2A3040] text-gray-100 rounded-bl-md'}`}>
                    {m.role === 'assistant' ? renderText(m.content, go) : m.content}
                    {m.changed && m.changed.length > 0 && (
                      <div className="mt-1.5 space-y-0.5">
                        {m.changed.map((c, i) => <div key={i} className="inline-flex items-center gap-1 text-[11px] text-emerald-300 mr-2"><Check className="w-3 h-3" />{c}</div>)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {ask.sending && <div className="flex items-center gap-2 text-xs text-gray-400"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Thinking…</div>}
              {ask.error && (
                <div className="text-xs text-red-300 bg-red-900/20 border border-red-800/40 rounded-xl px-3 py-2">
                  {ask.error}
                  {ask.outOfCredits && (
                    <button onClick={() => go('/subscription#credits')} className="ml-2 inline-flex items-center gap-1 text-[#8FD3FF] font-semibold" style={{ textTransform: 'none', letterSpacing: 0 }}><Zap className="w-3 h-3" /> Get more credits</button>
                  )}
                </div>
              )}
              <div ref={endRef} />
            </div>

            {ask.messages.length === 0 && (
              <div className="flex flex-wrap gap-2 px-4 sm:px-5 pb-2">
                {CHIPS.map((c) => (
                  <button key={c} onClick={() => ask.send(c)} disabled={ask.sending} className="text-[13px] text-gray-200 bg-[#14171E] border border-[#2A3040] rounded-full px-3 py-1.5 hover:border-[#8FD3FF]/50" style={{ textTransform: 'none', letterSpacing: 0 }}>{c}</button>
                ))}
              </div>
            )}

            <div className="flex items-end gap-2 px-3 sm:px-4 py-3 border-t border-[#2A3040]" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
              <textarea
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
                placeholder="Ask about a show, cash, tasks…"
                rows={1}
                disabled={ask.sending}
                className="flex-1 resize-none bg-[#14171E] border border-[#2A3040] rounded-2xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#8FD3FF] disabled:opacity-50"
                style={{ fontSize: 16 }}
              />
              <button onClick={submit} disabled={ask.sending || !text.trim()} className="w-11 h-11 rounded-full bg-[#1140F0] text-white flex items-center justify-center disabled:opacity-40">
                {ask.sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
