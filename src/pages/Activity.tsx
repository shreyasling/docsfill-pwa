import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { listApprovalLogs } from '../lib/db';
import { tagDef } from '../lib/tags';
import type { ApprovalLogRow } from '../lib/types';
import { Banner, PageHeader, Spinner } from '../components/ui';

function siteLabel(log: ApprovalLogRow): string {
  if (log.origin) {
    try {
      return new URL(log.origin).hostname;
    } catch {
      return log.origin;
    }
  }
  return log.form_id ?? 'Unknown form';
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d > 1 ? 's' : ''} ago`;
}

function daysLeft(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));
}

export default function Activity() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<ApprovalLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    listApprovalLogs(user.id)
      .then(setLogs)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load activity.'))
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Sharing activity"
        subtitle="What you approved, when, and to which site. Kept for 7 days."
      />
      {error && <Banner tone="error">{error}</Banner>}

      {loading ? (
        <div className="flex h-48 items-center justify-center text-brand-600">
          <Spinner className="h-7 w-7" />
        </div>
      ) : logs.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <svg viewBox="0 0 24 24" fill="none" width="24" height="24">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
              <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <p className="font-semibold text-slate-700">No sharing yet</p>
          <p className="max-w-xs text-sm text-slate-400">
            When you approve a form's autofill request, it shows up here.
          </p>
          <Link to="/scan" className="btn-primary mt-2">
            Scan a form
          </Link>
        </div>
      ) : (
        <div className="space-y-2.5">
          {logs.map((log) => (
            <div key={log.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-bold text-slate-900">{siteLabel(log)}</p>
                  <p className="text-xs text-slate-400">
                    {timeAgo(log.created_at)} · shared {log.shared_tags.length} item
                    {log.shared_tags.length === 1 ? '' : 's'}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                  expires in {daysLeft(log.expires_at)}d
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {log.shared_tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-brand-50 px-2 py-1 text-[11px] font-medium text-brand-700"
                  >
                    {tagDef(t)?.label ?? t}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
