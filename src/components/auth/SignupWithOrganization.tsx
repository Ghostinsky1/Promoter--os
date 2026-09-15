import { useState } from 'react';
import { supabase } from '../../lib/supabase';

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

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            organization_name: formData.organizationName
          }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Signup failed');

      const orgSlug = formData.organizationName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: formData.organizationName,
          slug: orgSlug,
          subscription_tier: 'starter',
          subscription_status: 'incomplete',
          max_offers: 10,
          max_seats: 1
        })
        .select()
        .single();

      if (orgError) throw orgError;

      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({
          organization_id: orgData.id,
          user_id: authData.user.id,
          role: 'owner',
          is_active: true
        });

      if (memberError) throw memberError;

      const { error: settingsError } = await supabase
        .from('company_settings')
        .insert({
          user_id: authData.user.id,
          organization_id: orgData.id,
          company_name: formData.organizationName
        });

      if (settingsError) {
        console.warn('Could not create company settings:', settingsError);
      }

      window.location.href = '/pricing';
    } catch (err: any) {
      console.error('Signup error:', err);
      setError(err.message || 'Failed to create account');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1140F0] flex items-center justify-center p-6">
      <div className="bg-[#14171E] border border-gray-800 rounded-3xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <img
              src="/untitled_project_-_standard_1_(13).png"
              alt="PROMTP Logo"
              className="w-12 h-12 object-contain"
            />
            <span className="text-3xl font-bold text-white">PROMTP</span>
          </div>
          <p className="text-gray-400">Create your account</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl">
            <p className="text-red-500 text-sm">{error}</p>
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
