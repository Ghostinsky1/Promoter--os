import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { CREDIT_COST, canAfford, spendCredits, outOfCredits, creditStatus } from '../_shared/credits.ts';
import { survivalRead } from '../_shared/downside.ts';
import { toolMap, loadCtx, UserError } from '../promtp-mcp/tools.ts';
import { settlementActuals } from '../promtp-mcp/calc.ts';

/**
 * PROMOTER OS — "Ask". The bar in the middle of every screen, and the
 * assistant behind it.
 *
 * Three things it does.
 *
 * BRIEF (free, no model): what needs the promoter today, what is coming up,
 * what cash has to be on hand. Plain arithmetic on their own offers, tasks
 * and settlements. Runs on every app open. Costs nothing, invents nothing.
 *
 * THREADS (free): every conversation is a thread. A deal PDF gets its own
 * thread; so does a show, or a question. Files stay attached to the thread.
 *
 * CHAT (1 credit a message, 2 with files): the promoter talks in their own
 * words -- drops a deal PDF and says "structure this", asks "how can we make
 * this work?", says "bump GA to $35" -- and the assistant answers from their
 * numbers. It can read documents, run what-ifs, and, when the promoter says
 * so in the chat, create a draft offer, change an offer, record actuals, and
 * handle tasks and notes. Writes go through the same code as the Claude
 * connector (promtp-mcp/tools.ts), never raw SQL. Everything in
 * HOW-IT-THINKS.md applies.
 *
 * RECEIPTS (Oct 14): drop receipts, payment screenshots or the venue sheet
 * for a show and the assistant keeps a working list -- the same list the
 * settlement page's chat uses (settlement_chat_ledgers, one per show), so
 * both screens see the same items. It writes the list into the settlement
 * only when the promoter says so, and never marks the show settled; that
 * still takes the Save button on the settlement page.
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const MODEL = 'claude-sonnet-5';
const PRICE_IN = 2 / 1_000_000, PRICE_OUT = 10 / 1_000_000;
const HISTORY_LIMIT = 30;
const THREAD_LIMIT = 30;
const MAX_ROUNDS = 6;
const MAX_FILES = 4;
const MAX_OUT = 8000;
const MAX_FILE_BYTES = 12 * 1024 * 1024;

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': '*' };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
// deno-lint-ignore no-explicit-any
type Any = any;
const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const money = (v: number) => (v < 0 ? '-' : '') + '$' + Math.abs(Math.round(v)).toLocaleString('en-US');

const DAY = 86_400_000;
function daysFromToday(date: string): number {
  const d = new Date(date + 'T00:00:00'); const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - t.getTime()) / DAY);
}
function niceDate(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

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

/** The working list for one show. Shared with the settlement page's chat. */
async function loadLedger(supabase: Any, offerId: string): Promise<LedgerItem[]> {
  const { data } = await supabase.from('settlement_chat_ledgers').select('items').eq('offer_id', offerId).maybeSingle();
  return Array.isArray(data?.items) ? data.items : [];
}
async function saveLedger(supabase: Any, orgId: string, offerId: string, items: LedgerItem[]) {
  await supabase.from('settlement_chat_ledgers').upsert({ offer_id: offerId, organization_id: orgId, items, updated_at: new Date().toISOString() });
}

/** What the settlement of one show looks like right now, for the model and for the write. */
async function loadSettlementState(supabase: Any, orgId: string, offerId: string) {
  const { data: offer } = await supabase.from('offers').select('*, show:shows(*)').eq('id', offerId).eq('organization_id', orgId).maybeSingle();
  if (!offer) return null;
  const { data: settlement } = await supabase.from('settlements').select('*').eq('offer_id', offerId).maybeSingle();
  const categories = Object.keys({ ...(offer.expenses || {}), ...((settlement?.actual_expenses as Any) || {}) });
  if (!categories.includes('general')) categories.push('general');
  const ledger = await loadLedger(supabase, offerId);
  return { offer, settlement, categories, ledger };
}

function receiptsContext(st: NonNullable<Awaited<ReturnType<typeof loadSettlementState>>>) {
  const { offer, settlement, categories, ledger } = st;
  const saved: Any = settlement?.actual_expenses && Object.keys(settlement.actual_expenses).length ? settlement.actual_expenses : null;
  const lines = Object.entries((saved || offer.expenses || {}) as Record<string, Any>)
    .map(([cat, items]: [string, Any]) => `${cat}: ${Object.entries(items || {}).map(([k, v]) => `${k} ${money(num(v))}${saved ? '' : ' (estimate)'}`).join(', ') || '(none)'}`)
    .join('\n');
  const attendance: Any[] = Array.isArray(settlement?.actual_attendance) ? settlement.actual_attendance : [];
  const tiers = (offer.ticket_tiers || []).map((t: Any) => {
    const a = attendance.find((x: Any) => x.type === t.type);
    return `${t.type} at $${t.price}: ${a ? `${num(a.actual_sold)} sold` : 'no count yet'}`;
  }).join('\n');
  const name = offer.show?.event_name || offer.show?.artist_name || offer.artist_name || 'Show';
  return `RECEIPTS FOR: ${name} at ${offer.show?.venue_name ?? '?'} on ${offer.show?.event_date ?? '?'} (offer ${offer.id})
EXPENSE CATEGORIES ON THIS SHOW: ${categories.join(', ')}
EXPENSE LINES ${saved ? 'ON THE SETTLEMENT (actuals)' : 'FROM THE OFFER (estimates, nothing actual saved yet)'}:
${lines || '(none)'}
TICKET TIERS (name at price: count on the settlement):
${tiers || '(no tiers)'}
ARTIST DEAL: ${offer.deal_type ?? 'flat_fee'}, guarantee $${offer.guarantee ?? 0} -- the app handles the artist's fee; do NOT add it as an expense unless the promoter says a different amount was actually paid, and ask first.
WORKING LIST (JSON): ${JSON.stringify(ledger)}`;
}

/** What the UI shows: the show's working list, if the thread is about a show. */
async function receiptsFor(supabase: Any, orgId: string, offerId: string | null | undefined) {
  if (!offerId) return null;
  const items = await loadLedger(supabase, offerId);
  if (!items.length) return null;
  const { data: o } = await supabase.from('offers').select('id, show:shows(event_name, artist_name)').eq('id', offerId).eq('organization_id', orgId).maybeSingle();
  return { offer_id: offerId, show: o?.show?.event_name || o?.show?.artist_name || 'Show', items };
}

