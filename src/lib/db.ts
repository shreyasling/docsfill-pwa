import { supabase } from './supabase';
import type {
  ApprovalLogRow,
  DocumentRow,
  ProfileRow,
  SessionRow,
  FilledPayload,
} from './types';
import type { DrivePickResult } from './drivePicker';

// ---- Documents (file tags) ----

export async function listDocuments(userId: string): Promise<DocumentRow[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('user_id', userId);
  if (error) throw error;
  return data as DocumentRow[];
}

export async function upsertDocument(
  userId: string,
  tag: string,
  file: DrivePickResult,
): Promise<DocumentRow> {
  const { data, error } = await supabase
    .from('documents')
    .upsert(
      {
        user_id: userId,
        tag,
        drive_file_id: file.driveFileId,
        drive_file_name: file.fileName,
        drive_view_url: file.driveViewUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,tag' },
    )
    .select()
    .single();
  if (error) throw error;
  return data as DocumentRow;
}

export async function deleteDocument(userId: string, tag: string): Promise<void> {
  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('user_id', userId)
    .eq('tag', tag);
  if (error) throw error;
}

// ---- Profile (value tags) ----

export async function getProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data as ProfileRow) ?? null;
}

export async function upsertProfile(
  userId: string,
  patch: Partial<Omit<ProfileRow, 'user_id' | 'updated_at'>>,
): Promise<ProfileRow> {
  const { data, error } = await supabase
    .from('profiles')
    .upsert(
      { user_id: userId, ...patch, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
    .select()
    .single();
  if (error) throw error;
  return data as ProfileRow;
}

// ---- Sessions (the /fill flow) ----

export async function getSession(
  sessionId: string,
  token?: string | null,
): Promise<SessionRow | null> {
  // Hardened path: fetch via the security-definer RPC using the per-session
  // capability token (the table itself is locked once hardening is applied).
  if (token) {
    const { data, error } = await supabase.rpc('get_session', {
      p_id: sessionId,
      p_token: token,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return (row as SessionRow) ?? null;
  }
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();
  if (error) throw error;
  return (data as SessionRow) ?? null;
}

/**
 * Writes the filled payload and flips status to 'filled'. The RLS update policy
 * only permits this while the row is still 'pending', so a stale session id
 * can't overwrite an already-filled one.
 */
export async function approveSession(
  sessionId: string,
  payload: FilledPayload,
  token?: string | null,
): Promise<SessionRow> {
  // Hardened path: the RPC enforces (id + token + still-pending) server-side.
  if (token) {
    const { data, error } = await supabase.rpc('fill_session', {
      p_id: sessionId,
      p_token: token,
      p_payload: payload,
    });
    if (error) throw error;
    return data as SessionRow;
  }
  const { data, error } = await supabase
    .from('sessions')
    .update({ status: 'filled', filled_payload: payload })
    .eq('id', sessionId)
    .eq('status', 'pending')
    .select()
    .single();
  if (error) throw error;
  return data as SessionRow;
}

/**
 * Sends a PII-free "filled" wake-up on the session's Realtime Broadcast channel
 * so an embedded SDK updates instantly instead of waiting for its next poll.
 * Best-effort: if the socket is blocked the SDK's polling still delivers.
 */
export async function signalFilled(sessionId: string): Promise<void> {
  const channel = supabase.channel(`docfill:${sessionId}`);
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('subscribe timeout')), 3000);
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timer);
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          clearTimeout(timer);
          reject(new Error(status));
        }
      });
    });
    await channel.send({ type: 'broadcast', event: 'filled', payload: {} });
  } finally {
    await supabase.removeChannel(channel);
  }
}

// ---- Approval activity log (7-day TTL, owner-only) ----

export async function addApprovalLog(
  userId: string,
  entry: { sessionId: string; formId: string | null; origin: string | null; sharedTags: string[] },
): Promise<void> {
  const { error } = await supabase.from('approval_logs').insert({
    user_id: userId,
    session_id: entry.sessionId,
    form_id: entry.formId,
    origin: entry.origin,
    shared_tags: entry.sharedTags,
  });
  if (error) throw error;
}

export async function listApprovalLogs(userId: string): Promise<ApprovalLogRow[]> {
  const { data, error } = await supabase
    .from('approval_logs')
    .select('*')
    .eq('user_id', userId)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as ApprovalLogRow[];
}
