/**
 * Meta (Facebook) Pixel — browser side.
 *
 * The pixel ID is public by design, same as the Stripe publishable key.
 * The Conversions API access token is NOT here — it lives in a Supabase
 * secret and is only ever used server-side (see supabase/functions/fb-capi).
 *
 * Every conversion is sent twice on purpose: once from the browser (fbq) and
 * once from the server (Conversions API), sharing one event_id so Meta
 * de-duplicates them. Browser-only tracking loses 30-50% of events to ad
 * blockers and iOS; server-only loses the browser signals. Both is correct.
 */

// Paste the pixel ID here. Empty = tracking is off and every call below no-ops.
export const FB_PIXEL_ID = '1059089886967514';

type FbqFn = ((...args: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown };
declare global { interface Window { fbq?: FbqFn; _fbq?: FbqFn } }

export const pixelEnabled = () => Boolean(FB_PIXEL_ID);

let booted = false;

/** Injects the Meta base code once. Safe to call repeatedly. */
export function initFacebookPixel(): void {
  if (booted || !pixelEnabled() || typeof window === 'undefined') return;
  booted = true;

  /* eslint-disable */
  (function (f: any, b: Document, e: string, v: string) {
    if (f.fbq) return;
    const n: any = (f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    });
    if (!f._fbq) f._fbq = n;
    n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
    const t = b.createElement(e) as HTMLScriptElement;
    t.async = true; t.src = v;
    const s = b.getElementsByTagName(e)[0];
    s.parentNode?.insertBefore(t, s);
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */

  window.fbq?.('init', FB_PIXEL_ID);
}

/** A unique id shared by the browser event and its server twin, so Meta dedupes. */
export function newEventId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch { /* fall through */ }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function readCookie(name: string): string | undefined {
  try {
    const hit = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`));
    return hit ? decodeURIComponent(hit.split('=').slice(1).join('=')) : undefined;
  } catch { return undefined; }
}

/** Meta's own browser cookies — they materially improve match quality server-side. */
export function getFbCookies(): { fbp?: string; fbc?: string } {
  return { fbp: readCookie('_fbp'), fbc: readCookie('_fbc') };
}

export function trackPageView(): void {
  if (!pixelEnabled()) return;
  window.fbq?.('track', 'PageView');
}

/** Standard Meta event. Pass the same eventId to the Conversions API call. */
export function trackEvent(
  event: string,
  params: Record<string, unknown> = {},
  eventId?: string,
): void {
  if (!pixelEnabled()) return;
  window.fbq?.('track', event, params, eventId ? { eventID: eventId } : undefined);
}

/** For events that aren't in Meta's standard list. */
export function trackCustom(
  event: string,
  params: Record<string, unknown> = {},
  eventId?: string,
): void {
  if (!pixelEnabled()) return;
  window.fbq?.('trackCustom', event, params, eventId ? { eventID: eventId } : undefined);
}
