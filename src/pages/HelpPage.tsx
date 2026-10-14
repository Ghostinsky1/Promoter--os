import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Zap, FileText, Calculator, Receipt, MessageCircle, Compass, Sparkles } from 'lucide-react';
import { Mascot } from '../components/ask/Mascot';

/**
 * PROMOTER OS — Help. How to use it, what the math is, the easy way and the
 * full way, and what to do next. Plain words. Every section has an id so
 * the little ? on each screen can land on the right part.
 */

const SECTIONS = [
  { id: 'start', label: 'Start here', icon: Compass },
  { id: 'quick', label: 'The easy way', icon: Zap },
  { id: 'offer', label: 'The full offer', icon: FileText },
  { id: 'math', label: 'The math', icon: Calculator },
  { id: 'settlement', label: 'After the show', icon: Receipt },
  { id: 'ask', label: 'The little TV', icon: MessageCircle },
  { id: 'next', label: 'What to do next', icon: Sparkles },
];

function H({ id, children }: { id: string; children: React.ReactNode }) {
  return <h2 id={id} className="font-display text-xl text-white uppercase tracking-wide scroll-mt-24 pt-2">{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[15px] text-gray-200 leading-relaxed">{children}</p>;
}
function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="space-y-2">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3 text-[15px] text-gray-200 leading-relaxed">
          <span className="shrink-0 w-6 h-6 rounded-md bg-[#1140F0] text-white text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
          <span>{it}</span>
        </li>
      ))}
    </ol>
  );
}
function Formula({ children }: { children: React.ReactNode }) {
  return <div className="bg-[#0B0D12] border border-[#2A3040] rounded-lg px-3 py-2 font-label text-[12px] tracking-[0.06em] text-[#8FD3FF] whitespace-pre-wrap">{children}</div>;
}
function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-[#14171E] border border-[#2A3040] rounded-2xl p-4 sm:p-5 space-y-3">{children}</div>;
}
function Verdict({ tag, cls, text }: { tag: string; cls: string; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className={`shrink-0 font-label text-[9px] tracking-[0.14em] uppercase px-2 py-1 rounded ${cls}`}>{tag}</span>
      <span className="text-[14px] text-gray-200">{text}</span>
    </div>
  );
}

