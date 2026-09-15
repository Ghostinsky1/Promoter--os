// Client-side email sanity checks for sign-up. Real verification happens when the
// confirmation email is delivered (Supabase Auth "Confirm email" + SendGrid SMTP).

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

// Placeholder / throwaway domains we don't accept
const BLOCKED_DOMAINS = new Set([
  'test.com', 'example.com', 'example.org', 'example.net', 'email.com', 'mail.com', 'domain.com', 'company.com',
  'test.test', 'localhost', 'gi.com', 'abc.com', 'asdf.com', 'qwerty.com', 'fake.com', 'none.com', 'no.com',
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.net', '10minutemail.com', '10minutemail.net', 'tempmail.com',
  'temp-mail.org', 'yopmail.com', 'yopmail.fr', 'trashmail.com', 'trashmail.de', 'getnada.com', 'dispostable.com',
  'sharklasers.com', 'maildrop.cc', 'throwawaymail.com', 'fakeinbox.com', 'mohmal.com', 'mintemail.com',
  'emailondeck.com', 'tempr.email', 'discard.email', 'spamgourmet.com', 'mailnesia.com', 'tempail.com', 'burnermail.io',
]);

// Common typos of big providers → suggested fix
const TYPO_FIXES: Record<string, string> = {
  'gmial.com': 'gmail.com', 'gmal.com': 'gmail.com', 'gamil.com': 'gmail.com', 'gmail.co': 'gmail.com', 'gmail.con': 'gmail.com',
  'gnail.com': 'gmail.com', 'gmaill.com': 'gmail.com', 'gmai.com': 'gmail.com',
  'yaho.com': 'yahoo.com', 'yahooo.com': 'yahoo.com', 'yahoo.co': 'yahoo.com', 'yahoo.con': 'yahoo.com',
  'hotmal.com': 'hotmail.com', 'hotmai.com': 'hotmail.com', 'hotmail.co': 'hotmail.com', 'hotmail.con': 'hotmail.com',
  'outlok.com': 'outlook.com', 'outloo.com': 'outlook.com', 'iclod.com': 'icloud.com', 'icloud.co': 'icloud.com',
};

export interface EmailCheck {
  ok: boolean;
  reason?: string;
  suggestion?: string; // a corrected address, when we can guess it
}

export function checkSignupEmail(raw: string): EmailCheck {
  const email = (raw || '').trim().toLowerCase();
  if (!email) return { ok: false, reason: 'Enter your email address.' };
  if (!EMAIL_RE.test(email)) return { ok: false, reason: 'That doesn\'t look like a valid email address.' };

  const [local, domain] = email.split('@');
  if (local.length < 2) return { ok: false, reason: 'That doesn\'t look like a valid email address.' };

  if (TYPO_FIXES[domain]) {
    return { ok: false, reason: `Did you mean ${local}@${TYPO_FIXES[domain]}?`, suggestion: `${local}@${TYPO_FIXES[domain]}` };
  }

  if (BLOCKED_DOMAINS.has(domain) || domain.endsWith('.test') || domain.endsWith('.invalid') || domain.endsWith('.local')) {
    return { ok: false, reason: 'Please use a real email address — we\'ll send your confirmation link and offers there.' };
  }

  // Obviously mashed-keyboard names ("asdf", "test", "aaaa")
  if (/^(test|asdf|qwerty|abc|aaa+|xxx+|none|fake)\d*$/.test(local)) {
    return { ok: false, reason: 'Please use a real email address — we\'ll send your confirmation link and offers there.' };
  }

  return { ok: true };
}
