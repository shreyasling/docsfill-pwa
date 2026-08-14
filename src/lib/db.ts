import { supabase } from './supabase';
import type {
  ApprovalLogRow,
  DocumentRow,
  ProfileRow,
  ProfileEncRow,
  ProfileData,
  SessionRow,
  FilledPayload,
} from './types';
import { getVaultKey, encryptJSON, decryptJSON } from './crypto';
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

// ---- Profile (value tags, encrypted at rest) ----

/** Thrown when the vault key isn't loaded yet (user hasn't unlocked). */
export class VaultLockedError extends Error {
  constructor() {
    super('Your vault is locked. Unlock it to view or edit profile details.');
    this.name = 'VaultLockedError';
  }
}

/** All decrypted profile fields default to null. */
export function emptyProfileData(): ProfileData {
  return {
    full_name: null,
    father_name: null,
    mother_name: null,
    spouse_name: null,
    date_of_birth: null,
    gender: null,
    nationality: null,
    marital_status: null,
    religion: null,
    category: null,
    pan: null,
    aadhaar: null,
    passport_number: null,
    voter_id: null,
    driving_license_number: null,
    email: null,
    phone: null,
    alt_phone: null,
    blood_group: null,
    address_current: null,
    address_permanent: null,
  };
}

/** Raw row (ciphertext + salt + any legacy plaintext). Used by the vault gate
 *  to decide setup vs unlock BEFORE a key exists. */
export async function getProfileEncRow(userId: string): Promise<ProfileEncRow | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data as ProfileEncRow) ?? null;
}

export async function getProfile(userId: string): Promise<ProfileRow | null> {
  const row = await getProfileEncRow(userId);
  if (!row) return null;
  if (row.enc_data) {
    const key = getVaultKey();
    if (!key) throw new VaultLockedError();
    const data = await decryptJSON<ProfileData>(key, row.enc_data);
    return { user_id: userId, updated_at: row.updated_at, ...emptyProfileData(), ...data };
  }
  // Legacy plaintext row (pre-encryption) — surface so the gate can migrate it.
  return {
    user_id: userId,
    updated_at: row.updated_at,
    ...emptyProfileData(),
    full_name: row.full_name ?? null,
    father_name: row.father_name ?? null,
    date_of_birth: row.date_of_birth ?? null,
    address_current: row.address_current ?? null,
    address_permanent: row.address_permanent ?? null,
  };
}

/** Encrypts and writes the FULL profile blob, clearing any legacy plaintext.
 *  `saltB64` is only passed during vault setup/migration. */
export async function saveEncryptedProfile(
  userId: string,
  data: ProfileData,
  saltB64?: string,
): Promise<void> {
  const key = getVaultKey();
  if (!key) throw new VaultLockedError();
  const enc_data = await encryptJSON(key, data);
  const patch: Record<string, unknown> = {
    user_id: userId,
    enc_data,
    updated_at: new Date().toISOString(),
    // Wipe any pre-encryption plaintext still on the row.
    full_name: null,
    father_name: null,
    date_of_birth: null,
    address_current: null,
    address_permanent: null,
  };
  if (saltB64) patch.enc_salt = saltB64;
  const { error } = await supabase.from('profiles').upsert(patch, { onConflict: 'user_id' });
  if (error) throw error;
}

/** Merges a partial patch into the current (decrypted) profile and re-encrypts. */
export async function upsertProfile(
  userId: string,
  patch: Partial<ProfileData>,
): Promise<ProfileRow> {
  const current = (await getProfile(userId)) ?? {
    user_id: userId,
    updated_at: '',
    ...emptyProfileData(),
  };
  const { user_id: _u, updated_at: _t, ...currentData } = current;
  const merged: ProfileData = { ...currentData, ...patch };
  await saveEncryptedProfile(userId, merged);
  return { user_id: userId, updated_at: new Date().toISOString(), ...merged };
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
