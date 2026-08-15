import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { TAGS, fileTagsByGroup, type GroupKey } from '../lib/tags';
import { listDocuments, upsertDocument, deleteDocument } from '../lib/db';
import { openDrivePicker, uploadFileToDrive } from '../lib/drivePicker';
import { getDriveAccessToken } from '../lib/google';
import { getDestFolder } from '../lib/prefs';
import type { DocumentRow } from '../lib/types';
import { Banner, PlusIcon, Spinner } from '../components/ui';
import { GROUP_STYLE, CategoryIcon } from '../components/pass';

function previewLabel(group: GroupKey) {
  const labels: Partial<Record<GroupKey, string>> = {
    financial: 'Financial Documents',
    education: 'Education Certificates',
    employment: 'Employment Documents',
  };
  return labels[group] ?? group;
}

export default function Vault() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const next = params.get('next');
  const [docs, setDocs] = useState<Record<string, DocumentRow>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<GroupKey>('identity');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [showAllDocuments, setShowAllDocuments] = useState(false);
  const folderId = getDestFolder()?.id ?? null;

  async function refresh() {
    if (!user) return;
    try {
      const rows = await listDocuments(user.id);
      const byTag: Record<string, DocumentRow> = {};
      for (const r of rows) byTag[r.tag] = r;
      setDocs(byTag);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load documents.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const groups = fileTagsByGroup();
  const filteredGroups = groups
    .map((group) => ({
      ...group,
      tags: group.tags.filter((tag) => !query.trim() || TAGS[tag].label.toLowerCase().includes(query.trim().toLowerCase())),
    }))
    .filter((group) => group.tags.length > 0);
  const activeGroup = filteredGroups.find((group) => group.key === selectedGroup) ?? filteredGroups[0];
  const previewGroups = (['financial', 'education', 'employment'] as GroupKey[])
    .map((key) => groups.find((group) => group.key === key))
    .filter((group): group is (typeof groups)[number] => Boolean(group && group.key !== activeGroup?.key));
  const uploadedTags = activeGroup?.tags.filter((tag) => docs[tag]) ?? [];
  const visibleTags = showAllDocuments
    ? activeGroup?.tags ?? []
    : (uploadedTags.length > 0 ? uploadedTags : activeGroup?.tags ?? []).slice(0, 2);

  function selectGroup(group: GroupKey) {
    setSelectedGroup(group);
    setShowAllDocuments(false);
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-brand-600">
        <Spinner className="h-7 w-7" />
      </div>
    );
  }

  return (
    <div className="vault-screen space-y-5">
      <header className="flex items-start justify-between gap-3 px-1">
        <div>
          <h1 className="text-[27px] font-bold tracking-[-0.03em] text-slate-900">Document vault</h1>
          <p className="mt-1 text-[15px] text-slate-500">Stored securely in your Google Drive</p>
        </div>
        <div className="flex gap-2">
          <button type="button" aria-label="Search documents" onClick={() => setSearchOpen((open) => !open)} className="icon-button">
            <svg viewBox="0 0 24 24" fill="none" width="21" height="21"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2"/><path d="m16.5 16.5 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
          <Link to="/activity" aria-label="Sharing activity" className="icon-button">
            <svg viewBox="0 0 24 24" fill="none" width="21" height="21"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/><circle cx="8" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="16" cy="12" r="1" fill="currentColor"/></svg>
          </Link>
        </div>
      </header>
      {error && <Banner tone="error">{error}</Banner>}

      {next && (
        <Link
          to={decodeURIComponent(next)}
          className="flex items-center justify-between rounded-xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700 ring-1 ring-brand-100"
        >
          <span>Add the document, then return to the request →</span>
        </Link>
      )}

      {searchOpen && (
        <input autoFocus className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your documents" aria-label="Search your documents" />
      )}

      <div className="vault-tabs" role="tablist" aria-label="Document categories">
        <button type="button" role="tab" aria-selected={selectedGroup === 'identity'} className={`vault-tab ${selectedGroup === 'identity' ? 'vault-tab-active' : ''}`} onClick={() => selectGroup('identity')}>
          <span className="grid grid-cols-2 gap-0.5"><i /><i /><i /><i /></span>All
        </button>
        {groups.slice(0, 4).map((group) => (
          <button type="button" role="tab" key={group.key} aria-selected={selectedGroup === group.key && selectedGroup !== 'identity'} onClick={() => selectGroup(group.key)} className={`vault-tab ${selectedGroup === group.key && selectedGroup !== 'identity' ? 'vault-tab-selected' : ''}`}>
            <CategoryIcon group={group.key} />{group.label.split(' ')[0]}
          </button>
        ))}
      </div>

      <div className="vault-category-stack">
      {previewGroups.map((group) => {
        const have = group.tags.filter((t) => docs[t]).length;
        return (
          <button type="button" key={group.key} onClick={() => selectGroup(group.key)} className="vault-category-preview">
            <span className="vault-preview-icon"><CategoryIcon group={group.key} /></span><span>{previewLabel(group.key)}</span><em>{have}</em>
          </button>
        );
      })}
      </div>

      {activeGroup && (
        <section className="vault-pass">
          <div className="vault-pass-heading">
            <div className="flex items-center gap-3"><span className="vault-pass-icon"><CategoryIcon group={activeGroup.key} /></span><h2>{activeGroup.label}</h2></div>
            <span>{activeGroup.tags.filter((t) => docs[t]).length} / {activeGroup.tags.length}</span>
          </div>
          <div className="vault-pass-items">
            {visibleTags.map((tag) => <VaultRow key={tag} tag={tag} doc={docs[tag]} folderId={folderId} onChanged={refresh} onError={setError} />)}
            {!showAllDocuments && activeGroup.tags.length > visibleTags.length && (
              <button type="button" className="vault-add-more" onClick={() => setShowAllDocuments(true)}><span>＋</span><div><strong>Add more documents</strong><small>Upload or scan a new document</small></div></button>
            )}
          </div>
        </section>
      )}

      <div className="security-line"><span className="security-line-icon">♢</span><span>Your data is encrypted on your device</span><span className="ml-auto text-xl">›</span></div>
      <div className="security-card"><span className="security-card-icon">♢</span><div><strong>Only you can access your documents.</strong><p>We never store your data on our servers.</p></div><span className="ml-auto text-xl">›</span></div>
    </div>
  );
}