export function HelpPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [active, setActive] = useState('start');

  useEffect(() => {
    const id = location.hash.replace('#', '');
    if (id) {
      setActive(id);
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    }
  }, [location.hash]);

  const go = (id: string) => { setActive(id); navigate(`/help#${id}`); };
  const showWelcomeAgain = () => { try { localStorage.removeItem('pos_welcomed'); } catch { /* ignore */ } navigate('/dashboard?welcome=1'); };

  return (
    <div className="min-h-screen bg-[#1140F0] p-3 sm:p-5">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <Mascot mood="happy" size={60} powerOn />
          <div>
            <h1 className="text-2xl font-bold text-white">Help</h1>
            <p className="text-white/80 text-sm">How Promoter OS works, in plain words. The easy way, the full way, and the math underneath.</p>
          </div>
        </div>

        {/* Section tabs */}
        <div className="sticky top-16 z-20 -mx-3 px-3 py-2 mb-3 bg-[#0B2FB8]/95 backdrop-blur border-b border-[#8FD3FF]/30">
          <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {SECTIONS.map((s) => (
              <button key={s.id} onClick={() => go(s.id)} className={`crt-tab ${active === s.id ? 'on' : ''}`} style={{ padding: '7px 12px' }}>
                <s.icon className="w-3.5 h-3.5" /> {s.label}
                {active === s.id && <span className="crt-tab-bar" />}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {/* START */}
          <Card>
            <H id="start">Start here</H>
            <P>Promoter OS answers one question before you sign anything: <b className="text-white">does this show survive a bad night?</b> You give it the room, the ticket price, the artist's fee and your costs; it shows you the profit at a sellout, at 70% sold, and at a half-full room. Then it stays with the show — deposits, tasks, the settlement after — so the numbers you see are always yours, never a guess.</P>
            <Steps items={[
              <>Make an offer. The <b className="text-white">easy way</b> is seven boxes (<button onClick={() => navigate('/offers/quick')} className="text-[#8FD3FF] underline" style={{ textTransform: 'none', letterSpacing: 0 }}>Quick offer</button>). The <b className="text-white">full way</b> has tiers, deposits, support acts and every cost line.</>,
              <>Read the verdict: <b className="text-green-400">SAFE</b>, <b className="text-yellow-400">TIGHT</b>, <b className="text-orange-400">FRAGILE</b> or <b className="text-red-400">UNDERWATER</b>. Fix the deal until it survives a half-full room, or know going in that you are betting on a sellout.</>,
              <>Move the show from <b className="text-white">Planning</b> to <b className="text-white">Confirmed</b> when it is real. Planning is a sketch and does not touch your totals.</>,
              <>After the show, settle it: tickets actually sold, what was actually paid. That is your real profit, and it feeds the dashboard.</>,
            ]} />
            <P>Or skip all of that and drop a cost sheet, a deal memo or a settlement PDF into the little TV at the bottom of the screen. It reads it and lays the deal out for you.</P>
          </Card>

          {/* QUICK */}
          <Card>
            <H id="quick">The easy way — Quick offer</H>
            <P>Seven boxes: artist, venue, date, capacity, ticket price, artist fee, show costs (plus ads if you know them). The read appears next to the boxes as you type. Press <b className="text-white">Create offer</b> and it is saved as Planning with sensible defaults for everything you did not fill in — 20% artist deposit, 13.18% sales tax on top of the ticket, the usual PRO and insurance rates, a $2 facility fee that the venue keeps. All of it can be changed on the offer page afterwards.</P>
            <P>Use it when you are on the phone with an agent and need an answer in a minute. Come back to the full offer when the deal gets real.</P>
            <button onClick={() => navigate('/offers/quick')} className="inline-flex items-center gap-2 bg-[#8FD3FF] hover:bg-[#6FB8F2] text-[#04214D] rounded-xl px-4 py-2 font-bold text-sm"><Zap className="w-4 h-4" /> Open Quick offer</button>
          </Card>

          {/* FULL OFFER */}
          <Card>
            <H id="offer">The full offer — the advanced way</H>
            <P>The offer page has five tabs. A strip under the header stays with you while you edit and shows net profit and the verdict live.</P>
            <Steps items={[
              <><b className="text-white">Deal</b> — the lineup (drag to reorder, each act with its own fee), the headliner's deal, deposits. Deal types: <b className="text-white">flat fee</b> (artist gets the guarantee, you keep the rest), <b className="text-white">guarantee vs %</b> (artist gets the higher of a floor or a share of what is left after costs), <b className="text-white">door deal</b> (a straight split).</>,
              <><b className="text-white">Tickets</b> — tiers with price, allotment and comps. Sales tax is on top of the ticket, the fan pays it, it is never your money. The three stress points live here too.</>,
              <><b className="text-white">Costs</b> — fixed lines by category (venue, production, marketing, talent extras) and the variable ones that scale with tickets (PRO fees, insurance per head, card fees).</>,
              <><b className="text-white">Money in</b> — bar, parking, vendor spots, sponsors. Bar is capacity × your per-head number (Jose's rooms do $25–30 a head). Off by default; turn it on only if that money is really yours.</>,
              <><b className="text-white">Tasks & notes</b> — what has to happen before doors, pinned notes, next steps.</>,
            ]} />
            <P>Everything autosaves about a second after you stop typing. The pill in the corner says Saving / Saved, and Undo takes you back to the last saved version.</P>
          </Card>

          {/* MATH */}
          <Card>
            <H id="math">The math, exactly</H>
            <P>No typical figures, no padding. Every number comes from what you typed.</P>
            <div className="space-y-2">
              <div className="font-label text-[10px] tracking-[0.16em] uppercase text-[#8FD3FF]">1 · Gross and net gross</div>
              <Formula>{`gross      = Σ (tickets sold in tier × tier price)
net gross  = gross − facility fee carved out of the ticket (only if "inside")
             sales tax is ON TOP of the ticket: the fan pays it, it never reduces net gross`}</Formula>
              <div className="font-label text-[10px] tracking-[0.16em] uppercase text-[#8FD3FF] pt-1">2 · Costs</div>
              <Formula>{`fixed      = every expense line + support acts + hotel/flights/transport/rider if turned on
variable   = net gross × (ASCAP + BMI + SESAC + card fee rates) + tickets × insurance per head
costs      = fixed + variable`}</Formula>
              <div className="font-label text-[10px] tracking-[0.16em] uppercase text-[#8FD3FF] pt-1">3 · The artist</div>
              <Formula>{`flat fee          artist = guarantee
guarantee vs %    artist = max(guarantee, % × (net gross − costs))
door deal         artist = % × (net gross − costs)   (or of gross, if you set it so)
tax withholding   taken off the artist's payout, not yours`}</Formula>
              <div className="font-label text-[10px] tracking-[0.16em] uppercase text-[#8FD3FF] pt-1">4 · Your profit</div>
              <Formula>{`profit = net gross − costs − artist + your share of bar/parking/sponsors`}</Formula>
              <div className="font-label text-[10px] tracking-[0.16em] uppercase text-[#8FD3FF] pt-1">5 · The bad night — the number that matters</div>
              <P>The same formula is run three times, at <b className="text-white">50%</b>, <b className="text-white">70%</b> and <b className="text-white">100%</b> of sellable tickets. On a bad night the cheap tickets sell first (you can switch to a blended mix on the Deal Score card). The verdict:</P>
              <div className="space-y-1.5">
                <Verdict tag="SAFE" cls="bg-green-900/40 text-green-300" text="Profit is positive at 50% sold. You survive a half-full room." />
                <Verdict tag="TIGHT" cls="bg-yellow-900/40 text-yellow-300" text="Loses at 50%, clears at 70%. You need a real crowd." />
                <Verdict tag="FRAGILE" cls="bg-orange-900/40 text-orange-300" text="Loses at 70%. Only a near-sellout works." />
                <Verdict tag="UNDERWATER" cls="bg-red-900/40 text-red-300" text="Loses money even sold out. Something in the deal has to change." />
              </div>
              <div className="font-label text-[10px] tracking-[0.16em] uppercase text-[#8FD3FF] pt-1">6 · Deal Score (0–100)</div>
              <P>Scored at capacity, judged at 50%. It rewards a deal that survives the bad night and punishes one that only works sold out. Free — it is arithmetic, not AI.</P>
              <div className="font-label text-[10px] tracking-[0.16em] uppercase text-[#8FD3FF] pt-1">7 · Cash you need on hand</div>
              <Formula>{`cash on hand = unpaid artist deposits + unpaid venue deposits + marketing budget
                (artist balances and night-of costs come out of the door — not due now)`}</Formula>
              <div className="font-label text-[10px] tracking-[0.16em] uppercase text-[#8FD3FF] pt-1">8 · A fair artist fee (Artist Fee page)</div>
              <P>Under about $10,000 in expected gross, the headliner should cost 10–15% of the gross. Over $10,000, stop paying flat: guarantee about 10% of expected gross and pay 15–25% of what is left after costs, whichever is higher. Tested on real settlements — the guarantee floor is what protects the bad night.</P>
            </div>
          </Card>

          {/* SETTLEMENT */}
          <Card>
            <H id="settlement">After the show — settlement</H>
            <Steps items={[
              <>Open the show → <b className="text-white">Settle event</b>. Type what actually sold per tier and what was actually paid per line. It saves a draft as you type; nothing is marked settled until you press Save.</>,
              <>Or talk to the settlement chat: drop receipts, Venmo screenshots, the venue's sheet. It sorts them into a working list, asks when something is unclear, and writes to the settlement only when you say "looks good".</>,
              <>When it does not add up, it says <b className="text-white">check this</b> and gives you the two numbers. It never says anyone is cheating — it is usually a 2 a.m. arithmetic mistake, and you have to work with these people again.</>,
              <>Press Save. The show is marked settled, actual profit replaces the estimate, and the dashboard's "actual revenue" moves.</>,
            ]} />
          </Card>

          {/* ASK */}
          <Card>
            <H id="ask">The little TV — Ask</H>
            <P>The bar at the bottom of every screen. Tap it. It opens with what needs you today (free — no credits), then you can talk to it like a partner:</P>
            <Steps items={[
              <>Drop a deal PDF, a cost sheet or a screenshot and say <i>"structure this"</i>. It says what the document is, lays the deal out, gives its read, and asks before saving anything.</>,
              <><i>"How can we make this work?"</i> — it tries changes one at a time and shows you 50% / 100% for each. Nothing is saved by that.</>,
              <><i>"Save it"</i> — creates a draft offer. <i>"Bump GA to $35"</i>, <i>"add $500 security"</i>, <i>"mark the deposit paid"</i> — it does it and lists exactly what changed.</>,
              <>Every deal or show gets its own chat thread. The chats button in the header lists them.</>,
            ]} />
            <P>Credits: a message costs 1, a message with files 2, a document scan 3. The brief, Deal Score and insights are free. Your plan gives you a monthly allowance; packs never expire.</P>
          </Card>

          {/* NEXT */}
          <Card>
            <H id="next">What to do next</H>
            <Steps items={[
              <>Make your first offer — <button onClick={() => navigate('/offers/quick')} className="text-[#8FD3FF] underline" style={{ textTransform: 'none', letterSpacing: 0 }}>the easy way</button> or by dropping a cost sheet into the little TV.</>,
              <>Put in your real costs. The verdict is only as honest as the cost lines.</>,
              <>Set deposits and due dates. Needs You will nag you a week out.</>,
              <>Move it to Confirmed when the agent says yes. Now it counts.</>,
              <>After the show, settle it the same week while the receipts are fresh.</>,
            ]} />
            <button onClick={showWelcomeAgain} className="text-sm text-[#8FD3FF] underline" style={{ textTransform: 'none', letterSpacing: 0 }}>Show me the welcome again</button>
          </Card>
        </div>
      </div>
    </div>
  );
}
