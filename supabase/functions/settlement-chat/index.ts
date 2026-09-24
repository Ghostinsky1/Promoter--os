import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

/**
 * PROMOTER OS — the settlement chat.
 *
 * The promoter drops receipts, payment screenshots, venue sheets, or just
 * types "paid security $200 cash", and talks it through. The assistant keeps a
 * WORKING LIST (the ledger) of every item it has seen, sorted into the show's
 * expense categories. When something is unclear it asks -- one question per
 * item -- and nothing gets a category until the promoter answers.
 *
 * It writes to the settlement ONLY when the promoter says so in the chat
 * ("looks good", "apply it", "write it"). Jose chose this over a review table.
 * That makes the rule about not guessing more important, not less: an item
 * the assistant is unsure about stays a question, it never becomes a number.
 *
 * Every rule in HOW-IT-THINKS.md applies here. In particular:
 *   - Copy, never compute. A receipt says $183.40 -> the item is $183.40.
 *   - "Check this", never "they are stealing".
 *   - Plain language. Short. No jargon.
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

const MODEL = 'claude-sonnet-5';
const ALLOWED_TIERS = new Set(['pro', 'agency_scale']);
const PRICE_IN = 2 / 1_000_000;
const PRICE_OUT = 10 / 1_000_000;
const HISTORY_LIMIT = 30;
const MAX_ROUNDS = 5;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

// deno-lint-ignore no-explicit-any
type Any = any;

export interface LedgerItem {
  id: string;
  label: string;
  amount: number | null;
  category: string;
  /** Where it came from: a file name, or "typed". */
  source: string;
  /** ok = ready to write. question = waiting on the promoter. */
  status: 'ok' | 'question';
  question?: string | null;
  /** Something to look at, in "check this" language. Optional. */
  note?: string | null;
  kind: 'expense' | 'ticket_count' | 'revenue_channel';
  /** ticket_count: the tier name in `label`, count in `amount`. revenue_channel: gross in `amount`, fees in `fees`. */
  fees?: number | null;
}

const TOOLS = [
  {
    name: 'update_items',
    description:
      'Add or change items on the working list. Send the FULL item for each id you touch; an id already on the list is replaced, a new id is added. Use short ids like "sec1". Items you do not mention are left alone.',
    input_schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              label: { type: 'string', description: 'Plain name, as the promoter would say it. "Security", "Facebook ads", "Sound tech".' },
              amount: { type: ['number', 'null'], description: 'Exactly as the source states it. Null if the source does not state it.' },
              category: { type: 'string', description: 'One of the show\'s categories given in the context. When none fits, "general".' },
              source: { type: 'string' },
              status: { type: 'string', enum: ['ok', 'question'] },
              question: { type: ['string', 'null'], description: 'When status is question: the one thing you need to know, in one sentence.' },
              note: { type: ['string', 'null'], description: 'Only if something needs a human eye. "Check this: ..." Never suggest wrongdoing.' },
              kind: { type: 'string', enum: ['expense', 'ticket_count', 'revenue_channel'] },
              fees: { type: ['number', 'null'] },
            },
            required: ['id', 'label', 'amount', 'category', 'source', 'status', 'kind'],
          },
        },
        remove_ids: { type: 'array', items: { type: 'string' }, description: 'Ids to take off the list (duplicates, things the promoter says do not belong).' },
      },
      required: ['items'],
    },
  },
  {
    name: 'write_to_settlement',
    description:
      'Write every item with status "ok" into the settlement. Call this ONLY after the promoter has clearly said to, in this same message ("looks good", "apply it", "write it", "yes do it"). Never call it because the list looks complete. If any item is still a question, say so instead and do not call this.',
    input_schema: {
      type: 'object',
      properties: {
        confirm: { type: 'boolean', description: 'Must be true.' },
      },
      required: ['confirm'],
    },
  },
];