interface NeedsItem { offer_id: string | null; title: string; detail: string; tag: string; tone: 'red' | 'amber' | 'blue'; link: string; rank: number }

/** The brief: everything below is arithmetic on the promoter's own rows. */
async function buildBrief(supabase: Any, orgId: string, firstName: string) {
  const [{ data: offers }, { data: settlements }, { data: tasks }] = await Promise.all([
    supabase.from('offers').select('*, show:shows(*)').eq('organization_id', orgId),
    supabase.from('settlements').select('offer_id').eq('organization_id', orgId),
    supabase.from('offer_tasks').select('*').eq('organization_id', orgId).eq('completed', false),
  ]);
  const settledIds = new Set((settlements || []).map((s: Any) => s.offer_id));
  const all: Any[] = (offers || []).filter((o: Any) => o.show?.event_date);
  const live = all.filter((o) => o.status !== 'cancelled');
  const nameOf = (o: Any) => o.show?.event_name || o.show?.artist_name || o.artist_name || 'Show';

  const needs: NeedsItem[] = [];
  const upcoming: Any[] = [];
  let cashTotal = 0, cashArtist = 0, cashVenue = 0, cashMarketing = 0, committed = 0;

  for (const o of live) {
    const days = daysFromToday(o.show.event_date);
    const settled = o.status === 'settled' || settledIds.has(o.id);
    const link = `/offers/${o.id}`;
    const name = nameOf(o);

    if (days < 0 && o.status === 'planning') continue; // a sketch that never happened; nothing to settle
    if (days < 0 && !settled) {
      needs.push({ offer_id: o.id, title: name, detail: `Show was ${-days} day${days === -1 ? '' : 's'} ago and is not settled`, tag: 'SETTLE', tone: 'amber', link: `${link}/settlement`, rank: 20 + Math.min(-days, 60) / 60 });
      continue;
    }
    if (days < 0) continue;

    // A planning show is a sketch: its cash is counted (budgeted is budgeted)
    // and its tasks nag, but it gets no bad-night flag and sits out of
    // "coming up" until it moves to offer_sent / confirmed / active.
    const isPlanning = o.status === 'planning';
    const read = survivalRead(o);
    const artistDeposit = num(o.guarantee) * (num(o.deposit_pct) / 100);
    const venueDeposit = num(o.venue_deposit);
    const marketing = Object.values(o.expenses?.marketing || {}).reduce((s: number, v) => s + num(v), 0);
    const artistPaid = o.artist_deposit_status === 'paid';
    const venuePaid = o.venue_deposit_status === 'paid';
    const stillToPay = (artistPaid ? 0 : artistDeposit) + (venuePaid ? 0 : venueDeposit) + marketing;
    committed += 1; cashTotal += stillToPay;
    cashArtist += artistPaid ? 0 : artistDeposit; cashVenue += venuePaid ? 0 : venueDeposit; cashMarketing += marketing;

    if (!isPlanning) upcoming.push({
      offer_id: o.id, title: name, venue: o.show?.venue_name || '', date: o.show.event_date, when: niceDate(o.show.event_date), days,
      verdict: read.verdict, profit_full: read.atFull.profit, profit_50: read.at50.profit, link,
    });

    if (days <= 7) {
      if (artistDeposit > 0 && !artistPaid) needs.push({ offer_id: o.id, title: name, detail: `Artist deposit ${money(artistDeposit)} still marked unpaid`, tag: days === 0 ? 'TODAY' : `${days} DAY${days === 1 ? '' : 'S'}`, tone: 'red', link, rank: days });
      if (venueDeposit > 0 && !venuePaid) needs.push({ offer_id: o.id, title: name, detail: `Venue deposit ${money(venueDeposit)} still marked unpaid`, tag: days === 0 ? 'TODAY' : `${days} DAY${days === 1 ? '' : 'S'}`, tone: 'red', link, rank: days });
    }
    if (isPlanning) continue;
    if (read.verdict === 'UNDERWATER') needs.push({ offer_id: o.id, title: name, detail: `Even a sellout loses ${money(-read.atFull.profit)}`, tag: 'UNDERWATER', tone: 'red', link, rank: 10 });
    else if (read.verdict === 'FRAGILE') needs.push({ offer_id: o.id, title: name, detail: `At 50% sold it loses ${money(-read.at50.profit)}`, tag: 'FRAGILE', tone: 'amber', link, rank: 15 });
  }

  for (const t of tasks || []) {
    if (!t.due_date) continue;
    const d = daysFromToday(t.due_date);
    if (d < 0) {
      const o = live.find((x) => x.id === t.offer_id);
      needs.push({ offer_id: t.offer_id, title: t.title, detail: `${o ? nameOf(o) + ' · ' : ''}due ${-d} day${d === -1 ? '' : 's'} ago`, tag: 'OVERDUE', tone: 'amber', link: t.offer_id ? `/offers/${t.offer_id}` : '/offers', rank: 5 + Math.min(-d, 30) / 30 });
    }
  }

  needs.sort((a, b) => a.rank - b.rank);
  upcoming.sort((a, b) => a.days - b.days);
  const next30 = upcoming.filter((u) => u.days <= 30).length;
  const next = upcoming[0];

  const hour = new Date().getUTCHours() - 5; // rough US Central; the greeting is not a clock
  const greet = hour < 12 && hour >= 4 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const headline = [
    needs.length === 0 ? 'Nothing needs you right now.' : `${needs.length} thing${needs.length === 1 ? '' : 's'} need${needs.length === 1 ? 's' : ''} you today.`,
    next ? (next.days === 0 ? `Show tonight: ${next.title}.` : `Next show in ${next.days} day${next.days === 1 ? '' : 's'}.`) : 'No shows on the calendar.',
  ].join(' ');

  return {
    greeting: `${greet}, ${firstName}.`,
    headline,
    needs_you: needs.slice(0, 8),
    upcoming: upcoming.slice(0, 6),
    next30,
    cash: { total: cashTotal, artist: cashArtist, venue: cashVenue, marketing: cashMarketing, shows: committed },
    open_tasks: (tasks || []).map((t: Any) => ({ id: t.id, offer_id: t.offer_id, title: t.title, due_date: t.due_date, priority: t.priority })),
    offers_index: live.map((o) => ({ id: o.id, name: nameOf(o), artist: o.show?.artist_name || '', venue: o.show?.venue_name || '', date: o.show?.event_date, status: o.status, counted: o.status !== 'planning', settled: o.status === 'settled' || settledIds.has(o.id), capacity: num(o.show?.capacity), projected_profit: num(o.calculations?.netProfit), guarantee: num(o.guarantee), deal_type: o.deal_type })),
  };
}

