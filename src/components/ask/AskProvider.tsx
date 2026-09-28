import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useOrganization } from '../../hooks/useOrganization';
import {
  fetchBrief, fetchThread, sendAsk, uploadAskFiles, renameThread as renameThreadApi, deleteThread as deleteThreadApi,
  AskError, Brief, CreditStatus, AskMessage, AskThread, MAX_ASK_FILES, MAX_ASK_FILE_MB,
} from '../../lib/ask';
import type { Mood } from './Mascot';

/**
 * One brief for the whole app, plus the conversation threads. The dashboard
 * reads the brief, the Ask sheet reads everything, and an answer that changed
 * something refreshes the brief for both.
 */

interface AskState {
  brief: Brief | null;
  credits: CreditStatus | null;
  threads: AskThread[];
  thread: AskThread | null;
  messages: AskMessage[];
  loading: boolean;
  loadingThread: boolean;
  sending: boolean;
  busy: string | null;
  error: string | null;
  outOfCredits: boolean;
  mood: Mood;
  setMood: (m: Mood) => void;
  open: boolean;
  setOpen: (v: boolean) => void;
  refresh: () => Promise<void>;
  send: (text: string, files?: File[]) => Promise<void>;
  openThread: (id: string | null) => Promise<void>;
  newThread: () => void;
  renameThread: (id: string, title: string) => Promise<void>;
  deleteThread: (id: string) => Promise<void>;
  setCreditsLeft: (n: number) => void;
}

const Ctx = createContext<AskState | null>(null);

export function AskProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { organization } = useOrganization();
  const [brief, setBrief] = useState<Brief | null>(null);
  const [credits, setCredits] = useState<CreditStatus | null>(null);
  const [threads, setThreads] = useState<AskThread[]>([]);
  const [thread, setThread] = useState<AskThread | null>(null);
  const [messages, setMessages] = useState<AskMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outOfCredits, setOutOfCredits] = useState(false);
  const [mood, setMood] = useState<Mood>('idle');
  const [open, setOpen] = useState(false);
  const loadedFor = useRef<string | null>(null);
  const moodTimer = useRef<number | null>(null);

  const flashMood = useCallback((m: Mood, ms = 1800) => {
    setMood(m);
    if (moodTimer.current) window.clearTimeout(moodTimer.current);
    moodTimer.current = window.setTimeout(() => setMood('idle'), ms);
  }, []);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const r = await fetchBrief();
      setBrief(r.brief); setCredits(r.credits); setThreads(r.threads);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Could not load the brief.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user && loadedFor.current !== user.id) { loadedFor.current = user.id; refresh(); }
    if (!user) { loadedFor.current = null; setBrief(null); setMessages([]); setCredits(null); setThreads([]); setThread(null); }
  }, [user, refresh]);

  const openThread = useCallback(async (id: string | null) => {
    setError(null); setOutOfCredits(false);
    if (!id) { setThread(null); setMessages([]); return; }
    setLoadingThread(true);
    try {
      const r = await fetchThread(id);
      setThread(r.thread); setMessages(r.messages);
    } catch (e: any) {
      setError(e?.message || 'Could not open that chat.');
    } finally {
      setLoadingThread(false);
    }
  }, []);

  const newThread = useCallback(() => { setThread(null); setMessages([]); setError(null); setOutOfCredits(false); }, []);

  const send = useCallback(async (text: string, files: File[] = []) => {
    const t = text.trim();
    if ((!t && files.length === 0) || sending) return;
    if (files.length > MAX_ASK_FILES) { setError(`Up to ${MAX_ASK_FILES} files at a time.`); return; }
    const big = files.find((f) => f.size > MAX_ASK_FILE_MB * 1024 * 1024);
    if (big) { setError(`${big.name} is over ${MAX_ASK_FILE_MB}MB.`); return; }
    setSending(true); setError(null); setOutOfCredits(false);
    setMood(files.length ? 'reading' : 'thinking');
    const tempId = `u_${Date.now()}`;
    try {
      let importIds: string[] = [];
      let attachments: { import_id: string; file_name: string }[] = [];
      if (files.length) {
        if (!organization?.id) throw new AskError('Your account is still loading. Try again in a second.');
        attachments = await uploadAskFiles(organization.id, files, setBusy);
        importIds = attachments.map((a) => a.import_id);
      }
      setMessages((m) => [...m, { id: tempId, role: 'user', content: t, attachments, created_at: new Date().toISOString() }]);
      setBusy(files.length ? 'Reading' : 'Thinking');
      const r = await sendAsk({ threadId: thread?.id ?? null, message: t, importIds });
      setMessages((m) => [...m, { id: `a_${Date.now()}`, role: 'assistant', content: r.reply, changed: r.changed, created_at: new Date().toISOString() }]);
      setThread(r.thread); setThreads(r.threads); setBrief(r.brief);
      if (r.creditsLeft != null) setCredits((c) => (c ? { ...c, total_left: r.creditsLeft as number } : c));
      flashMood(r.changed.length ? 'happy' : 'idle', 2200);
    } catch (e: any) {
      if (e instanceof AskError && e.credits) { setOutOfCredits(true); setCredits((c) => (c ? { ...c, total_left: e.creditsLeft } : c)); }
      setError(e?.message || 'Ask could not answer.');
      flashMood('sad', 2600);
    } finally {
      setSending(false); setBusy(null);
    }
  }, [sending, thread?.id, organization?.id, flashMood]);

  const renameThread = useCallback(async (id: string, title: string) => {
    await renameThreadApi(id, title);
    setThreads((ts) => ts.map((x) => (x.id === id ? { ...x, title } : x)));
    setThread((x) => (x && x.id === id ? { ...x, title } : x));
  }, []);

  const deleteThread = useCallback(async (id: string) => {
    await deleteThreadApi(id);
    setThreads((ts) => ts.filter((x) => x.id !== id));
    setThread((x) => (x && x.id === id ? null : x));
    setMessages((m) => (thread?.id === id ? [] : m));
  }, [thread?.id]);

  const setCreditsLeft = useCallback((n: number) => setCredits((c) => (c ? { ...c, total_left: n } : c)), []);

  return (
    <Ctx.Provider value={{
      brief, credits, threads, thread, messages, loading, loadingThread, sending, busy, error, outOfCredits, mood, setMood,
      open, setOpen, refresh, send, openThread, newThread, renameThread, deleteThread, setCreditsLeft,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAsk(): AskState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAsk outside AskProvider');
  return v;
}
