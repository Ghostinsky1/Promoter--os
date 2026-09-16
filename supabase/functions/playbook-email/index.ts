import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

/**
 * PROMOTER OS — playbook lead magnet email flow.
 *
 * mode "welcome"  → saves the lead and sends the playbook right away (called by /playbook/).
 * mode "run"      → sends the 3-day activation sequence to whoever is due (called hourly by pg_cron).
 *
 * "run" is safe to call by anyone: it only ever sends a step that is already due, and every
 * (lead, step) pair is written once thanks to a unique index, so it can never double-send.
 *
 * Secrets: SENDGRID_API_KEY. Optional: SENDGRID_FROM_EMAIL, SENDGRID_FROM_NAME.
 */

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY');
const FROM_EMAIL = Deno.env.get('SENDGRID_FROM_EMAIL') ?? 'support@gozaentertainment.com';
const FROM_NAME = Deno.env.get('SENDGRID_FROM_NAME') ?? 'PROMOTER OS';
const REPLY_TO = 'jhuaroco@gozaentertainment.com';

const SITE = 'https://promoteros.com';
const PDF = `${SITE}/playbook/promoter-booking-playbook.pdf`;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const BATCH = 100;

function cors(body: unknown, status = 200) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };
  if (status === 204) return new Response(null, { status, headers });
  return new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

function trialLink(email: string, step: number) {
  return `${SITE}/signup?email=${encodeURIComponent(email)}` +
    `&utm_source=playbook&utm_medium=email&utm_campaign=booking_playbook&utm_content=day${step}`;
}

