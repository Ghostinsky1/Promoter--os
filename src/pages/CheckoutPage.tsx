import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { ArrowLeft, Check, ShieldCheck } from 'lucide-react';
import { STRIPE_PRODUCTS } from '../stripe-config';
import { createEmbeddedCheckout, STRIPE_PUBLISHABLE_KEY } from '../lib/stripe';
import { supabase } from '../lib/supabase';

const stripePromise = STRIPE_PUBLISHABLE_KEY.startsWith('pk_') ? loadStripe(STRIPE_PUBLISHABLE_KEY) : null;

/**
 * In-app checkout. The Stripe payment form renders right here, inside PROMTP —
 * no redirect to a Stripe-hosted page. On completion Stripe returns the user to /success.
 */
export function CheckoutPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const priceId = searchParams.get('price') || STRIPE_PRODUCTS[0].priceId;
  const product = useMemo(() => STRIPE_PRODUCTS.find(p => p.priceId === priceId) || STRIPE_PRODUCTS[0], [priceId]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate('/login');
    });
  }, [navigate]);

  const fetchClientSecret = useCallback(async () => {
    try {
      return await createEmbeddedCheckout(product.priceId);
    } catch (e: any) {
      setError(e.message || 'Could not start checkout');
      throw e;
    }
  }, [product.priceId]);

  return (
    <div className="min-h-screen bg-[#0F1113] py-10 px-4">
      <div className="max-w-5xl mx-auto">
        <button
          onClick={() => navigate('/pricing')}
          className="text-gray-400 hover:text-white inline-flex items-center gap-2 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to plans
        </button>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-8 items-start">
          {/* Plan summary */}
          <div className="bg-[#1A1D1F] border border-gray-800 rounded-3xl p-8">
            <div className="inline-flex items-center gap-3 mb-6">
              <img src="/untitled_project_-_standard_1_(13).png" alt="PROMTP" className="w-10 h-10 object-contain" />
              <span className="text-2xl font-bold text-white">PROMTP</span>
            </div>
            <p className="text-sm uppercase tracking-wider text-gray-500 mb-2">You're subscribing to</p>
            <h1 className="text-3xl font-bold text-white mb-1">{product.name}</h1>
            <p className="text-gray-400 mb-6">{product.description}</p>
            <div className="flex items-baseline gap-2 mb-6">
              <span className="text-5xl font-bold text-[#C4FF0D]">${product.price.toFixed(0)}</span>
              <span className="text-gray-400">/ month</span>
            </div>
            <p className="text-sm text-[#C4FF0D] font-semibold mb-6">14-day free trial — you won't be charged today.</p>
            <ul className="space-y-3">
              {product.features.map((f) => (
                <li key={f} className="flex items-start gap-3 text-gray-300 text-sm">
                  <Check className="w-4 h-4 text-[#C4FF0D] mt-0.5 flex-shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 pt-6 border-t border-gray-800 flex items-center gap-2 text-xs text-gray-500">
              <ShieldCheck className="w-4 h-4" /> Payments are processed securely by Stripe. Cancel anytime.
            </div>
          </div>

          {/* Payment form */}
          <div className="bg-white rounded-3xl p-4 sm:p-6 min-h-[520px]">
            {!stripePromise ? (
              <div className="text-gray-700 p-6">
                <p className="font-semibold mb-2">Payments aren't switched on yet.</p>
                <p className="text-sm">The Stripe publishable key hasn't been added to the app. Add it and redeploy.</p>
              </div>
            ) : error ? (
              <div className="text-gray-700 p-6">
                <p className="font-semibold mb-2">Couldn't start checkout</p>
                <p className="text-sm mb-4">{error}</p>
                <button onClick={() => window.location.reload()} className="bg-black text-white px-4 py-2 rounded-lg text-sm">Try again</button>
              </div>
            ) : (
              <EmbeddedCheckoutProvider stripe={stripePromise} options={{ fetchClientSecret }}>
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
