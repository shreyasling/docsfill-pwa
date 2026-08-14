// Database row shapes mirroring the shared Supabase schema (see brief §5).
// DO NOT rename tables/columns.

export interface AddressValue {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
}

export interface SessionRow {
  id: string;
  form_id: string;
  required_tags: string[];
  status: 'pending' | 'filled' | 'expired';
  filled_payload: FilledPayload | null;
  created_at: string;
  expires_at: string;
  /** Optional: origin of the site that created the session (SDK-provided). */
  origin?: string | null;
}

export interface ApprovalLogRow {
  id: string;
  user_id: string;
  session_id: string | null;
  form_id: string | null;
  origin: string | null;
  shared_tags: string[];
  created_at: string;
  expires_at: string;
}

export interface DocumentRow {
  id: string;
  user_id: string;
  tag: string;
  drive_file_id: string;
  drive_file_name: string | null;
  drive_view_url: string | null;
  extracted_fields: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileRow {
  user_id: string;
  full_name: string | null;
  father_name: string | null;
  mother_name: string | null;
  spouse_name: string | null;
  date_of_birth: string | null;
  gender: string | null;
  nationality: string | null;
  marital_status: string | null;
  religion: string | null;
  category: string | null;
  pan: string | null;
  aadhaar: string | null;
  passport_number: string | null;
  voter_id: string | null;
  driving_license_number: string | null;
  email: string | null;
  phone: string | null;
  alt_phone: string | null;
  blood_group: string | null;
  address_current: AddressValue | null;
  address_permanent: AddressValue | null;
  updated_at: string;
}

/** The encrypted-at-rest row actually stored in Supabase. Everything sensitive
 *  lives inside `enc_data` (AES-GCM, base64). Legacy plaintext columns may still
 *  exist on older rows and are migrated into the blob on first unlock. */
export interface ProfileEncRow {
  user_id: string;
  enc_data: string | null;
  enc_salt: string | null;
  updated_at: string;
  // Legacy plaintext columns (pre-encryption) — read once for migration.
  full_name?: string | null;
  father_name?: string | null;
  date_of_birth?: string | null;
  address_current?: AddressValue | null;
  address_permanent?: AddressValue | null;
}

/** The plaintext, decrypted profile fields (everything except user_id/updated_at). */
export type ProfileData = Omit<ProfileRow, 'user_id' | 'updated_at'>;

// filled_payload is keyed by tag (see brief §5).
export type FilledValue = { value: string | number };
// `fileUrl` (optional) is a short-lived, CORS-fetchable proxy URL that lets the
// SDK inject the real file into a native <input type="file">. `driveUrl` stays
// as the human-viewable reference / fallback.
export type FilledFile = {
  fileName: string;
  driveFileId: string;
  driveUrl: string;
  fileUrl?: string;
};
export type FilledPayload = Record<string, FilledValue | FilledFile>;
