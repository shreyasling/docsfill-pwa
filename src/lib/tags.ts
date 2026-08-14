// Shared tag vocabulary — single source of truth for THIS repo.
// DO NOT invent new tags. Must stay in lockstep with the SDK and demo-form repos.

export type TagKind = 'value' | 'file' | 'derived';

// Vault sections (file tags are grouped by these in the UI).
export type GroupKey = 'govt_id' | 'education' | 'photo' | 'address' | 'personal';

export interface TagDef {
  tag: string;
  label: string;
  kind: TagKind;
  /** Vault section this tag belongs to. */
  group?: GroupKey;
  /** For value tags backed by a column on the `profiles` table. */
  profileField?:
    | 'full_name'
    | 'father_name'
    | 'date_of_birth'
    | 'address_current'
    | 'address_permanent';
  /** Optional regex the value must satisfy before it can be approved. */
  format?: RegExp;
  /** Human hint for format errors / placeholders. */
  hint?: string;
}

// Ordered Vault sections + display labels.
export const GROUPS: { key: GroupKey; label: string; icon: string }[] = [
  { key: 'govt_id', label: 'Government IDs', icon: 'id' },
  { key: 'education', label: 'Education', icon: 'cap' },
  { key: 'photo', label: 'Photo & Signature', icon: 'photo' },
  { key: 'address', label: 'Address proof', icon: 'home' },
];

export const TAGS: Record<string, TagDef> = {
  'identity.full_name': {
    tag: 'identity.full_name',
    label: 'Full name',
    kind: 'value',
    profileField: 'full_name',
  },
  'identity.father_name': {
    tag: 'identity.father_name',
    label: "Father's name",
    kind: 'value',
    profileField: 'father_name',
  },
  'identity.dob': {
    tag: 'identity.dob',
    label: 'Date of birth',
    kind: 'value',
    profileField: 'date_of_birth',
    hint: 'ISO 8601 date, e.g. 2001-04-12',
  },
  'identity.pan': {
    tag: 'identity.pan',
    label: 'PAN number',
    kind: 'value',
    format: /^[A-Z]{5}[0-9]{4}[A-Z]$/,
    hint: 'Format: ABCDE1234F',
  },
  'identity.aadhaar': {
    tag: 'identity.aadhaar',
    label: 'Aadhaar number',
    kind: 'value',
    format: /^\d{12}$/,
    hint: '12 digits',
  },
  'derived.age': {
    tag: 'derived.age',
    label: 'Age',
    kind: 'derived',
    hint: 'Computed at fill-time from date of birth',
  },
  'address.current': {
    tag: 'address.current',
    label: 'Current address',
    kind: 'value',
    profileField: 'address_current',
  },
  'address.permanent': {
    tag: 'address.permanent',
    label: 'Permanent address',
    kind: 'value',
    profileField: 'address_permanent',
  },
  'education.10th_marksheet': {
    tag: 'education.10th_marksheet',
    label: '10th marksheet',
    kind: 'file',
    group: 'education',
  },
  'education.12th_marksheet': {
    tag: 'education.12th_marksheet',
    label: '12th marksheet',
    kind: 'file',
    group: 'education',
  },
  'education.degree_certificate': {
    tag: 'education.degree_certificate',
    label: 'Degree certificate',
    kind: 'file',
    group: 'education',
  },
  'photo.passport_size': {
    tag: 'photo.passport_size',
    label: 'Passport-size photo',
    kind: 'file',
    group: 'photo',
  },

  // --- v2 file tags (grouped Vault sections). Add matching entries to the SDK
  // vocabulary before a form can request these. ---
  'identity.aadhaar_card': {
    tag: 'identity.aadhaar_card',
    label: 'Aadhaar card',
    kind: 'file',
    group: 'govt_id',
  },
  'identity.pan_card': {
    tag: 'identity.pan_card',
    label: 'PAN card',
    kind: 'file',
    group: 'govt_id',
  },
  'identity.passport': {
    tag: 'identity.passport',
    label: 'Passport',
    kind: 'file',
    group: 'govt_id',
  },
  'identity.driving_license': {
    tag: 'identity.driving_license',
    label: 'Driving license',
    kind: 'file',
    group: 'govt_id',
  },
  'identity.voter_id': {
    tag: 'identity.voter_id',
    label: 'Voter ID',
    kind: 'file',
    group: 'govt_id',
  },
  'address.proof': {
    tag: 'address.proof',
    label: 'Address proof',
    kind: 'file',
    group: 'address',
    hint: 'Utility bill / rent agreement',
  },
  'signature.specimen': {
    tag: 'signature.specimen',
    label: 'Signature',
    kind: 'file',
    group: 'photo',
  },
};

export const ALL_TAGS = Object.keys(TAGS);

export const FILE_TAGS = ALL_TAGS.filter((t) => TAGS[t].kind === 'file');
export const VALUE_TAGS = ALL_TAGS.filter((t) => TAGS[t].kind === 'value');

/** File tags bucketed by Vault section, in GROUPS order (empty groups dropped). */
export function fileTagsByGroup(): { key: GroupKey; label: string; tags: string[] }[] {
  return GROUPS.map(({ key, label }) => ({
    key,
    label,
    tags: FILE_TAGS.filter((t) => (TAGS[t].group ?? 'photo') === key),
  })).filter((g) => g.tags.length > 0);
}

export function tagDef(tag: string): TagDef | undefined {
  return TAGS[tag];
}

export function isKnownTag(tag: string): boolean {
  return tag in TAGS;
}

/** Compute age in whole years from an ISO date string. Never stored. */
export function computeAge(isoDob: string): number | null {
  if (!isoDob) return null;
  const dob = new Date(isoDob);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age >= 0 ? age : null;
}
