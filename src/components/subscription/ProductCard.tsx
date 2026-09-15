import React, { useState } from 'react';
import { StripeProduct } from '../../stripe-config';
import { Check, Loader2 } from 'lucide-react';
import { createCheckoutSession } from '../../lib/stripe';

interface ProductCardProps {
  product: StripeProduct;
}

export function ProductCard({ product }: ProductCardProps) {
  const [loading, setLoading] = useState(false);

  const handlePurchase = async () => {
    setLoading(true);
    try {
      const successUrl = `${window.location.origin}/success?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = window.location.href;

      const { url } = await createCheckoutSession({
        priceId: product.priceId,
        mode: product.mode,
        successUrl,
        cancelUrl,
      });

      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handlePurchase}
      disabled={loading}
      className="w-full bg-[#C4FF0D] text-black py-3 px-6 rounded-lg hover:bg-[#A3D60A] focus:outline-none focus:ring-2 focus:ring-[#C4FF0D] focus:ring-offset-2 focus:ring-offset-[#1A1F1E] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center font-semibold transition-all transform hover:scale-105"
    >
      {loading ? (
        <>
          <Loader2 className="animate-spin h-5 w-5 mr-2" />
          Processing...
        </>
      ) : (
        <>
          <Check className="h-5 w-5 mr-2" />
          {product.mode === 'subscription' ? 'Subscribe Now' : 'Purchase'}
        </>
      )}
    </button>
  );
}