import { AlertTriangle, Clock, CreditCard, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useOrganization } from '../hooks/useOrganization';

export function TrialBanner() {
  const navigate = useNavigate();
  const { organization, getDaysLeftInTrial, isInGracePeriod, isTrialExpired } = useOrganization();

  if (!organization) return null;

  const daysLeft = getDaysLeftInTrial();
  const inTrial = organization.subscription_status === 'trialing' && !isTrialExpired();
  const inGrace = organization.subscription_status === 'past_due' && isInGracePeriod();
  const isActive = organization.subscription_status === 'active';

  if (isActive) return null;

  if (inTrial && daysLeft > 0) {
    const isUrgent = daysLeft <= 3;
    return (
      <div className={`${isUrgent ? 'bg-red-900/20 border-red-700/50' : 'bg-yellow-900/20 border-yellow-700/50'} border-b border-t`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Clock className={`h-5 w-5 ${isUrgent ? 'text-red-500' : 'text-yellow-500'}`} />
              <div>
                <p className={`font-semibold ${isUrgent ? 'text-red-400' : 'text-yellow-400'}`}>
                  {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left in your trial
                </p>
                <p className={`text-sm ${isUrgent ? 'text-red-500' : 'text-yellow-600'}`}>
                  Subscribe now to continue using all features
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/pricing')}
              className={`${isUrgent ? 'bg-red-600 hover:bg-red-700' : 'bg-[#C4FF0D] hover:bg-[#A3D60A]'} ${isUrgent ? 'text-white' : 'text-black'} px-6 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2`}
            >
              Subscribe Now <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (inGrace) {
    return (
      <div className="bg-red-900/20 border-b border-t border-red-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <div>
                <p className="font-semibold text-red-400">
                  Payment Failed - Grace Period Active
                </p>
                <p className="text-sm text-red-500">
                  Update your payment method within 14 days to avoid losing access
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/pricing')}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2"
            >
              Update Payment <CreditCard className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
