// Helpers for turning a scanned QR payload into a DocFill session id.
//
// The SDK / demo form may encode the QR as either:
//   - a full URL, e.g. https://app.docfill.dev/fill?session=<uuid>
//   - a bare session UUID
// We extract just the session id and always route to our own /fill screen.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function extractSessionId(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;

  if (UUID_RE.test(text)) return text;

  // Try to parse as a URL and read ?session= (or a trailing /<uuid>).
  try {
    const url = new URL(text);
    const fromQuery = url.searchParams.get('session');
    if (fromQuery && UUID_RE.test(fromQuery)) return fromQuery;

    const lastSeg = url.pathname.split('/').filter(Boolean).pop();
    if (lastSeg && UUID_RE.test(lastSeg)) return lastSeg;
  } catch {
    // not a URL — fall through
  }

  // Last resort: find a UUID anywhere in the string.
  const match = text.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
  );
  return match ? match[0] : null;
}

export function hasNativeBarcodeDetector(): boolean {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window;
}

/**
 * Builds the in-app fill path from a scanned QR, preserving the per-session
 * capability token (`k`) when the QR carries one, e.g.
 *   https://<pwa>/fill?session=<id>&k=<token>  ->  /fill?session=<id>&k=<token>
 * Returns null if no session id can be extracted.
 */
export function fillPathFromScan(raw: string): string | null {
  const id = extractSessionId(raw);
  if (!id) return null;
  let token: string | null = null;
  try {
    token = new URL(raw.trim()).searchParams.get('k');
  } catch {
    // not a URL — no token available
  }
  return token ? `/fill?session=${id}&k=${encodeURIComponent(token)}` : `/fill?session=${id}`;
}