// ---------- tools the model can use ----------

/** Connector tools the assistant may call, with the wording the model sees. */
const CONNECTOR_TOOLS: Record<string, string> = {
  get_offer: 'Read one offer in full: deal terms, ticket tiers, every expense line, lineup, deposits, tasks, notes, settlement. Use it before answering anything detailed about a show, and before changing one.',
  calculate_deal: 'Run the deal math on numbers WITHOUT saving anything. Use it for "what if" and "how can we make this work": try a lower guarantee, a percentage deal, a different ticket price, fewer costs. Pass offer_id to start from a saved offer, or pass the numbers from the deal on the table. Returns profit at 50/70/85/100% sold, break-even, and risk.',
  create_offer: 'Create a DRAFT offer (status planning) from the deal on the table or from what the promoter told you. Call this ONLY after the promoter has said, in this same message, to save it ("save it", "create it", "add it", "yes make the offer"). Needs artist_name, venue_name, event_date (YYYY-MM-DD) and capacity; if any is missing, ask instead of guessing. Never call it because a deal looks complete.',
  update_offer: 'Change an existing offer: deal terms, ticket tiers (replaces the full list -- pass every tier), expenses (only the lines you pass change), status, show details. Call this ONLY when the promoter has asked for that specific change in this same message ("bump GA to $35", "add $500 security", "mark the deposit paid"). Say exactly what changed.',
  preview_settlement: 'Settlement math for a show using actual tickets sold and actual expenses. With save=false it only shows the result. With save=true it records the settlement and marks the show settled -- ONLY when the promoter has said to record or settle it in this same message.',
};

const LOCAL_TOOLS = [
  {
    name: 'update_receipts',
    description: 'Put receipts, payments and counts for ONE show on its working list. Send the FULL item for each id you touch; a known id is replaced, a new id is added, ids you do not mention are left alone. Short ids like "sec1". offer_id is the show from LIVE SHOWS (ask if unsure which). Never guesses: an item you are not sure about is status "question" with one question.',
    input_schema: {
      type: 'object',
      properties: {
        offer_id: { type: 'string' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              label: { type: 'string', description: 'Plain name as the promoter would say it: "Security", "Facebook ads", "Sound tech".' },
              amount: { type: ['number', 'null'], description: 'Exactly as the source states it. Null if the source does not state it.' },
              category: { type: 'string', description: "One of the show's categories in the context. When none fits, \"general\"." },
              source: { type: 'string', description: 'The file name, or "typed".' },
              status: { type: 'string', enum: ['ok', 'question'] },
              question: { type: ['string', 'null'], description: 'When status is question: the one thing you need to know.' },
              note: { type: ['string', 'null'], description: 'Only if a human should look: "Check this: ..." Never suggest wrongdoing.' },
              kind: { type: 'string', enum: ['expense', 'ticket_count', 'revenue_channel'], description: 'ticket_count: tier name in label, count in amount. revenue_channel: gross in amount, fees in fees.' },
              fees: { type: ['number', 'null'] },
            },
            required: ['id', 'label', 'amount', 'category', 'source', 'status', 'kind'],
          },
        },
        remove_ids: { type: 'array', items: { type: 'string' } },
      },
      required: ['offer_id', 'items'],
    },
  },
  {
    name: 'write_receipts',
    description: 'Write every "ok" item on the show\'s working list into its settlement (expenses, ticket counts, where the money came in). Call it ONLY after the promoter has said to in this same message ("write it", "put it in", "apply it", "looks good, go"). Never because the list looks done. If any item is still a question, say which instead and do not call this. Does not mark the show settled.',
    input_schema: { type: 'object', properties: { offer_id: { type: 'string' }, confirm: { type: 'boolean', description: 'Must be true.' } }, required: ['offer_id', 'confirm'] },
  },
  { name: 'complete_task', description: 'Check a task off. Use the task id from the context.', input_schema: { type: 'object', properties: { task_id: { type: 'string' } }, required: ['task_id'] } },
  { name: 'add_task', description: 'Add a task to a show. Keep the title short, in the promoter\'s words.', input_schema: { type: 'object', properties: { offer_id: { type: 'string' }, title: { type: 'string' }, due_date: { type: ['string', 'null'], description: 'YYYY-MM-DD or null' } }, required: ['offer_id', 'title'] } },
  { name: 'add_note', description: 'Pin a short note to a show.', input_schema: { type: 'object', properties: { offer_id: { type: 'string' }, text: { type: 'string' } }, required: ['offer_id', 'text'] } },
  {
    name: 'set_deal_on_table',
    description: 'Remember the deal you just structured from a document or from the conversation, so it stays on the table for follow-up questions and for "save it" later. Call it every time the deal changes (a new file, a corrected number, a what-if the promoter wants to keep). Only fields the document or the promoter actually stated; leave the rest out. This saves nothing to the app.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short: "Fuerza Regida — Kansas City — Nov 14"' },
        source: { type: 'string', description: 'Where it came from: the file name, or "conversation".' },
        deal: {
          type: 'object',
          description: 'The offer fields as the connector expects them (artist_name, venue_name, event_date, capacity, deal_type, guarantee, artist_percentage, deposit_pct, ticket_tiers, expenses, venue_deposit, doors_time, age_limit, ...). Only what is stated.',
          additionalProperties: true,
        },
        missing: { type: 'array', items: { type: 'string' }, description: 'What is still needed before it could be saved (capacity, ticket prices, venue cost...).' },
        checks: { type: 'array', items: { type: 'string' }, description: '"Check this: ..." lines. Numbers that do not add up, terms that are unusual. Never suggest wrongdoing.' },
      },
      required: ['title', 'deal'],
    },
  },
];

