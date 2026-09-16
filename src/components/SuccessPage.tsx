import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ArrowRight, Loader2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { track } from '../lib/track';

export function SuccessPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [countdown, setCountdown] = useState(10);
  const [verifying, setVerifying] = useState(true);
  const firedRef = useRef(false);

  useEffect(() => {
    const verifySubscription = async () => {
      const sessionId = searchParams.get('session_id');

      if (sessionId) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      setVerifying(false);
    };

    verifySubscription();
  }, [searchParams]);

  // Fire the conversion once, after Stripe sends the customer back.
  useEffect(() => {
    if (verifying || firedRef.current) return;
    firedRef.current = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: org } = await supabase
        .from('organizations')
        .select('subscription_tier')
        .limit(1)
        .maybeSingle();
      // 7-day trial, so the money lands later — report the plan's monthly value.
      const tier = org?.subscription_tier ?? 'starter';
      const value = tier === 'agency_scale' ? 297 : tier === 'pro' ? 99 : 39;
      track('StartTrial', {
        value,
        currency: 'USD',
        email: user?.email ?? undefined,
        userId: user?.id,
        custom: { content_name: `PROMOTER OS ${tier}`, predicted_ltv: value * 12 },
      });
      track('Subscribe', {
        value,
        currency: 'USD',
        email: user?.email ?? undefined,
        userId: user?.id,
        custom: { content_name: `PROMOTER OS ${tier}` },
      });
    })();
  }, [verifying]);

  useEffect(() => {
    if (verifying) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          navigate('/dashboard');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate, verifying]);

  if (verifying) {
    return (
      <div className="min-h-screen bg-[#1140F0] flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <Loader2 className="h-12 w-12 text-[#8FD3FF] animate-spin mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-white mb-4">
            Setting up your account...
          </h2>
          <p className="text-gray-400">
            Please wait while we verify your subscription
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1140F0] flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 bg-[#8FD3FF]/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="h-12 w-12 text-[#8FD3FF]" />
        </div>

        <h1 className="text-3xl font-bold text-white mb-4">
          Welcome to PROMOTER OS!
        </h1>

        <p className="text-lg text-gray-400 mb-8">
          Your account is ready. Start creating professional offers and managing your events.
        </p>

        <div className="bg-[#14171E] border border-gray-800 p-6 rounded-2xl mb-8">
          <h3 className="font-semibold text-white mb-4">Get Started:</h3>
          <ul className="text-left space-y-3 text-gray-400">
            <li className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-[#8FD3FF] mt-0.5 flex-shrink-0" />
              <span>Create your first offer</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-[#8FD3FF] mt-0.5 flex-shrink-0" />
              <span>Set up your company settings</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-[#8FD3FF] mt-0.5 flex-shrink-0" />
              <span>Explore deal structures and pricing</span>
            </li>
          </ul>
        </div>

        <button
          onClick={() => navigate('/dashboard')}
          className="w-full bg-[#8FD3FF] hover:bg-[#6FB8F2] text-[#04214D] px-6 py-4 rounded-2xl font-bold transition-colors flex items-center justify-center gap-2"
        >
          Go to Dashboard
          <ArrowRight className="h-4 w-4" />
        </button>

        <p className="text-sm text-gray-500 mt-4">
          Redirecting automatically in {countdown} seconds...
        </p>
      </div>
    </div>
  );
}