const SYSTEM = `You are the settlement helper inside PROMOTER OS, a tool for concert promoters. The promoter is closing out a show: they drop receipts, invoices, screenshots of Venmo/Zelle/Cash App/bank payments, the venue's sheet, or just type what they paid. Your job is to organize all of it into the show's expense categories on a working list, ask when something is unclear, and -- only when they tell you to -- write the list into the settlement.

HOW YOU WORK
- Every file or line they give you: pull out each item (what, how much, who was paid) and put it on the list with update_items. One item per expense. Never merge two receipts into one number.
- Copy, never compute. The amount is what the source states. If a receipt shows a subtotal, tax and total, the item is the TOTAL paid. If nothing states an amount, amount is null and status is question.
- When you are not sure where an item goes, or what it is, or whether it belongs to this show at all: status "question", with ONE short question. Do not guess a category for it. Common questions: "Is the $450 to Marco for security or for the door?" "This Zelle to Ana is $300 -- was that the DJ or the photographer?" "Is this Uber for the artist or for you?"
- A payment screenshot with just a name and amount is always a question unless the memo says what it was for.
- If the same amount to the same person shows up twice, keep ONE item and put a note: "Check this: $200 to Luis appears twice (receipt and Zelle)." Ask if it was paid twice.
- Ticket counts and where money came in (bar, door cash, presale) are also items, with kind ticket_count or revenue_channel. Ticket tier names must match the show's tiers given in the context.
- Things that are NOT this show's expenses (personal, another show, the artist's own costs the promoter is not paying): ask once; if confirmed, remove them.

HOW YOU TALK
- Plain words, short. Like texting a partner who is busy. No jargon, no headers, no bullet walls. Two to four sentences is normal.
- After reading files, say what you found in one line each ("Got the sound invoice: $850, production.") then ask your questions, one at a time if there are several, most important first.
- When the paperwork doesn't add up, say "check this" and state the numbers. NEVER say or imply anyone is stealing, cheating, or padding. You see one document; you don't know what was agreed.
- The list on screen is the source of truth; don't repeat the whole list back in words.

WRITING TO THE SETTLEMENT
- Only when the promoter says so in this message. Words like "looks good", "apply it", "write it", "put it in", "done", "yes" (to your offer) count. A list that merely looks finished does not.
- If items are still questions, do not write. Say which ones are waiting.
- When you do write, say so in one line and what went in ("Wrote 9 expenses and the ticket counts into the settlement.").
- After writing, the list stays; new items can still be added and written again.

NEVER
- Invent a cost. Never fill an amount the source doesn't state.
- Change an amount to make totals match.
- Write to the settlement on your own judgement.`;

async function planOf(supabase: Any, organizationId: string): Promise<string> {
  const { data } = await supabase.from('organizations').select('subscription_tier').eq('id', organizationId).maybeSingle();
  return data?.subscription_tier ?? 'starter';
}

function toB64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(binary);
}

