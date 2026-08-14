import { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { isSupabaseConfigured } from '../lib/supabase';
import { Banner, Spinner } from '../components/ui';

export default function Login() {
  const { user, loading, signInWithGoogle } = useAuth();
  const [params] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = params.get('next') || '/';

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-brand-600">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (user) return <Navigate to={decodeURIComponent(next)} replace />;

  async function handleSignIn() {
    setError(null);
    setBusy(true);
    try {
      await signInWithGoogle(decodeURIComponent(next));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed.');
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-white shadow-lg ring-1 ring-slate-100">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white">
            <svg viewBox="0 0 24 24" fill="none" width="26" height="26">
              <rect x="4" y="3" width="16" height="18" rx="3" stroke="currentColor" strokeWidth="2" />
              <path d="M8.5 12.5 11 15l4.5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
        <h1 className="text-3xl font-extrabold text-brand-600">DocFill</h1>
        <p className="mt-2 text-base text-slate-500">Your documents, filled in one tap.</p>
      </div>

      <div className="card space-y-4">
        <ul className="space-y-4 text-sm">
          <li className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
                <path d="M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.4A3.5 3.5 0 0 1 17 18H7Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                <path d="M9.5 13.5 11 15l3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="font-medium text-slate-700">Files stay in your Google Drive</span>
          </li>
          <li className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-50 text-purple-600">
              <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
                <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="font-medium text-slate-700">We never store your files</span>
          </li>
          <li className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
                <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="2" />
                <path d="M8.5 12.5 11 15l4.5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="font-medium text-slate-700">You approve every field</span>
          </li>
        </ul>

        {!isSupabaseConfigured && (
          <Banner tone="error">
            Supabase isn't configured. Copy <code>.env.example</code> to <code>.env</code> and
            fill in your keys.
          </Banner>
        )}
        {error && <Banner tone="error">{error}</Banner>}

        <button
          className="btn-ghost w-full"
          onClick={handleSignIn}
          disabled={busy || !isSupabaseConfigured}
        >
          {busy ? (
            <Spinner className="h-5 w-5" />
          ) : (
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
              <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z" />
              <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z" />
              <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1Z" />
              <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-5 6.7-5Z" />
            </svg>
          )}
          Continue with Google
        </button>
        <p className="text-center text-xs text-slate-400">
          You'll see a Google consent screen requesting only <b>drive.file</b> access.
        </p>
      </div>
    </div>
  );
}
