import React, { useEffect, useState } from 'react';
import { Crown, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { STRIPE_PRODUCTS } from '../stripe-config';

interface SubscriptionStatusProps {
  className?: string;
}

export function SubscriptionStatus({ className }: SubscriptionStatusProps) {
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    try {
      const { data, error } = await supabase
        .from('stripe_user_subscriptions')
        .select('*')
        .eq('subscription_status', 'active')
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching subscription:', error);
        return;
      }

      setSubscription(data);
    } catch (error) {
      console.error('Error fetching subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center text-gray-500 ${className}`}>
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        <span className="text-sm">Loading...</span>
      </div>
    );
  }

  if (!subscription) {
    return null;
  }

  const product = STRIPE_PRODUCTS.find(p => p.priceId === subscription.price_id);
  
  return (
    <div className={`flex items-center text-indigo-600 ${className}`}>
      <Crown className="w-4 h-4 mr-2" />
      <span className="text-sm font-medium">
        {product?.name || 'Premium Plan'}
      </span>
    </div>
  );
}