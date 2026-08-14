import { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { hasNativeBarcodeDetector } from '../lib/qr';
import { Banner, Spinner } from './ui';

// Minimal typing for the (experimental) BarcodeDetector API.
interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]>;
}
declare global {
  interface Window {
    BarcodeDetector?: {
      new (opts?: { formats?: string[] }): BarcodeDetectorLike;
    };
  }
}

type Status = 'starting' | 'scanning' | 'error';

export default function QrScanner({
  onResult,
  onClose,
}: {
  onResult: (text: string) => void;
  onClose?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const doneRef = useRef(false);

  const [status, setStatus] = useState<Status>('starting');
  const [error, setError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  const handleHit = useCallback(
    (raw: string) => {
      if (doneRef.current) return;
      doneRef.current = true;
      onResult(raw);
    },
    [onResult],
  );

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      const next = !torchOn;
      // `torch` is a non-standard constraint; cast to keep TS happy.
      await track.applyConstraints({
        advanced: [{ torch: next }],
      } as unknown as MediaTrackConstraints);
      setTorchOn(next);
    } catch {
      /* ignore torch failures */
    }
  }, [torchOn]);

  useEffect(() => {
    doneRef.current = false;
    let detector: BarcodeDetectorLike | null = null;
    if (hasNativeBarcodeDetector() && window.BarcodeDetector) {
      try {
        detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      } catch {
        detector = null;
      }
    }

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        const track = stream.getVideoTracks()[0];
        const caps = track.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean };
        setTorchSupported(Boolean(caps?.torch));

        setStatus('scanning');
        rafRef.current = requestAnimationFrame(tick);
      } catch (e) {
        setStatus('error');
        setError(
          e instanceof DOMException && e.name === 'NotAllowedError'
            ? 'Camera permission was denied. Allow camera access and try again.'
            : 'Could not start the camera on this device.',
        );
      }
    }

    let lastDecode = 0;
    async function tick(now: number) {
      if (doneRef.current) return;
      const video = videoRef.current;
      if (video && video.readyState >= 2 && now - lastDecode > 150) {
        lastDecode = now;
        try {
          if (detector) {
            const codes = await detector.detect(video);
            if (codes[0]?.rawValue) return handleHit(codes[0].rawValue);
          } else {
            const canvas = canvasRef.current!;
            const w = video.videoWidth;
            const h = video.videoHeight;
            if (w && h) {
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
              ctx.drawImage(video, 0, 0, w, h);
              const img = ctx.getImageData(0, 0, w, h);
              const found = jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' });
              if (found?.data) return handleHit(found.data);
            }
          }
        } catch {
          /* keep scanning on transient decode errors */
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    start();

    return () => {
      doneRef.current = true;
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [handleHit]);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-black">
      <video
        ref={videoRef}
        className="aspect-square w-full object-cover"
        playsInline
        muted
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* framing overlay: corner brackets + sweeping scan line */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <div className="relative h-60 w-60 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
          <span className="absolute left-0 top-0 h-8 w-8 rounded-tl-2xl border-l-4 border-t-4 border-white" />
          <span className="absolute right-0 top-0 h-8 w-8 rounded-tr-2xl border-r-4 border-t-4 border-white" />
          <span className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-2xl border-b-4 border-l-4 border-white" />
          <span className="absolute bottom-0 right-0 h-8 w-8 rounded-br-2xl border-b-4 border-r-4 border-white" />
          {status === 'scanning' && (
            <span className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-brand-400 shadow-[0_0_10px_2px] shadow-brand-400 animate-scanline" />
          )}
        </div>
        <p className="mt-5 rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white backdrop-blur">
          Align the form's QR code in the frame
        </p>
      </div>

      {status === 'starting' && (
        <div className="absolute inset-0 flex items-center justify-center text-white">
          <Spinner className="h-8 w-8" />
        </div>
      )}

      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3">
        {onClose ? (
          <button
            className="rounded-full bg-black/40 p-2 text-white backdrop-blur"
            onClick={onClose}
            aria-label="Close scanner"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        ) : (
          <span />
        )}
        {torchSupported && (
          <button
            className="rounded-full bg-black/40 p-2 text-white backdrop-blur"
            onClick={toggleTorch}
            aria-label="Toggle flashlight"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
              <path d="M9 2h6l-1 7h3l-8 13 2-9H8l1-11Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill={torchOn ? 'currentColor' : 'none'} />
            </svg>
          </button>
        )}
      </div>

      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <Banner tone="error">{error}</Banner>
        </div>
      )}
    </div>
  );
}
