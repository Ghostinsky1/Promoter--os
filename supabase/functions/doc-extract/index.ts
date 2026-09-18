import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

/**
 * PROMOTER OS — read an uploaded settlement.
 *
 * Follows EXTRACTION.md in this folder. The rules that matter most, restated
 * here because they are easy to erode by accident:
 *
 *   - We say "check this". We never say or imply anyone is stealing. It is
 *     usually a mistake, the promoter has to work with these people again, and
 *     we only ever see one document.
 *   - Copy, never compute. Arithmetic checks a figure, it never fills one.
 *   - A clean document returns an EMPTY flag list. Notes saying "matches
 *     exactly" cost money on every run and tell the promoter nothing.
 *   - Nothing here writes to a settlement. This returns a proposal; the
 *     promoter approves it on the review screen.
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

const MODEL = 'claude-sonnet-5';
const MAX_PAGES = 10;
const ALLOWED_TIERS = new Set(['pro', 'agency_scale']);
// Sonnet 5, $ per million tokens. Used only to tell the promoter what a scan cost.
const PRICE_IN = 2 / 1_000_000;
const PRICE_OUT = 10 / 1_000_000;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

type Any = any;

/** The shape the model fills in. Deliberately close to the settlements table. */
const SCHEMA = {
  name: 'settlement',
  description: 'The numbers exactly as printed on this settlement document.',
  input_schema: {
    type: 'object',
    properties: {
      document_kind: {
        type: 'string',
        enum: ['settlement', 'offer', 'invoice', 'contract', 'ticket_report', 'unknown'],
        description: 'What this document actually is. Only settlements are acted on.',
      },
      event_name: { type: ['string', 'null'] },
      artist_name: { type: ['string', 'null'] },
      venue_name: { type: ['string', 'null'] },
      event_date: { type: ['string', 'null'], description: 'YYYY-MM-DD. A date with no year takes the year of the event.' },
      ticket_tiers: {
        type: 'array',
        description: 'One entry per price level. Comps are their own entry with is_comp true and zero revenue.',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string' },
            price: { type: ['number', 'null'] },
            sold: { type: ['number', 'null'] },
            is_comp: { type: 'boolean' },
          },
          required: ['type', 'is_comp'],
        },
      },
      revenue_channels: {
        type: 'array',
        description: 'Where the money came in, if the document breaks it out at all. Otherwise empty.',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string' },
            gross: { type: ['number', 'null'] },
            fees: { type: ['number', 'null'] },
          },
          required: ['label'],
        },
      },
      expenses: {
        type: 'array',
        description: 'Every expense line as printed. Amounts positive.',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string' },
            amount: { type: ['number', 'null'] },
            category: { type: 'string', enum: ['venue', 'production', 'marketing', 'staffing', 'hospitality', 'travel', 'other'] },
          },
          required: ['label', 'category'],
        },
      },
      artist_payout: { type: ['number', 'null'], description: 'What the document says the artist was paid.' },
      stated_gross_revenue: { type: ['number', 'null'] },
      stated_total_expenses: { type: ['number', 'null'] },
      stated_net_profit: { type: ['number', 'null'] },
      flags: {
        type: 'array',
        description: 'ONLY things that need a human eye. A document that reconciles returns an empty list. Never note that something matches.',
        items: {
          type: 'object',
          properties: {
            field: { type: 'string', description: 'Which field this concerns.' },
            severity: { type: 'string', enum: ['check', 'unreadable', 'unusual'] },
            note: { type: 'string', description: 'One sentence, numbers included, under 20 words. State the arithmetic and stop. Never suggest wrongdoing.' },
          },
          required: ['field', 'severity', 'note'],
        },
      },
    },
    required: ['document_kind', 'ticket_tiers', 'expenses', 'flags'],
  },
};

const SYSTEM = `You read one concert settlement document and fill in the schema. Nothing else.

HOW YOU TALK ABOUT PROBLEMS — the rule that matters most:
When the paperwork does not add up you say "check this". You NEVER say or imply that anyone is
stealing, cheating, skimming, padding, or acting in bad faith. It is usually a mistake — tired
people doing arithmetic at 2am. The promoter has to work with these people again. And you only see
one document; you do not know what was agreed on the phone or waived later.
Say: "Stated $X, line items add to $Y, difference $Z." Then stop. The promoter draws the conclusion.

EXTRACTION:
- Copy, do not compute. Transcribe every figure as printed. Never derive a value the document does
  not state. Arithmetic is only for checking, never for filling.
- Missing means null. Never guess, never infer from a similar line.
- Comps are never paid tickets: own entry, is_comp true, no revenue.
- Expenses positive. Category ambiguous: use "other" and move on.
- Where a stated total and its line items disagree, KEEP THE STATED TOTAL and raise a check flag.
  Never quietly fix someone's paperwork.

FLAGS — cost rule as much as a noise rule:
Flag only: a stated total that does not equal its own line items (give both and the difference); a
payout that does not match the deal terms printed on the document; a percentage that does not
compute against the base it names; the same expense twice; comps counted inside paid tickets; a
value you could not read.
Do NOT flag anything that reconciles. Never write "matches exactly", "verified", or "consistent".
Silence means it checked out. A clean document returns an EMPTY flags array — that is the expected
result. Do not flag rounding under $1, formatting, or business judgement.

severity: check (does not reconcile) | unreadable (could not read it) | unusual (fine but odd —
lowest priority, never framed as wrongdoing). There is no fraud level.

One pass. No prose, no preamble, no restating the numbers. Reply only through the tool.`;

