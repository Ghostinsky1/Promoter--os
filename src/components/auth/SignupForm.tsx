import { SignupWithOrganization } from './SignupWithOrganization';

export function SignupForm() {
  return <SignupWithOrganization />;
}

export function SignupFormLegacy() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters long' });
      setLoading(false);
      return;
    }

    try {
      sessionStorage.setItem('signup_email', email);
      sessionStorage.setItem('signup_password', password);

      const product = STRIPE_PRODUCTS[0];
      if (!product) {
        setMessage({ type: 'error', text: 'No subscription plan available' });
        setLoading(false);
        return;
      }

      const origin = window.location.origin;

      const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke(
        'stripe-checkout',
        {
          body: {
            price_id: product.priceId,
            mode: product.mode,
            success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/signup`,
            email,
            metadata: {
              signup_flow: 'true'
            }
          }
        }
      );

      if (checkoutError) {
        console.error('Checkout error:', checkoutError);
        setMessage({ type: 'error', text: 'Failed to create checkout session' });
        setLoading(false);
        return;
      }

      if (checkoutData?.url) {
        setMessage({ type: 'success', text: 'Redirecting to checkout...' });
        window.location.href = checkoutData.url;
      } else {
        setMessage({ type: 'error', text: 'No checkout URL received' });
        setLoading(false);
      }
    } catch (error) {
      console.error('Signup error:', error);
      setMessage({ type: 'error', text: 'An unexpected error occurred' });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1140F0] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <img
              src="/promoter-os-mark.png"
              alt="PROMOTER OS Logo"
              className="w-12 h-12 object-contain"
            />
            <span className="text-3xl font-bold text-white">PROMOTER OS</span>
          </div>
          <p className="text-[#A8B2C1]">Create your free account - no credit card required</p>
        </div>

        <div className="bg-[#22262F] border border-gray-800 rounded-2xl p-8">
          <h2 className="text-2xl font-bold text-white mb-6">Create Account</h2>

          {message && (
            <div
              className={`rounded-xl p-4 mb-6 ${
                message.type === 'error'
                  ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                  : 'bg-[#8FD3FF]/10 text-[#8FD3FF] border border-[#8FD3FF]/20'
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
                className="w-full bg-[#14171E] border border-gray-700 text-white placeholder:text-gray-600 rounded-xl h-12 px-4 focus:border-[#8FD3FF] focus:ring-[#8FD3FF] focus:ring-1 focus:outline-none"
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
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#14171E] border border-gray-700 text-white placeholder:text-gray-600 rounded-xl h-12 px-4 pr-12 focus:border-[#8FD3FF] focus:ring-[#8FD3FF] focus:ring-1 focus:outline-none"
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
              <p className="text-xs text-[#6B7280] mt-1">Must be at least 6 characters</p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-white mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#14171E] border border-gray-700 text-white placeholder:text-gray-600 rounded-xl h-12 px-4 pr-12 focus:border-[#8FD3FF] focus:ring-[#8FD3FF] focus:ring-1 focus:outline-none"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-4 flex items-center"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-600" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-600" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  required
                  className="w-4 h-4 rounded border-gray-700 bg-[#14171E] text-[#8FD3FF] focus:ring-[#8FD3FF] mt-1"
                />
                <span className="text-sm text-[#A8B2C1]">
                  I agree to the{' '}
                  <a href="#" className="text-[#8FD3FF] hover:text-[#6FB8F2]">Terms of Service</a>
                  {' '}and{' '}
                  <a href="#" className="text-[#8FD3FF] hover:text-[#6FB8F2]">Privacy Policy</a>
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#8FD3FF] hover:bg-[#6FB8F2] text-[#04214D] font-bold h-12 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : 'Create Account →'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-[#A8B2C1]">
              Already have an account?{' '}
              <Link to="/login" className="text-[#8FD3FF] hover:text-[#6FB8F2] font-semibold">
                Sign in
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-8 p-6 bg-[#22262F]/50 border border-gray-800 rounded-2xl">
          <h3 className="font-bold text-white mb-4 text-center">What you get:</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-[#8FD3FF] flex-shrink-0" />
              <span className="text-sm text-[#A8B2C1]">14-day free trial, no credit card</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-[#8FD3FF] flex-shrink-0" />
              <span className="text-sm text-[#A8B2C1]">Professional offer creation</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-[#8FD3FF] flex-shrink-0" />
              <span className="text-sm text-[#A8B2C1]">Settlement tracking & analytics</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-[#8FD3FF] flex-shrink-0" />
              <span className="text-sm text-[#A8B2C1]">Cancel anytime, no strings attached</span>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link to="/" className="text-sm text-[#A8B2C1] hover:text-[#8FD3FF]">
            ← Back to homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
