// Google Identity Services (GIS) token client + gapi loader.
//
// We deliberately request ONLY the `drive.file` scope. That is a per-file,
// non-sensitive scope: our app can only see files the user explicitly picks in
// the Google Picker or files our app creates itself — nothing else in their
// Drive. This is the core trust story of DocFill; do not broaden it.

export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

interface TokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  error?: string;
}

interface TokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
  callback: (resp: TokenResponse) => void;
}

// Minimal shape of the pieces of the Google global we rely on.
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            prompt?: string;
            callback: (resp: TokenResponse) => void;
          }) => TokenClient;
          revoke: (token: string, done?: () => void) => void;
        };
      };
    };
    gapi?: {
      load: (name: string, cb: () => void) => void;
    };
  }
}

function waitFor(check: () => boolean, timeoutMs = 10000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (check()) return resolve();
    const started = Date.now();
    const id = window.setInterval(() => {
      if (check()) {
        window.clearInterval(id);
        resolve();
      } else if (Date.now() - started > timeoutMs) {
        window.clearInterval(id);
        reject(new Error('Timed out waiting for Google scripts to load.'));
      }
    }, 50);
  });
}

export const gisReady = () => waitFor(() => Boolean(window.google?.accounts?.oauth2));
export const gapiReady = () => waitFor(() => Boolean(window.gapi));

let tokenClient: TokenClient | null = null;
let cachedToken: { value: string; expiresAt: number } | null = null;
// Coalesces concurrent token requests so parallel callers (e.g. filling several
// file tags at once) share ONE GIS flow instead of racing on tokenClient.callback
// and triggering multiple account-chooser popups.
let inflight: Promise<{ token: string; expiresAt: number }> | null = null;

/** Drops the cached Drive token (e.g. on sign-out). */
export function clearDriveToken(): void {
  cachedToken = null;
}

/**
 * Returns a valid `drive.file` access token, minting a fresh one via GIS when
 * the cached token is missing or about to expire. `interactive` controls
 * whether a consent popup may be shown.
 */
export async function getDriveAccessToken(interactive = true): Promise<string> {
  return (await getDriveTokenWithExpiry(interactive)).token;
}

/**
 * Like `getDriveAccessToken`, but also returns the token's absolute expiry (ms
 * epoch). The Edge Function proxy needs the expiry to cap a file grant's TTL.
 * `forceFresh` bypasses the cache to mint a brand-new (max-lifetime) token —
 * used at fill-time so the proxy hands the SDK a token that won't expire mid-fetch.
 */
export async function getDriveTokenWithExpiry(
  interactive = true,
  forceFresh = false,
): Promise<{ token: string; expiresAt: number }> {
  if (!forceFresh && cachedToken && cachedToken.expiresAt - Date.now() > 60_000) {
    return { token: cachedToken.value, expiresAt: cachedToken.expiresAt };
  }

  // If a request is already in flight, reuse it — never open a second popup.
  if (inflight) return inflight;

  if (!CLIENT_ID) {
    throw new Error(
      'Missing VITE_GOOGLE_CLIENT_ID. Add it to .env to enable Google Drive access.',
    );
  }

  inflight = requestFreshToken(interactive).finally(() => {
    inflight = null;
  });
  return inflight;
}

async function requestFreshToken(
  interactive: boolean,
): Promise<{ token: string; expiresAt: number }> {
  await gisReady();

  return new Promise<{ token: string; expiresAt: number }>((resolve, reject) => {
    if (!tokenClient) {
      tokenClient = window.google!.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID!,
        scope: DRIVE_FILE_SCOPE,
        callback: () => {
          /* replaced per-request below */
        },
      });
    }

    // GIS never calls back if the consent popup is silently blocked (common in
    // mobile/embedded browsers) — without this the caller would hang forever.
    const timer = window.setTimeout(() => {
      reject(new Error('Timed out waiting for Google Drive access — the sign-in popup may be blocked.'));
    }, 15000);

    tokenClient.callback = (resp) => {
      window.clearTimeout(timer);
      if (resp.error || !resp.access_token) {
        reject(new Error(resp.error || 'Failed to obtain Drive access token.'));
        return;
      }
      const expiresAt = Date.now() + (resp.expires_in ?? 3600) * 1000;
      cachedToken = { value: resp.access_token, expiresAt };
      resolve({ token: resp.access_token, expiresAt });
    };

    tokenClient.requestAccessToken({ prompt: interactive ? '' : 'none' });
  });
}