function modelTools(): Any[] {
  const fromConnector = Object.entries(CONNECTOR_TOOLS).map(([name, description]) => {
    const t = toolMap.get(name);
    if (!t) throw new Error(`connector tool missing: ${name}`);
    return { name, description, input_schema: t.inputSchema };
  });
  return [...LOCAL_TOOLS, ...fromConnector];
}

const SYSTEM = `You are the assistant inside PROMOTER OS, a tool for independent concert promoters. You live in the Ask bar on every screen. The promoter talks to you like a partner: drops a deal PDF and says "structure this", asks "what does this event look like?", "how can we make this work?", "review this deal", or just "what needs me today?". You get them up to speed and you get things done.

WHAT YOU KNOW: the context in each message is the promoter's own shows, tasks, deposits, cash still to go out, the bad-night read on each upcoming show, and the deal on the table (if a document was structured in this thread). Every number comes from their offers or their documents. Use ONLY those numbers plus what the tools return. Never estimate, never fill a gap with a typical figure, never invent a fee, a cost, or a capacity. If a document does not state something, say it is not in the document and ask.

READING A DOCUMENT (a deal memo, an artist offer, a venue quote, a contract, a settlement, a screenshot):
1. Say in one line what it is.
2. Lay the deal out in short labeled lines the promoter can read on a phone: Artist, Date, Venue, Deal (flat / guarantee vs % / door), Guarantee, Deposit and when it is due, Balance and when, Splits, Tickets and prices if stated, Costs the document puts on the promoter, Cancellation and other terms that can hurt. Copy figures as printed; arithmetic only checks a figure, it never fills one.
3. Call set_deal_on_table with the fields, what is still missing, and any "check this" lines.
4. Give your read in two or three plain sentences: what the promoter is on the hook for, what protects them, what to push back on. Run calculate_deal when you have enough numbers to show what a bad night looks like; if you do not, ask for the one or two numbers you need (usually capacity and ticket price).
5. End by asking if they want it saved as a draft offer. Do not save until they say so.

HANDWRITTEN AND SPANISH SHEETS are normal -- a phone photo of a venue's cost list on paper is a real document; read it. Common words: Renta = venue rent; Trabajadores / Staff = workers; Policías / Seguridad = police or security; Aseguranza / Seguro = insurance; Sonido = sound; Luces = lights; Permisos (de alcohol) = permits / liquor permit; Promoción = marketing; Total. Copy each line as written. A range ("2500-3000") is a range: show both, and say which one the sheet's own total uses. A "?" or a blank is MISSING -- say so, never fill it. Check the sheet's total against its lines and say "check this" if it doesn't match. Use the venue costs as expense lines (venue, security, production, insurance, permits) and keep the artist separate. If you cannot make out a number, say which line and ask -- never guess a digit.

HOW CAN WE MAKE THIS WORK: use calculate_deal to try changes, one or two at a time -- a lower guarantee, a guarantee-versus-percentage deal, a different ticket price, a cost that can go, bar or other revenue if they have it. Report each as "at 50% sold: ... at 100%: ...". Compare to the deal as offered. Recommend the version that survives a half-full room. Nothing is saved by calculate_deal.

BAD-NIGHT READ: SAFE clears at 50% sold, TIGHT clears at 70%, FRAGILE needs more than 70%, UNDERWATER loses money even sold out. "Cash you need on hand" means deposits not yet paid plus marketing, before the doors open. Artist balances and night-of costs come out of the door and are NOT due now -- say so when asked. When something doesn't add up say "check this" and state the numbers; never suggest anyone is cheating, padding, or acting in bad faith -- it is usually a mistake and the promoter has to work with these people again.

RECEIPTS (closing out a show): when they drop receipts, invoices, Venmo/Zelle/Cash App screenshots, the venue's sheet, or type "paid security $200 cash", you are organizing a show's actuals. First be sure which show: use the thread's offer, or match the file to LIVE SHOWS, or ask. Then pull out each item (what, how much, who was paid) and put it on the working list with update_receipts -- one item per expense, never two receipts merged into one number. Copy, never compute: a receipt with subtotal, tax and total is the TOTAL paid; no stated amount = amount null, status question. Not sure what it was for, which category, or whether it is this show's at all = status question with ONE short question, and no category guess. A payment screenshot with only a name and amount is always a question unless the memo says what it was for. Same amount to the same person twice = keep one item, note "Check this: ... appears twice", ask if it was paid twice. Ticket counts and where the money came in (door cash, presale, bar) are items too (kind ticket_count / revenue_channel; tier names must match the show's tiers). After reading files say what you found, one line each ("Got the sound invoice: $850, production."), then your questions one at a time, most important first. The list is on their screen; do not read it back. Write it into the settlement with write_receipts ONLY when they say so in this message; if items are still questions, say which ones are waiting instead. After writing, say in one line what went in and link [Open settlement](/offers/<id>/settlement). The list stays after a write; more can be added and written again.

WHAT YOU CAN DO, and only when the promoter asks for it in the same message: create a draft offer (create_offer), change an offer (update_offer), record actual ticket counts and expenses (write_receipts after they are on the list; preview_settlement only when they ask to settle and close the show), check a task off, add a task, pin a note. Before a write, get_offer if you have not read the offer in this thread. After a write, say exactly what changed, in one line each, and link the page. Never change anything the promoter did not ask for. Never save a deal because it looks complete. If you are unsure which show they mean, ask.

HOW YOU TALK: plain words, short, like texting a partner who is busy and on their phone. No jargon, no headers, no long bullet walls. Money as $1,200. Name the show. For a structured deal, short labeled lines are right; for everything else, two to five sentences. When a page would help, end with ONE link in this exact form: [Open Sensación](/offers/<id>) or [Open settlement](/offers/<id>/settlement) or [Open tasks](/offers/<id>). Paths only, never a full URL.

NEVER: invent a figure, round a profit up, tell them a show is fine when the read says otherwise, save or change anything they did not ask for, or hide that something is missing.`;

