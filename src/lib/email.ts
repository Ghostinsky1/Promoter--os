import { supabase, SUPABASE_URL } from './supabase';

export interface EmailAttachment {
  filename: string;
  content: string; // base64 (no data: prefix)
  type?: string;
}

export interface SendEmailInput {
  to: string[];
  subject: string;
  message: string;
  copySelf?: boolean;
  senderName?: string;
  companyName?: string;
  attachments?: EmailAttachment[];
}

/** Sends an email through the `send-email` edge function (SendGrid). Throws on failure. */
export async function sendEmail(input: SendEmailInput): Promise<{ sent_to: string[]; copied: string | null }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('You need to be signed in to send email.');

  const res = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      to: input.to,
      subject: input.subject,
      message: input.message,
      copy_self: input.copySelf === true,
      sender_name: input.senderName,
      company_name: input.companyName,
      attachments: input.attachments ?? [],
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Email failed (${res.status})`);
  return json;
}

export function parseRecipients(raw: string): string[] {
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
