import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { listApprovalLogs } from '../lib/db';
import { tagDef } from '../lib/tags';
import type { ApprovalLogRow } from '../lib/types';
import { Banner, Spinner } from '../components/ui';

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
  const [filter, setFilter] = useState<'all' | 'today' | 'week'>('all');
  const [selectedLog, setSelectedLog] = useState<ApprovalLogRow | null>(null);

  useEffect(() => {
    if (!user) return;
    listApprovalLogs(user.id)
      .then(setLogs)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load activity.'))
      .finally(() => setLoading(false));
  }, [user]);

  const filteredLogs = logs.filter((log) => {
    if (filter === 'all') return true;
    const age = Date.now() - new Date(log.created_at).getTime();
    return age <= (filter === 'today' ? 24 : 7 * 24) * 60 * 60 * 1000;
  });

  return (
    <div className="space-y-4">
      <header className="history-hero">
        <div className="flex items-start justify-between gap-3"><div><h1>Sharing history</h1><p>Every approved form request, in one place.</p></div><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15">⌕</span></div>
        <div className="mt-5 flex items-center gap-2 text-xs font-medium text-brand-100"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/15">✓</span> Kept for 7 days to protect your privacy</div>
      </header>
      {error && <Banner tone="error">{error}</Banner>}

      {!loading && logs.length > 0 && <div className="history-filters" role="group" aria-label="Filter sharing history">{([['all', 'All'], ['today', 'Today'], ['week', 'This week']] as const).map(([value, label]) => <button type="button" key={value} onClick={() => setFilter(value)} className={filter === value ? 'active' : ''}>{label}</button>)}</div>}

      {loading ? (
        <div className="flex h-48 items-center justify-center text-brand-600">
          <Spinner className="h-7 w-7" />
        </div>
      ) : logs.length === 0 ? (
        <div className="history-card flex flex-col items-center gap-2 py-10 text-center">
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
      ) : filteredLogs.length === 0 ? (
        <div className="history-card py-10 text-center"><p className="font-semibold text-slate-700">Nothing shared in this period</p><button type="button" onClick={() => setFilter('all')} className="mt-3 text-sm font-semibold text-brand-600">Show all activity</button></div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <div key={log.id} className="history-card">
              <div className="flex items-start gap-3">
                <span className="history-site-icon"><svg viewBox="0 0 24 24" fill="none" width="21" height="21"><path d="M12 3 20 7.5v9L12 21l-8-4.5v-9L12 3Z" stroke="currentColor" strokeWidth="2"/><path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-slate-900">{siteLabel(log)}</p>
                  <p className="text-xs text-slate-400">
                    {timeAgo(log.created_at)} · shared {log.shared_tags.length} item
                    {log.shared_tags.length === 1 ? '' : 's'}
                  </p>
                </div>
                <span className="history-expiry">
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
              <button type="button" className="mt-4 text-xs font-semibold text-brand-600" onClick={() => setSelectedLog(log)}>View sharing details →</button>
            </div>
          ))}
        </div>
      )}
      {selectedLog && <div className="history-drawer-backdrop" role="presentation" onClick={() => setSelectedLog(null)}><section className="history-drawer" role="dialog" aria-modal="true" aria-label="Sharing details" onClick={(e) => e.stopPropagation()}><div className="mx-auto h-1.5 w-10 rounded-full bg-slate-200"/><div className="mt-5 flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Approved share</p><h2>{siteLabel(selectedLog)}</h2><p>{timeAgo(selectedLog.created_at)}</p></div><button type="button" aria-label="Close details" onClick={() => setSelectedLog(null)}>×</button></div><div className="mt-5 rounded-2xl bg-brand-50 p-4 text-sm text-brand-800"><strong>Shared data</strong><div className="mt-3 flex flex-wrap gap-1.5">{selectedLog.shared_tags.map((tag) => <span key={tag}>{tagDef(tag)?.label ?? tag}</span>)}</div></div><p className="mt-4 text-sm leading-relaxed text-slate-500">This approval expires in {daysLeft(selectedLog.expires_at)} day{daysLeft(selectedLog.expires_at) === 1 ? '' : 's'}. DocFill never shares anything without your approval.</p></section></div>}
    </div>
  );
}
