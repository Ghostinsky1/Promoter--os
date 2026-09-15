import { useEffect, useState } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { ShieldCheck } from 'lucide-react';

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

  if (authLoading) return <Shell><p className="text-[#A8B3B8]">Loading…</p></Shell>;

  if (!authorizationId) {
    return <Shell><p className="text-red-400">This link is missing its authorization code. Start the connection again from Claude.</p></Shell>;
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
        <div className="rounded-xl p-4 mb-6 bg-red-500/10 text-red-400 border border-red-500/20">{error}</div>
      )}
      {!details && !error && <p className="text-[#A8B3B8]">Loading request…</p>}
      {details && (
        <>
          <div className="flex items-center gap-3 mb-6">
            {details.client.logo_uri ? (
              <img src={details.client.logo_uri} alt="" className="w-12 h-12 rounded-xl object-contain bg-white/5" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-[#C4FF0D]/10 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-[#C4FF0D]" />
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold text-white">{appName} wants to connect</h2>
              <p className="text-sm text-[#A8B3B8]">to PromoterOS as {details.user.email}</p>
            </div>
          </div>

          <p className="text-sm text-white mb-3">If you allow it, {appName} can:</p>
          <ul className="space-y-2 mb-6">
            {CAN_DO.map((t) => (
              <li key={t} className="flex gap-2 text-sm text-[#A8B3B8]">
                <span className="text-[#C4FF0D]">✓</span>
                {t}
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-500 mb-6">
            It only sees your own organization's data. You can disconnect it anytime from {appName}'s settings.
            {details.client.uri && <> App website: {details.client.uri}</>}
          </p>

          <div className="flex gap-3">
            <button
              onClick={() => decide(false)}
              disabled={busy}
              className="flex-1 h-12 rounded-xl border border-gray-700 text-white hover:bg-white/5 disabled:opacity-50"
            >
              Deny
            </button>
            <button
              onClick={() => decide(true)}
              disabled={busy}
              className="flex-1 h-12 rounded-xl bg-[#C4FF0D] hover:bg-[#A3D60A] text-black font-bold disabled:opacity-50"
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
    <div className="min-h-screen bg-[#0F1113] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3">
            <img src="/untitled_project_-_standard_1_(13).png" alt="PromoterOS Logo" className="w-10 h-10 object-contain" />
            <span className="text-2xl font-bold text-white">PromoterOS</span>
          </div>
        </div>
        <div className="bg-[#252A2E] border border-gray-800 rounded-2xl p-8">{children}</div>
      </div>
    </div>
  );
}
