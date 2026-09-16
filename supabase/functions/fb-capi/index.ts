/**
 * Meta Conversions API relay.
 *
 * The browser sends the same conversion twice: once via fbq, once here. Both
 * carry the same event_id so Meta de-duplicates. Server-side events survive ad
 * blockers and iOS tracking prevention, which is where most browser events die.
 *
 * Secrets (Supabase -> Edge Functions -> Secrets):
 *   FB_PIXEL_ID           the pixel / dataset id
 *   FB_CAPI_ACCESS_TOKEN  generated in Events Manager -> Settings -> Conversions API
 *   FB_TEST_EVENT_CODE    optional, only while watching Test Events
 *
 * The access token never reaches the browser.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const PIXEL_ID = Deno.env.get('FB_PIXEL_ID') ?? '';
const ACCESS_TOKEN = Deno.env.get('FB_CAPI_ACCESS_TOKEN') ?? '';
const TEST_EVENT_CODE = Deno.env.get('FB_TEST_EVENT_CODE') ?? '';
const GRAPH_VERSION = 'v21.0';

// Only these may be forwarded — this endpoint is public, so an allowlist keeps
// a stranger from stuffing junk events into the pixel.
const ALLOWED_EVENTS = new Set([
  'PageView', 'ViewContent', 'Lead', 'CompleteRegistration',
  'InitiateCheckout', 'AddPaymentInfo', 'Subscribe', 'StartTrial', 'Purchase', 'Contact',
]);

const MAX_BODY_BYTES = 16 * 1024;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

function json(body: unknown, status = 200) {
  if (status === 204) return new Response(null, { status, headers: CORS });
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

/** Meta requires PII hashed: trimmed, lowercased, SHA-256 hex. */
async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value.trim().toLowerCase());
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function digitsOnly(v: string) { return v.replace(/[^0-9]/g, ''); }

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return json(null, 204);
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    if (!PIXEL_ID || !ACCESS_TOKEN) {
      // Not configured yet — accept and ignore so the app never breaks on it.
      return json({ ok: false, skipped: 'Conversions API is not configured' });
    }

    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return json({ error: 'Payload too large' }, 413);
    const body = JSON.parse(raw || '{}');

    const eventName = String(body.event_name ?? '').trim();
    if (!ALLOWED_EVENTS.has(eventName)) return json({ error: `Unsupported event: ${eventName}` }, 400);

    const u = body.user_data ?? {};
    const user_data: Record<string, unknown> = {
      client_user_agent: req.headers.get('user-agent') ?? undefined,
      client_ip_address:
        (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || undefined,
    };
    if (u.email) user_data.em = [await sha256(String(u.email))];
    if (u.phone) user_data.ph = [await sha256(digitsOnly(String(u.phone)))];
    if (u.first_name) user_data.fn = [await sha256(String(u.first_name))];
    if (u.last_name) user_data.ln = [await sha256(String(u.last_name))];
    // external_id is an app-side identifier (the user id) — hashed like the rest.
    if (u.external_id) user_data.external_id = [await sha256(String(u.external_id))];
    if (u.fbp) user_data.fbp = String(u.fbp);
    if (u.fbc) user_data.fbc = String(u.fbc);

    const event: Record<string, unknown> = {
      event_name: eventName,
      event_time: Math.floor(Date.now() / 1000),
      action_source: 'website',
      user_data,
    };
    if (body.event_id) event.event_id = String(body.event_id);
    if (body.event_source_url) event.event_source_url = String(body.event_source_url);
    if (body.custom_data && typeof body.custom_data === 'object') event.custom_data = body.custom_data;

    const payload: Record<string, unknown> = { data: [event] };
    if (TEST_EVENT_CODE) payload.test_event_code = TEST_EVENT_CODE;

    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${PIXEL_ID}/events?access_token=${encodeURIComponent(ACCESS_TOKEN)}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
    );
    const result = await res.json().catch(() => ({}));

    if (!res.ok) {
      // Never let a tracking failure surface to the user or break a signup.
      console.error('Meta CAPI rejected event', eventName, JSON.stringify(result).slice(0, 500));
      return json({ ok: false, error: result?.error?.message ?? 'Meta rejected the event' }, 502);
    }

    return json({ ok: true, event: eventName, events_received: result.events_received ?? 1 });
  } catch (err) {
    console.error('fb-capi error', (err as Error).message);
    return json({ ok: false, error: (err as Error).message }, 500);
  }
});
