// Shared tag vocabulary — single source of truth for THIS repo.
// DO NOT invent new tags. Must stay in lockstep with the SDK and demo-form repos.

export type TagKind = 'value' | 'file' | 'derived';

// Vault sections (file tags are grouped by these in the UI).
export type GroupKey =
  | 'identity'
  | 'education'
  | 'employment'
  | 'financial'
  | 'certificate'
  | 'medical'
  | 'address'
  | 'photo';

/** Profile fields persisted (encrypted) in the vault and reused across forms. */
export type ProfileField =
  | 'full_name'
  | 'father_name'
  | 'mother_name'
  | 'spouse_name'
  | 'date_of_birth'
  | 'gender'
  | 'nationality'
  | 'marital_status'
  | 'religion'
  | 'category'
  | 'pan'
  | 'aadhaar'
  | 'passport_number'
  | 'voter_id'
  | 'driving_license_number'
  | 'email'
  | 'phone'
  | 'alt_phone'
  | 'blood_group'
  | 'address_current'
  | 'address_permanent';

export interface TagDef {
  tag: string;
  label: string;
  kind: TagKind;
  /** Vault section this tag belongs to (file tags only). */
  group?: GroupKey;
  /** Value tag backed by a stored profile field. */
  profileField?: ProfileField;
  /** Value tag resolved from a sub-field of the stored current address. */
  addressField?: 'city' | 'state' | 'country' | 'pincode';
  /** Optional regex the value must satisfy before it can be approved. */
  format?: RegExp;
  /** Human hint for format errors / placeholders. */
  hint?: string;
}

// Ordered Vault sections + display labels.
export const GROUPS: { key: GroupKey; label: string; icon: string }[] = [
  { key: 'identity', label: 'Identity & IDs', icon: 'id' },
  { key: 'education', label: 'Education', icon: 'cap' },
  { key: 'employment', label: 'Employment', icon: 'work' },
  { key: 'financial', label: 'Financial', icon: 'bank' },
  { key: 'certificate', label: 'Certificates', icon: 'doc' },
  { key: 'medical', label: 'Medical', icon: 'health' },
  { key: 'address', label: 'Address proof', icon: 'home' },
  { key: 'photo', label: 'Photo & Signature', icon: 'photo' },
];

