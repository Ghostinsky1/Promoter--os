import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { STEPS, END, H, plain, type Any, type Episode, type Lead, type Step } from './steps.ts';

/**
 * PROMOTER OS — "Before You Send the Deposit" live emails.
 *
 * mode "welcome" → the /live/ page calls this on register: saves the lead, records the
 *                  registration, sends the confirmation right away.
 * mode "run"     → pg_cron calls this every 10 minutes and it sends whatever is due.
 *
 * The sequence (Brunson's webinar shape, Jose Oct 14):
 *   confirm  → right away: you're in, the link, homework (reply with your deal), 7-day trial
 *   story1-3 → one a day after registering (indoctrination), never inside the last 36 hours
 *   remind24 / morning / hour / live → the show-up sequence
 *   replay / day2 / last / final     → replay up for 72h + the registrant-only Pro deal
 *
 * Every (episode, lead, step) is unique in live_emails, so "run" can be called by anyone,
 * any number of times, and never double-sends. Each step has a window; a step whose window
 * has passed is skipped, so a late cron never sends "we start in an hour" the next morning.
 * Deal emails skip anyone whose organization already pays (email_is_paying).
 *
 * Episode facts (start, deal end, deal label) live in public.live_episodes. The page's
 * EVENT_START must match starts_at.
 *
 * Secrets: SENDGRID_API_KEY. Optional: SENDGRID_FROM_EMAIL, SENDGRID_FROM_NAME.
 */

const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY');
const FROM_EMAIL = Deno.env.get('SENDGRID_FROM_EMAIL') ?? 'support@gozaentertainment.com';
const FROM_NAME = Deno.env.get('SENDGRID_FROM_NAME') ?? 'PROMOTER OS';
const REPLY_TO = 'jhuaroco@gozaentertainment.com';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;


function cors(body: unknown, status = 200) {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': '*' };
  if (status === 204) return new Response(null, { status, headers });
  return new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
}


async function send(e: Episode, l: Lead, s: Step) {
  const name = (l.first_name ?? '').trim();
  const { html } = s.render(e, name, l.email);
  // Claim the step first; the unique index makes a second runner lose here.
  const { error: claimErr } = await supabase.from('live_emails').insert({ episode: e.episode, lead_id: l.id, step: s.key, status: 'sending' });
  if (claimErr) return { ok: false, skipped: true };
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: l.email }] }],
      from: { email: FROM_EMAIL, name: FROM_NAME },
      reply_to: { email: REPLY_TO, name: 'Jose Huaroco' },
      subject: s.subject(e),
      content: [{ type: 'text/plain', value: plain(html) }, { type: 'text/html', value: html }],
      tracking_settings: { subscription_tracking: { enable: true } },
      categories: ['live', `live-${e.episode}`, `live-${e.episode}-${s.key}`],
    }),
  });
  const ok = res.ok;
  const detail = ok ? null : (await res.text()).slice(0, 500);
  await supabase.from('live_emails').update({ status: ok ? 'sent' : 'failed', detail, sent_at: new Date().toISOString() })
    .eq('episode', e.episode).eq('lead_id', l.id).eq('step', s.key);
  return { ok, detail };
}

async function episodeFor(key: string): Promise<Episode | null> {
  const { data } = await supabase.from('live_episodes').select('*').eq('episode', key).maybeSingle();
  return data as Episode | null;
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return cors({}, 204);
    if (req.method !== 'POST') return cors({ error: 'Method not allowed' }, 405);
    if (!SENDGRID_API_KEY) return cors({ error: 'Email is not configured (SENDGRID_API_KEY missing).' }, 500);
    const body = await req.json().catch(() => ({}));
    const mode = String(body.mode ?? 'welcome');

    /* ---------- someone registered on /live/ ---------- */
    if (mode === 'welcome') {
      const email = String(body.email ?? '').trim().toLowerCase();
      if (!EMAIL_RE.test(email) || email.length > 254) return cors({ error: 'invalid_email' }, 400);
      const epKey = String(body.episode ?? 'ep01').slice(0, 20);
      const e = await episodeFor(epKey);
      if (!e) return cors({ error: 'unknown_episode' }, 400);
      const source = `live_${e.episode}`;

      const { error: capErr } = await supabase.rpc('capture_lead', {
        p_email: email,
        p_first_name: body.first_name ? String(body.first_name).slice(0, 80) : null,
        p_promoter_type: body.promoter_type ? String(body.promoter_type).slice(0, 40) : null,
        p_language: 'en', p_source: source,
        p_utm_source: body.utm_source ?? null, p_utm_medium: body.utm_medium ?? null,
        p_utm_campaign: body.utm_campaign ?? null, p_utm_content: body.utm_content ?? null,
        p_referrer: body.referrer ?? null,
      });
      if (capErr) return cors({ error: 'save_failed', detail: capErr.message }, 500);

      const { data: lead } = await supabase.from('leads').select('id, email, first_name').eq('email', email).eq('source', source).maybeSingle();
      if (!lead) return cors({ error: 'lead_not_found' }, 500);
      await supabase.from('live_registrations').upsert({ episode: e.episode, lead_id: lead.id }, { onConflict: 'episode,lead_id', ignoreDuplicates: true });
      const { data: reg } = await supabase.from('live_registrations').select('registered_at').eq('episode', e.episode).eq('lead_id', lead.id).maybeSingle();

      const confirm = STEPS[0];
      const r = await send(e, { ...lead, registered_at: reg?.registered_at ?? new Date().toISOString() }, confirm);
      return cors({ ok: true, emailed: r.ok });
    }

    /* ---------- every 10 minutes: whatever is due ---------- */
    if (mode === 'run') {
      const now = Date.now();
      const { data: eps } = await supabase.from('live_episodes').select('*');
      const out: Record<string, number> = { sent: 0, failed: 0 };
      for (const e of (eps ?? []) as Episode[]) {
        // Nothing to do a week after the deal ends.
        if (now > END(e) + 7 * 24 * H) continue;
        const { data: regs } = await supabase.from('live_registrations').select('lead_id, registered_at, leads(id, email, first_name)').eq('episode', e.episode);
        const { data: done } = await supabase.from('live_emails').select('lead_id, step').eq('episode', e.episode);
        const sent = new Set((done ?? []).map((d: Any) => `${d.lead_id}:${d.step}`));
        const paying = new Map<string, boolean>();
        for (const row of (regs ?? []) as Any[]) {
          const lead: Lead = { id: row.leads.id, email: row.leads.email, first_name: row.leads.first_name, registered_at: row.registered_at };
          for (const s of STEPS) {
            if (sent.has(`${lead.id}:${s.key}`)) continue;
            if (now < s.at(e, lead) || now > s.until(e, lead)) continue;
            if (s.when && !s.when(e, lead)) continue;
            if (s.deal) {
              if (!paying.has(lead.email)) {
                const { data: p } = await supabase.rpc('email_is_paying', { p_email: lead.email });
                paying.set(lead.email, !!p);
              }
              if (paying.get(lead.email)) continue;
            }
            const r = await send(e, lead, s);
            if (!r.skipped) out[r.ok ? 'sent' : 'failed']++;
            break; // one email per person per run: never two in the same minute
          }
        }
      }
      return cors({ ok: true, ...out });
    }

    return cors({ error: 'unknown_mode' }, 400);
  } catch (err) {
    return cors({ error: 'server_error', detail: String(err).slice(0, 300) }, 500);
  }
});
