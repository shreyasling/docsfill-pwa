import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { getProfile, upsertProfile } from '../lib/db';
import { pickDriveFolder } from '../lib/drivePicker';
import type { DriveFolder } from '../lib/drivePicker';
import { getDestFolder, setDestFolder } from '../lib/prefs';
import type { AddressValue, ProfileRow } from '../lib/types';
import { computeAge } from '../lib/tags';
import { useThemePreference, type ThemePreference } from '../lib/theme';
import { Banner, PageHeader, Spinner } from '../components/ui';

const EMPTY_ADDR: AddressValue = {
  line1: '',
  line2: '',
  city: '',
  state: '',
  pincode: '',
};

/** Supabase errors are plain objects, not Error instances — pull out the real
 *  message so failures aren't hidden behind a generic string. */
function errText(e: unknown, fallback: string): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === 'object' && 'message' in e) {
    return String((e as { message: unknown }).message) || fallback;
  }
  return fallback;
}

function AddressFields({
  value,
  onChange,
}: {
  value: AddressValue;
  onChange: (v: AddressValue) => void;
}) {
  const set = (k: keyof AddressValue, v: string) => onChange({ ...value, [k]: v });
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="col-span-2">
        <input className="input" placeholder="Address line 1" value={value.line1 ?? ''} onChange={(e) => set('line1', e.target.value)} />
      </div>
      <div className="col-span-2">
        <input className="input" placeholder="Address line 2" value={value.line2 ?? ''} onChange={(e) => set('line2', e.target.value)} />
      </div>
      <input className="input" placeholder="City" value={value.city ?? ''} onChange={(e) => set('city', e.target.value)} />
      <input className="input" placeholder="State" value={value.state ?? ''} onChange={(e) => set('state', e.target.value)} />
      <input className="input" placeholder="Pincode" value={value.pincode ?? ''} onChange={(e) => set('pincode', e.target.value)} />
    </div>
  );
}

