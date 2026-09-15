import React, { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { StripeProduct } from '../stripe-config';

interface PricingCardProps {
  product: StripeProduct;
  onSubscribe: (priceId: string) => Promise<void>;
  isPopular?: boolean;
}

export function PricingCard({ product, onSubscribe, isPopular = false }: PricingCardProps) {
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      await onSubscribe(product.priceId);
    } catch (error) {
      console.error('Subscription error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`relative bg-[#14171E] border rounded-3xl shadow-xl p-8 ${isPopular ? 'border-2 border-[#8FD3FF]' : 'border-gray-800'}`}>
      {isPopular && (
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
          <span className="bg-[#8FD3FF] text-[#04214D] px-6 py-2 rounded-full text-sm font-bold">
            Most Popular
          </span>
        </div>
      )}

      <div className="text-center mb-8">
        <h3 className="text-3xl font-bold text-white mb-6">{product.name}</h3>
        <div className="mb-4">
          <span className="text-5xl font-bold text-[#8FD3FF]">${product.price}</span>
          <span className="text-gray-400 ml-2 text-lg">/month</span>
        </div>
        <p className="text-gray-300 leading-relaxed">{product.description}</p>
      </div>

      <button
        onClick={handleSubscribe}
        disabled={loading}
        className="w-full py-4 px-6 rounded-2xl font-bold text-lg transition-all transform hover:scale-[1.02] bg-[#8FD3FF] hover:bg-[#6FB8F2] text-[#04214D] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          'Start Free Trial →'
        )}
      </button>

      <div className="mt-8">
        <h4 className="font-semibold text-white mb-5 text-lg">Features include:</h4>
        <ul className="space-y-4">
          {product.features.map((feature, index) => (
            <li key={index} className="flex items-start">
              <Check className="w-5 h-5 text-[#8FD3FF] mr-3 flex-shrink-0 mt-0.5" />
              <span className="text-gray-300 leading-relaxed">{feature}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}