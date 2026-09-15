import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Loader2, ArrowRight } from 'lucide-react';

export function Success() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    
    if (!sessionId) {
      setError('No session ID found');
      setLoading(false);
      return;
    }

    // Give some time for the webhook to process
    const timer = setTimeout(() => {
      setLoading(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, [searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F1113] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-[#1A1D1F] border border-gray-800 rounded-3xl p-8 text-center">
          <Loader2 className="w-16 h-16 text-[#C4FF0D] mx-auto mb-6 animate-spin" />
          <h1 className="text-2xl font-bold text-white mb-4">
            Processing Your Subscription
          </h1>
          <p className="text-gray-400">
            Please wait while we set up your account. This may take a few seconds.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0F1113] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-[#1A1D1F] border border-gray-800 rounded-3xl p-8 text-center">
          <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">
            Something went wrong
          </h1>
          <p className="text-gray-400 mb-8">
            {error}. Please contact support if this issue persists.
          </p>
          <button
            onClick={() => navigate('/pricing')}
            className="bg-[#C4FF0D] hover:bg-[#A3D60A] text-black font-bold py-3 px-6 rounded-2xl transition-colors inline-flex items-center"
          >
            Go to Pricing
            <ArrowRight className="w-4 h-4 ml-2" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F1113] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-[#1A1D1F] border border-gray-800 rounded-3xl p-8 text-center">
        <div className="w-16 h-16 bg-[#C4FF0D]/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-8 h-8 text-[#C4FF0D]" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-4">
          Subscription Activated!
        </h1>
        <p className="text-gray-400 mb-8">
          Your subscription has been successfully activated. You now have access to all premium features.
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          className="bg-[#C4FF0D] hover:bg-[#A3D60A] text-black font-bold py-3 px-6 rounded-2xl transition-colors inline-flex items-center"
        >
          Go to Dashboard
          <ArrowRight className="w-4 h-4 ml-2" />
        </button>
      </div>
    </div>
  );
}