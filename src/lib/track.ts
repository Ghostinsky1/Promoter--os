/**
 * One call fires a conversion to both Meta endpoints — the browser pixel and
 * the Conversions API — sharing an event_id so Meta counts it once.
 *
 * Tracking must never break the app: every failure here is swallowed.
 */
import { SUPABASE_URL } from './supabase';
import { FB_PIXEL_ID, getFbCookies, newEventId, pixelEnabled, trackEvent } from './facebookPixel';

export interface TrackOptions {
  /** Money events: value + currency. */
  value?: number;
  currency?: string;
  /** Anything else Meta accepts as custom_data. */
  custom?: Record<string, unknown>;
  /** Improves match quality. Hashed server-side, never sent in the clear. */
  email?: string;
  userId?: string;
  firstName?: string;
  lastName?: string;
}

export function track(event: string, opts: TrackOptions = {}): void {
  if (!pixelEnabled()) return;

  const eventId = newEventId();
  const custom_data: Record<string, unknown> = { ...(opts.custom ?? {}) };
  if (typeof opts.value === 'number') {
    custom_data.value = opts.value;
    custom_data.currency = opts.currency ?? 'USD';
  }

  // 1. Browser
  try {
    trackEvent(event, custom_data, eventId);
  } catch { /* ad blocker, private mode — the server copy still lands */ }

  // 2. Server (Conversions API)
  try {
    const { fbp, fbc } = getFbCookies();
    const payload = {
      event_name: event,
      event_id: eventId,
      event_source_url: typeof window !== 'undefined' ? window.location.href : undefined,
      user_data: {
        email: opts.email,
        external_id: opts.userId,
        first_name: opts.firstName,
        last_name: opts.lastName,
        fbp,
        fbc,
      },
      custom_data,
    };
    const url = `${SUPABASE_URL}/functions/v1/fb-capi`;
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });

    // sendBeacon survives the page unloading (checkout redirects, tab closes).
    if (typeof navigator !== 'undefined' && navigator.sendBeacon && navigator.sendBeacon(url, blob)) return;

    void fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => { /* tracking is best effort */ });
  } catch { /* tracking is best effort */ }
}

export { FB_PIXEL_ID, pixelEnabled };
