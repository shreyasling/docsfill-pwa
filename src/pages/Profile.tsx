import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { getProfile, upsertProfile } from '../lib/db';
import { pickDriveFolder } from '../lib/drivePicker';
import type { DriveFolder } from '../lib/drivePicker';
import { getDestFolder, setDestFolder } from '../lib/prefs';
import type { AddressValue, ProfileRow } from '../lib/types';
import { computeAge } from '../lib/tags';
import { Banner, PageHeader, Spinner } from '../components/ui';

const EMPTY_ADDR: AddressValue = {
  line1: '',
  line2: '',
  city: '',
  state: '',
  pincode: '',
};

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

export default function Profile() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [dob, setDob] = useState('');
  const [addrCurrent, setAddrCurrent] = useState<AddressValue>(EMPTY_ADDR);
  const [addrPermanent, setAddrPermanent] = useState<AddressValue>(EMPTY_ADDR);
  const [sameAsCurrent, setSameAsCurrent] = useState(false);

  useEffect(() => {
    if (!user) return;
    getProfile(user.id)
      .then((p: ProfileRow | null) => {
        if (p) {
          setFullName(p.full_name ?? '');
          setFatherName(p.father_name ?? '');
          setDob(p.date_of_birth ?? '');
          setAddrCurrent(p.address_current ?? EMPTY_ADDR);
          setAddrPermanent(p.address_permanent ?? EMPTY_ADDR);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load profile.'))
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
        date_of_birth: dob || null,
        address_current: addrCurrent,
        address_permanent: permanent,
      });
      if (sameAsCurrent) setAddrPermanent(addrCurrent);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save profile.');
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

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <PageHeader
        title="Profile"
        subtitle="Text details reused across forms. Age is computed automatically — never stored."
      />

      {error && <Banner tone="error">{error}</Banner>}
      {saved && <Banner tone="success">Profile saved.</Banner>}

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
          <label className="label">Date of birth</label>
          <input className="input" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
          {age !== null && (
            <p className="mt-1 text-xs text-slate-400">Computed age: {age} years</p>
          )}
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
        {saving ? <Spinner className="h-5 w-5" /> : 'Save profile'}
      </button>

      <DriveFolderSetting />

      <SignOutButton />
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
