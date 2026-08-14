import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QrScanner from '../components/QrScanner';
import { fillPathFromScan } from '../lib/qr';
import { Banner, PageHeader } from '../components/ui';

export default function Scan() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [scannerKey, setScannerKey] = useState(0);

  function handleResult(raw: string) {
    const path = fillPathFromScan(raw);
    if (!path) {
      setError("Scanned a code, but it isn't a DocFill form QR. Try again.");
      setScannerKey((k) => k + 1); // remount to resume scanning
      return;
    }
    navigate(path);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Scan form QR"
        subtitle="Point your camera at the QR code shown on the web form."
      />

      {error && <Banner tone="error">{error}</Banner>}

      <QrScanner key={scannerKey} onResult={handleResult} />

      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
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
    </div>
  );
}