function mimeOf(name: string): { mime: string; isPdf: boolean } {
  const n = name.toLowerCase();
  if (n.endsWith('.pdf')) return { mime: 'application/pdf', isPdf: true };
  if (n.endsWith('.png')) return { mime: 'image/png', isPdf: false };
  if (n.endsWith('.webp')) return { mime: 'image/webp', isPdf: false };
  if (n.endsWith('.gif')) return { mime: 'image/gif', isPdf: false };
  return { mime: 'image/jpeg', isPdf: false };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (!ANTHROPIC_KEY) return json({ error: 'The settlement chat is not configured on this server yet.' }, 503);

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Sign in first.' }, 401);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: 'Sign in first.' }, 401);

  let body: Any;
  try { body = await req.json(); } catch { return json({ error: 'Body must be JSON' }, 400); }
  const offerId: string = body?.offer_id;
  const message: string = (body?.message ?? '').toString().trim();
  const importIds: string[] = Array.isArray(body?.import_ids) ? body.import_ids : [];
  if (!offerId) return json({ error: 'offer_id is required' }, 400);
  if (!message && importIds.length === 0) return json({ error: 'Say something or attach a file.' }, 400);

  // The offer, and proof this user belongs to its organization.
  const { data: offer } = await supabase.from('offers').select('*').eq('id', offerId).maybeSingle();
  if (!offer) return json({ error: 'That show could not be found.' }, 404);
  const { data: member } = await supabase
    .from('organization_members').select('organization_id')
    .eq('user_id', user.id).eq('organization_id', offer.organization_id).maybeSingle();
  if (!member) return json({ error: 'That show belongs to another account.' }, 403);

  const tier = await planOf(supabase, offer.organization_id);
  if (!ALLOWED_TIERS.has(tier)) {
    return json({ error: 'The settlement chat is on the Pro and Agency Scale plans.', upgrade: true }, 402);
  }

  const orgId = offer.organization_id;

  // Context: show, categories, tiers, what is already on the settlement, the ledger, and history.
  const { data: show } = await supabase.from('shows').select('artist_name, venue_name, event_date').eq('id', offer.show_id).maybeSingle();
  const { data: settlement } = await supabase.from('settlements').select('actual_expenses, actual_attendance').eq('offer_id', offerId).maybeSingle();
  const { data: ledgerRow } = await supabase.from('settlement_chat_ledgers').select('items').eq('offer_id', offerId).maybeSingle();
  const { data: history } = await supabase
    .from('settlement_chat_messages').select('role, content, attachments')
    .eq('offer_id', offerId).order('created_at', { ascending: false }).limit(HISTORY_LIMIT);

  let ledger: LedgerItem[] = Array.isArray(ledgerRow?.items) ? ledgerRow.items : [];

  const categories = Object.keys({ ...(offer.expenses || {}), ...((settlement?.actual_expenses as Any) || {}) });
  if (!categories.includes('general')) categories.push('general');
  const existingLines = Object.entries((settlement?.actual_expenses as Any) || offer.expenses || {})
    .map(([cat, lines]: [string, Any]) => `${cat}: ${Object.keys(lines || {}).join(', ') || '(none)'}`)
    .join('\n');
  const tiers = (offer.ticket_tiers || []).map((t: Any) => `${t.type} ($${t.price})`).join(', ');

  const context = `SHOW: ${show?.artist_name ?? offer.artist_name ?? '?'} at ${show?.venue_name ?? '?'} on ${show?.event_date ?? '?'}
EXPENSE CATEGORIES ON THIS SHOW: ${categories.join(', ')}
LINES ALREADY ON THE SETTLEMENT (category: lines):
${existingLines || '(none yet)'}
TICKET TIERS: ${tiers || '(none)'}
ARTIST DEAL: ${offer.deal_type ?? 'flat_fee'}, guarantee $${offer.guarantee ?? 0} (the artist's fee is handled by the app; do NOT add it as an expense unless the promoter says a different amount was actually paid, and then ask first).

WORKING LIST RIGHT NOW (JSON):
${JSON.stringify(ledger)}`;

  // Attach the new files.
  const attachments: { import_id: string; file_name: string }[] = [];
  const fileBlocks: Any[] = [];
  for (const id of importIds.slice(0, 10)) {
    const { data: imp } = await supabase.from('document_imports').select('*').eq('id', id).maybeSingle();
    if (!imp || imp.organization_id !== orgId) continue;
    const { data: file } = await supabase.storage.from('imports').download(imp.storage_path);
    if (!file) continue;
    const b64 = toB64(new Uint8Array(await file.arrayBuffer()));
    const { mime, isPdf } = mimeOf(imp.file_name);
    fileBlocks.push({ type: 'text', text: `File: ${imp.file_name}` });
    fileBlocks.push(isPdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } }
      : { type: 'image', source: { type: 'base64', media_type: mime, data: b64 } });
    attachments.push({ import_id: imp.id, file_name: imp.file_name });
    await supabase.from('document_imports').update({ status: 'extracting', kind: 'chat' }).eq('id', imp.id);
  }

  // Conversation so far, oldest first. Earlier files are not re-sent; what
  // came out of them lives on the working list.
  const past = (history || []).reverse().map((m: Any) => ({
    role: m.role,
    content: (m.attachments?.length
      ? `[attached: ${m.attachments.map((a: Any) => a.file_name).join(', ')}]\n` : '') + (m.content || '(no text)'),
  }));

  const userContent: Any[] = [
    { type: 'text', text: `CONTEXT (refreshed every message):\n${context}` },
    ...fileBlocks,
    { type: 'text', text: message || '(files attached, no message)' },
  ];
  const messages: Any[] = [...past, { role: 'user', content: userContent }];

  // Record the promoter's message first, so a failed reply doesn't lose it.
  await supabase.from('settlement_chat_messages').insert({
    organization_id: orgId, offer_id: offerId, user_id: user.id, role: 'user',
    content: message, attachments,
  });

  let inTok = 0, outTok = 0;
  let reply = '';
  let apply: Any = null;

  const upsertLedger = async () => {
    await supabase.from('settlement_chat_ledgers').upsert({
      offer_id: offerId, organization_id: orgId, items: ledger, updated_at: new Date().toISOString(),
    });
  };

  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 2500,
          system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
          tools: TOOLS,
          messages,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        console.error('Anthropic error', res.status, t.slice(0, 400));
        return json({ error: res.status === 401
          ? 'The AI key was rejected. Check it in Supabase settings.'
          : 'The assistant could not answer just now. Try again.' }, 502);
      }
      const out = await res.json();
      const u = out.usage ?? {};
      inTok += (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
      outTok += u.output_tokens ?? 0;

      const content: Any[] = out.content || [];
      reply += content.filter((c) => c.type === 'text').map((c) => c.text).join('\n');
      const toolUses = content.filter((c) => c.type === 'tool_use');
      if (toolUses.length === 0 || out.stop_reason !== 'tool_use') break;

      messages.push({ role: 'assistant', content });
      const results: Any[] = [];
      for (const tu of toolUses) {
        if (tu.name === 'update_items') {
          const incoming: LedgerItem[] = Array.isArray(tu.input?.items) ? tu.input.items : [];
          const removeIds: string[] = Array.isArray(tu.input?.remove_ids) ? tu.input.remove_ids : [];
          const byId = new Map(ledger.map((i) => [i.id, i]));
          for (const it of incoming) {
            if (!it?.id) continue;
            const amount = it.amount == null ? null : Number(it.amount);
            byId.set(it.id, {
              id: String(it.id),
              label: String(it.label || 'Unnamed'),
              amount: Number.isFinite(amount as number) ? amount : null,
              category: categories.includes(it.category) ? it.category : 'general',
              source: String(it.source || 'typed'),
              status: it.status === 'question' || amount == null ? 'question' : 'ok',
              question: it.question ?? null,
              note: it.note ?? null,
              kind: it.kind === 'ticket_count' || it.kind === 'revenue_channel' ? it.kind : 'expense',
              fees: it.fees == null ? null : Number(it.fees),
            });
          }
          for (const id of removeIds) byId.delete(id);
          ledger = [...byId.values()];
          await upsertLedger();
          results.push({ type: 'tool_result', tool_use_id: tu.id, content: `List now has ${ledger.length} items, ${ledger.filter((i) => i.status === 'question').length} waiting on an answer.` });
        } else if (tu.name === 'write_to_settlement') {
          const pending = ledger.filter((i) => i.status === 'question');
          if (!tu.input?.confirm || pending.length > 0) {
            results.push({ type: 'tool_result', tool_use_id: tu.id, is_error: true,
              content: pending.length
                ? `Not written: ${pending.length} item(s) still need an answer: ${pending.map((p) => p.label).join(', ')}.`
                : 'Not written: confirm must be true.' });
          } else {
            const ok = ledger.filter((i) => i.status === 'ok');
            apply = {
              expenses: ok.filter((i) => i.kind === 'expense').map((i) => ({ label: i.label, amount: i.amount ?? 0, category: i.category })),
              ticket_counts: ok.filter((i) => i.kind === 'ticket_count').map((i) => ({ type: i.label, sold: i.amount ?? 0 })),
              revenue_channels: ok.filter((i) => i.kind === 'revenue_channel').map((i) => ({ label: i.label, gross: i.amount ?? 0, fees: i.fees ?? 0 })),
            };
            results.push({ type: 'tool_result', tool_use_id: tu.id,
              content: `Written: ${apply.expenses.length} expenses, ${apply.ticket_counts.length} ticket counts, ${apply.revenue_channels.length} revenue channels.` });
          }
        } else {
          results.push({ type: 'tool_result', tool_use_id: tu.id, is_error: true, content: 'Unknown tool.' });
        }
      }
      messages.push({ role: 'user', content: results });
    }
  } catch (e) {
    console.error('settlement-chat failed', e);
    return json({ error: 'Something went wrong. Try again.' }, 500);
  }

  const cost = Number((inTok * PRICE_IN + outTok * PRICE_OUT).toFixed(5));
  if (!reply.trim()) reply = apply ? 'Written to the settlement.' : 'Got it.';

  await supabase.from('settlement_chat_messages').insert({
    organization_id: orgId, offer_id: offerId, user_id: user.id, role: 'assistant',
    content: reply.trim(), attachments: [], applied: !!apply,
    input_tokens: inTok, output_tokens: outTok, cost_usd: cost,
  });
  for (const a of attachments) {
    await supabase.from('document_imports').update({ status: 'extracted', engine: 'anthropic', extracted_at: new Date().toISOString() }).eq('id', a.import_id);
  }

  return json({ ok: true, reply: reply.trim(), ledger, apply, cost_usd: cost });
});
