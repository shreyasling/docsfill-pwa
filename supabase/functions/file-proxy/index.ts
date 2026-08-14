// DocFill — file-proxy Edge Function.
//
// Purpose: let the (unauthenticated, cross-origin) SDK fetch the bytes of a
// private Google Drive file so it can inject the real file into a form's native
// <input type="file">, WITHOUT ever persisting those bytes on our side.
//
//   POST /file-proxy   (requires the user's Supabase JWT)
//     body: { sessionId, tag, driveFileId, fileName, driveAccessToken, driveTokenExpiresAt }
//     -> mints a short-lived, use-limited grant and returns { fileUrl, expiresAt }
//
//   GET  /file-proxy?t=<grantToken>   (no auth — the unguessable token IS the auth)
//     -> streams the Drive file back with permissive CORS headers
//
// Deploy WITHOUT JWT verification (the GET must be anonymous); we do auth
// ourselves:  supabase functions deploy file-proxy --no-verify-jwt
//
// Requires a `file_grants` table (see supabase/schema.sql). RLS on that table
// has NO policies, so only this function (service role) can read/write it.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const GRANT_TTL_MS = 10 * 60 * 1000; // 10 minutes
const DEFAULT_MAX_USES = 3; // tolerate a couple of retries, then invalidate

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function handlePost(req: Request): Promise<Response> {
  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ error: 'missing auth' }, 401);

  // Validate the caller is a real signed-in user.
  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userData.user) return json({ error: 'invalid auth' }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad json' }, 400);
  }

  const sessionId = String(body.sessionId ?? '');
  const tag = String(body.tag ?? '');
  const driveFileId = String(body.driveFileId ?? '');
  const fileName = body.fileName ? String(body.fileName) : null;
  const driveAccessToken = String(body.driveAccessToken ?? '');
  const driveTokenExpiresAt = Number(body.driveTokenExpiresAt ?? 0);

  if (!sessionId || !tag || !driveFileId || !driveAccessToken) {
    return json({ error: 'missing fields' }, 400);
  }

  // Defense-in-depth: the session must exist, still be pending, and actually
  // require this tag before we hand out a grant.
  const { data: session, error: sErr } = await admin
    .from('sessions')
    .select('id, status, required_tags')
    .eq('id', sessionId)
    .maybeSingle();
  if (sErr || !session) return json({ error: 'session not found' }, 404);
  if (session.status !== 'pending') return json({ error: 'session not pending' }, 409);
  const required = Array.isArray(session.required_tags) ? session.required_tags : [];
  if (!required.includes(tag)) return json({ error: 'tag not requested' }, 400);

  // Cap the grant lifetime by the Drive token's own expiry (can't outlive it).
  const cap = driveTokenExpiresAt > 0 ? driveTokenExpiresAt - 30_000 : Infinity;
  const expiresAtMs = Math.min(Date.now() + GRANT_TTL_MS, cap);
  if (expiresAtMs <= Date.now()) return json({ error: 'drive token already expired' }, 400);

  const token = randomToken();
  const { error: insErr } = await admin.from('file_grants').insert({
    token,
    session_id: sessionId,
    tag,
    drive_file_id: driveFileId,
    drive_access_token: driveAccessToken,
    file_name: fileName,
    max_uses: DEFAULT_MAX_USES,
    used: 0,
    expires_at: new Date(expiresAtMs).toISOString(),
  });
  if (insErr) return json({ error: 'could not create grant' }, 500);

  return json({
    fileUrl: `${SUPABASE_URL}/functions/v1/file-proxy?t=${token}`,
    expiresAt: new Date(expiresAtMs).toISOString(),
  });
}

async function handleGet(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const token = url.searchParams.get('t');
  if (!token) return json({ error: 'missing token' }, 400);

  const { data: grant, error } = await admin
    .from('file_grants')
    .select('*')
    .eq('token', token)
    .maybeSingle();

  if (error || !grant) return json({ error: 'invalid or expired link' }, 404);
  if (new Date(grant.expires_at).getTime() < Date.now()) {
    await admin.from('file_grants').delete().eq('token', token);
    return json({ error: 'link expired' }, 410);
  }
  if (grant.used >= grant.max_uses) return json({ error: 'link exhausted' }, 410);

  // Count this use up-front so a burst of requests can't exceed the limit.
  await admin
    .from('file_grants')
    .update({ used: grant.used + 1 })
    .eq('token', token);

  // Stream the private Drive file straight through — bytes are never stored.
  const driveRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${grant.drive_file_id}?alt=media`,
    { headers: { Authorization: `Bearer ${grant.drive_access_token}` } },
  );

  if (!driveRes.ok || !driveRes.body) {
    // Surface Drive's own reason (e.g. "File not found" = this OAuth client was
    // never granted per-file access) so failures are diagnosable, not opaque.
    const detail = await driveRes.text().catch(() => '');
    return json(
      { error: 'drive fetch failed', status: driveRes.status, detail: detail.slice(0, 400) },
      502,
    );
  }

  const name = grant.file_name ?? 'document';
  return new Response(driveRes.body, {
    status: 200,
    headers: {
      ...CORS,
      'Content-Type': driveRes.headers.get('content-type') ?? 'application/octet-stream',
      'Content-Disposition': `inline; filename="${name.replace(/"/g, '')}"`,
      'Cache-Control': 'no-store',
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  try {
    if (req.method === 'POST') return await handlePost(req);
    if (req.method === 'GET') return await handleGet(req);
    return json({ error: 'method not allowed' }, 405);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'unexpected error' }, 500);
  }
});
