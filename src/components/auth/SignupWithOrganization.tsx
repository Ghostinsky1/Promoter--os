import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { checkSignupEmail } from '../../lib/emailValidation';
import { MailCheck } from 'lucide-react';

interface SignupFormData {
  organizationName: string;
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  tier: string;
}

export function SignupWithOrganization() {
  const [formData, setFormData] = useState<SignupFormData>({
    organizationName: '',
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    tier: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [redirectingToCheckout, setRedirectingToCheckout] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState<string | null>(null);
  const [emailSuggestion, setEmailSuggestion] = useState<string | null>(null);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    const emailCheck = checkSignupEmail(formData.email);
    if (!emailCheck.ok) {
      setError(emailCheck.reason || 'Please enter a valid email address');
      setEmailSuggestion(emailCheck.suggestion || null);
      setLoading(false);
      return;
    }
    setEmailSuggestion(null);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/pricing`,
          data: {
            full_name: formData.fullName.trim(),
            organization_name: formData.organizationName.trim()
          }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Signup failed');

      // Supabase returns a user with no identities when the email is already registered
      if (Array.isArray(authData.user.identities) && authData.user.identities.length === 0) {
        throw new Error('An account with this email already exists. Try signing in instead.');
      }

      // The organization, owner membership and company settings are created by a database
      // trigger the moment the user is created — nothing to insert from the browser.

      if (!authData.session) {
        // Email confirmation is on: they need to click the link we just sent
        setAwaitingConfirmation(formData.email.trim().toLowerCase());
        setLoading(false);
        return;
      }

      window.location.href = '/pricing';
    } catch (err: any) {
      console.error('Signup error:', err);
      setError(err.message || 'Failed to create account');
      setLoading(false);
    }
  };

  if (awaitingConfirmation) {
    return (
      <div className="min-h-screen bg-[#1140F0] flex items-center justify-center p-6">
        <div className="bg-[#14171E] border border-gray-800 rounded-3xl p-8 max-w-md w-full text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-[#8FD3FF]/15 flex items-center justify-center mb-5">
            <MailCheck className="h-8 w-8 text-[#8FD3FF]" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Check your inbox</h2>
          <p className="text-gray-400 mb-6">
            We sent a confirmation link to <span className="text-white font-semibold">{awaitingConfirmation}</span>.
            Click it to activate your account and pick a plan.
          </p>
          <p className="text-gray-500 text-sm mb-6">Not there? Check your spam or promotions folder. The link expires in 24 hours.</p>
          <button
            onClick={async () => {
              const { error: resendErr } = await supabase.auth.resend({ type: 'signup', email: awaitingConfirmation, options: { emailRedirectTo: `${window.location.origin}/pricing` } });
              setError(resendErr ? resendErr.message : '');
              if (!resendErr) alert('Confirmation email sent again.');
            }}
            className="text-[#8FD3FF] hover:text-[#6FB8F2] font-semibold text-sm"
          >
            Resend the email
          </button>
          {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
          <div className="mt-8 pt-6 border-t border-gray-800">
            <a href="/login" className="text-gray-400 hover:text-white text-sm">Back to sign in</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1140F0] flex items-center justify-center p-6">
      <div className="bg-[#14171E] border border-gray-800 rounded-3xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <img
              src="/promoter-os-mark.png"
              alt="PROMOTER OS Logo"
              className="w-12 h-12 object-contain"
            />
            <span className="text-3xl font-bold text-white">PROMOTER OS</span>
          </div>
          <p className="text-gray-400">Create your account</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl">
            <p className="text-red-500 text-sm">{error}</p>
            {emailSuggestion && (
              <button type="button" onClick={() => { setFormData({ ...formData, email: emailSuggestion }); setError(''); setEmailSuggestion(null); }} className="mt-2 text-[#8FD3FF] hover:text-[#6FB8F2] text-sm font-semibold">
                Use {emailSuggestion}
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-5">
          <div>
            <label className="text-white mb-2 block text-sm font-medium">
              Organization Name
            </label>
            <input
              type="text"
              placeholder="Your Company Name"
              className="w-full bg-[#0B0D12] border border-gray-700 text-white rounded-2xl px-4 py-3 focus:outline-none focus:border-[#8FD3FF]"
              value={formData.organizationName}
              onChange={(e) => setFormData({ ...formData, organizationName: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="text-white mb-2 block text-sm font-medium">
              Full Name
            </label>
            <input
              type="text"
              placeholder="John Doe"
              className="w-full bg-[#0B0D12] border border-gray-700 text-white rounded-2xl px-4 py-3 focus:outline-none focus:border-[#8FD3FF]"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="text-white mb-2 block text-sm font-medium">
              Email
            </label>
            <input
              type="email"
              placeholder="you@company.com"
              className="w-full bg-[#0B0D12] border border-gray-700 text-white rounded-2xl px-4 py-3 focus:outline-none focus:border-[#8FD3FF]"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="text-white mb-2 block text-sm font-medium">
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full bg-[#0B0D12] border border-gray-700 text-white rounded-2xl px-4 py-3 focus:outline-none focus:border-[#8FD3FF]"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              minLength={6}
            />
          </div>

          <div>
            <label className="text-white mb-2 block text-sm font-medium">
              Confirm Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full bg-[#0B0D12] border border-gray-700 text-white rounded-2xl px-4 py-3 focus:outline-none focus:border-[#8FD3FF]"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#8FD3FF] text-[#04214D] hover:bg-[#6FB8F2] rounded-2xl py-4 font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating Account...' : 'Continue to Plan Selection →'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-400 text-sm">
            Already have an account?{' '}
            <a href="/login" className="text-[#8FD3FF] hover:text-[#6FB8F2] font-semibold">
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
