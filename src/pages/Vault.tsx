import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { FILE_TAGS, TAGS, fileTagsByGroup } from '../lib/tags';
import { listDocuments, upsertDocument, deleteDocument } from '../lib/db';
import { openDrivePicker, uploadFileToDrive } from '../lib/drivePicker';
import { getDriveAccessToken } from '../lib/google';
import { getDestFolder } from '../lib/prefs';
import type { DocumentRow } from '../lib/types';
import { Banner, PageHeader, PlusIcon, Spinner } from '../components/ui';
import { GROUP_STYLE, CategoryIcon, QrMotif } from '../components/pass';

export default function Vault() {
  const { user } = useAuth();
  const [docs, setDocs] = useState<Record<string, DocumentRow>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  const uploadedCount = Object.keys(docs).length;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-brand-600">
        <Spinner className="h-7 w-7" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Document vault"
        subtitle={`${uploadedCount} of ${FILE_TAGS.length} documents added — stored in your own Google Drive.`}
        action={
          <Link
            to="/activity"
            aria-label="Sharing activity"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-slate-100"
          >
            <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
              <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        }
      />
      {error && <Banner tone="error">{error}</Banner>}

      {fileTagsByGroup().map((group) => {
        const have = group.tags.filter((t) => docs[t]).length;
        return (
          <section key={group.key} className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                {group.label}
              </h2>
              <span className="text-xs font-medium text-slate-400">
                {have}/{group.tags.length}
              </span>
            </div>
            <div className="space-y-2.5">
              {group.tags.map((tag) => (
                <VaultRow
                  key={tag}
                  tag={tag}
                  doc={docs[tag]}
                  folderId={folderId}
                  onChanged={refresh}
                  onError={setError}
                />
              ))}
            </div>
          </section>
        );
      })}
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
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
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
          <QrMotif />
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
