import React from 'react';
import { useSubscription } from '../../hooks/useSubscription';
import { Crown, Calendar, CreditCard } from 'lucide-react';

export function SubscriptionCard() {
  const { subscription, loading, getActiveProduct, isActive } = useSubscription();

  if (loading) {
    return (
      <div className="bg-[#1A1F1E] border border-gray-800 rounded-2xl p-6 animate-pulse">
        <div className="h-4 bg-gray-700 rounded w-1/3 mb-4"></div>
        <div className="h-6 bg-gray-700 rounded w-1/2 mb-2"></div>
        <div className="h-4 bg-gray-700 rounded w-2/3"></div>
      </div>
    );
  }

  const activeProduct = getActiveProduct();

  if (!subscription || !isActive()) {
    return (
      <div className="bg-[#1A1F1E] rounded-2xl border-2 border-dashed border-gray-700 p-6">
        <div className="text-center">
          <Crown className="mx-auto h-12 w-12 text-gray-600" />
          <h3 className="mt-2 text-sm font-medium text-white">No Active Subscription</h3>
          <p className="mt-1 text-sm text-gray-400">
            Subscribe to access premium features
          </p>
        </div>
      </div>
    );
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  return (
    <div className="bg-[#1A1F1E] rounded-2xl shadow-lg p-6 border-l-4 border-[#C4FF0D]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Crown className="h-6 w-6 text-[#C4FF0D] mr-2" />
          <h3 className="text-lg font-semibold text-white">
            {activeProduct?.name || 'Premium Subscription'}
          </h3>
        </div>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
          Active
        </span>
      </div>

      {activeProduct && (
        <p className="text-sm text-gray-300 mb-4">{activeProduct.description}</p>
      )}

      <div className="space-y-3">
        {subscription.current_period_end && (
          <div className="flex items-center text-sm text-gray-300">
            <Calendar className="h-4 w-4 mr-2 text-[#C4FF0D]" />
            <span>Renews on {formatDate(subscription.current_period_end)}</span>
          </div>
        )}

        {subscription.payment_method_brand && subscription.payment_method_last4 && (
          <div className="flex items-center text-sm text-gray-300">
            <CreditCard className="h-4 w-4 mr-2 text-[#C4FF0D]" />
            <span>
              {subscription.payment_method_brand.toUpperCase()} ending in {subscription.payment_method_last4}
            </span>
          </div>
        )}

        {subscription.cancel_at_period_end && (
          <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <p className="text-sm text-yellow-400">
              Your subscription will cancel at the end of the current period.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}