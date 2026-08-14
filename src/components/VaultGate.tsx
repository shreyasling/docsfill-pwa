import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useAuth } from '../lib/auth';
import {
  getProfileEncRow,
  getProfile,
  saveEncryptedProfile,
  emptyProfileData,
} from '../lib/db';
import {
  deriveKey,
  cacheVaultKey,
  restoreVaultKey,
  newSaltB64,
  decryptJSON,
  isCryptoAvailable,
} from '../lib/crypto';
import type { ProfileData } from '../lib/types';
import { Banner, Spinner } from './ui';

type GateState = 'loading' | 'needs-setup' | 'locked' | 'unlocked' | 'insecure';

/**
 * Guards the app behind the encryption vault. Profile PII is stored encrypted;
 * the user unlocks (or creates) their vault with a passphrase that never leaves
 * the device. Renders children only once a valid key is loaded.
 */
export default function VaultGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<GateState>('loading');
  const [salt, setSalt] = useState<string | null>(null);
  const [encData, setEncData] = useState<string | null>(null);
  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const init = useCallback(async () => {
    if (!user) return;
    setState('loading');
    setError(null);
    // Encryption needs a secure context (HTTPS / localhost). Bail early with a
    // clear message rather than failing mid-setup on a plain LAN IP.
    if (!isCryptoAvailable()) {
      setState('insecure');
      return;
    }
    try {
      const key = await restoreVaultKey(user.id);
      if (key) {
        setState('unlocked');
        return;
      }
      const row = await getProfileEncRow(user.id);
      if (row?.enc_data && row.enc_salt) {
        setSalt(row.enc_salt);
        setEncData(row.enc_data);
        setState('locked');
      } else {
        setState('needs-setup');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not check your vault.');
      setState('needs-setup');
    }
  }, [user]);

  useEffect(() => {
    void init();
  }, [init]);

  async function handleUnlock(e: FormEvent) {
    e.preventDefault();
    if (!user || !salt || !encData) return;
    setBusy(true);
    setError(null);
    try {
      const key = await deriveKey(pass, salt);
      // Decrypting the existing blob validates the passphrase.
      await decryptJSON(key, encData);
      await cacheVaultKey(user.id, key);
      setPass('');
      setState('unlocked');
    } catch {
      setError('Wrong passphrase. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSetup(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (pass.length < 6) {
      setError('Use a passphrase of at least 6 characters.');
      return;
    }
    if (pass !== confirm) {
      setError('The two passphrases do not match.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const s = newSaltB64();
      const key = await deriveKey(pass, s);
      await cacheVaultKey(user.id, key);
      // Seed from any legacy plaintext so existing details aren't lost.
      const existing = await getProfile(user.id);
      let seed: ProfileData;
      if (existing) {
        const { user_id: _u, updated_at: _t, ...rest } = existing;
        seed = rest;
      } else {
        seed = emptyProfileData();
      }
      await saveEncryptedProfile(user.id, seed, s);
      setPass('');
      setConfirm('');
      setState('unlocked');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not set up your vault.');
    } finally {
      setBusy(false);
    }
  }

  if (state === 'unlocked') return <>{children}</>;

  if (state === 'loading') {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center text-brand-600">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (state === 'insecure') {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-4 py-10">
        <div className="mb-4">
          <Banner tone="error">Secure connection required</Banner>
        </div>
        <div className="card space-y-3 text-sm text-slate-600">
          <p className="font-semibold text-slate-800">
            Your vault can’t be opened on this address.
          </p>
          <p>
            DocFill encrypts your details in the browser, which needs a secure
            connection. Open the app over <b>HTTPS</b> or on <b>localhost</b> — not
            over a plain IP address like <code>http://192.168.x.x</code>.
          </p>
          <p>
            On your phone, use the deployed link:{' '}
            <b>https://docsfill-pwa.vercel.app</b>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <svg viewBox="0 0 24 24" fill="none" width="24" height="24">
            <rect x="4" y="10" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2" />
          </svg>
        </div>
        <h1 className="text-xl font-extrabold text-slate-800">
          {state === 'needs-setup' ? 'Create your vault passphrase' : 'Unlock your vault'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {state === 'needs-setup'
            ? 'Your details are encrypted on this device before they’re saved. Only this passphrase can unlock them — we can’t recover it for you.'
            : 'Enter your passphrase to decrypt your saved details.'}
        </p>
      </div>

      {error && (
        <div className="mb-4">
          <Banner tone="error">{error}</Banner>
        </div>
      )}

      {state === 'needs-setup' ? (
        <form onSubmit={handleSetup} className="card space-y-3">
          <div>
            <label className="label">Passphrase</label>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="At least 6 characters"
            />
          </div>
          <div>
            <label className="label">Confirm passphrase</label>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter passphrase"
            />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? <Spinner className="h-5 w-5" /> : 'Create vault'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleUnlock} className="card space-y-3">
          <div>
            <label className="label">Passphrase</label>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              autoFocus
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="Your vault passphrase"
            />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? <Spinner className="h-5 w-5" /> : 'Unlock'}
          </button>
        </form>
      )}
    </div>
  );
}