export const TAGS: Record<string, TagDef> = {
  // ---- identity (text) ----
  'identity.full_name': { tag: 'identity.full_name', label: 'Full name', kind: 'value', profileField: 'full_name' },
  'identity.father_name': { tag: 'identity.father_name', label: "Father's name", kind: 'value', profileField: 'father_name' },
  'identity.mother_name': { tag: 'identity.mother_name', label: "Mother's name", kind: 'value', profileField: 'mother_name' },
  'identity.spouse_name': { tag: 'identity.spouse_name', label: "Spouse's name", kind: 'value', profileField: 'spouse_name' },
  'identity.dob': { tag: 'identity.dob', label: 'Date of birth', kind: 'value', profileField: 'date_of_birth', hint: 'ISO 8601 date, e.g. 2001-04-12' },
  'identity.gender': { tag: 'identity.gender', label: 'Gender', kind: 'value', profileField: 'gender', hint: 'Male / Female / Other' },
  'identity.nationality': { tag: 'identity.nationality', label: 'Nationality', kind: 'value', profileField: 'nationality', hint: 'e.g. Indian' },
  'identity.marital_status': { tag: 'identity.marital_status', label: 'Marital status', kind: 'value', profileField: 'marital_status', hint: 'Single / Married' },
  'identity.religion': { tag: 'identity.religion', label: 'Religion', kind: 'value', profileField: 'religion' },
  'identity.category': { tag: 'identity.category', label: 'Category', kind: 'value', profileField: 'category', hint: 'GEN / OBC / SC / ST / EWS' },
  'identity.pan': { tag: 'identity.pan', label: 'PAN number', kind: 'value', profileField: 'pan', format: /^[A-Z]{5}[0-9]{4}[A-Z]$/, hint: 'Format: ABCDE1234F' },
  'identity.aadhaar': { tag: 'identity.aadhaar', label: 'Aadhaar number', kind: 'value', profileField: 'aadhaar', format: /^\d{12}$/, hint: '12 digits' },
  'identity.passport_number': { tag: 'identity.passport_number', label: 'Passport number', kind: 'value', profileField: 'passport_number', format: /^[A-Z][0-9]{7}$/, hint: 'e.g. A1234567' },
  'identity.voter_id': { tag: 'identity.voter_id', label: 'Voter ID (EPIC)', kind: 'value', profileField: 'voter_id', format: /^[A-Z]{3}[0-9]{7}$/, hint: 'e.g. ABC1234567' },
  'identity.driving_license_number': { tag: 'identity.driving_license_number', label: 'Driving licence number', kind: 'value', profileField: 'driving_license_number', hint: 'e.g. KA01 20191234567' },

  // ---- identity (file) ----
  'identity.aadhaar_card': { tag: 'identity.aadhaar_card', label: 'Aadhaar card', kind: 'file', group: 'identity' },
  'identity.pan_card': { tag: 'identity.pan_card', label: 'PAN card', kind: 'file', group: 'identity' },
  'identity.passport': { tag: 'identity.passport', label: 'Passport', kind: 'file', group: 'identity' },
  'identity.voter_id_card': { tag: 'identity.voter_id_card', label: 'Voter ID card', kind: 'file', group: 'identity' },
  'identity.driving_license': { tag: 'identity.driving_license', label: 'Driving licence', kind: 'file', group: 'identity' },
  'identity.ration_card': { tag: 'identity.ration_card', label: 'Ration card', kind: 'file', group: 'identity' },
  'identity.birth_certificate': { tag: 'identity.birth_certificate', label: 'Birth certificate', kind: 'file', group: 'identity' },

  // ---- contact (text) ----
  'contact.email': { tag: 'contact.email', label: 'Email address', kind: 'value', profileField: 'email', format: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, hint: 'name@example.com' },
  'contact.phone': { tag: 'contact.phone', label: 'Phone number', kind: 'value', profileField: 'phone', format: /^[6-9]\d{9}$/, hint: '10-digit Indian mobile' },
  'contact.alt_phone': { tag: 'contact.alt_phone', label: 'Alternate phone', kind: 'value', profileField: 'alt_phone', format: /^[6-9]\d{9}$/, hint: '10-digit Indian mobile' },

  // ---- address ----
  'address.current': { tag: 'address.current', label: 'Current address', kind: 'value', profileField: 'address_current' },
  'address.permanent': { tag: 'address.permanent', label: 'Permanent address', kind: 'value', profileField: 'address_permanent' },
  'address.city': { tag: 'address.city', label: 'City', kind: 'value', addressField: 'city' },
  'address.state': { tag: 'address.state', label: 'State', kind: 'value', addressField: 'state' },
  'address.country': { tag: 'address.country', label: 'Country', kind: 'value', addressField: 'country' },
  'address.pincode': { tag: 'address.pincode', label: 'Pincode', kind: 'value', addressField: 'pincode', format: /^\d{6}$/, hint: '6 digits' },
  'address.proof': { tag: 'address.proof', label: 'Address proof', kind: 'file', group: 'address', hint: 'Utility bill / rent agreement' },

  // ---- education (text, typed at fill-time) ----
  'education.10th_percentage': { tag: 'education.10th_percentage', label: '10th percentage', kind: 'value', hint: 'e.g. 92.4' },
  'education.12th_percentage': { tag: 'education.12th_percentage', label: '12th percentage', kind: 'value', hint: 'e.g. 88.0' },
  'education.degree': { tag: 'education.degree', label: 'Degree', kind: 'value', hint: 'e.g. B.Tech CSE' },
  'education.degree_cgpa': { tag: 'education.degree_cgpa', label: 'Degree CGPA', kind: 'value', hint: 'e.g. 8.6' },
  'education.university': { tag: 'education.university', label: 'University', kind: 'value' },
  'education.graduation_year': { tag: 'education.graduation_year', label: 'Graduation year', kind: 'value', format: /^(19|20)\d{2}$/, hint: 'e.g. 2024' },

  // ---- education (file) ----
  'education.10th_marksheet': { tag: 'education.10th_marksheet', label: '10th marksheet', kind: 'file', group: 'education' },
  'education.12th_marksheet': { tag: 'education.12th_marksheet', label: '12th marksheet', kind: 'file', group: 'education' },
  'education.degree_certificate': { tag: 'education.degree_certificate', label: 'Degree certificate', kind: 'file', group: 'education' },
  'education.degree_marksheet': { tag: 'education.degree_marksheet', label: 'Degree marksheet', kind: 'file', group: 'education' },
  'education.transfer_certificate': { tag: 'education.transfer_certificate', label: 'Transfer certificate (TC)', kind: 'file', group: 'education' },
  'education.migration_certificate': { tag: 'education.migration_certificate', label: 'Migration certificate', kind: 'file', group: 'education' },

  // ---- employment (text, typed at fill-time) ----
  'employment.employer': { tag: 'employment.employer', label: 'Current employer', kind: 'value' },
  'employment.designation': { tag: 'employment.designation', label: 'Designation', kind: 'value' },
  'employment.experience_years': { tag: 'employment.experience_years', label: 'Experience (years)', kind: 'value', hint: 'e.g. 3' },
  'employment.current_salary': { tag: 'employment.current_salary', label: 'Current salary', kind: 'value', hint: 'Annual CTC' },

  // ---- employment (file) ----
  'employment.offer_letter': { tag: 'employment.offer_letter', label: 'Offer letter', kind: 'file', group: 'employment' },
  'employment.appointment_letter': { tag: 'employment.appointment_letter', label: 'Appointment letter', kind: 'file', group: 'employment' },
  'employment.experience_letter': { tag: 'employment.experience_letter', label: 'Experience letter', kind: 'file', group: 'employment' },
  'employment.payslip': { tag: 'employment.payslip', label: 'Payslip', kind: 'file', group: 'employment' },
  'employment.form16': { tag: 'employment.form16', label: 'Form 16', kind: 'file', group: 'employment' },

  // ---- financial (text, typed at fill-time) ----
  'financial.bank_name': { tag: 'financial.bank_name', label: 'Bank name', kind: 'value' },
  'financial.account_number': { tag: 'financial.account_number', label: 'Account number', kind: 'value', format: /^\d{9,18}$/, hint: '9–18 digits' },
  'financial.ifsc': { tag: 'financial.ifsc', label: 'IFSC code', kind: 'value', format: /^[A-Z]{4}0[A-Z0-9]{6}$/, hint: 'e.g. HDFC0001234' },
  'financial.upi_id': { tag: 'financial.upi_id', label: 'UPI ID', kind: 'value', hint: 'e.g. name@okbank' },

  // ---- financial (file) ----
  'financial.bank_statement': { tag: 'financial.bank_statement', label: 'Bank statement', kind: 'file', group: 'financial' },
  'financial.cancelled_cheque': { tag: 'financial.cancelled_cheque', label: 'Cancelled cheque', kind: 'file', group: 'financial' },
  'financial.itr': { tag: 'financial.itr', label: 'Income tax return (ITR)', kind: 'file', group: 'financial' },

  // ---- certificate (file) ----
  'certificate.caste': { tag: 'certificate.caste', label: 'Caste certificate', kind: 'file', group: 'certificate' },
  'certificate.income': { tag: 'certificate.income', label: 'Income certificate', kind: 'file', group: 'certificate' },
  'certificate.domicile': { tag: 'certificate.domicile', label: 'Domicile certificate', kind: 'file', group: 'certificate' },
  'certificate.ews': { tag: 'certificate.ews', label: 'EWS certificate', kind: 'file', group: 'certificate' },

  // ---- medical ----
  'medical.blood_group': { tag: 'medical.blood_group', label: 'Blood group', kind: 'value', profileField: 'blood_group', hint: 'e.g. O+' },
  'medical.disability_certificate': { tag: 'medical.disability_certificate', label: 'Disability certificate', kind: 'file', group: 'medical' },
  'medical.medical_certificate': { tag: 'medical.medical_certificate', label: 'Medical certificate', kind: 'file', group: 'medical' },
  'medical.vaccination_certificate': { tag: 'medical.vaccination_certificate', label: 'Vaccination certificate', kind: 'file', group: 'medical' },

  // ---- photo & signature (file) ----
  'photo.passport_size': { tag: 'photo.passport_size', label: 'Passport-size photo', kind: 'file', group: 'photo' },
  'signature.specimen': { tag: 'signature.specimen', label: 'Signature', kind: 'file', group: 'photo' },

  // ---- derived (computed, never stored) ----
  'derived.age': { tag: 'derived.age', label: 'Age', kind: 'derived', hint: 'Computed at fill-time from date of birth' },
  'derived.full_address': { tag: 'derived.full_address', label: 'Full address', kind: 'derived', hint: 'Computed from your current address' },
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