function fileKind(name: string): { mime: string; isPdf: boolean } {
  const n = name.toLowerCase();
  if (n.endsWith('.pdf')) return { mime: 'application/pdf', isPdf: true };
  if (n.endsWith('.png')) return { mime: 'image/png', isPdf: false };
  if (n.endsWith('.webp')) return { mime: 'image/webp', isPdf: false };
  if (n.endsWith('.gif')) return { mime: 'image/gif', isPdf: false };
  return { mime: 'image/jpeg', isPdf: false };
}

/** What the bytes really are. Phones rename HEIC photos to .jpg; the name lies, the bytes don't. */
function sniff(bytes: Uint8Array): string | null {
  const b = bytes;
  if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45) return 'image/webp';
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'application/pdf';
  const brand = String.fromCharCode(...b.subarray(4, 12));
  if (brand.startsWith('ftyp') && /heic|heix|hevc|mif1|msf1|heif/.test(brand + String.fromCharCode(...b.subarray(12, 24)))) return 'image/heic';
  return null;
}

/** One file from storage as a content block the model can read, or a plain note saying why not. */
async function fileBlock(supabase: Any, imp: Any): Promise<Any> {
  if (num(imp.file_size) > MAX_FILE_BYTES) return { type: 'text', text: `[${imp.file_name} is over 12MB and could not be read. Ask the promoter for a smaller file or the key numbers.]` };
  const { data: file } = await supabase.storage.from('imports').download(imp.storage_path);
  if (!file) return { type: 'text', text: `[${imp.file_name} could not be loaded from storage. Ask the promoter to attach it again.]` };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniff(bytes) ?? fileKind(imp.file_name).mime;
  if (kind === 'image/heic') return { type: 'text', text: `[${imp.file_name} is an iPhone HEIC photo, which can't be read here. Ask the promoter to send it as a screenshot or JPG — or type the numbers.]` };
  const b64 = toBase64(bytes);
  return kind === 'application/pdf'
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 }, title: imp.file_name }
    : { type: 'image', source: { type: 'base64', media_type: kind, data: b64 } };
}

async function sha256hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(binary);
}

