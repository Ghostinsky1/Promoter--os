import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { fetchBrief, sendAsk, AskError, Brief, CreditStatus, AskMessage } from '../../lib/ask';

/**
 * One brief for the whole app. The dashboard reads it, the Ask bar reads it,
 * and an answer that changed something refreshes it for both.
 */

interface AskState {
  brief: Brief | null;
  credits: CreditStatus | null;
  messages: AskMessage[];
  loading: boolean;
  sending: boolean;
  error: string | null;
  outOfCredits: boolean;
  open: boolean;
  setOpen: (v: boolean) => void;
  refresh: () => Promise<void>;
  send: (text: string) => Promise<void>;
  setCreditsLeft: (n: number) => void;
}

const Ctx = createContext<AskState | null>(null);

export function AskProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [brief, setBrief] = useState<Brief | null>(null);
  const [credits, setCredits] = useState<CreditStatus | null>(null);
  const [messages, setMessages] = useState<AskMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outOfCredits, setOutOfCredits] = useState(false);
  const [open, setOpen] = useState(false);
  const loadedFor = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const r = await fetchBrief();
      setBrief(r.brief); setCredits(r.credits); setMessages(r.history);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Could not load the brief.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user && loadedFor.current !== user.id) { loadedFor.current = user.id; refresh(); }
    if (!user) { loadedFor.current = null; setBrief(null); setMessages([]); setCredits(null); }
  }, [user, refresh]);

  const send = useCallback(async (text: string) => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true); setError(null); setOutOfCredits(false);
    setMessages((m) => [...m, { id: `u_${Date.now()}`, role: 'user', content: t, created_at: new Date().toISOString() }]);
    try {
      const r = await sendAsk(t);
      setMessages((m) => [...m, { id: `a_${Date.now()}`, role: 'assistant', content: r.reply, changed: r.changed, created_at: new Date().toISOString() }]);
      setBrief(r.brief);
      if (r.creditsLeft != null) setCredits((c) => (c ? { ...c, total_left: r.creditsLeft as number } : c));
    } catch (e: any) {
      if (e instanceof AskError && e.credits) { setOutOfCredits(true); setCredits((c) => (c ? { ...c, total_left: e.creditsLeft } : c)); }
      setError(e?.message || 'Ask could not answer.');
    } finally {
      setSending(false);
    }
  }, [sending]);

  const setCreditsLeft = useCallback((n: number) => setCredits((c) => (c ? { ...c, total_left: n } : c)), []);

  return (
    <Ctx.Provider value={{ brief, credits, messages, loading, sending, error, outOfCredits, open, setOpen, refresh, send, setCreditsLeft }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAsk(): AskState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAsk outside AskProvider');
  return v;
}
