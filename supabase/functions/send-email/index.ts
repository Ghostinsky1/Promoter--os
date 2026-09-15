import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

// Sends transactional email through SendGrid on behalf of a signed-in PROMOTER OS user.
// Secrets required (Supabase → Edge Functions → Secrets): SENDGRID_API_KEY
// Optional: SENDGRID_FROM_EMAIL (default support@gozaentertainment.com), SENDGRID_FROM_NAME

const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY');
const FROM_EMAIL = Deno.env.get('SENDGRID_FROM_EMAIL') ?? 'support@gozaentertainment.com';
const FROM_NAME = Deno.env.get('SENDGRID_FROM_NAME') ?? 'PROMOTER OS · Goza Entertainment';

const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024; // SendGrid caps total message size at ~30MB
const MAX_RECIPIENTS = 10;

function cors(body: object | null, status = 200) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };
  if (status === 204) return new Response(null, { status, headers });
  return new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function brandedHtml(opts: { title: string; message: string; senderName: string; senderEmail: string; company?: string }) {
  const paragraphs = opts.message
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px 0;">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
  const company = opts.company ? escapeHtml(opts.company) : 'Goza Entertainment';
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#EEF2F8;font-family:Arial,Helvetica,sans-serif;color:#1F2430;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#EEF2F8;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid #D2DAE6;">
        <tr><td style="background:#08090D;padding:22px 28px;">
          <div style="font-size:11px;letter-spacing:2px;color:#8FD3FF;text-transform:uppercase;">${company}</div>
          <div style="font-size:22px;font-weight:900;color:#FFFFFF;letter-spacing:0.5px;margin-top:4px;text-transform:uppercase;">${escapeHtml(opts.title)}</div>
        </td></tr>
        <tr><td style="height:4px;background:#1140F0;"></td></tr>
        <tr><td style="padding:28px;font-size:15px;line-height:1.55;">
          ${paragraphs}
          <p style="margin:22px 0 0 0;">— ${escapeHtml(opts.senderName)}<br>
          <a href="mailto:${escapeHtml(opts.senderEmail)}" style="color:#1140F0;">${escapeHtml(opts.senderEmail)}</a></p>
        </td></tr>
        <tr><td style="padding:16px 28px;background:#F6F8FB;border-top:1px solid #D2DAE6;font-size:11px;color:#6B7280;letter-spacing:1px;text-transform:uppercase;">
          Sent with PROMOTER OS · ${company} · Reply to this email to reach the sender
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return cors({}, 204);
    if (req.method !== 'POST') return cors({ error: 'Method not allowed' }, 405);
    if (!SENDGRID_API_KEY) return cors({ error: 'Email is not configured (SENDGRID_API_KEY missing).' }, 500);

    // 1. Who is sending? Must be a signed-in user.
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) return cors({ error: 'Not signed in' }, 401);
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user?.email) return cors({ error: 'Not signed in' }, 401);

    // 2. Payload
    const body = await req.json();
    const to: string[] = Array.isArray(body.to) ? body.to : typeof body.to === 'string' ? [body.to] : [];
    const recipients = to.map((e) => String(e).trim()).filter(Boolean);
    const subject = String(body.subject ?? '').trim();
    const message = String(body.message ?? '').trim();
    const copySelf = body.copy_self === true;
    const senderName = String(body.sender_name ?? '').trim() || user.email;
    const company = body.company_name ? String(body.company_name) : undefined;
    // Replies go to the company email from Settings when set, otherwise the sender's login email
    const replyTo = body.reply_to && EMAIL_RE.test(String(body.reply_to).trim()) ? String(body.reply_to).trim() : user.email;
    const attachments: { filename: string; content: string; type?: string }[] = Array.isArray(body.attachments) ? body.attachments : [];

    if (recipients.length === 0) return cors({ error: 'At least one recipient is required' }, 400);
    if (recipients.length > MAX_RECIPIENTS) return cors({ error: `Max ${MAX_RECIPIENTS} recipients` }, 400);
    const bad = recipients.find((e) => !EMAIL_RE.test(e));
    if (bad) return cors({ error: `Invalid email address: ${bad}` }, 400);
    if (!subject) return cors({ error: 'Subject is required' }, 400);
    if (!message) return cors({ error: 'Message is required' }, 400);

    let attachBytes = 0;
    const sgAttachments = attachments.map((a) => {
      const content = String(a.content ?? '').replace(/^data:[^;]+;base64,/, '');
      attachBytes += Math.floor((content.length * 3) / 4);
      return {
        content,
        filename: String(a.filename ?? 'attachment.pdf'),
        type: a.type ?? 'application/pdf',
        disposition: 'attachment',
      };
    });
    if (attachBytes > MAX_ATTACHMENT_BYTES) return cors({ error: 'Attachments too large (max 8MB)' }, 400);

    // 3. Build the SendGrid request
    const personalization: Record<string, unknown> = { to: recipients.map((email) => ({ email })) };
    if (copySelf) personalization.cc = [{ email: user.email }];

    const payload: Record<string, unknown> = {
      personalizations: [personalization],
      from: { email: FROM_EMAIL, name: FROM_NAME },
      reply_to: { email: replyTo, name: senderName },
      subject,
      content: [
        { type: 'text/plain', value: `${message}\n\n— ${senderName}\n${replyTo}` },
        { type: 'text/html', value: brandedHtml({ title: subject, message, senderName, senderEmail: replyTo, company }) },
      ],
      categories: ['promoteros'],
      custom_args: { user_id: user.id },
    };
    if (sgAttachments.length) payload.attachments = sgAttachments;

    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.status === 202) {
      console.log(`Email sent by ${user.email} to ${recipients.join(', ')} (${sgAttachments.length} attachment(s))`);
      return cors({ ok: true, sent_to: recipients, reply_to: replyTo, copied: copySelf ? user.email : null });
    }

    const errText = await res.text();
    console.error(`SendGrid error ${res.status}: ${errText}`);
    let detail = 'SendGrid rejected the message';
    try {
      const j = JSON.parse(errText);
      if (Array.isArray(j.errors) && j.errors[0]?.message) detail = j.errors[0].message;
    } catch { /* keep default */ }
    return cors({ error: detail, status: res.status }, 502);
  } catch (err: any) {
    console.error(`send-email error: ${err.message}`);
    return cors({ error: err.message ?? 'Unexpected error' }, 500);
  }
});
