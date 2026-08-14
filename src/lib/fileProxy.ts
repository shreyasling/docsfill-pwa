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
    // Reuse the batch's cached Drive token (pre-minted by the caller). Silent
    // first, interactive only as a last resort. Coalesced in google.ts so
    // parallel file tags never trigger more than one popup.
    let tokenInfo;
    try {
      tokenInfo = await getDriveTokenWithExpiry(false);
    } catch {
      tokenInfo = await getDriveTokenWithExpiry(true);
    }
    const { token: driveAccessToken, expiresAt: driveTokenExpiresAt } = tokenInfo;

    const { data } = await supabase.auth.getSession();
    const jwt = data.session?.access_token;
    if (!jwt) return null;

    // Bound the proxy call too — a hung fetch shouldn't freeze the approve flow.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    let res: Response;
    try {
      res = await fetch(FUNCTION_URL, {
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
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) return null;

    const body = (await res.json()) as { fileUrl?: string };
    return body.fileUrl ?? null;
  } catch {
    return null;
  }
}
