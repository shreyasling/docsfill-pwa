import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Suspense, lazy, type ReactNode } from 'react';
import { useAuth } from './lib/auth';
import { Spinner } from './components/ui';
import VaultGate from './components/VaultGate';
import Login from './pages/Login';
import Vault from './pages/Vault';
import Profile from './pages/Profile';
import Activity from './pages/Activity';
import Fill from './pages/Fill';

// Code-split the scanner (pulls in the jsQR fallback) so it loads on demand.
const Scan = lazy(() => import('./pages/Scan'));

function FullScreenLoader() {
  return (
    <div className="flex h-full items-center justify-center text-brand-600">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullScreenLoader />;
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <VaultGate>{children}</VaultGate>;
}

function BottomNav() {
  const base =
    'flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium transition';
  const active = 'text-brand-600';
  const idle = 'text-slate-400';
  return (
    <nav className="safe-bottom sticky bottom-0 z-10 flex border-t border-slate-200 bg-white/90 backdrop-blur">
      <NavLink to="/" end className={({ isActive }) => `${base} ${isActive ? active : idle}`}>
        <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
          <path d="M4 7a2 2 0 0 1 2-2h3l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z" stroke="currentColor" strokeWidth="2" />
        </svg>
        Wallet
      </NavLink>
      <NavLink to="/scan" className={`${base} -mt-6`}>
        {({ isActive }) => (
          <>
            <span
              className={`flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg ring-4 ring-slate-100 ${
                isActive ? 'bg-brand-700' : 'bg-brand-600'
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" width="24" height="24">
                <path d="M4 4h4M4 4v4M20 4h-4M20 4v4M4 20h4M4 20v-4M20 20h-4M20 20v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="2" />
              </svg>
            </span>
            <span className={isActive ? active : idle}>Scan</span>
          </>
        )}
      </NavLink>
      <NavLink to="/profile" className={({ isActive }) => `${base} ${isActive ? active : idle}`}>
        <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
          <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
          <path d="M4 20c0-4 4-6 8-6s8 2 8 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        Profile
      </NavLink>
    </nav>
  );
}

function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col">
      <main className="flex-1 px-4 pb-4 pt-6">{children}</main>
      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <AppShell>
              <Vault />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/profile"
        element={
          <RequireAuth>
            <AppShell>
              <Profile />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/activity"
        element={
          <RequireAuth>
            <AppShell>
              <Activity />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/scan"
        element={
          <RequireAuth>
            <AppShell>
              <Suspense fallback={<FullScreenLoader />}>
                <Scan />
              </Suspense>
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/fill"
        element={
          <RequireAuth>
            <Fill />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
