import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { clearDriveToken } from './google';
import { clearVaultKey } from './crypto';

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signInWithGoogle: (redirectTo?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) {
        clearDriveToken();
        clearVaultKey();
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      async signInWithGoogle(redirectTo?: string) {
        const target = redirectTo
          ? `${window.location.origin}${redirectTo}`
          : window.location.origin;
        // Login is identity-only. ALL Drive access (Picker, uploads, proxy)
        // goes through the GIS client so drive.file grants stay under one
        // OAuth client — see src/lib/google.ts.
        await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: target },
        });
      },
      async signOut() {
        clearDriveToken();
        clearVaultKey();
        await supabase.auth.signOut();
      },
    }),
    [session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>.');
  return ctx;
}
