import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Search, X, ChevronRight, Lock } from 'lucide-react';
import { Mascot } from '../components/ask/Mascot';
import { useAuth } from '../hooks/useAuth';
import { ARTICLES, CATEGORIES, articleText, type Article, type Block } from '../content/helpCenter';

/**
 * PROMOTER OS — public Help Center. No login. Same blue, same CRT tabs as
 * the app so it reads as the same product. Search is plain text over the
 * article bodies; nothing leaves the browser.
 */

function Inline({ text }: { text: string }) {
  // **bold** is the only mark.
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return <>{parts.map((p, i) => (p.startsWith('**') ? <b key={i} className="text-white">{p.slice(2, -2)}</b> : <span key={i}>{p}</span>))}</>;
}

function Verdicts() {
  const rows = [
    ['SAFE', 'bg-green-900/40 text-green-300', 'Profit is positive at 50% sold. You survive a half-full room.'],
    ['TIGHT', 'bg-yellow-900/40 text-yellow-300', 'Loses at 50%, clears at 70%. You need a real crowd.'],
    ['FRAGILE', 'bg-orange-900/40 text-orange-300', 'Loses at 70%. Only a near-sellout works.'],
    ['UNDERWATER', 'bg-red-900/40 text-red-300', 'Loses money even sold out. Something in the deal has to change.'],
  ];
  return (
    <div className="space-y-1.5">
      {rows.map(([tag, cls, text]) => (
        <div key={tag} className="flex items-start gap-3">
          <span className={`shrink-0 font-label text-[9px] tracking-[0.14em] uppercase px-2 py-1 rounded ${cls}`}>{tag}</span>
          <span className="text-[14px] text-gray-200">{text}</span>
        </div>
      ))}
    </div>
  );
}

