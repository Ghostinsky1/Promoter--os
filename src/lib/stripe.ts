import { supabase, SUPABASE_URL } from './supabase';

// Stripe PUBLISHABLE key — public by design (it only lets the browser render the card form).
export const STRIPE_PUBLISHABLE_KEY: string =
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_live_51UG2vlGeegvFIqACWs8HtSa3s33m0isZSV6hyfpulxszqS7sDeQ5iUn1vEQYaLkjs5ZVX2o0Odxq9LLgVV5EuvQa00vJXsDUNJ';

export const PRO_PRICE_ID = 'price_1UG3GxGeegvFIqACTTpeqq4n';

async function authHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('No authentication token found');
  return `Bearer ${session.access_token}`;
}

/**
 * In-app checkout: asks the backend for an embedded Checkout session and returns its
 * client secret, which <EmbeddedCheckout> uses to render the payment form inside PROMTP.
 */
export async function createEmbeddedCheckout(priceId: string): Promise<string> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/stripe-checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: await authHeader() },
    body: JSON.stringify({
      price_id: priceId,
      mode: 'subscription',
      ui_mode: 'embedded',
      return_url: `${window.location.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      metadata: { tier: priceId === PRO_PRICE_ID ? 'pro' : 'starter' },
    }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to start checkout');
  }
  const data = await response.json();
  if (!data.clientSecret) throw new Error('No checkout session returned');
  return data.clientSecret as string;
}

interface CreateCheckoutSessionParams {
  priceId: string;
  mode: 'payment' | 'subscription';
  successUrl: string;
  cancelUrl: string;
}

/** Legacy: hosted Stripe page (redirect). Kept for reference; the app uses createEmbeddedCheckout. */
export async function createCheckoutSession({ priceId, mode, successUrl, cancelUrl }: CreateCheckoutSessionParams) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/stripe-checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: await authHeader() },
    body: JSON.stringify({
      price_id: priceId,
      mode,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { tier: priceId === PRO_PRICE_ID ? 'pro' : 'starter' },
    }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create checkout session');
  }
  return response.json();
}