function VaultRow({
  tag,
  doc,
  folderId,
  onChanged,
  onError,
}: {
  tag: string;
  doc?: DocumentRow;
  folderId: string | null;
  onChanged: () => void | Promise<void>;
  onError: (m: string) => void;
}) {
  const { user } = useAuth();
  const def = TAGS[tag];
  const cameraInput = useRef<HTMLInputElement>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  async function withBusy(fn: () => Promise<void>) {
    setBusy(true);
    setProgress(null);
    setMenuOpen(false);
    onError('');
    try {
      await fn();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  const handlePicker = () =>
    withBusy(async () => {
      if (!user) return;
      const picked = await openDrivePicker();
      if (!picked) return;
      await upsertDocument(user.id, tag, picked);
      await onChanged();
    });

  const handleFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    void withBusy(async () => {
      if (!user) return;
      const ext = file.name.split('.').pop() || 'jpg';
      const uploaded = await uploadFileToDrive(
        file,
        `${tag.replace(/\./g, '_')}.${ext}`,
        setProgress,
        folderId,
      );
      await upsertDocument(user.id, tag, uploaded);
      await onChanged();
    });
  };

  const handleRemove = () =>
    withBusy(async () => {
      if (!user) return;
      await deleteDocument(user.id, tag);
      await onChanged();
    });

  // Grab the Drive token now (clean gesture, no file chooser open) so the
  // consent popup can't be blocked later by an active <input type=file> chooser.
  const openAddMenu = async () => {
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }
    setMenuOpen(true);
    try {
      await getDriveAccessToken(true);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Could not connect Google Drive.');
    }
  };

  const uploaded = Boolean(doc);
  const style = GROUP_STYLE[def.group ?? 'identity'];

  return (
    <div className="vault-document-row">
      <div className={`h-1.5 w-full ${uploaded ? style.strip : 'bg-slate-200'}`} />
      <div className="flex items-center gap-3 p-4">
        <span
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${style.tileBg} ${style.tileText}`}
        >
          <CategoryIcon group={def.group ?? 'identity'} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold text-slate-900">{def.label}</p>
          {busy && progress !== null ? (
            <p className="mt-0.5 text-xs font-medium text-brand-600">Uploading… {progress}%</p>
          ) : uploaded ? (
            <p className="mt-0.5 flex items-center gap-1.5 text-xs">
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
                  <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Added
              </span>
              <span className="truncate text-slate-400">• {doc!.drive_file_name}</span>
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-slate-400">Not added yet</p>
          )}
          {busy && progress !== null && (
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-brand-600 transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>

        {busy ? (
          progress !== null ? (
            <span className="text-xs font-bold tabular-nums text-brand-600">{progress}%</span>
          ) : (
            <Spinner className="h-5 w-5 text-brand-600" />
          )
        ) : uploaded ? (
          <span className="vault-check" aria-label="Added">✓</span>
        ) : (
          <button className="btn-primary px-3 py-1.5 text-xs" onClick={openAddMenu}>
            <PlusIcon className="h-4 w-4" /> Add
          </button>
        )}
      </div>

      {uploaded && !busy && (
        <div className="flex divide-x divide-slate-100 border-t border-slate-100 text-xs">
          <a
            href={doc!.drive_view_url ?? '#'}
            target="_blank"
            rel="noreferrer"
            className="flex-1 py-2.5 text-center font-medium text-brand-600 hover:bg-slate-50"
          >
            View in Drive
          </a>
          <button
            className="flex-1 py-2.5 text-center font-medium text-red-500 hover:bg-red-50"
            onClick={handleRemove}
          >
            Remove
          </button>
        </div>
      )}

      {menuOpen && !uploaded && (
        <div className="grid grid-cols-3 gap-2 border-t border-slate-100 p-3">
          <button className="btn-ghost text-xs" onClick={handlePicker}>
            Drive
          </button>
          <button className="btn-ghost text-xs" onClick={() => uploadInput.current?.click()}>
            Upload
          </button>
          <button className="btn-ghost text-xs" onClick={() => cameraInput.current?.click()}>
            Camera
          </button>
        </div>
      )}

      {/* Camera capture (images only). */}
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChosen}
      />
      {/* Upload an existing file: PDF or image, any format the user has. */}
      <input
        ref={uploadInput}
        type="file"
        accept="image/png,image/jpeg,image/webp,application/pdf"
        className="hidden"
        onChange={handleFileChosen}
      />
    </div>
  );
}
