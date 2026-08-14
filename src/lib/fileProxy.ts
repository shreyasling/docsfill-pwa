import { supabase } from './supabase';
import { getDriveTokenWithExpiry } from './google';
import type { DocumentRow } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const FUNCTION_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/file-proxy` : '';

/**
 * Asks the `file-proxy` Edge Function to mint a short-lived, single-purpose,
 * CORS-fetchable URL for a Drive file so the SDK can pull the real bytes and
 * drop them into the form's native file input. Returns null on any failure so
 * the caller can fall back to the reference chip (no hard dependency).
 */
export async function prepareFileUrl(
  sessionId: string,
  tag: string,
  doc: DocumentRow,
): Promise<string | null> {
  if (!FUNCTION_URL) return null;
  try {
    // Mint a BRAND-NEW token (silent; falls back to interactive) so the proxy
    // gets a full-lifetime token from the same GIS client that opened the file.
    let tokenInfo;
    try {
      tokenInfo = await getDriveTokenWithExpiry(false, true);
    } catch {
      tokenInfo = await getDriveTokenWithExpiry(true, true);
    }
    const { token: driveAccessToken, expiresAt: driveTokenExpiresAt } = tokenInfo;

    const { data } = await supabase.auth.getSession();
    const jwt = data.session?.access_token;
    if (!jwt) return null;

    const res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        tag,
        driveFileId: doc.drive_file_id,
        fileName: doc.drive_file_name,
        driveAccessToken,
        driveTokenExpiresAt,
      }),
    });
    if (!res.ok) return null;

    const body = (await res.json()) as { fileUrl?: string };
    return body.fileUrl ?? null;
  } catch {
    return null;
  }
}
