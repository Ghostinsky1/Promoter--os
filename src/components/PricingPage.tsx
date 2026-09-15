import { createCheckoutSession } from '../lib/stripe';
import { SUPABASE_URL } from '../lib/supabase';
import { useState } from 'react';
import { CheckCircle2, Sparkles, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { STRIPE_PRODUCTS } from '../stripe-config';

export function PricingPage() {
  const { user } = useAuth();
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);

  const handleSubscribe = async (priceId: string) => {
    if (!user) {
      window.location.href = '/login';
      return;
    }

    setLoadingPriceId(priceId);

    try {
      const { url } = await createCheckoutSession({
        priceId,
        mode: 'subscription',
        successUrl: `${window.location.origin}/success`,
        cancelUrl: `${window.location.origin}/pricing`,
      });
      
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
    } finally {
      setLoadingPriceId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-20 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold mb-4 text-gray-900">
            Choose Your Plan
          </h1>
          <p className="text-xl text-gray-600">
            Start with the basics, unlock AI when you're ready
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {STRIPE_PRODUCTS.map((product, index) => (
            <div 
              key={product.id}
              className={`p-8 bg-white rounded-lg border-2 hover:shadow-xl transition-shadow ${
                index === 1 ? 'border-purple-600 relative' : 'border-gray-200'
              }`}
            >
              {index === 1 && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
                    MOST POPULAR
                  </div>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-2xl font-bold mb-2">{product.name}</h3>
                <p className="text-gray-600">{product.description}</p>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-2">
                  <span className={`text-5xl font-bold ${index === 1 ? 'text-purple-600' : ''}`}>
                    ${product.price}
                  </span>
                  <span className="text-gray-600">/ month</span>
                </div>
              </div>

              <button
                onClick={() => handleSubscribe(product.priceId)}
                disabled={loadingPriceId === product.priceId}
                className={`w-full mb-6 px-6 py-3 rounded-lg font-semibold transition-all ${
                  index === 1
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:shadow-lg'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loadingPriceId === product.priceId ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing...
                  </div>
                ) : (
                  `Subscribe to ${product.name}`
                )}
              </button>

              <div className="space-y-3">
                {product.features.map((feature, featureIndex) => (
                  <div key={featureIndex} className="flex items-start gap-2">
                    {feature.startsWith('Everything in') ? (
                      <Sparkles className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    )}
                    <span className={`text-sm ${
                      feature.startsWith('Everything in') ? 'font-semibold text-purple-600' : ''
                    }`}>
                      {feature}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 p-6 bg-gray-50 rounded-lg max-w-4xl mx-auto">
          <h4 className="font-bold text-center mb-4">All Plans Include:</h4>
          <div className="grid md:grid-cols-3 gap-4 text-sm text-gray-700">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
              <span>Industry-accurate financial calculations</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
              <span>Professional PDF offers & settlements</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
              <span>Secure cloud storage</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
              <span>Mobile-friendly access</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
              <span>Regular feature updates</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
              <span>Cancel anytime</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}