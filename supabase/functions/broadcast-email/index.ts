import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

/**
 * PROMOTER OS — one-off broadcast emails (blog announcements etc.).
 *
 * mode "test" → sends the current campaign to Jose only (subject prefixed [TEST]).
 * mode "run"  → sends the campaign to everyone in broadcast_recipients(), but ONLY once
 *               the campaign's send time has passed. Every (campaign, email) is unique in
 *               broadcast_sends, so calling it again never double-sends.
 *
 * To send a new campaign: change CAMPAIGN, SEND_AT, SUBJECT, html and text, push, redeploy
 * (the function is deployed as a jsDelivr import pinned to a commit), then point the
 * pg_cron job at it (see claude/BLOG-AND-BROADCAST-EMAIL.md).
 */

const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY');
// Every email the app sends comes from promoteros.com (domain authenticated in SendGrid). Not overridable by a secret on purpose.
const FROM_EMAIL = 'support@promoteros.com';
const FROM_NAME = 'Jose @ Promoter OS';
const REPLY_TO = 'jhuaroco@gozaentertainment.com';
const TEST_TO = 'jhuaroco@gozaentertainment.com';
const SITE = 'https://promoteros.com';

const CAMPAIGN = 'blog-headliner-2026-10-15';
const SEND_AT = new Date('2026-10-15T18:00:00Z'); // 1:00 PM Central (CDT)
const SUBJECT = 'Is your headliner worth it? (10-second test)';
const utm = (c: string) => `utm_source=newsletter&utm_medium=email&utm_campaign=${CAMPAIGN}&utm_content=${c}`;
const POST = `${SITE}/blog/is-your-headliner-worth-it/?${utm('post')}`;
const TRIAL = `${SITE}/signup?${utm('trial')}`;

const P = 'margin:0 0 14px;';
const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#0B0D12;font-family:Arial,Helvetica,sans-serif;color:#E7EDF7;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0B0D12;padding:24px 0;">
<tr><td align="center">
  <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#14171E;border-radius:16px;overflow:hidden;border:1px solid #2A3040;">
    <tr><td style="background:#1140F0;padding:26px 30px;">
      <img src="${SITE}/promoter-os-lockup.png" width="160" alt="PROMOTER OS" style="display:block;width:160px;height:auto;border:0;margin-bottom:16px;">
      <div style="font-size:11px;letter-spacing:3px;color:#CFE4FF;text-transform:uppercase;">New on the blog</div>
      <div style="font-size:26px;font-weight:900;color:#FFFFFF;line-height:1.12;margin-top:6px;text-transform:uppercase;">Is your headliner worth it?</div>
    </td></tr>
    <tr><td style="height:4px;background:#8FD3FF;"></td></tr>
    <tr><td style="padding:30px;font-size:16px;line-height:1.6;color:#D7E0EE;">
<p style="${P}">Quick one.</p>
<p style="${P}">I opened the books on one of my summer shows. It was a 1,000-cap room and a $641 headliner, and I walked away with <b style="color:#fff;">$3,319, a 39% margin.</b> Live Nation's concert business runs on 2.8%.</p>
<p style="${P}">Then I ran the same night with a $5,000 headliner and the same crowd. The result was <b style="color:#fff;">-$2,127.</b> I'd have sold out the room and still lost money.</p>
<p style="${P}">So I wrote down the test I use now. It takes 10 seconds and you do it before you send any offer:</p>
<p style="margin:0 0 14px;padding:14px 16px;background:#22262F;border-left:4px solid #8FD3FF;border-radius:8px;color:#fff;"><b>Fee ÷ ticket price = how many people that artist has to bring who wouldn't have come anyway.</b></p>
<p style="${P}">The full breakdown is in the post, with the real settlement numbers, the half-house test, and how I cap the fee before the agent names one.</p>
<table role="presentation" cellspacing="0" cellpadding="0" style="margin:22px 0 22px 0;"><tr>
  <td style="background:#8FD3FF;border-radius:12px;">
    <a href="${POST}" style="display:inline-block;padding:16px 30px;color:#04214D;font-size:16px;font-weight:bold;text-decoration:none;text-transform:uppercase;letter-spacing:.5px;">Read the post</a>
  </td></tr></table>