/** Dark, brand-matched email shell. */
function shell(opts: { kicker: string; title: string; body: string; cta?: { text: string; href: string }; ps?: string }) {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#0B0D12;font-family:Arial,Helvetica,sans-serif;color:#E7EDF7;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0B0D12;padding:24px 0;">
<tr><td align="center">
  <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#14171E;border-radius:16px;overflow:hidden;border:1px solid #2A3040;">
    <tr><td style="background:#1140F0;padding:26px 30px;">
      <img src="${SITE}/promoter-os-lockup.png" width="160" alt="PROMOTER OS" style="display:block;width:160px;height:auto;border:0;margin-bottom:16px;">
      <div style="font-size:11px;letter-spacing:3px;color:#CFE4FF;text-transform:uppercase;">${esc(opts.kicker)}</div>
      <div style="font-size:26px;font-weight:900;color:#FFFFFF;line-height:1.12;margin-top:6px;text-transform:uppercase;">${esc(opts.title)}</div>
    </td></tr>
    <tr><td style="height:4px;background:#8FD3FF;"></td></tr>
    <tr><td style="padding:30px;font-size:16px;line-height:1.6;color:#D7E0EE;">
      ${opts.body}
      ${opts.cta ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:26px 0 6px 0;"><tr>
        <td style="background:#8FD3FF;border-radius:12px;">
          <a href="${opts.cta.href}" style="display:inline-block;padding:16px 30px;color:#04214D;font-size:16px;font-weight:bold;text-decoration:none;text-transform:uppercase;letter-spacing:.5px;">${esc(opts.cta.text)}</a>
        </td></tr></table>` : ''}
      ${opts.ps ? `<p style="margin:22px 0 0 0;color:#93A2B8;font-size:14px;">${opts.ps}</p>` : ''}
      <p style="margin:26px 0 0 0;color:#93A2B8;font-size:14px;">— Jose<br>Promoter OS</p>
    </td></tr>
    <tr><td style="padding:18px 30px;background:#0B0D12;border-top:1px solid #2A3040;font-size:11px;color:#6C7A90;line-height:1.7;">
      You're getting this because you downloaded The Promoter's Booking Playbook at promoteros.com.<br>
      <a href="${SITE}" style="color:#8FD3FF;text-decoration:none;">PROMOTEROS.COM</a> &nbsp;·&nbsp; <%asm_global_unsubscribe_raw_url%>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

type Step = { subject: string; html: (name: string, email: string) => string; text: (name: string) => string };

const hi = (n: string) => (n ? `Hey ${esc(n)},` : 'Hey,');

const STEPS: Record<number, Step> = {
  0: {
    subject: "Here's your Booking Playbook",
    html: (n) => shell({
      kicker: 'Free promoter playbook',
      title: 'Your playbook is ready',
      body: `<p style="margin:0 0 14px;">${hi(n)}</p>
<p style="margin:0 0 14px;">Here it is — twelve pages, seven steps, one real show followed from the first offer all the way to the final settlement.</p>
<p style="margin:0 0 14px;"><b style="color:#fff;">Start with step 1.</b> It's the number most promoters never run before they send an offer, and it's the reason a sold-out night can still lose money.</p>`,
      cta: { text: 'Download the playbook', href: PDF },
      ps: `Save it somewhere you'll find it on show day. Over the next three days I'll send you the three parts promoters tell me changed how they book.`,
    }),
    text: (n) => `${n ? `Hey ${n},` : 'Hey,'}\n\nHere's The Promoter's Booking Playbook: ${PDF}\n\nStart with step 1 — your break-even. It's the number most promoters never run before they send an offer.\n\n— Jose, Promoter OS`,
  },
  1: {
    subject: 'The one number that decides your next show',
    html: (n, e) => shell({
      kicker: 'Day 1 · Break-even',
      title: 'Know it before you make the offer',
      body: `<p style="margin:0 0 14px;">${hi(n)}</p>
<p style="margin:0 0 14px;">Break-even is the number of tickets you need to sell to cover every dollar you'll spend. If you don't know it, you're not making an offer — you're placing a bet.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0B0D12;border-left:5px solid #8FD3FF;border-radius:0 12px 12px 0;margin:0 0 14px;">
  <tr><td style="padding:18px 20px;">
    <div style="font-size:11px;letter-spacing:2px;color:#8FD3FF;text-transform:uppercase;margin-bottom:8px;">The formula</div>
    <div style="color:#fff;font-size:17px;font-weight:bold;">(Artist fee + All other costs) &divide; Your net per ticket</div>
    <div style="color:#93A2B8;margin-top:6px;">($5,000 + $7,000) &divide; $30 = <b style="color:#8FD3FF;">400 tickets</b></div>
  </td></tr>
</table>
<p style="margin:0 0 14px;">In a 700-cap room that's 57% of the house just to get to zero. Workable — but there's no room for a rainy night. The rule of thumb in the playbook: if break-even is more than 60% of capacity, the deal is too tight. Renegotiate the fee, trim costs, or raise prices <i>before</i> you send it.</p>
<p style="margin:0 0 14px;">Your next show has a different number. Plug it in and you'll have it in about a minute.</p>`,
      cta: { text: 'Run your break-even', href: trialLink(e, 1) },
    }),
    text: (n) => `${n ? `Hey ${n},` : 'Hey,'}\n\nBreak-even = (Artist fee + All other costs) / Your net per ticket.\n($5,000 + $7,000) / $30 = 400 tickets.\n\nIf break-even is more than 60% of capacity, the deal is too tight. Fix it before you send the offer.\n\n— Jose, Promoter OS`,
  },
  2: {
    subject: 'Same show, three deals, three very different paydays',
    html: (n, e) => shell({
      kicker: 'Day 2 · Deal types',
      title: 'The deal decides who carries the risk',
      body: `<p style="margin:0 0 14px;">${hi(n)}</p>
<p style="margin:0 0 14px;">Same artist. Same night. Here's what you keep under three common deals:</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-radius:12px;overflow:hidden;margin:0 0 14px;font-size:15px;">
  <tr style="background:#0B0D12;">
    <td style="padding:12px 14px;color:#8FD3FF;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;">Sold</td>
    <td style="padding:12px 14px;color:#8FD3FF;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;">Flat $5,000</td>
    <td style="padding:12px 14px;color:#8FD3FF;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;">$5k vs 70%</td>
    <td style="padding:12px 14px;color:#8FD3FF;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;">80/20 door</td>
  </tr>
  <tr style="background:#22262F;"><td style="padding:12px 14px;">400</td><td style="padding:12px 14px;">$0</td><td style="padding:12px 14px;">$0</td><td style="padding:12px 14px;">$1,000</td></tr>
  <tr style="background:#1B1F27;"><td style="padding:12px 14px;">550</td><td style="padding:12px 14px;color:#8FD3FF;"><b>$4,500</b></td><td style="padding:12px 14px;">$2,850</td><td style="padding:12px 14px;">$1,900</td></tr>
  <tr style="background:#22262F;"><td style="padding:12px 14px;">700</td><td style="padding:12px 14px;color:#8FD3FF;"><b>$9,000</b></td><td style="padding:12px 14px;">$4,200</td><td style="padding:12px 14px;">$2,800</td></tr>
</table>
<p style="margin:0 0 14px;">A flat guarantee pays you the most on a big night and hurts the most on a slow one. A door deal protects you but caps your upside. The mistake is picking from habit instead of running all three.</p>`,
      cta: { text: 'Compare your deals', href: trialLink(e, 2) },
    }),
    text: (n) => `${n ? `Hey ${n},` : 'Hey,'}\n\nSame show, 550 tickets: flat $5,000 deal keeps you $4,500. A $5k vs 70% deal keeps $2,850. An 80/20 door deal keeps $1,900.\n\nRun all three before you pick. Don't pick from habit.\n\n— Jose, Promoter OS`,
  },
  3: {
    subject: 'Your next show, with the math already done',
    html: (n, e) => shell({
      kicker: 'Day 3 · Put it to work',
      title: 'Everything in the playbook, built in',
      body: `<p style="margin:0 0 14px;">${hi(n)}</p>
<p style="margin:0 0 14px;">You've got the seven steps. Doing them by hand across texts, notes and spreadsheets is where the money leaks — that's mistake #10 in the playbook, and it's the one that causes the other nine.</p>
<p style="margin:0 0 14px;">Promoter OS runs all of it in one place:</p>
<ul style="margin:0 0 14px;padding-left:20px;color:#D7E0EE;">
  <li style="margin-bottom:7px;">Break-even and profit at every ticket level, before you send the offer</li>
  <li style="margin-bottom:7px;">Artist offer PDF and your internal version from the same deal, one click each</li>
  <li style="margin-bottom:7px;">Every deal type — flat, vs., door splits, bonuses, deposits</li>
  <li style="margin-bottom:7px;">Ticket tiers, deposits, tasks and run of show</li>
  <li style="margin-bottom:7px;">Settlement sheets you can print and get signed</li>
</ul>
<p style="margin:0 0 14px;">Seven days free. Put your next show in and see the numbers today.</p>`,
      cta: { text: 'Start your 7-day free trial', href: trialLink(e, 3) },
      ps: `If you'd rather just ask me a question about a deal you're working on, hit reply — it comes straight to me.`,
    }),
    text: (n) => `${n ? `Hey ${n},` : 'Hey,'}\n\nPromoter OS runs every step in the playbook in one place — break-even, deal types, offer PDFs, deposits, run of show and settlements.\n\n7 days free: ${SITE}/signup\n\n— Jose, Promoter OS`,
  },
};