async function planOf(supabase: Any, organizationId: string): Promise<string> {
  const { data } = await supabase
    .from('organizations').select('subscription_tier').eq('id', organizationId).maybeSingle();
  return data?.subscription_tier ?? 'starter';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (!ANTHROPIC_KEY) return json({ error: 'Document scanning is not configured on this server yet.' }, 503);

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Sign in to scan a document.' }, 401);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: 'Sign in to scan a document.' }, 401);

  let body: Any;
  try { body = await req.json(); } catch { return json({ error: 'Body must be JSON' }, 400); }
  const importId: string = body?.import_id;
  if (!importId) return json({ error: 'import_id is required' }, 400);

  const { data: imp, error: impErr } = await supabase
    .from('document_imports').select('*').eq('id', importId).maybeSingle();
  if (impErr || !imp) return json({ error: 'That upload could not be found.' }, 404);

  // The member must belong to the org the file sits under.
  const { data: member } = await supabase
    .from('organization_members').select('organization_id')
    .eq('user_id', user.id).eq('organization_id', imp.organization_id).maybeSingle();
  if (!member) return json({ error: 'That upload belongs to another account.' }, 403);

  const tier = await planOf(supabase, imp.organization_id);
  if (!ALLOWED_TIERS.has(tier)) {
    return json({ error: 'Document scanning is on the Pro and Agency Scale plans.', upgrade: true }, 402);
  }

  await supabase.from('document_imports').update({ status: 'extracting' }).eq('id', importId);

  const fail = async (msg: string, status = 500) => {
    await supabase.from('document_imports').update({ status: 'failed', error: msg }).eq('id', importId);
    return json({ error: msg }, status);
  };

  try {
    const { data: file, error: dlErr } = await supabase.storage.from('imports').download(imp.storage_path);
    if (dlErr || !file) return await fail('The uploaded file could not be read back.');

    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    const b64 = btoa(binary);

    const isPdf = imp.file_name.toLowerCase().endsWith('.pdf');
    const mime = isPdf ? 'application/pdf'
      : imp.file_name.toLowerCase().endsWith('.png') ? 'image/png'
      : 'image/jpeg';

    const docBlock = isPdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } }
      : { type: 'image', source: { type: 'base64', media_type: mime, data: b64 } };

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4000,
        // The instructions and the schema are identical on every document, so
        // they are cached. At volume this is the single biggest saving.
        system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
        tools: [SCHEMA],
        tool_choice: { type: 'tool', name: 'settlement' },
        messages: [{
          role: 'user',
          content: [
            docBlock,
            { type: 'text', text: `Read this settlement and fill in the schema. Only the first ${MAX_PAGES} pages matter; skip riders, stage plots and blank pages.` },
          ],
        }],
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      console.error('Anthropic error', res.status, t.slice(0, 400));
      return await fail(res.status === 401
        ? 'The document scanning key was rejected. Check it in Supabase settings.'
        : 'The document could not be read. Try again, or type the numbers in by hand.');
    }

    const out = await res.json();
    const block = (out.content || []).find((c: Any) => c.type === 'tool_use');
    if (!block) return await fail('Nothing readable came back from the document.');

    const extracted = block.input ?? {};
    const usage = out.usage ?? {};
    const inTok = (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
    const outTok = usage.output_tokens ?? 0;
    const cost = inTok * PRICE_IN + outTok * PRICE_OUT;

    const flags = Array.isArray(extracted.flags) ? extracted.flags : [];

    await supabase.from('document_imports').update({
      status: 'extracted',
      engine: 'anthropic',
      kind: extracted.document_kind ?? 'unknown',
      extracted,
      flags,
      input_tokens: inTok,
      output_tokens: outTok,
      cost_usd: Number(cost.toFixed(5)),
      extracted_at: new Date().toISOString(),
      error: null,
    }).eq('id', importId);

    return json({
      ok: true,
      import_id: importId,
      kind: extracted.document_kind ?? 'unknown',
      extracted,
      flags,
      cost_usd: Number(cost.toFixed(5)),
    });
  } catch (e) {
    console.error('doc-extract failed', e);
    return await fail('Something went wrong reading that document.');
  }
});