<p style="${P}">The next post is about ad budgets: how much to spend to fill a room, using my real numbers.</p>
<p style="margin:22px 0 0 0;color:#93A2B8;font-size:14px;">P.S. If you've got an offer out right now, put it into Promoter OS and see the sellout, 70% and bad-night numbers side by side before you sign. <a href="${TRIAL}" style="color:#8FD3FF;">Start the 7-day trial</a></p>
<p style="margin:26px 0 0 0;color:#93A2B8;font-size:14px;">— Jose<br>Promoter OS</p>
    </td></tr>
    <tr><td style="padding:18px 30px;background:#0B0D12;border-top:1px solid #2A3040;font-size:11px;color:#6C7A90;line-height:1.7;">
      You're getting this because you signed up at promoteros.com.<br>
      <a href="${SITE}" style="color:#8FD3FF;text-decoration:none;">PROMOTEROS.COM</a> &nbsp;·&nbsp; <%asm_global_unsubscribe_raw_url%>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;

const text = `Quick one.

I opened the books on one of my summer shows. It was a 1,000-cap room and a $641 headliner, and I walked away with $3,319, a 39% margin. Live Nation's concert business runs on 2.8%.

Then I ran the same night with a $5,000 headliner and the same crowd. The result was -$2,127. I'd have sold out the room and still lost money.

So I wrote down the test I use now. It takes 10 seconds and you do it before you send any offer:

Fee ÷ ticket price = how many people that artist has to bring who wouldn't have come anyway.

The full breakdown is in the post, with the real settlement numbers, the half-house test, and how I cap the fee before the agent names one:
${POST}

The next post is about ad budgets: how much to spend to fill a room, using my real numbers.

— Jose

P.S. If you've got an offer out right now, put it into Promoter OS and see the sellout, 70% and bad-night numbers side by side before you sign. Start the 7-day trial: ${TRIAL}`;

async function send(to: string, subject: string) {
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: FROM_EMAIL, name: FROM_NAME },
      reply_to: { email: REPLY_TO, name: 'Jose Huaroco' },
      subject,
      content: [{ type: 'text/plain', value: text }, { type: 'text/html', value: html }],
      tracking_settings: { subscription_tracking: { enable: true } },
      categories: ['broadcast', CAMPAIGN],
    }),
  });
  return { ok: res.ok, detail: res.ok ? null : (await res.text()).slice(0, 500) };
}

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!SENDGRID_API_KEY) return json({ error: 'SENDGRID_API_KEY missing' }, 500);
  const body = await req.json().catch(() => ({}));
  const mode = String(body.mode ?? '');

  if (mode === 'test') {
    const r = await send(TEST_TO, `[TEST] ${SUBJECT}`);
    return json({ campaign: CAMPAIGN, test: TEST_TO, ...r });
  }

  if (mode === 'run') {
    if (Date.now() < SEND_AT.getTime()) return json({ campaign: CAMPAIGN, skipped: 'not time yet', send_at: SEND_AT });
    const { data: rec, error } = await supabase.rpc('broadcast_recipients');
    if (error) return json({ error: error.message }, 500);
    const { data: done } = await supabase.from('broadcast_sends').select('email').eq('campaign', CAMPAIGN);
    const already = new Set((done ?? []).map((d: { email: string }) => d.email));
    let sent = 0, failed = 0;
    for (const { email } of (rec ?? []) as { email: string }[]) {
      if (already.has(email)) continue;
      // claim the row first so a parallel call can't double-send
      const { error: claimErr } = await supabase.from('broadcast_sends').insert({ campaign: CAMPAIGN, email, status: 'sending' });
      if (claimErr) continue;
      const r = await send(email, SUBJECT);
      await supabase.from('broadcast_sends').update({ status: r.ok ? 'sent' : 'failed', detail: r.detail, sent_at: new Date().toISOString() })
        .eq('campaign', CAMPAIGN).eq('email', email);
      r.ok ? sent++ : failed++;
    }
    return json({ campaign: CAMPAIGN, sent, failed });
  }

  return json({ error: 'mode must be "test" or "run"' }, 400);
});
