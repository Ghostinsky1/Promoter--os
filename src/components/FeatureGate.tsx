import { ReactNode } from 'react';
import { Lock, ArrowRight } from 'lucide-react';
import { useOrganization } from '../hooks/useOrganization';
import { useNavigate } from 'react-router-dom';

interface FeatureGateProps {
  feature: string;
  children: ReactNode;
  fallback?: ReactNode;
  showUpgrade?: boolean;
}

export function FeatureGate({ feature, children, fallback, showUpgrade = true }: FeatureGateProps) {
  const { hasFeature, loading, organization } = useOrganization();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8FD3FF]"></div>
      </div>
    );
  }

  const hasAccess = hasFeature(feature);

  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }

    if (!showUpgrade) {
      return null;
    }

    return (
      <div className="p-8 md:p-12 bg-[#14171E] border-2 border-gray-800 rounded-3xl text-center max-w-2xl mx-auto">
        <div className="w-16 h-16 bg-gray-800/50 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Lock className="h-8 w-8 text-gray-600" />
        </div>
        <h3 className="text-2xl md:text-3xl font-bold text-white mb-3">
          Upgrade to Access This Feature
        </h3>
        <p className="text-gray-400 mb-2 text-lg">
          This feature is available on <span className="text-[#8FD3FF] font-semibold">Pro</span> and above.
        </p>
        <p className="text-gray-500 mb-8">
          Current plan: <span className="text-white font-medium">{organization?.subscription_tier || 'Starter'}</span>
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => navigate('/pricing')}
            className="bg-[#8FD3FF] text-[#04214D] hover:bg-[#6FB8F2] px-8 py-4 rounded-2xl font-bold transition-colors inline-flex items-center justify-center gap-2"
          >
            View Plans <ArrowRight className="h-5 w-5" />
          </button>
          <button
            onClick={() => navigate('/')}
            className="border-2 border-gray-700 text-white hover:bg-[#22262F] px-8 py-4 rounded-2xl font-semibold transition-colors"
          >
            Go Back
          </button>
        </div>

        <div className="mt-8 p-6 bg-[#22262F] border border-gray-800 rounded-2xl">
          <p className="text-sm font-semibold text-white mb-3">Pro Plan Includes:</p>
          <ul className="text-sm text-gray-400 space-y-2">
            <li>✓ Unlimited events & offers</li>
            <li>✓ Tour Management</li>
            <li>✓ AI Insights & Deal Analyzer</li>
            <li>✓ Advanced analytics</li>
            <li>✓ Priority support</li>
          </ul>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function FeatureGateInline({ feature, children }: { feature: string; children: ReactNode }) {
  const { hasFeature, loading } = useOrganization();

  if (loading) {
    return null;
  }

  const hasAccess = hasFeature(feature);

  if (!hasAccess) {
    return null;
  }

  return <>{children}</>;
}
