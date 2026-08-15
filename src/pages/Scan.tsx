import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QrScanner from '../components/QrScanner';
import { fillPathFromScan } from '../lib/qr';
import { addRecentScan, getRecentScans, type RecentScan } from '../lib/prefs';
import { Banner } from '../components/ui';

export default function Scan() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [scannerKey, setScannerKey] = useState(0);
  const [manualCode, setManualCode] = useState('');
  const [recentScans, setRecentScans] = useState<RecentScan[]>(getRecentScans);

  function handleResult(raw: string) {
    const path = fillPathFromScan(raw);
    if (!path) {
      setError("Scanned a code, but it isn't a DocFill form QR. Try again.");
      setScannerKey((k) => k + 1); // remount to resume scanning
      return;
    }
    setRecentScans(addRecentScan(path));
    navigate(path);
  }

  return (
    <div className="space-y-4">
      <header className="scan-hero">
        <span className="scan-hero-icon"><svg viewBox="0 0 24 24" fill="none" width="25" height="25"><path d="M4 4h4M4 4v4M20 4h-4M20 4v4M4 20h4M4 20v-4M20 20h-4M20 20v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="2"/></svg></span>
        <div><h1>Scan a form</h1><p>Point at a DocFill QR code to start a secure request.</p></div>
      </header>

      {error && <Banner tone="error">{error}</Banner>}

      <QrScanner key={scannerKey} onResult={handleResult} />

      <div className="scan-how">
        <p className="text-sm font-semibold text-slate-700">How it works</p>
        <ol className="mt-3 space-y-3 text-sm text-slate-500">
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-600">
              1
            </span>
            Open the form that shows a DocFill QR code.
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-600">
              2
            </span>
            Hold your camera over it — it detects automatically.
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-600">
              3
            </span>
            Review the requested details, then Approve &amp; Send.
          </li>
        </ol>
      </div>

      <details className="scan-manual">
        <summary>Can’t scan the code?</summary>
        <div className="mt-3 flex gap-2"><input className="input" value={manualCode} onChange={(e) => setManualCode(e.target.value)} placeholder="Paste DocFill link" aria-label="DocFill link" /><button type="button" onClick={() => handleResult(manualCode)} className="btn-primary shrink-0 px-3">Open</button></div>
      </details>

      {recentScans.length > 0 && <section className="recent-scans"><div className="flex items-center justify-between"><h2>Recent scans</h2><span>Available for 7 days</span></div>{recentScans.map((scan) => <button type="button" key={scan.path} onClick={() => navigate(scan.path)}><span>⌁</span><div><strong>DocFill request</strong><small>{new Date(scan.createdAt).toLocaleString()}</small></div><b>›</b></button>)}</section>}
    </div>
  );
}
