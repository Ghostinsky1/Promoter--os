import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { CREDIT_COST, canAfford, spendCredits, outOfCredits, creditStatus } from '../_shared/credits.ts';
import { survivalRead } from '../_shared/downside.ts';

/**
 * PROMOTER OS — "Ask". The bar in the middle of every screen.
 *
 * Two modes.
 *
 * BRIEF (free, no model): what needs the promoter today, what is coming up,
 * what cash has to be on hand. Plain arithmetic on their own offers, tasks
 * and settlements. Runs on every app open. Costs nothing, invents nothing.
 *
 * CHAT (1 credit a message): the promoter asks in their own words. The model
 * gets the same brief plus a compact list of every live show and open task,
 * and three small tools -- check a task off, add a task, pin a note to a show.
 * It can never touch money, deals, or settlements, and it always says what it
 * changed. Everything in HOW-IT-THINKS.md applies.
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const MODEL = 'claude-sonnet-5';
const PRICE_IN = 2 / 1_000_000, PRICE_OUT = 10 / 1_000_000;
const HISTORY_LIMIT = 20;
const MAX_ROUNDS = 4;

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

    if (days < 0 && !settled) {
      needs.push({ offer_id: o.id, title: name, detail: `Show was ${-days} day${days === -1 ? '' : 's'} ago and is not settled`, tag: 'SETTLE', tone: 'amber', link: `${link}/settlement`, rank: 20 + Math.min(-days, 60) / 60 });
      continue;
    }
    if (days < 0) continue;

    // Upcoming: survival read and cash still to go out.
    const read = survivalRead(o);
    const artistDeposit = num(o.guarantee) * (num(o.deposit_pct) / 100);
    const venueDeposit = num(o.venue_deposit);
    const marketing = Object.values(o.expenses?.marketing || {}).reduce((s: number, v) => s + num(v), 0);
    const artistPaid = o.artist_deposit_status === 'paid';
    const venuePaid = o.venue_deposit_status === 'paid';
    const stillToPay = (artistPaid ? 0 : artistDeposit) + (venuePaid ? 0 : venueDeposit) + marketing;
    committed += 1; cashTotal += stillToPay;
    cashArtist += artistPaid ? 0 : artistDeposit; cashVenue += venuePaid ? 0 : venueDeposit; cashMarketing += marketing;

    upcoming.push({
      offer_id: o.id, title: name, venue: o.show?.venue_name || '', date: o.show.event_date, when: niceDate(o.show.event_date), days,
      verdict: read.verdict, profit_full: read.atFull.profit, profit_50: read.at50.profit, link,
    });

    if (days <= 7) {
      if (artistDeposit > 0 && !artistPaid) needs.push({ offer_id: o.id, title: name, detail: `Artist deposit ${money(artistDeposit)} still marked unpaid`, tag: days === 0 ? 'TODAY' : `${days} DAY${days === 1 ? '' : 'S'}`, tone: 'red', link, rank: days });
      if (venueDeposit > 0 && !venuePaid) needs.push({ offer_id: o.id, title: name, detail: `Venue deposit ${money(venueDeposit)} still marked unpaid`, tag: days === 0 ? 'TODAY' : `${days} DAY${days === 1 ? '' : 'S'}`, tone: 'red', link, rank: days });
    }
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
    offers_index: live.map((o) => ({ id: o.id, name: nameOf(o), venue: o.show?.venue_name || '', date: o.show?.event_date, status: o.status, settled: o.status === 'settled' || settledIds.has(o.id), projected_profit: num(o.calculations?.netProfit), guarantee: num(o.guarantee) })),
  };
}

const TOOLS = [
  { name: 'complete_task', description: 'Check a task off. Use the task id from the context.', input_schema: { type: 'object', properties: { task_id: { type: 'string' } }, required: ['task_id'] } },
  { name: 'add_task', description: 'Add a task to a show. Keep the title short, in the promoter\'s words.', input_schema: { type: 'object', properties: { offer_id: { type: 'string' }, title: { type: 'string' }, due_date: { type: ['string', 'null'], description: 'YYYY-MM-DD or null' } }, required: ['offer_id', 'title'] } },
  { name: 'add_note', description: 'Pin a short note to a show.', input_schema: { type: 'object', properties: { offer_id: { type: 'string' }, text: { type: 'string' } }, required: ['offer_id', 'text'] } },
];

const SYSTEM = `You are the Ask bar inside PROMOTER OS, a tool for concert promoters. The promoter is busy and on their phone. You get them up to speed and handle small things.

WHAT YOU KNOW: the context in each message is the promoter's own shows, tasks, deposits, cash still to go out, and the bad-night read on each upcoming show. Every number in it comes from their own offers. Use ONLY those numbers. Never estimate, never fill a gap with a typical figure. If it isn't in the context, say you don't have it and where in the app it lives.

HOW YOU TALK: plain words, short, like texting a partner. Two to four sentences. Numbers as money ($1,200). Name the show. No headers, no bullet walls, no jargon. When a page would help, end with ONE link in this exact form: [Open Sensación](/offers/<id>) or [Open settlement](/offers/<id>/settlement) or [Open tasks](/offers/<id>). Paths only, never a full URL.

MONEY TALK: "cash you need on hand" means deposits not yet paid plus marketing, before the doors open. Artist balances and night-of costs (security, production) come out of the door and are NOT due now -- say so when asked. A show's bad-night read: SAFE clears at 50% sold, TIGHT clears at 70%, FRAGILE needs more than 70%, UNDERWATER loses money even sold out. When something doesn't add up say "check this" and state the numbers; never suggest anyone is cheating.

WHAT YOU CAN DO: check a task off, add a task, pin a note -- only when the promoter asks, only with the tools, and always say exactly what you changed. You cannot change deals, deposits, prices, expenses, or settlements; when asked, say which page does that and link it.

NEVER: invent a figure, round a profit up, tell them a show is fine when the read says otherwise, or do anything they didn't ask for.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Sign in first.' }, 401);
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

  const brief = await buildBrief(supabase, orgId, firstName);
  const credits = await creditStatus(supabase, orgId);

  // ---- BRIEF: free. ----
  const message = (body?.message ?? '').toString().trim();
  if (!message) {
    const { data: history } = await supabase.from('ask_messages').select('id, role, content, created_at').eq('organization_id', orgId).eq('user_id', user.id).order('created_at', { ascending: false }).limit(HISTORY_LIMIT);
    return json({ ok: true, brief, credits, history: (history || []).reverse() });
  }

  // ---- CHAT: 1 credit. ----
  if (!ANTHROPIC_KEY) return json({ error: 'Ask is not configured on this server yet.' }, 503);
  const afford = await canAfford(supabase, orgId, CREDIT_COST.chat_text);
  if (!afford.ok) return json(outOfCredits(afford.status, CREDIT_COST.chat_text), 402);

  const { data: history } = await supabase.from('ask_messages').select('role, content').eq('organization_id', orgId).eq('user_id', user.id).order('created_at', { ascending: false }).limit(HISTORY_LIMIT);
  const past = (history || []).reverse().map((m: Any) => ({ role: m.role, content: m.content || '(no text)' }));
  const { offers_index, open_tasks, ...briefForModel } = brief;
  const context = `TODAY: ${new Date().toISOString().slice(0, 10)}
BRIEF (already shown on screen): ${JSON.stringify(briefForModel)}
LIVE SHOWS: ${JSON.stringify(offers_index)}
OPEN TASKS: ${JSON.stringify(open_tasks)}
CREDITS LEFT: ${credits?.total_left ?? '?'}`;
  const messages: Any[] = [...past, { role: 'user', content: [{ type: 'text', text: `CONTEXT (refreshed every message):\n${context}` }, { type: 'text', text: message }] }];

  await supabase.from('ask_messages').insert({ organization_id: orgId, user_id: user.id, role: 'user', content: message });

  let inTok = 0, outTok = 0, reply = '';
  const changed: string[] = [];
  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: MODEL, max_tokens: 1200, system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }], tools: TOOLS, messages }),
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
      reply += content.filter((c) => c.type === 'text').map((c) => c.text).join('\n');
      const uses = content.filter((c) => c.type === 'tool_use');
      if (uses.length === 0 || out.stop_reason !== 'tool_use') break;
      messages.push({ role: 'assistant', content });
      const results: Any[] = [];
      for (const tu of uses) {
        let result = 'Done.';
        try {
          if (tu.name === 'complete_task') {
            const { data, error } = await supabase.from('offer_tasks').update({ completed: true, updated_at: new Date().toISOString() }).eq('id', tu.input.task_id).eq('organization_id', orgId).select('title').maybeSingle();
            if (error || !data) result = 'That task was not found.'; else { result = `Checked off: ${data.title}`; changed.push(result); }
          } else if (tu.name === 'add_task') {
            const ok = brief.offers_index.some((o) => o.id === tu.input.offer_id);
            if (!ok) result = 'That show was not found.';
            else {
              const { error } = await supabase.from('offer_tasks').insert({ organization_id: orgId, offer_id: tu.input.offer_id, title: String(tu.input.title).slice(0, 140), due_date: tu.input.due_date || null, completed: false, priority: 'medium' });
              result = error ? 'Could not add the task.' : `Added task: ${tu.input.title}`; if (!error) changed.push(result);
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
              result = error ? 'Could not add the note.' : `Pinned note: ${note.text}`; if (!error) changed.push(result);
            }
          } else result = 'Unknown tool.';
        } catch (e) { result = 'That did not go through.'; console.error(e); }
        results.push({ type: 'tool_result', tool_use_id: tu.id, content: result });
      }
      messages.push({ role: 'user', content: results });
    }
  } catch (e) {
    console.error('ask failed', e);
    return json({ error: 'Something went wrong. Try again.' }, 500);
  }

  const cost = Number((inTok * PRICE_IN + outTok * PRICE_OUT).toFixed(5));
  if (!reply.trim()) reply = changed.length ? changed.join(' ') : 'Got it.';
  await supabase.from('ask_messages').insert({ organization_id: orgId, user_id: user.id, role: 'assistant', content: reply.trim(), changed, input_tokens: inTok, output_tokens: outTok, cost_usd: cost });
  const creditsLeft = await spendCredits(supabase, orgId, CREDIT_COST.chat_text, 'ask', user.id, null, cost);

  // The brief may have moved (a task got checked off). Send it fresh.
  const fresh = changed.length ? await buildBrief(supabase, orgId, firstName) : brief;
  return json({ ok: true, reply: reply.trim(), changed, brief: fresh, credits_left: creditsLeft, cost_usd: cost });
});