async function sendStep(lead: { id: string; email: string; first_name: string | null }, step: number) {
  const s = STEPS[step];
  const name = (lead.first_name ?? '').trim();
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: lead.email }] }],
      from: { email: FROM_EMAIL, name: FROM_NAME },
      reply_to: { email: REPLY_TO, name: 'Jose Huaroco' },
      subject: s.subject,
      content: [
        { type: 'text/plain', value: s.text(name) },
        { type: 'text/html', value: s.html(name, lead.email) },
      ],
      tracking_settings: { subscription_tracking: { enable: true } },
      categories: ['playbook', `playbook-day-${step}`],
    }),
  });
  const ok = res.ok;
  const detail = ok ? null : (await res.text()).slice(0, 500);
  await supabase.from('lead_emails').insert({
    lead_id: lead.id,
    step,
    status: ok ? 'sent' : 'failed',
    detail,
  });
  return { ok, detail };
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return cors({}, 204);
    if (req.method !== 'POST') return cors({ error: 'Method not allowed' }, 405);
    if (!SENDGRID_API_KEY) return cors({ error: 'Email is not configured (SENDGRID_API_KEY missing).' }, 500);

    const body = await req.json().catch(() => ({}));
    const mode = String(body.mode ?? 'welcome');

    /* ---------- 1. Someone just asked for the playbook ---------- */
    if (mode === 'welcome') {
      const email = String(body.email ?? '').trim().toLowerCase();
      if (!EMAIL_RE.test(email) || email.length > 254) return cors({ error: 'invalid_email' }, 400);
      const first_name = body.first_name ? String(body.first_name).slice(0, 80) : null;

      const { error: capErr } = await supabase.rpc('capture_lead', {
        p_email: email,
        p_first_name: first_name,
        p_promoter_type: body.promoter_type ? String(body.promoter_type).slice(0, 40) : null,
        p_language: String(body.language ?? 'en').slice(0, 5),
        p_source: String(body.source ?? 'playbook_crt').slice(0, 40),
        p_utm_source: body.utm_source ?? null,
        p_utm_medium: body.utm_medium ?? null,
        p_utm_campaign: body.utm_campaign ?? null,
        p_utm_content: body.utm_content ?? null,
        p_referrer: body.referrer ?? null,
      });
      if (capErr) return cors({ error: 'save_failed', detail: capErr.message }, 500);

      const { data: lead } = await supabase
        .from('leads').select('id, email, first_name').eq('email', email)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!lead) return cors({ error: 'lead_not_found' }, 500);

      // Only ever one welcome per lead, even if they fill the form again.
      const { data: already } = await supabase
        .from('lead_emails').select('id').eq('lead_id', lead.id).eq('step', 0).maybeSingle();
      if (already) return cors({ ok: true, emailed: false, reason: 'already_welcomed' });

      const r = await sendStep(lead, 0);
      return cors({ ok: true, emailed: r.ok, download: PDF });
    }

    /* ---------- 2. Hourly: send whatever is due ---------- */
    if (mode === 'run') {
      const { data: due, error } = await supabase.rpc('leads_due_for_email', { p_limit: BATCH });
      if (error) return cors({ error: 'query_failed', detail: error.message }, 500);

      const results: Record<string, number> = { sent: 0, failed: 0 };
      for (const row of (due ?? []) as Array<{ id: string; email: string; first_name: string | null; next_step: number }>) {
        if (!STEPS[row.next_step]) continue;
        const r = await sendStep({ id: row.id, email: row.email, first_name: row.first_name }, row.next_step);
        results[r.ok ? 'sent' : 'failed']++;
      }
      return cors({ ok: true, ...results, considered: (due ?? []).length });
    }

    return cors({ error: 'unknown_mode' }, 400);
  } catch (e) {
    return cors({ error: 'server_error', detail: String(e).slice(0, 300) }, 500);
  }
});
