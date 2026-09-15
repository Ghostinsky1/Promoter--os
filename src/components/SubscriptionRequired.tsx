import { AlertTriangle, CreditCard, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useOrganization } from '../hooks/useOrganization';
import { useEffect } from 'react';

export function SubscriptionRequired() {
  const navigate = useNavigate();
  const { organization, isTrialExpired, isInGracePeriod } = useOrganization();

  // Auto-redirect to pricing if no organization found (likely new signup)
  useEffect(() => {
    if (!organization) {
      const timer = setTimeout(() => {
        navigate('/pricing');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [organization, navigate]);

  const getMessage = () => {
    if (!organization) {
      return {
        title: 'Complete Your Setup',
        description: 'Redirecting you to select a subscription plan...',
        icon: CreditCard
      };
    }

    if (isTrialExpired()) {
      return {
        title: 'Trial Expired',
        description: 'Your 14-day trial has ended. Subscribe now to continue using the platform.',
        icon: Calendar
      };
    }

    if (organization.subscription_status === 'past_due') {
      if (isInGracePeriod()) {
        return {
          title: 'Payment Failed - Grace Period Active',
          description: 'Your payment failed, but you still have access for 14 days. Please update your payment method immediately to avoid losing access to your data.',
          icon: AlertTriangle
        };
      } else {
        return {
          title: 'Payment Failed - Access Suspended',
          description: 'Your payment failed over 14 days ago. Update your payment method to restore access to your account and data.',
          icon: CreditCard
        };
      }
    }

    if (organization.subscription_status === 'canceled') {
      return {
        title: 'Subscription Canceled',
        description: 'Your subscription has been canceled. Resubscribe to regain access to your account.',
        icon: AlertTriangle
      };
    }

    return {
      title: 'Subscription Required',
      description: 'Subscribe to continue using the platform.',
      icon: CreditCard
    };
  };

  const message = getMessage();
  const Icon = message.icon;

  return (
    <div className="min-h-screen bg-[#1140F0] flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="bg-[#14171E] border-2 border-red-900/50 rounded-3xl p-8 md:p-12 text-center">
          <div className="w-20 h-20 bg-red-900/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Icon className="h-10 w-10 text-red-500" />
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
            {message.title}
          </h1>

          <p className="text-gray-400 text-lg mb-8">
            {message.description}
          </p>

          {organization?.subscription_status === 'past_due' && isInGracePeriod() && (
            <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-xl p-4 mb-8">
              <p className="text-yellow-500 font-semibold">
                Warning: You are in a 14-day grace period
              </p>
              <p className="text-yellow-600 text-sm mt-1">
                Update your payment method now to avoid losing access to your data
              </p>
            </div>
          )}

          {organization?.subscription_status === 'past_due' && !isInGracePeriod() && (
            <div className="bg-red-900/20 border border-red-700/50 rounded-xl p-4 mb-8">
              <p className="text-red-500 font-semibold">
                Your data is still safe
              </p>
              <p className="text-red-400 text-sm mt-1">
                Subscribe now to restore access. Your data will not be deleted.
              </p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <button
              onClick={() => navigate('/pricing')}
              className="bg-[#8FD3FF] text-[#04214D] hover:bg-[#6FB8F2] px-8 py-4 rounded-2xl font-bold transition-colors"
            >
              {organization?.subscription_status === 'past_due' ? 'Update Payment' : 'View Plans'}
            </button>
            <button
              onClick={() => navigate('/')}
              className="border-2 border-gray-700 text-white hover:bg-[#22262F] px-8 py-4 rounded-2xl font-semibold transition-colors"
            >
              Go to Dashboard
            </button>
          </div>

          <div className="bg-[#22262F] border border-gray-800 rounded-2xl p-6">
            <h3 className="text-white font-semibold mb-4">What You Get With Pro:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-left">
              <div className="flex items-start gap-2">
                <span className="text-[#8FD3FF] mt-1">✓</span>
                <span className="text-gray-400 text-sm">Unlimited events & offers</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#8FD3FF] mt-1">✓</span>
                <span className="text-gray-400 text-sm">Tour management</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#8FD3FF] mt-1">✓</span>
                <span className="text-gray-400 text-sm">AI insights & deal analyzer</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#8FD3FF] mt-1">✓</span>
                <span className="text-gray-400 text-sm">Advanced analytics</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#8FD3FF] mt-1">✓</span>
                <span className="text-gray-400 text-sm">Settlement tracking</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#8FD3FF] mt-1">✓</span>
                <span className="text-gray-400 text-sm">Priority support</span>
              </div>
            </div>
          </div>
        </div>

        {organization && (
          <div className="mt-6 text-center">
            <p className="text-gray-500 text-sm">
              Organization: <span className="text-gray-400 font-medium">{organization.name}</span>
              {' • '}
              Status: <span className="text-gray-400 font-medium capitalize">{organization.subscription_status}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
