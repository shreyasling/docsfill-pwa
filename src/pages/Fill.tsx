import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import {
  approveSession,
  addApprovalLog,
  getProfile,
  getSession,
  listDocuments,
  signalFilled,
} from '../lib/db';
import type {
  AddressValue,
  DocumentRow,
  FilledPayload,
  ProfileRow,
  SessionRow,
} from '../lib/types';
import { TAGS, computeAge, isKnownTag, tagDef } from '../lib/tags';
import { prepareFileUrl } from '../lib/fileProxy';
import { getDriveTokenWithExpiry } from '../lib/google';
import { AlertIcon, Banner, Spinner } from '../components/ui';
import { TagIcon, CheckCircle, tagTile } from '../components/pass';

function formatAddress(a: AddressValue | null | undefined): string {
  if (!a) return '';
  return [a.line1, a.line2, a.city, a.state, a.pincode]
    .map((s) => (s ?? '').trim())
    .filter(Boolean)
    .join(', ');
}

type ResolvedTag =
  | { tag: string; kind: 'unknown' }
  | { tag: string; kind: 'file'; satisfied: boolean; doc?: DocumentRow }
  | {
      tag: string;
      kind: 'value' | 'derived';
      satisfied: boolean;
      /** For a stored/derived value we already have. */
      value?: string | number;
      /** Value tags with no backing store (e.g. PAN) are entered at fill-time. */
      needsInput?: boolean;
      /** Where to go to add a missing profile value. */
      addAt?: string;
    };