function BlockView({ b }: { b: Block }) {
  switch (b.t) {
    case 'p': return <p className="text-[15px] text-gray-200 leading-relaxed"><Inline text={b.text} /></p>;
    case 'h': return <div className="font-label text-[10px] tracking-[0.16em] uppercase text-[#8FD3FF] pt-2">{b.text}</div>;
    case 'steps': return (
      <ol className="space-y-2">
        {b.items.map((it, i) => (
          <li key={i} className="flex gap-3 text-[15px] text-gray-200 leading-relaxed">
            <span className="shrink-0 w-6 h-6 rounded-md bg-[#1140F0] text-white text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
            <span><Inline text={it} /></span>
          </li>
        ))}
      </ol>
    );
    case 'bullets': return (
      <ul className="space-y-1.5">
        {b.items.map((it, i) => (
          <li key={i} className="flex gap-3 text-[15px] text-gray-200 leading-relaxed">
            <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-[#8FD3FF] mt-2.5" />
            <span><Inline text={it} /></span>
          </li>
        ))}
      </ul>
    );
    case 'formula': return <div className="bg-[#0B0D12] border border-[#2A3040] rounded-lg px-3 py-2 font-label text-[12px] tracking-[0.06em] text-[#8FD3FF] whitespace-pre-wrap overflow-x-auto">{b.text}</div>;
    case 'verdicts': return <Verdicts />;
    case 'tip': return <div className="border-l-2 border-[#F2B640] bg-[#F2B640]/10 rounded-r-lg px-3 py-2 text-[14px] text-gray-100"><Inline text={b.text} /></div>;
    case 'link': return b.external
      ? <a href={b.to} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[#8FD3FF] font-semibold text-sm">{b.label} <ArrowRight className="w-4 h-4" /></a>
      : <Link to={b.to} className="inline-flex items-center gap-1.5 text-[#8FD3FF] font-semibold text-sm">{b.label} <ArrowRight className="w-4 h-4" /></Link>;
  }
}

function ArticleCard({ a }: { a: Article }) {
  return (
    <Link to={`/help-center/${a.slug}`} className="block bg-[#14171E] border border-[#2A3040] hover:border-[#8FD3FF]/60 rounded-2xl px-4 py-3.5 transition-colors group">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[15px] font-semibold text-white leading-snug">{a.title}{a.members && <span className="ml-2 inline-flex items-center gap-1 align-middle font-label text-[9px] tracking-[0.14em] uppercase text-[#F2B640]"><Lock className="w-3 h-3" /> members</span>}</div>
          <div className="text-[13px] text-gray-400 mt-0.5 leading-snug">{a.summary}</div>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-[#8FD3FF] shrink-0 mt-1" />
      </div>
    </Link>
  );
}

export function HelpCenterPage() {
  const { slug } = useParams();
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string>('all');

  const article = slug ? ARTICLES.find((a) => a.slug === slug) : null;
  const index = useMemo(() => ARTICLES.map((a) => ({ a, text: articleText(a) })), []);

  useEffect(() => { window.scrollTo({ top: 0 }); }, [slug]);
  useEffect(() => { document.title = article ? `${article.title} — Promoter OS Help` : 'Help Center — Promoter OS'; return () => { document.title = 'PROMOTER OS'; }; }, [article]);

  const results = useMemo(() => {
    const words = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return index
      .filter(({ a }) => cat === 'all' || a.category === cat)
      .filter(({ text }) => words.every((w) => text.includes(w)))
      .map(({ a }) => a);
  }, [q, cat, index]);

  const grouped = useMemo(() => CATEGORIES.map((c) => ({ c, items: results.filter((a) => a.category === c.id) })).filter((g) => g.items.length), [results]);

  const back = user ? { to: '/dashboard', label: 'Back to the app' } : { to: '/', label: 'Back to home' };

  // ── Article view ──
  if (slug) {
    if (!article) {
      return (
        <div className="min-h-screen bg-[#1140F0] p-4 sm:p-6">
          <div className="max-w-3xl mx-auto bg-[#14171E] border border-[#2A3040] rounded-2xl p-6 text-center">
            <Mascot mood="sad" size={60} />
            <p className="text-white mt-3">That article is not here.</p>
            <Link to="/help-center" className="text-[#8FD3FF] underline text-sm">Back to the help center</Link>
          </div>
        </div>
      );
    }
    const i = ARTICLES.indexOf(article);
    const prev = ARTICLES[i - 1], next = ARTICLES[i + 1];
    const catLabel = CATEGORIES.find((c) => c.id === article.category)?.label;
    const related = ARTICLES.filter((a) => a.category === article.category && a.slug !== article.slug).slice(0, 4);
    return (
      <div className="min-h-screen bg-[#1140F0] p-3 sm:p-5">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between gap-3 mb-3">
            <Link to="/help-center" className="inline-flex items-center gap-2 text-white/80 hover:text-white text-sm"><ArrowLeft className="w-4 h-4" /> Help center</Link>
            <Link to={back.to} className="text-white/70 hover:text-white text-sm">{back.label}</Link>
          </div>
          <article className="bg-[#14171E] border border-[#2A3040] rounded-2xl p-4 sm:p-6 space-y-3 crt-panel">
            <div className="font-label text-[10px] tracking-[0.16em] uppercase text-[#8FD3FF]">{catLabel}</div>
            <h1 className="font-display text-2xl text-white uppercase tracking-wide leading-tight">{article.title}</h1>
            <p className="text-[15px] text-gray-400">{article.summary}</p>
            <div className="h-px bg-[#2A3040]" />
            {article.members && !user ? (
              <>
                {(article.teaser || []).map((b, k) => <BlockView key={k} b={b} />)}
                <div className="mt-2 bg-[#0B0D12] border border-[#F2B640]/50 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <Lock className="w-5 h-5 text-[#F2B640] shrink-0" />
                  <div className="flex-1">
                    <div className="text-white font-semibold text-[15px]">The rule itself is for members.</div>
                    <div className="text-gray-400 text-[13px]">Sign in to read it, or start the free trial — 7 days, no card.</div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Link to="/login" className="border border-[#2A3040] hover:border-[#8FD3FF]/60 text-white rounded-xl px-4 py-2 font-semibold text-sm">Sign in</Link>
                    <Link to="/signup" className="bg-[#8FD3FF] hover:bg-[#6FB8F2] text-[#04214D] rounded-xl px-4 py-2 font-bold text-sm">Start free</Link>
                  </div>
                </div>
              </>
            ) : article.body.map((b, k) => <BlockView key={k} b={b} />)}
          </article>

          <div className="grid grid-cols-2 gap-3 mt-3">
            {prev ? <Link to={`/help-center/${prev.slug}`} className="bg-[#14171E]/80 border border-[#2A3040] rounded-xl px-3 py-2.5 text-left"><div className="text-[10px] uppercase tracking-[0.14em] text-gray-500">Previous</div><div className="text-[13px] text-white truncate">{prev.title}</div></Link> : <span />}
            {next ? <Link to={`/help-center/${next.slug}`} className="bg-[#14171E]/80 border border-[#2A3040] rounded-xl px-3 py-2.5 text-right"><div className="text-[10px] uppercase tracking-[0.14em] text-gray-500">Next</div><div className="text-[13px] text-white truncate">{next.title}</div></Link> : <span />}
          </div>

          {related.length > 0 && (
            <div className="mt-5">
              <div className="font-label text-[10px] tracking-[0.16em] uppercase text-white/70 mb-2">More in {catLabel}</div>
              <div className="grid sm:grid-cols-2 gap-2">{related.map((a) => <ArticleCard key={a.slug} a={a} />)}</div>
            </div>
          )}

          <StillStuck user={!!user} />
        </div>
      </div>
    );
  }

  // ── Index view ──
  return (
    <div className="min-h-screen bg-[#1140F0] p-3 sm:p-5">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <Mascot mood={q ? 'thinking' : 'happy'} size={60} powerOn />
            <div>
              <h1 className="text-2xl font-bold text-white">Help Center</h1>
              <p className="text-white/80 text-sm">How Promoter OS works, in plain words. The easy way, the full way, and the math underneath.</p>
            </div>
          </div>
          <Link to={back.to} className="hidden sm:inline text-white/70 hover:text-white text-sm whitespace-nowrap">{back.label}</Link>
        </div>

        {/* Search */}
        <div className="flex items-center bg-[#14171E] border border-[#2A3040] focus-within:border-[#8FD3FF] rounded-full px-4 h-12 mb-3">
          <Search className="w-4 h-4 text-[#8FD3FF] shrink-0" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search: deposit, facility fee, receipts, credits…"
            className="flex-1 bg-transparent outline-none text-white text-[15px] px-3 placeholder:text-gray-500"
            style={{ textTransform: 'none', letterSpacing: 0 }}
            autoFocus
          />
          {q && <button onClick={() => setQ('')} className="text-gray-400 hover:text-white" aria-label="Clear"><X className="w-4 h-4" /></button>}
        </div>

        {/* Category tabs */}
        <div className="sticky top-16 z-20 -mx-3 px-3 py-2 mb-3 bg-[#0B2FB8]/95 backdrop-blur border-b border-[#8FD3FF]/30">
          <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            <button onClick={() => setCat('all')} className={`crt-tab ${cat === 'all' ? 'on' : ''}`} style={{ padding: '7px 12px' }}>All{cat === 'all' && <span className="crt-tab-bar" />}</button>
            {CATEGORIES.map((c) => (
              <button key={c.id} onClick={() => setCat(c.id)} className={`crt-tab ${cat === c.id ? 'on' : ''}`} style={{ padding: '7px 12px' }}>
                {c.label}{cat === c.id && <span className="crt-tab-bar" />}
              </button>
            ))}
          </div>
        </div>

        {grouped.length === 0 ? (
          <div className="bg-[#14171E] border border-[#2A3040] rounded-2xl p-6 text-center">
            <Mascot mood="sad" size={60} />
            <p className="text-white mt-3">Nothing for "{q}".</p>
            <p className="text-gray-400 text-sm">Try one word — "deposit", "tax", "receipts" — or <button onClick={() => { setQ(''); setCat('all'); }} className="text-[#8FD3FF] underline" style={{ textTransform: 'none', letterSpacing: 0 }}>show everything</button>.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {grouped.map(({ c, items }) => (
              <section key={c.id} className="crt-panel">
                <div className="flex items-baseline justify-between gap-3 mb-2">
                  <h2 className="font-display text-lg text-white uppercase tracking-wide">{c.label}</h2>
                  <span className="text-[12px] text-white/70 hidden sm:inline">{c.blurb}</span>
                </div>
                <div className="grid sm:grid-cols-2 gap-2">{items.map((a) => <ArticleCard key={a.slug} a={a} />)}</div>
              </section>
            ))}
          </div>
        )}

        <StillStuck user={!!user} />
        {!user && (
          <p className="text-center text-[12px] text-white/60 mt-6">
            <Link to="/" className="underline">Home</Link> · <Link to="/pricing" className="underline">Pricing</Link> · <Link to="/faq" className="underline">FAQ</Link> · <a href="/blog/" className="underline">Blog</a>
          </p>
        )}
      </div>
    </div>
  );
}

function StillStuck({ user }: { user: boolean }) {
  return (
    <div className="mt-6 bg-[#14171E] border border-[#1140F0] rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <Mascot mood="listening" size={40} />
      <div className="flex-1">
        <div className="text-white font-semibold text-[15px]">Still stuck?</div>
        <div className="text-gray-400 text-[13px]">{user ? 'Ask the little TV in the bar at the bottom of any screen — it knows your shows.' : 'Inside the app, the little TV in the bar at the bottom answers questions about your own shows.'}</div>
      </div>
      {user
        ? <Link to="/dashboard" className="shrink-0 bg-[#8FD3FF] hover:bg-[#6FB8F2] text-[#04214D] rounded-xl px-4 py-2 font-bold text-sm">Open the app</Link>
        : <Link to="/signup" className="shrink-0 bg-[#8FD3FF] hover:bg-[#6FB8F2] text-[#04214D] rounded-xl px-4 py-2 font-bold text-sm">Start free — 7 days</Link>}
    </div>
  );
}
