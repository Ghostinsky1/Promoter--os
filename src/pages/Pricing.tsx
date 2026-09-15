import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PricingCard } from '../components/PricingCard';
import { STRIPE_PRODUCTS } from '../stripe-config';
import { createCheckoutSession } from '../lib/stripe';
import { supabase } from '../lib/supabase';

export function Pricing() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
    });
  }, []);

  const handleSubscribe = async (priceId: string) => {
    try {
      const { url } = await createCheckoutSession({
        priceId,
        mode: 'subscription',
        successUrl: `${window.location.origin}/success`,
        cancelUrl: `${window.location.origin}/pricing`
      });

      if (!url) {
        throw new Error('No checkout URL received');
      }

      window.location.href = url;
    } catch (error: any) {
      console.error('Checkout error:', error);

      if (error.message?.includes('authentication') || error.message?.includes('token')) {
        alert('Please log in to subscribe to a plan.');
        navigate('/login');
      } else if (error.message?.includes('STRIPE_SECRET_KEY')) {
        alert('Payment system is not configured. Please contact support or configure Stripe integration.');
      } else {
        alert(`Failed to start checkout: ${error.message || 'Please try again.'}`);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1113] py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-3 mb-6">
            <img
              src="/untitled_project_-_standard_1_(13).png"
              alt="PROMTP Logo"
              className="w-16 h-16 object-contain"
            />
            <span className="text-4xl font-bold text-white">PROMTP</span>
          </div>
          <h1 className="text-5xl font-bold text-white mb-6">
            Choose Your Plan
          </h1>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto mb-4">
            Select the perfect plan for your concert promotion business.
            All plans include professional features to streamline your workflow.
          </p>
          <p className="text-lg text-[#C4FF0D] font-semibold">
            14-day free trial included with all plans
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {STRIPE_PRODUCTS.map((product, index) => (
            <PricingCard
              key={product.id}
              product={product}
              onSubscribe={handleSubscribe}
              isPopular={index === 1}
            />
          ))}
        </div>

        {isAuthenticated && (
          <div className="text-center mt-16">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-[#C4FF0D] hover:text-[#A8D90B] font-medium text-lg transition-colors"
            >
              ← Back to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}