export default function Fill() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const sessionId = params.get('session');
  // Per-session capability token from the QR/fill URL (?...&k=<token>).
  const accessToken = params.get('k');

  const [session, setSession] = useState<SessionRow | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [docs, setDocs] = useState<Record<string, DocumentRow>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Fill-time-only values for value tags with no backing store (never persisted).
  const [inlineValues, setInlineValues] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!sessionId || !user) return;
    setLoading(true);
    setError(null);
    try {
      const [s, p, d] = await Promise.all([
        getSession(sessionId, accessToken),
        getProfile(user.id),
        listDocuments(user.id),
      ]);
      setSession(s);
      setProfile(p);
      const byTag: Record<string, DocumentRow> = {};
      for (const r of d) byTag[r.tag] = r;
      setDocs(byTag);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load session.');
    } finally {
      setLoading(false);
    }
  }, [sessionId, user, accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const requiredTags: string[] = useMemo(
    () => (Array.isArray(session?.required_tags) ? session!.required_tags : []),
    [session],
  );

  const resolved: ResolvedTag[] = useMemo(() => {
    return requiredTags.map((tag): ResolvedTag => {
      if (!isKnownTag(tag)) return { tag, kind: 'unknown' };
      const def = TAGS[tag];

      if (def.kind === 'file') {
        const doc = docs[tag];
        return { tag, kind: 'file', satisfied: Boolean(doc), doc };
      }

      if (def.kind === 'derived') {
        if (tag === 'derived.full_address') {
          const value = formatAddress(profile?.address_current) || undefined;
          return {
            tag,
            kind: 'derived',
            satisfied: Boolean(value),
            value,
            addAt: value ? undefined : '/profile',
          };
        }
        // derived.age — computed here, never stored.
        const age = computeAge(profile?.date_of_birth ?? '');
        return {
          tag,
          kind: 'derived',
          satisfied: age !== null,
          value: age ?? undefined,
          addAt: age === null ? '/profile' : undefined,
        };
      }

      // value tag backed by a sub-field of the stored current address
      if (def.addressField) {
        const value = profile?.address_current?.[def.addressField] || undefined;
        return {
          tag,
          kind: 'value',
          satisfied: Boolean(value),
          value,
          addAt: value ? undefined : '/profile',
        };
      }

      // value tag
      if (def.profileField) {
        const field = def.profileField;
        const value =
          field === 'address_current' || field === 'address_permanent'
            ? formatAddress(profile?.[field]) || undefined
            : (profile?.[field] as string | null | undefined) ?? undefined;
        return {
          tag,
          kind: 'value',
          satisfied: Boolean(value),
          value,
          addAt: value ? undefined : '/profile',
        };
      }

      // value tag with no backing store (PAN, Aadhaar) — typed at fill-time.
      const typed = (inlineValues[tag] ?? '').trim();
      const okFormat = def.format ? def.format.test(typed) : typed.length > 0;
      return { tag, kind: 'value', satisfied: okFormat, value: typed, needsInput: true };
    });
  }, [requiredTags, docs, profile, inlineValues]);

  // Unknown tags are skipped (see payload loop), so they must not block Approve.
  const knownResolved = resolved.filter((r) => r.kind !== 'unknown');
  const satisfiedCount = knownResolved.filter((r) => 'satisfied' in r && r.satisfied).length;
  const allSatisfied = knownResolved.length > 0 && satisfiedCount === knownResolved.length;
  // Everything is optional: approve as long as at least one field can be shared.
  // Empty/missing fields are simply skipped, not required.
  const canApprove = satisfiedCount > 0;

  // Warm a Drive token SILENTLY the moment we know files will be sent, so the
  // Approve tap reuses the cached token and never pops the account chooser.
  const hasFileTags = resolved.some((r) => r.kind === 'file' && Boolean(r.doc));
  useEffect(() => {
    if (!hasFileTags) return;
    void getDriveTokenWithExpiry(false).catch(() => {
      /* silent warm-up only; approve will fall back to interactive if needed */
    });
  }, [hasFileTags]);

  const now = Date.now();
  const isExpired =
    session != null &&
    (session.status === 'expired' || new Date(session.expires_at).getTime() < now);
  const alreadyFilled = session?.status === 'filled';

  async function handleApprove() {
    if (!session) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload: FilledPayload = {};
      // Mint proxy URLs for the file tags in parallel so the SDK can inject the
      // real bytes. A null result just means we fall back to the reference.
      const fileEntries = resolved.filter(
        (r): r is Extract<ResolvedTag, { kind: 'file' }> => r.kind === 'file' && Boolean(r.doc),
      );
      // Pre-mint ONE fresh Drive token for the whole batch so every file reuses
      // it (one account popup at most, full-lifetime token, faster).
      if (fileEntries.length > 0) {
        try {
          await getDriveTokenWithExpiry(false);
        } catch {
          try {
            await getDriveTokenWithExpiry(true);
          } catch {
            /* proxy calls will just fall back to Drive references */
          }
        }
      }
      const fileUrls = await Promise.all(
        fileEntries.map((r) => prepareFileUrl(session.id, r.tag, r.doc!)),
      );
      const urlByTag = new Map(fileEntries.map((r, i) => [r.tag, fileUrls[i]]));

      for (const r of resolved) {
        if (r.kind === 'unknown') continue;
        if (r.kind === 'file' && r.doc) {
          const fileUrl = urlByTag.get(r.tag);
          payload[r.tag] = {
            fileName: r.doc.drive_file_name ?? 'document',
            driveFileId: r.doc.drive_file_id,
            driveUrl: r.doc.drive_view_url ?? '',
            ...(fileUrl ? { fileUrl } : {}),
          };
        } else if (r.kind === 'derived' && r.value !== undefined) {
          payload[r.tag] = { value: r.value };
        } else if (r.kind === 'value' && r.value !== undefined && r.value !== '') {
          payload[r.tag] = { value: r.value };
        }
      }
      await approveSession(session.id, payload, accessToken);
      // Instant path: nudge the SDK via Realtime Broadcast (polling is the fallback).
      void signalFilled(session.id).catch(() => {
        /* broadcast is a latency optimization, never fatal */
      });
      // Best-effort activity log — never block the approve on it.
      if (user) {
        try {
          await addApprovalLog(user.id, {
            sessionId: session.id,
            formId: session.form_id,
            origin: session.origin ?? null,
            sharedTags: Object.keys(payload),
          });
        } catch {
          /* logging is non-fatal */
        }
      }
      setDone(true);
    } catch (e) {
      console.error('approve failed:', e);
      setError(
        e instanceof Error
          ? e.message
          : (e && typeof e === 'object' && 'message' in e
              ? String((e as { message: unknown }).message)
              : 'Could not submit. The session may have expired or already been filled.'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-4 pb-6 pt-6">
      <header className="mb-2 flex items-center justify-between">
        <Link
          to="/"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-500 ring-1 ring-slate-200"
          aria-label="Close"
        >
          <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </Link>
        <span className="text-lg font-extrabold text-brand-600">DocFill</span>
        <span className="h-9 w-9" />
      </header>

      {!sessionId && <Banner tone="error">No session id in the link.</Banner>}
      {error && <div className="mb-3"><Banner tone="error">{error}</Banner></div>}

      {loading ? (
        <div className="flex h-64 items-center justify-center text-brand-600">
          <Spinner className="h-7 w-7" />
        </div>
      ) : !session ? (
        sessionId && <Banner tone="error">Session not found. The link may be invalid.</Banner>
      ) : done ? (
        <SuccessCard />
      ) : alreadyFilled ? (
        <Banner tone="success">
          This request has already been filled. Nothing more to do here.
        </Banner>
      ) : isExpired ? (
        <Banner tone="error">
          This request has expired. Ask the form to generate a fresh QR code.
        </Banner>
      ) : (
        <>
          <div className="mb-5 mt-2 flex flex-col items-center text-center">
            <span className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <svg viewBox="0 0 24 24" fill="none" width="30" height="30">
                <path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                <path d="M13 3v6h6" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              </svg>
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Autofill request</h1>
            <p className="mt-2 text-sm text-slate-500">
              <span className="font-semibold text-slate-700">{session.form_id}</span> is requesting
              the following information from your wallet.
            </p>
          </div>
          <div className="space-y-2.5">
            {resolved.map((r) => (
              <TagRow
                key={r.tag}
                r={r}
                returnTo={window.location.pathname + window.location.search}
                inlineValue={inlineValues[r.tag] ?? ''}
                onInline={(v) => setInlineValues((m) => ({ ...m, [r.tag]: v }))}
              />
            ))}
          </div>

          <div className="safe-bottom sticky bottom-0 mt-6 bg-slate-100 pt-3">
            <button
              className="btn-primary w-full"
              disabled={!canApprove || submitting}
              onClick={handleApprove}
            >
              {submitting ? (
                <Spinner className="h-5 w-5" />
              ) : (
                `Approve & Send${satisfiedCount ? ` (${satisfiedCount})` : ''}`
              )}
            </button>
            <p className="mt-2 flex items-center justify-center gap-1 text-center text-xs text-slate-400">
              <svg viewBox="0 0 24 24" fill="none" width="12" height="12">
                <path d="M6 10V8a6 6 0 0 1 12 0v2M5 10h14v10H5V10Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              </svg>
              {!canApprove
                ? 'Add at least one item above to share.'
                : allSatisfied
                  ? 'You approve before anything is shared.'
                  : 'Only the filled items are shared — the rest are skipped.'}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function TagRow({
  r,
  returnTo,
  inlineValue,
  onInline,
}: {
  r: ResolvedTag;
  returnTo: string;
  inlineValue: string;
  onInline: (v: string) => void;
}) {
  const def = tagDef(r.tag);
  const label = def?.label ?? r.tag;
  const back = `next=${encodeURIComponent(returnTo)}`;

  if (r.kind === 'unknown') {
    return (
      <div className="card flex items-center gap-3 opacity-70">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          ?
        </span>
        <div>
          <p className="font-semibold text-slate-700">{r.tag}</p>
          <p className="text-xs text-slate-400">Unknown tag — will be skipped.</p>
        </div>
      </div>
    );
  }

  const satisfied = r.satisfied;
  const needsInput = r.kind !== 'file' && Boolean(r.needsInput);
  const addAt = r.kind !== 'file' ? r.addAt : undefined;
  const tile = tagTile(r.tag, r.kind);

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <div className="flex items-center gap-3">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tile.bg} ${tile.text}`}
        >
          <TagIcon tag={r.tag} kind={r.kind} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {label}
          </p>
          {r.kind === 'file' ? (
            satisfied ? (
              <p className="truncate text-base font-semibold text-slate-900">
                {r.doc?.drive_file_name}
              </p>
            ) : (
              <p className="text-sm text-slate-400">Not in your vault yet</p>
            )
          ) : needsInput ? (
            <p className="text-sm text-slate-400">{def?.hint ?? 'Enter value'}</p>
          ) : satisfied ? (
            <p className="truncate text-base font-semibold text-slate-900">
              {String(r.value)}
              {r.tag === 'derived.age' && (
                <span className="ml-1 text-xs font-normal text-slate-400">(auto-calculated)</span>
              )}
            </p>
          ) : (
            <p className="text-sm text-slate-400">Not saved in your profile</p>
          )}
        </div>

        {satisfied ? (
          <CheckCircle />
        ) : r.kind === 'file' ? (
          <Link to={`/?${back}`} className="btn-ghost px-3 py-1.5 text-xs">
            Add
          </Link>
        ) : !needsInput && addAt ? (
          <Link to={`${addAt}?${back}`} className="btn-ghost px-3 py-1.5 text-xs">
            Add
          </Link>
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-50 text-amber-500">
            <AlertIcon />
          </span>
        )}
      </div>

      {needsInput && (
        <input
          className="input mt-3"
          placeholder={def?.hint ?? label}
          value={inlineValue}
          onChange={(e) => onInline(e.target.value)}
          inputMode={r.tag === 'identity.aadhaar' ? 'numeric' : 'text'}
          autoCapitalize={r.tag === 'identity.pan' ? 'characters' : 'off'}
        />
      )}
    </div>
  );
}

function SuccessCard() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
      <span className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-200">
        <svg viewBox="0 0 24 24" fill="none" width="48" height="48">
          <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <h2 className="text-2xl font-extrabold text-slate-900">Sent!</h2>
      <p className="mt-2 max-w-xs text-sm text-slate-500">
        Your approved details were sent to the form — the fields fill in automatically. You can
        return to the form now.
      </p>
      <Link to="/" className="btn-primary mt-8 px-6">
        Back to Wallet
      </Link>
    </div>
  );
}
