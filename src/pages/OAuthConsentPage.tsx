import { useEffect, useState } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { ShieldCheck, Check } from 'lucide-react';

// Shown when an AI app (e.g. Claude) asks to connect to a promoter's PromoterOS account.
// Supabase Auth sends the browser here with ?authorization_id=...
// Setup: Supabase → Authentication → OAuth Server → Authorization Path = /oauth/consent

type Details = {
  authorization_id: string;
  redirect_uri: string;
  scope: string;
  client: { id: string; name: string; uri: string; logo_uri: string };
  user: { id: string; email: string };
};

const CAN_DO = [
  'See your shows, offers, lineup, tasks, notes and settlements',
  'Create and edit offers, lineup artists, tasks, notes and run of show',
  'Run deal, break-even and settlement numbers',
];

export default function OAuthConsentPage() {
  const { user, loading: authLoading } = useAuth();
  const [params] = useSearchParams();
  const location = useLocation();
  const authorizationId = params.get('authorization_id');
  const [details, setDetails] = useState<Details | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user || !authorizationId) return;
    (async () => {
      const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
      if (error) return setError(error.message);
      if (data && 'redirect_url' in data && data.redirect_url) {
        // Already approved before — send them straight back.
        window.location.href = data.redirect_url;
        return;
      }
      setDetails(data as Details);
    })();
  }, [user, authorizationId]);

  if (authLoading) return <Shell><p className="text-gray-400">Loading…</p></Shell>;

  if (!authorizationId) {
    return <Shell><p className="text-[#FF7A7A]">This link is missing its authorization code. Start the connection again from Claude.</p></Shell>;
  }

  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  const decide = async (approve: boolean) => {
    setBusy(true);
    setError(null);
    const fn = approve ? supabase.auth.oauth.approveAuthorization : supabase.auth.oauth.denyAuthorization;
    const { data, error } = await fn.call(supabase.auth.oauth, authorizationId, { skipBrowserRedirect: true });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    if (data?.redirect_url) window.location.href = data.redirect_url;
  };

  const appName = details?.client?.name || 'An app';

  return (
    <Shell>
      {error && (
        <div className="rounded-xl p-4 mb-6 bg-[#FF7A7A]/10 text-[#FF9E9E] border border-[#FF7A7A]/30 text-sm">{error}</div>
      )}
      {!details && !error && <p className="text-gray-400">Loading request…</p>}
      {details && (
        <>
          <p className="font-label text-[11px] tracking-[0.22em] text-[#8FD3FF] uppercase mb-3">[ Connect ]</p>
          <div className="flex items-start gap-4 mb-6">
            {details.client.logo_uri ? (
              <img src={details.client.logo_uri} alt="" className="w-12 h-12 rounded-xl object-contain bg-white/5 flex-shrink-0" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-[#8FD3FF]/15 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-6 h-6 text-[#8FD3FF]" />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-xl text-white leading-tight">{appName} wants to connect</h2>
              <p className="text-sm text-gray-400 mt-1 break-words">to PROMOTER OS as {details.user.email}</p>
            </div>
          </div>

          <p className="font-label text-xs tracking-wider uppercase text-gray-300 mb-3">If you allow it, {appName} can</p>
          <ul className="space-y-2.5 mb-6">
            {CAN_DO.map((t) => (
              <li key={t} className="flex items-start gap-3 text-sm text-gray-200">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-[#8FD3FF]/15 flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3 text-[#8FD3FF]" />
                </span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
          <div className="rounded-2xl border border-[#2A3040] bg-[#0B0D12] p-4 text-xs text-gray-400 mb-6 leading-relaxed">
            It only sees your own organization's data, and every action runs under your login. You can disconnect it anytime from {appName}'s settings.
            {details.client.uri && <span className="block mt-1 text-gray-500">App website: {details.client.uri}</span>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => decide(false)}
              disabled={busy}
              className="h-12 rounded-xl bg-[#22262F] hover:bg-[#2A3040] border border-[#2A3040] text-white font-bold disabled:opacity-50 transition-colors"
            >
              Deny
            </button>
            <button
              onClick={() => decide(true)}
              disabled={busy}
              className="h-12 rounded-xl bg-[#8FD3FF] hover:bg-[#6FB8F2] text-[#04214D] font-bold disabled:opacity-50 transition-colors"
            >
              {busy ? 'Working…' : 'Allow'}
            </button>
          </div>
        </>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#1140F0] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3">
            <img src="/untitled_project_-_standard_1_(13).png" alt="PROMOTER OS Logo" className="w-10 h-10 object-contain" />
            <span className="text-2xl text-white font-display">PROMOTER OS</span>
          </div>
        </div>
        <div className="bg-[#14171E] border border-gray-800 rounded-3xl p-6 sm:p-8">{children}</div>
      </div>
    </div>
  );
}