function summarizeToolResult(name: string, out: Any): string {
  // Keep tool results compact; the model does not need every decimal.
  const s = JSON.stringify(out);
  return s.length > 12_000 ? s.slice(0, 12_000) + ' …(truncated)' : s;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  // ---- SELF-TEST (operator only): run one model turn on a stored file, execute nothing. ----
  // Guarded by a random operator key; only its SHA-256 lives here.
  const stKey = req.headers.get('x-selftest-key');
  if (stKey && await sha256hex(stKey) === '1faea1bf7dee87f4a6b5bca358728d811b4eb597176f490d5c781064782994eb') {
    const b: Any = await req.json().catch(() => ({}));
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: imp } = await admin.from('document_imports').select('*').eq('id', String(b.import_id ?? '')).maybeSingle();
    if (!imp) return json({ error: 'no such import' }, 404);
    const content: Any[] = [{ type: 'text', text: 'CONTEXT: self-test, no live shows loaded.' }, { type: 'text', text: `File: ${imp.file_name}` }, await fileBlock(admin, imp), { type: 'text', text: String(b.message ?? 'Structure this.') }];
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: MAX_OUT, system: [{ type: 'text', text: SYSTEM }], tools: modelTools(), messages: [{ role: 'user', content }] }),
    });
    const out: Any = await res.json();
    return json({
      status: res.status, stop_reason: out.stop_reason, usage: out.usage, block_kind: content[2]?.type, media_type: content[2]?.source?.media_type,
      text: (out.content || []).filter((c: Any) => c.type === 'text').map((c: Any) => c.text).join('\n'),
      tool_calls: (out.content || []).filter((c: Any) => c.type === 'tool_use').map((c: Any) => ({ name: c.name, input: c.input })),
      error: out.error,
    });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Sign in first.' }, 401);
  const token = authHeader.slice(7).trim();
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: 'Sign in first.' }, 401);

  let body: Any;
  try { body = await req.json(); } catch { return json({ error: 'Body must be JSON' }, 400); }

  const { data: member } = await supabase.from('organization_members').select('organization_id').eq('user_id', user.id).eq('is_active', true).limit(1).maybeSingle();
  const orgId = member?.organization_id;
  if (!orgId) return json({ error: 'No organization on this account yet.' }, 400);

  const { data: profile } = await supabase.from('company_settings').select('contact_name, company_name').eq('organization_id', orgId).maybeSingle();
  const firstName = String(profile?.contact_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'there').split(' ')[0];

  const listThreads = async () => {
    const { data } = await supabase.from('ask_threads').select('id, title, offer_id, last_message_at, deal_on_table').eq('user_id', user.id).order('last_message_at', { ascending: false }).limit(THREAD_LIMIT);
    return (data || []).map((t: Any) => ({ id: t.id, title: t.title, offer_id: t.offer_id, last_message_at: t.last_message_at, has_deal: !!t.deal_on_table }));
  };
  const threadMessages = async (threadId: string) => {
    const { data } = await supabase.from('ask_messages').select('id, role, content, changed, attachments, created_at').eq('thread_id', threadId).eq('user_id', user.id).order('created_at', { ascending: true }).limit(200);
    return data || [];
  };

  // ---- THREAD: free. Messages of one conversation. ----
  if (body?.action === 'thread' && body.thread_id) {
    const { data: t } = await supabase.from('ask_threads').select('*').eq('id', body.thread_id).eq('user_id', user.id).maybeSingle();
    if (!t) return json({ error: 'That chat was not found.' }, 404);
    return json({ ok: true, thread: { id: t.id, title: t.title, offer_id: t.offer_id, deal_on_table: t.deal_on_table, receipts: await receiptsFor(supabase, orgId, t.offer_id) }, messages: await threadMessages(t.id) });
  }

  const message = (body?.message ?? '').toString().trim();
  const importIds: string[] = Array.isArray(body?.import_ids) ? body.import_ids.slice(0, MAX_FILES) : [];

  // ---- BRIEF: free. ----
  if (!message && importIds.length === 0) {
    const brief = await buildBrief(supabase, orgId, firstName);
    const credits = await creditStatus(supabase, orgId);
    return json({ ok: true, brief, credits, threads: await listThreads() });
  }

  // ---- CHAT: 1 credit, 2 with files. ----
  if (!ANTHROPIC_KEY) return json({ error: 'Ask is not configured on this server yet.' }, 503);
  const cost = importIds.length ? CREDIT_COST.chat_with_files : CREDIT_COST.chat_text;
  const afford = await canAfford(supabase, orgId, cost);
  if (!afford.ok) return json(outOfCredits(afford.status, cost), 402);

  // The thread. New when none given.
  let thread: Any = null;
  if (body?.thread_id) {
    const { data: t } = await supabase.from('ask_threads').select('*').eq('id', body.thread_id).eq('user_id', user.id).maybeSingle();
    if (!t) return json({ error: 'That chat was not found.' }, 404);
    thread = t;
  } else {
    const title = (message || 'New chat').replace(/\s+/g, ' ').slice(0, 60);
    const { data: t, error } = await supabase.from('ask_threads').insert({ organization_id: orgId, user_id: user.id, title, offer_id: body?.offer_id || null }).select('*').single();
    if (error || !t) return json({ error: 'Could not start the chat.' }, 500);
    thread = t;
  }

  // Attachments: the files this message came with, read straight from storage.
  const fileBlocks: Any[] = [];
  const attachments: { import_id: string; file_name: string }[] = [];
  for (const id of importIds) {
    const { data: imp } = await supabase.from('document_imports').select('*').eq('id', id).eq('organization_id', orgId).maybeSingle();
    if (!imp) continue;
    fileBlocks.push({ type: 'text', text: `File: ${imp.file_name}` }, await fileBlock(supabase, imp));
    attachments.push({ import_id: imp.id, file_name: imp.file_name });
    await supabase.from('document_imports').update({ status: 'extracting', kind: 'ask' }).eq('id', imp.id);
  }
  if (attachments.length && thread.title === 'New chat') {
    await supabase.from('ask_threads').update({ title: attachments[0].file_name.replace(/\.[a-z0-9]+$/i, '').slice(0, 60) }).eq('id', thread.id);
  }

  const brief = await buildBrief(supabase, orgId, firstName);
  const credits = await creditStatus(supabase, orgId);
  const { data: history } = await supabase.from('ask_messages').select('role, content, attachments').eq('thread_id', thread.id).order('created_at', { ascending: false }).limit(HISTORY_LIMIT);
  const past = (history || []).reverse().map((m: Any) => ({
    role: m.role,
    content: (m.attachments?.length ? `[attached: ${m.attachments.map((a: Any) => a.file_name).join(', ')}]\n` : '') + (m.content || '(no text)'),
  }));

  // Follow-ups ("where is it?", "add the artist") need the file again: history only carries its
  // name. Re-attach this thread's most recent files (up to MAX_FILES in all) so the model can
  // still read them. Jose, Oct 20: a cost sheet photo was "unreadable" on the second message.
  if (fileBlocks.length < MAX_FILES * 2) {
    const earlier: { import_id: string; file_name: string }[] = [];
    for (const m of (history || []) as Any[]) {          // newest first
      if (m.role !== 'user' || !Array.isArray(m.attachments)) continue;
      for (const a of m.attachments) if (a?.import_id && !earlier.some((e) => e.import_id === a.import_id)) earlier.push(a);
    }
    const room = MAX_FILES - attachments.length;
    for (const a of earlier.slice(0, Math.max(0, room))) {
      const { data: imp } = await supabase.from('document_imports').select('*').eq('id', a.import_id).eq('organization_id', orgId).maybeSingle();
      if (!imp) continue;
      fileBlocks.push({ type: 'text', text: `Earlier file in this chat (sent again so you can read it): ${imp.file_name}` }, await fileBlock(supabase, imp));
    }
  }

  const { offers_index, open_tasks, ...briefForModel } = brief;
  const settlementState = thread.offer_id ? await loadSettlementState(supabase, orgId, thread.offer_id) : null;
  const context = `TODAY: ${new Date().toISOString().slice(0, 10)}
BRIEF (already shown on screen): ${JSON.stringify(briefForModel)}
LIVE SHOWS (id, name, venue, date, status, deal; counted=false means status planning: a sketch NOT in totals or projections until it moves to offer_sent/confirmed/active): ${JSON.stringify(offers_index)}
OPEN TASKS: ${JSON.stringify(open_tasks)}
${thread.offer_id ? `THIS THREAD IS ABOUT OFFER: ${thread.offer_id}\n` : ''}${settlementState ? receiptsContext(settlementState) + '\n' : ''}${thread.deal_on_table ? `DEAL ON THE TABLE (structured earlier in this thread, NOT saved as an offer): ${JSON.stringify(thread.deal_on_table)}\n` : ''}CREDITS LEFT: ${credits?.total_left ?? '?'}`;

  const userContent: Any[] = [{ type: 'text', text: `CONTEXT (refreshed every message):\n${context}` }, ...fileBlocks, { type: 'text', text: message || 'Here is the file. Tell me what it is and lay the deal out.' }];
  const messages: Any[] = [...past, { role: 'user', content: userContent }];

  await supabase.from('ask_messages').insert({ organization_id: orgId, user_id: user.id, thread_id: thread.id, role: 'user', content: message, attachments });

  // Connector context: the promoter's own session, RLS and all. Writes go
  // through the same code as the Claude connector.
  const ctx = await loadCtx(token);
  if (ctx) ctx.inApp = true;

  let inTok = 0, outTok = 0, reply = '';
  let truncatedOnce = false;
  const changed: string[] = [];
  let dealOnTable: Any = thread.deal_on_table;
  let wrote = false;
  const tools = modelTools();

  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: MODEL, max_tokens: MAX_OUT, system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }], tools, messages }),
      });
      if (!res.ok) {
        console.error('Anthropic error', res.status, (await res.text()).slice(0, 300));
        return json({ error: res.status === 401 ? 'The AI key was rejected. Check it in Supabase settings.' : 'Ask could not answer just now. Try again.' }, 502);
      }
      const out = await res.json();
      const u = out.usage ?? {};
      inTok += (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
      outTok += u.output_tokens ?? 0;
      const content: Any[] = out.content || [];
      const text = content.filter((c) => c.type === 'text').map((c) => c.text).join('\n').trim();
      if (text) reply += (reply ? '\n\n' : '') + text;
      const uses = content.filter((c) => c.type === 'tool_use');
      // Cut off mid-answer (a long deal written into a tool call). The tool call is incomplete
      // and can't be run; ask again with the instruction to work in smaller steps.
      if (out.stop_reason === 'max_tokens' && !truncatedOnce) {
        truncatedOnce = true;
        const kept = content.filter((c) => c.type === 'text' && c.text?.trim());
        if (kept.length) messages.push({ role: 'assistant', content: kept });
        messages.push({ role: 'user', content: [{ type: 'text', text: '(system) Your last reply was cut off before it finished. Do it again in smaller steps: lay the deal out in short lines first, then make one tool call at a time with only the fields that are stated.' }] });
        continue;
      }
      if (uses.length === 0 || out.stop_reason !== 'tool_use') break;
      messages.push({ role: 'assistant', content });
      const results: Any[] = [];
      for (const tu of uses) {
        let result = 'Done.';
        try {
          if (tu.name === 'update_receipts') {
            const offerId = String(tu.input?.offer_id || thread.offer_id || '');
            const st = offerId ? await loadSettlementState(supabase, orgId, offerId) : null;
            if (!st) result = 'That show was not found. Pick one from LIVE SHOWS or ask the promoter which show this is.';
            else {
              const incoming: LedgerItem[] = Array.isArray(tu.input?.items) ? tu.input.items : [];
              const removeIds: string[] = Array.isArray(tu.input?.remove_ids) ? tu.input.remove_ids : [];
              const byId = new Map(st.ledger.map((i) => [i.id, i]));
              for (const it of incoming) {
                if (!it?.id) continue;
                const amount = it.amount == null ? null : Number(it.amount);
                byId.set(String(it.id), {
                  id: String(it.id), label: String(it.label || 'Unnamed').slice(0, 80),
                  amount: Number.isFinite(amount as number) ? amount : null,
                  category: st.categories.includes(it.category) ? it.category : 'general',
                  source: String(it.source || 'typed').slice(0, 120),
                  status: it.status === 'question' || amount == null ? 'question' : 'ok',
                  question: it.question ?? null, note: it.note ?? null,
                  kind: it.kind === 'ticket_count' || it.kind === 'revenue_channel' ? it.kind : 'expense',
                  fees: it.fees == null ? null : Number(it.fees),
                });
              }
              for (const id of removeIds) byId.delete(id);
              const items = [...byId.values()];
              await saveLedger(supabase, orgId, offerId, items);
              if (thread.offer_id !== offerId) { await supabase.from('ask_threads').update({ offer_id: offerId }).eq('id', thread.id); thread.offer_id = offerId; }
              result = `List now has ${items.length} items, ${items.filter((i) => i.status === 'question').length} waiting on an answer.`;
            }
          } else if (tu.name === 'write_receipts') {
            const offerId = String(tu.input?.offer_id || thread.offer_id || '');
            const st = offerId ? await loadSettlementState(supabase, orgId, offerId) : null;
            const pending = st ? st.ledger.filter((i) => i.status === 'question') : [];
            if (!st) result = 'That show was not found.';
            else if (!tu.input?.confirm) result = 'Not written: confirm must be true.';
            else if (pending.length) result = `Not written: ${pending.length} item(s) still need an answer: ${pending.map((p) => p.label).join(', ')}.`;
            else {
              const ok = st.ledger.filter((i) => i.status === 'ok');
              const { offer, settlement } = st;
              // Same rules as the settlement page's applyFromChat: expenses merge
              // by label, counts match the tier name, channels replace.
              const expenses: Any = settlement?.actual_expenses && Object.keys(settlement.actual_expenses).length
                ? JSON.parse(JSON.stringify(settlement.actual_expenses))
                : Object.fromEntries(Object.entries(offer.expenses || {}).map(([c, lines]: [string, Any]) => [c, Object.fromEntries(Object.keys(lines || {}).map((k) => [k, 0]))]));
              let nExp = 0;
              for (const i of ok.filter((x) => x.kind === 'expense')) {
                const cat = expenses[i.category] !== undefined ? i.category : 'general';
                const key = i.label.toLowerCase().trim().replace(/\s+/g, '_');
                expenses[cat] = { ...(expenses[cat] || {}), [key]: num(i.amount) };
                nExp++;
              }
              const prev: Any[] = Array.isArray(settlement?.actual_attendance) ? settlement.actual_attendance : [];
              const counts = ok.filter((x) => x.kind === 'ticket_count');
              const unknown = counts.filter((c) => !(offer.ticket_tiers || []).some((t: Any) => String(t.type).toLowerCase().trim() === c.label.toLowerCase().trim()));
              if (unknown.length) {
                result = `Not written: no ticket tier called ${unknown.map((u) => `"${u.label}"`).join(', ')}. This show's tiers are: ${(offer.ticket_tiers || []).map((t: Any) => t.type).join(', ')}. Fix the item label and try again.`;
              } else {
                const attendance = (offer.ticket_tiers || []).map((t: Any) => {
                  const hit = counts.find((c) => c.label.toLowerCase().trim() === String(t.type).toLowerCase().trim());
                  const was = prev.find((p) => p.type === t.type);
                  return { type: t.type, price: num(t.price), actual_sold: hit ? num(hit.amount) : num(was?.actual_sold), projected_sold: num(t.allotment) - num(t.comps) };
                });
                const channels = ok.filter((x) => x.kind === 'revenue_channel').map((c, i) => ({ id: `rc_chat_${i}`, label: c.label, gross: num(c.amount), fees: num(c.fees) }));
                const totals = settlementActuals(offer, attendance, expenses);
                const row: Any = {
                  offer_id: offerId, organization_id: orgId, user_id: user.id,
                  actual_attendance: attendance, actual_expenses: expenses, ...totals,
                  ...(channels.length ? { actual_revenue_channels: channels } : {}),
                  notes: settlement?.notes ?? '',
                };
                const { error } = settlement?.id
                  ? await supabase.from('settlements').update(row).eq('id', settlement.id)
                  : await supabase.from('settlements').insert(row);
                if (error) { console.error('write_receipts', error); result = 'Could not write the settlement. Try again.'; }
                else {
                  const name = offer.show?.event_name || offer.show?.artist_name || 'the show';
                  result = `Written to the ${name} settlement: ${nExp} expenses, ${counts.length} ticket counts, ${channels.length} revenue channels. Not marked settled.`;
                  changed.push(`Wrote ${nExp} expenses${counts.length ? `, ${counts.length} ticket counts` : ''}${channels.length ? `, ${channels.length} revenue channels` : ''} into the ${name} settlement`);
                  wrote = true;
                }
              }
            }
          } else if (tu.name === 'complete_task') {
            const { data, error } = await supabase.from('offer_tasks').update({ completed: true, updated_at: new Date().toISOString() }).eq('id', tu.input.task_id).eq('organization_id', orgId).select('title').maybeSingle();
            if (error || !data) result = 'That task was not found.'; else { result = `Checked off: ${data.title}`; changed.push(result); wrote = true; }
          } else if (tu.name === 'add_task') {
            const ok = brief.offers_index.some((o) => o.id === tu.input.offer_id);
            if (!ok) result = 'That show was not found.';
            else {
              const { error } = await supabase.from('offer_tasks').insert({ organization_id: orgId, offer_id: tu.input.offer_id, title: String(tu.input.title).slice(0, 140), due_date: tu.input.due_date || null, completed: false, priority: 'medium' });
              result = error ? 'Could not add the task.' : `Added task: ${tu.input.title}`; if (!error) { changed.push(result); wrote = true; }
            }
          } else if (tu.name === 'add_note') {
            const ok = brief.offers_index.some((o) => o.id === tu.input.offer_id);
            if (!ok) result = 'That show was not found.';
            else {
              const { data: row } = await supabase.from('offer_notes').select('id, pinned_notes').eq('offer_id', tu.input.offer_id).maybeSingle();
              const note = { id: `n_${Date.now()}`, text: String(tu.input.text).slice(0, 500), createdAt: new Date().toISOString() };
              const pinned = [...(Array.isArray(row?.pinned_notes) ? row.pinned_notes : []), note];
              const { error } = row
                ? await supabase.from('offer_notes').update({ pinned_notes: pinned, updated_at: new Date().toISOString() }).eq('id', row.id)
                : await supabase.from('offer_notes').insert({ organization_id: orgId, offer_id: tu.input.offer_id, event_notes: '', pinned_notes: pinned });
              result = error ? 'Could not add the note.' : `Pinned note: ${note.text}`; if (!error) { changed.push(result); wrote = true; }
            }
          } else if (tu.name === 'set_deal_on_table') {
            dealOnTable = { title: tu.input.title, source: tu.input.source || 'conversation', deal: tu.input.deal || {}, missing: tu.input.missing || [], checks: tu.input.checks || [], updated_at: new Date().toISOString() };
            await supabase.from('ask_threads').update({ deal_on_table: dealOnTable, title: String(tu.input.title || thread.title).slice(0, 60) }).eq('id', thread.id);
            result = 'Deal is on the table for this thread (not saved as an offer).';
          } else if (CONNECTOR_TOOLS[tu.name]) {
            if (!ctx) result = 'Your session could not be verified. Sign out and back in.';
            else {
              const tool = toolMap.get(tu.name)!;
              const out = await tool.run(ctx, tu.input || {});
              result = summarizeToolResult(tu.name, out);
              const o: Any = out || {};
              if (tu.name === 'create_offer' && o.created) {
                changed.push(`Created draft offer: ${o.artist || tu.input.artist_name} at ${o.venue || tu.input.venue_name} on ${o.event_date || tu.input.event_date}`);
                wrote = true;
                if (o.offer_id) await supabase.from('ask_threads').update({ offer_id: o.offer_id, deal_on_table: null }).eq('id', thread.id);
                thread.offer_id = o.offer_id || thread.offer_id; dealOnTable = null;
              } else if (tu.name === 'update_offer' && o.updated) {
                changed.push(`Updated ${o.artist || 'the offer'}: ${(o.changed_fields || []).join(', ')}`);
                wrote = true;
              } else if (tu.name === 'preview_settlement' && tu.input?.save) {
                changed.push('Recorded the settlement and marked the show settled');
                wrote = true;
              }
            }
          } else result = 'Unknown tool.';
        } catch (e) {
          result = e instanceof UserError ? e.message : 'That did not go through.';
          if (!(e instanceof UserError)) console.error(tu.name, e);
        }
        results.push({ type: 'tool_result', tool_use_id: tu.id, content: result });
      }
      messages.push({ role: 'user', content: results });
    }
  } catch (e) {
    console.error('ask failed', e);
    return json({ error: 'Something went wrong. Try again.' }, 500);
  }

  const usd = Number((inTok * PRICE_IN + outTok * PRICE_OUT).toFixed(5));
  // Never a silent "Got it." — if there is no answer, say so.
  if (!reply.trim()) reply = changed.length ? changed.join(' ') : "I didn't finish that one — my answer got cut off. Send it again (or just say \"go on\") and I'll pick it up.";
  await supabase.from('ask_messages').insert({ organization_id: orgId, user_id: user.id, thread_id: thread.id, role: 'assistant', content: reply.trim(), changed, input_tokens: inTok, output_tokens: outTok, cost_usd: usd });
  await supabase.from('ask_threads').update({ last_message_at: new Date().toISOString() }).eq('id', thread.id);
  for (const a of attachments) await supabase.from('document_imports').update({ status: 'extracted', engine: 'anthropic', extracted_at: new Date().toISOString() }).eq('id', a.import_id);
  const creditsLeft = await spendCredits(supabase, orgId, cost, importIds.length ? 'ask_files' : 'ask', user.id, thread.offer_id || null, usd);

  const { data: t2 } = await supabase.from('ask_threads').select('id, title, offer_id, deal_on_table').eq('id', thread.id).maybeSingle();
  const fresh = wrote ? await buildBrief(supabase, orgId, firstName) : brief;
  const receipts = await receiptsFor(supabase, orgId, t2?.offer_id || thread.offer_id);
  return json({
    ok: true, reply: reply.trim(), changed, brief: fresh, credits_left: creditsLeft, cost_usd: usd,
    thread: t2 ? { id: t2.id, title: t2.title, offer_id: t2.offer_id, deal_on_table: t2.deal_on_table, receipts } : { id: thread.id, title: thread.title, offer_id: thread.offer_id, deal_on_table: dealOnTable, receipts },
    threads: await listThreads(),
  });
});