function displayDate(value: string) {
  if (!value) return '—';
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function ProfileSymbol({ type = 'person' }: { type?: 'person' | 'calendar' | 'shield' | 'heart' | 'drop' | 'flower' | 'flag' }) {
  if (type === 'calendar') return <svg viewBox="0 0 24 24" fill="none"><rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M8 3v4m8-4v4M4 10h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>;
  if (type === 'shield') return <svg viewBox="0 0 24 24" fill="none"><path d="M12 3 19 6v5c0 4.6-3 7.8-7 10-4-2.2-7-5.4-7-10V6l7-3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg>;
  if (type === 'heart') return <svg viewBox="0 0 24 24" fill="none"><path d="M20 8.5c0 5-8 10-8 10s-8-5-8-10a4 4 0 0 1 7-2.6A4 4 0 0 1 20 8.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg>;
  if (type === 'drop') return <svg viewBox="0 0 24 24" fill="none"><path d="M12 3s6 6.7 6 11a6 6 0 1 1-12 0c0-4.3 6-11 6-11Z" stroke="currentColor" strokeWidth="2"/></svg>;
  if (type === 'flower') return <svg viewBox="0 0 24 24" fill="none"><path d="M12 9c-5-6-9 1-4 3-5 2-1 9 3 4 1 6 9 3 5-2 6 1 6-7 1-5 2-6-6-7-5 0Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg>;
  if (type === 'flag') return <svg viewBox="0 0 24 24" fill="none"><path d="M6 21V4m0 1h11l-2 4 2 4H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
  return <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="2"/><path d="M5 20c0-3.7 3-6 7-6s7 2.3 7 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>;
}

function OverviewRow({ label, value, icon = 'person', optional = false }: { label: string; value: string; icon?: 'person' | 'calendar'; optional?: boolean }) {
  return <div className="profile-overview-row"><span className="profile-symbol"><ProfileSymbol type={icon} /></span><div><p>{label}</p><strong>{value || '—'}</strong></div>{optional && !value && <small>Optional</small>}</div>;
}

function DetailTile({ label, value, icon }: { label: string; value: string; icon: 'person' | 'shield' | 'heart' | 'drop' | 'flower' | 'flag' }) {
  return <div className="profile-detail-tile"><span className="profile-symbol"><ProfileSymbol type={icon} /></span><div><p>{label}</p><strong>{value || '—'}</strong></div></div>;
}

function ProfileOverview({
  fullName, fatherName, motherName, spouseName, dob, age, gender, category, maritalStatus, bloodGroup, religion, nationality, onEdit, theme, setTheme,
}: {
  fullName: string; fatherName: string; motherName: string; spouseName: string; dob: string; age: number | null; gender: string; category: string; maritalStatus: string; bloodGroup: string; religion: string; nationality: string; onEdit: () => void; theme: ThemePreference; setTheme: (theme: ThemePreference) => void;
}) {
  const completed = [fullName, fatherName, motherName, dob, gender, category, maritalStatus, bloodGroup, religion, nationality].filter(Boolean).length;
  const completion = Math.round((completed / 10) * 100);
  return (
    <div className="profile-screen space-y-5">
      <header className="profile-hero">
        <div><h1>Profile <span className="profile-title-shield"><ProfileSymbol type="shield" /></span></h1><p><ProfileSymbol type="shield" />Your data is encrypted</p></div>
        <div className="flex flex-col items-end gap-4"><span className="profile-avatar">{fullName.trim().charAt(0).toUpperCase() || 'U'}</span><button type="button" className="profile-edit" onClick={onEdit}>⌕ <span>Edit</span></button></div>
      </header>
      <div className="profile-theme-switch" role="group" aria-label="Colour theme">
        {(['light', 'dark', 'system'] as ThemePreference[]).map((value) => <button type="button" key={value} onClick={() => setTheme(value)} className={theme === value ? 'active' : ''}>{value === 'system' ? 'Auto' : value[0].toUpperCase() + value.slice(1)}</button>)}
      </div>
      <button type="button" onClick={onEdit} className="profile-completion"><div><span>Profile completion</span><strong>{completion}%</strong></div><div className="profile-completion-track"><span style={{ width: `${completion}%` }} /></div><small>{completion === 100 ? 'Your details are ready for forms.' : `${10 - completed} more detail${10 - completed === 1 ? '' : 's'} can make autofill smoother.`}</small></button>
      <section className="profile-panel">
        <div className="profile-panel-title"><span className="profile-symbol"><ProfileSymbol /></span><h2>Personal information</h2><span>⌃</span></div>
        <OverviewRow label="Full name" value={fullName} />
        <OverviewRow label="Father's name" value={fatherName} />
        <OverviewRow label="Mother's name" value={motherName} />
        <OverviewRow label="Spouse's name" value={spouseName} optional />
        <OverviewRow label="Date of birth" value={displayDate(dob)} icon="calendar" />
      </section>
      {age !== null && <div className="profile-age"><span>✧</span>Computed age: {age} years</div>}
      <section className="profile-panel">
        <div className="profile-panel-title"><span className="profile-symbol"><ProfileSymbol type="shield" /></span><h2>Personal details</h2><span>⌃</span></div>
        <div className="profile-detail-grid">
          <DetailTile label="Gender" value={gender} icon="person" /><DetailTile label="Category" value={category} icon="shield" />
          <DetailTile label="Marital status" value={maritalStatus} icon="heart" /><DetailTile label="Blood group" value={bloodGroup} icon="drop" />
          <DetailTile label="Religion" value={religion} icon="flower" /><DetailTile label="Nationality" value={nationality} icon="flag" />
        </div>
      </section>
      <div className="profile-security-note"><span className="profile-symbol"><ProfileSymbol type="shield" /></span><div><strong>We never store your sensitive information.</strong><p>All data is encrypted on your device.</p></div></div>
    </div>
  );
}

export default function Profile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(() => Boolean(next));
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [motherName, setMotherName] = useState('');
  const [spouseName, setSpouseName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [nationality, setNationality] = useState('');
  const [maritalStatus, setMaritalStatus] = useState('');
  const [religion, setReligion] = useState('');
  const [category, setCategory] = useState('');
  const [pan, setPan] = useState('');
  const [aadhaar, setAadhaar] = useState('');
  const [passportNumber, setPassportNumber] = useState('');
  const [voterId, setVoterId] = useState('');
  const [dlNumber, setDlNumber] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [altPhone, setAltPhone] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [addrCurrent, setAddrCurrent] = useState<AddressValue>(EMPTY_ADDR);
  const [addrPermanent, setAddrPermanent] = useState<AddressValue>(EMPTY_ADDR);
  const [sameAsCurrent, setSameAsCurrent] = useState(false);
  const { theme, setTheme } = useThemePreference();

  useEffect(() => {
    if (!user) return;
    getProfile(user.id)
      .then((p: ProfileRow | null) => {
        if (p) {
          setFullName(p.full_name ?? '');
          setFatherName(p.father_name ?? '');
          setMotherName(p.mother_name ?? '');
          setSpouseName(p.spouse_name ?? '');
          setDob(p.date_of_birth ?? '');
          setGender(p.gender ?? '');
          setNationality(p.nationality ?? '');
          setMaritalStatus(p.marital_status ?? '');
          setReligion(p.religion ?? '');
          setCategory(p.category ?? '');
          setPan(p.pan ?? '');
          setAadhaar(p.aadhaar ?? '');
          setPassportNumber(p.passport_number ?? '');
          setVoterId(p.voter_id ?? '');
          setDlNumber(p.driving_license_number ?? '');
          setEmail(p.email ?? '');
          setPhone(p.phone ?? '');
          setAltPhone(p.alt_phone ?? '');
          setBloodGroup(p.blood_group ?? '');
          setAddrCurrent(p.address_current ?? EMPTY_ADDR);
          setAddrPermanent(p.address_permanent ?? EMPTY_ADDR);
        }
      })
      .catch((e) => setError(errText(e, 'Failed to load profile.')))
      .finally(() => setLoading(false));
  }, [user]);

  const age = computeAge(dob);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const permanent = sameAsCurrent ? addrCurrent : addrPermanent;
      await upsertProfile(user.id, {
        full_name: fullName.trim() || null,
        father_name: fatherName.trim() || null,
        mother_name: motherName.trim() || null,
        spouse_name: spouseName.trim() || null,
        date_of_birth: dob || null,
        gender: gender.trim() || null,
        nationality: nationality.trim() || null,
        marital_status: maritalStatus.trim() || null,
        religion: religion.trim() || null,
        category: category.trim() || null,
        pan: pan.trim().toUpperCase() || null,
        aadhaar: aadhaar.trim() || null,
        passport_number: passportNumber.trim().toUpperCase() || null,
        voter_id: voterId.trim().toUpperCase() || null,
        driving_license_number: dlNumber.trim().toUpperCase() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        alt_phone: altPhone.trim() || null,
        blood_group: bloodGroup.trim() || null,
        address_current: addrCurrent,
        address_permanent: permanent,
      });
      if (sameAsCurrent) setAddrPermanent(addrCurrent);
      // Came here from a fill request to add a missing field → go straight back.
      if (next) {
        navigate(decodeURIComponent(next));
        return;
      }
      setEditing(false);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(errText(e, 'Failed to save profile.'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-brand-600">
        <Spinner className="h-7 w-7" />
      </div>
    );
  }

  if (!editing && !next) {
    return <ProfileOverview fullName={fullName} fatherName={fatherName} motherName={motherName} spouseName={spouseName} dob={dob} age={age} gender={gender} category={category} maritalStatus={maritalStatus} bloodGroup={bloodGroup} religion={religion} nationality={nationality} onEdit={() => setEditing(true)} theme={theme} setTheme={setTheme} />;
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <PageHeader
        title="Profile"
        subtitle="Encrypted on your device before saving. Age is computed automatically — never stored."
        action={
          <button type="submit" className="btn-primary px-4 py-2 text-sm" disabled={saving}>
            {saving ? <Spinner className="h-4 w-4" /> : 'Save'}
          </button>
        }
      />

      {next && (
        <Banner tone="info">
          Adding details for a form. Save and you’ll go straight back to approve.
        </Banner>
      )}
      {error && <Banner tone="error">{error}</Banner>}

      <div className="card space-y-3">
        <div>
          <label className="label">Full name</label>
          <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" />
        </div>
        <div>
          <label className="label">Father's name</label>
          <input className="input" value={fatherName} onChange={(e) => setFatherName(e.target.value)} placeholder="John Doe" />
        </div>
        <div>
          <label className="label">Mother's name</label>
          <input className="input" value={motherName} onChange={(e) => setMotherName(e.target.value)} placeholder="Mary Doe" />
        </div>
        <div>
          <label className="label">Spouse's name</label>
          <input className="input" value={spouseName} onChange={(e) => setSpouseName(e.target.value)} placeholder="Optional" />
        </div>
        <div>
          <label className="label">Date of birth</label>
          <input className="input" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
          {age !== null && (
            <p className="mt-1 text-xs text-slate-400">Computed age: {age} years</p>
          )}
        </div>
      </div>

      <div className="card space-y-3">
        <label className="label mb-0">Personal details</label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Gender</label>
            <select className="input" value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="">Select</option>
              <option>Male</option>
              <option>Female</option>
              <option>Other</option>
            </select>
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Select</option>
              <option>GEN</option>
              <option>OBC</option>
              <option>SC</option>
              <option>ST</option>
              <option>EWS</option>
            </select>
          </div>
          <div>
            <label className="label">Marital status</label>
            <select className="input" value={maritalStatus} onChange={(e) => setMaritalStatus(e.target.value)}>
              <option value="">Select</option>
              <option>Single</option>
              <option>Married</option>
            </select>
          </div>
          <div>
            <label className="label">Blood group</label>
            <input className="input" value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} placeholder="O+" />
          </div>
          <div>
            <label className="label">Religion</label>
            <input className="input" value={religion} onChange={(e) => setReligion(e.target.value)} placeholder="e.g. Hindu" />
          </div>
          <div>
            <label className="label">Nationality</label>
            <input className="input" value={nationality} onChange={(e) => setNationality(e.target.value)} placeholder="Indian" />
          </div>
        </div>
      </div>

      <div className="card space-y-3">
        <label className="label mb-0">Government IDs</label>
        <div>
          <label className="label">PAN number</label>
          <input className="input uppercase" value={pan} onChange={(e) => setPan(e.target.value)} placeholder="ABCDE1234F" />
        </div>
        <div>
          <label className="label">Aadhaar number</label>
          <input className="input" inputMode="numeric" value={aadhaar} onChange={(e) => setAadhaar(e.target.value)} placeholder="12 digits" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Passport number</label>
            <input className="input uppercase" value={passportNumber} onChange={(e) => setPassportNumber(e.target.value)} placeholder="A1234567" />
          </div>
          <div>
            <label className="label">Voter ID (EPIC)</label>
            <input className="input uppercase" value={voterId} onChange={(e) => setVoterId(e.target.value)} placeholder="ABC1234567" />
          </div>
        </div>
        <div>
          <label className="label">Driving licence number</label>
          <input className="input uppercase" value={dlNumber} onChange={(e) => setDlNumber(e.target.value)} placeholder="KA01 20191234567" />
        </div>
      </div>

      <div className="card space-y-3">
        <label className="label mb-0">Contact</label>
        <div>
          <label className="label">Email address</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Phone number</label>
            <input className="input" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile" />
          </div>
          <div>
            <label className="label">Alternate phone</label>
            <input className="input" inputMode="numeric" value={altPhone} onChange={(e) => setAltPhone(e.target.value)} placeholder="Optional" />
          </div>
        </div>
      </div>

      <div className="card space-y-3">
        <label className="label">Current address</label>
        <AddressFields value={addrCurrent} onChange={setAddrCurrent} />
      </div>

      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <label className="label mb-0">Permanent address</label>
          <label className="flex items-center gap-2 text-xs text-slate-500">
            <input
              type="checkbox"
              checked={sameAsCurrent}
              onChange={(e) => setSameAsCurrent(e.target.checked)}
            />
            Same as current
          </label>
        </div>
        {!sameAsCurrent && (
          <AddressFields value={addrPermanent} onChange={setAddrPermanent} />
        )}
      </div>

      <button type="submit" className="btn-primary w-full" disabled={saving}>
        {saving ? <Spinner className="h-5 w-5" /> : next ? 'Save & return' : 'Save profile'}
      </button>

      <DriveFolderSetting />

      <SignOutButton />

      {saved && (
        <div className="pointer-events-none fixed bottom-24 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg">
          <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
            <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Saved
        </div>
      )}
    </form>
  );
}

