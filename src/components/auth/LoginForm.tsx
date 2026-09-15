import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Eye, EyeOff, Music } from 'lucide-react';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMessage({ type: 'error', text: error.message });
      } else {
        setMessage({ type: 'success', text: 'Successfully logged in!' });
        navigate('/');
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An unexpected error occurred' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1113] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <img
              src="/untitled_project_-_standard_1_(13).png"
              alt="PROMTP Logo"
              className="w-12 h-12 object-contain"
            />
            <span className="text-3xl font-bold text-white">PROMTP</span>
          </div>
          <p className="text-[#A8B3B8]">Welcome back! Sign in to your account</p>
        </div>

        <div className="bg-[#252A2E] border border-gray-800 rounded-2xl p-8">
          <h2 className="text-2xl font-bold text-white mb-6">Sign In</h2>

          {message && (
            <div
              className={`rounded-xl p-4 mb-6 ${
                message.type === 'error'
                  ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                  : 'bg-[#C4FF0D]/10 text-[#C4FF0D] border border-[#C4FF0D]/20'
              }`}
            >
              {message.text}
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white mb-2">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full bg-[#1A1D1F] border-gray-700 text-white placeholder:text-gray-600 rounded-xl h-12 px-4 focus:border-[#C4FF0D] focus:ring-[#C4FF0D] focus:ring-1 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-white mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#1A1D1F] border border-gray-700 text-white placeholder:text-gray-600 rounded-xl h-12 px-4 pr-12 focus:border-[#C4FF0D] focus:ring-[#C4FF0D] focus:ring-1 focus:outline-none"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-4 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-600" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-600" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-gray-700 bg-[#1A1D1F] text-[#C4FF0D] focus:ring-[#C4FF0D]"
                />
                <span className="text-sm text-[#A8B3B8]">Remember me</span>
              </label>
              <a href="#" className="text-sm text-[#C4FF0D] hover:text-[#A3D60A]">
                Forgot password?
              </a>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#C4FF0D] hover:bg-[#A3D60A] text-black font-bold h-12 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign In →'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-[#A8B3B8]">
              Don't have an account?{' '}
              <Link to="/signup" className="text-[#C4FF0D] hover:text-[#A3D60A] font-semibold">
                Create one free
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link to="/" className="text-sm text-[#A8B3B8] hover:text-[#C4FF0D]">
            ← Back to homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
