import React, { useState } from 'react';
import { StripeProduct } from '../../stripe-config';
import { Check, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ProductCardProps {
  product: StripeProduct;
}

export function ProductCard({ product }: ProductCardProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handlePurchase = async () => {
    setLoading(true);
    navigate(`/checkout?price=${encodeURIComponent(product.priceId)}`);
  };

  return (
    <button
      onClick={handlePurchase}
      disabled={loading}
      className="w-full bg-[#8FD3FF] text-[#04214D] py-3 px-6 rounded-lg hover:bg-[#6FB8F2] focus:outline-none focus:ring-2 focus:ring-[#8FD3FF] focus:ring-offset-2 focus:ring-offset-[#14171E] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center font-semibold transition-all transform hover:scale-105"
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