function DriveFolderSetting() {
  const [folder, setFolder] = useState<DriveFolder | null>(() => getDestFolder());
  const [error, setError] = useState<string | null>(null);

  async function change() {
    setError(null);
    try {
      const picked = await pickDriveFolder();
      if (!picked) return;
      setFolder(picked);
      setDestFolder(picked);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the folder picker.');
    }
  }

  function reset() {
    setFolder(null);
    setDestFolder(null);
  }

  return (
    <div className="card space-y-3">
      <label className="label mb-0">Drive upload folder</label>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-700">
            {folder ? folder.name : 'DocFill folder (default)'}
          </p>
          <p className="text-xs text-slate-400">Where your uploaded documents are saved.</p>
        </div>
        <button type="button" className="btn-ghost shrink-0 px-3 py-1.5 text-xs" onClick={change}>
          Change
        </button>
      </div>
      {folder && (
        <button type="button" className="text-xs text-slate-400 hover:text-slate-600" onClick={reset}>
          Reset to default
        </button>
      )}
      {error && <Banner tone="error">{error}</Banner>}
    </div>
  );
}

function SignOutButton() {
  const { user, signOut } = useAuth();
  return (
    <div className="pt-2 text-center">
      <p className="mb-2 text-xs text-slate-400">Signed in as {user?.email}</p>
      <button type="button" className="btn-ghost" onClick={() => signOut()}>
        Sign out
      </button>
    </div>
  );
}
