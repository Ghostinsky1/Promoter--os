import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function SuccessPage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accountCreated, setAccountCreated] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    createAccountAfterPayment();
  }, []);

  const createAccountAfterPayment = async () => {
    try {
      // Get stored credentials from sessionStorage
      const email = sessionStorage.getItem('signup_email');
      const password = sessionStorage.getItem('signup_password');

      if (!email || !password) {
        // User might have refreshed or credentials missing
        setLoading(false);
        setAccountCreated(true); // Assume account exists, let them continue
        return;
      }

      // Create the account now that payment is successful
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: undefined,
        },
      });

      if (signUpError) {
        // Check if user already exists
        if (signUpError.message.includes('already registered')) {
          // Sign them in instead
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (signInError) {
            setError('Account exists but sign in failed. Please try logging in manually.');
          } else {
            setAccountCreated(true);
          }
        } else {
          setError(signUpError.message);
        }
      } else {
        setAccountCreated(true);
      }

      // Clear stored credentials
      sessionStorage.removeItem('signup_email');
      sessionStorage.removeItem('signup_password');

      setLoading(false);

      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (err) {
      console.error('Account creation error:', err);
      setError('Failed to create account. Please contact support.');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-lg text-gray-600">Creating your account...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto h-16 w-16 bg-red-100 rounded-full flex items-center justify-center">
              <span className="text-3xl">⚠️</span>
            </div>
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              Account Setup Issue
            </h2>
            <p className="mt-2 text-sm text-red-600">
              {error}
            </p>
            <div className="mt-6">
              <button
                onClick={() => navigate('/login')}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Go to Login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Welcome to MusicOffers!
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Your payment was successful and your account has been created.
          </p>
          {accountCreated && (
            <p className="mt-2 text-sm text-green-600 font-medium">
              ✓ Account created successfully
            </p>
          )}
          <p className="mt-4 text-sm text-gray-500">
            Redirecting to dashboard...
          </p>
        </div>

        <div className="mt-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Continue to Dashboard
            <ArrowRight className="ml-2 h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}