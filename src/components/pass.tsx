import type { SVGProps } from 'react';
import type { GroupKey } from '../lib/tags';

// Google-Wallet-style category theming for pass cards.
export const GROUP_STYLE: Record<
  GroupKey,
  { strip: string; tileBg: string; tileText: string }
> = {
  identity: { strip: 'bg-blue-600', tileBg: 'bg-blue-50', tileText: 'text-blue-600' },
  education: { strip: 'bg-teal-600', tileBg: 'bg-teal-50', tileText: 'text-teal-600' },
  employment: { strip: 'bg-indigo-600', tileBg: 'bg-indigo-50', tileText: 'text-indigo-600' },
  financial: { strip: 'bg-emerald-600', tileBg: 'bg-emerald-50', tileText: 'text-emerald-600' },
  certificate: { strip: 'bg-rose-600', tileBg: 'bg-rose-50', tileText: 'text-rose-600' },
  medical: { strip: 'bg-red-600', tileBg: 'bg-red-50', tileText: 'text-red-600' },
  address: { strip: 'bg-amber-500', tileBg: 'bg-amber-50', tileText: 'text-amber-600' },
  photo: { strip: 'bg-purple-600', tileBg: 'bg-purple-50', tileText: 'text-purple-600' },
};

export function CategoryIcon({ group, ...p }: { group: GroupKey } & SVGProps<SVGSVGElement>) {
  const common = { viewBox: '0 0 24 24', fill: 'none', width: 26, height: 26, ...p };
  switch (group) {
    case 'identity':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
          <circle cx="8.5" cy="11" r="2" stroke="currentColor" strokeWidth="2" />
          <path d="M13 10h5M13 14h5M6 15.5c.5-1.2 4-1.2 4.5 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'education':
      return (
        <svg {...common}>
          <path d="M12 4 2 9l10 5 10-5-10-5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M6 11v5c0 1 3 3 6 3s6-2 6-3v-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'photo':
      return (
        <svg {...common}>
          <rect x="3" y="6" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
          <circle cx="12" cy="13" r="3.5" stroke="currentColor" strokeWidth="2" />
          <path d="M8 6l1.5-2h5L16 6" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      );
    case 'address':
      return (
        <svg {...common}>
          <path d="M4 11l8-6 8 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M6 10v9h12v-9" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M13 3v6h6" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      );
  }
}

// Small filled green check used on satisfied pass rows.
export function CheckCircle({ className = '' }: { className?: string }) {
  return (
    <span className={`flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white ${className}`}>
      <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
        <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

// Decorative QR-ish motif for the right edge of a wallet pass.
export function QrMotif({ className = '' }: { className?: string }) {
  return (
    <span className={`flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-300 ${className}`}>
      <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
        <path d="M3 3h6v6H3V3Zm2 2v2h2V5H5Zm10-2h6v6h-6V3Zm2 2v2h2V5h-2ZM3 15h6v6H3v-6Zm2 2v2h2v-2H5Zm10 0h2v2h-2v-2Zm4 0h2v2h-2v-2Zm-4 4h2v-2h-2v2Zm4 0h2v-2h-2v2Zm-6-6h2v2h-2v-2Zm4-2h2v2h-2v-2Z" />
      </svg>
    </span>
  );
}

// Per-tag glyph for the autofill checklist.
export function TagIcon({ tag, kind }: { tag: string; kind: string }) {
  const common = { viewBox: '0 0 24 24', fill: 'none', width: 22, height: 22 };
  if (kind === 'file')
    return (
      <svg {...common}>
        <path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M13 3v6h6" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    );
  if (tag === 'derived.age')
    return (
      <svg {...common}>
        <path d="M4 20h16M6 20v-7h12v7M9 13V9m6 4V9M8 9h8l-1-3H9L8 9Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (tag === 'identity.pan' || tag === 'identity.aadhaar')
    return (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
        <circle cx="8.5" cy="11" r="2" stroke="currentColor" strokeWidth="2" />
        <path d="M13 10h5M13 14h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  if (tag.startsWith('address.'))
    return (
      <svg {...common}>
        <path d="M4 11l8-6 8 6M6 10v9h12v-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (tag === 'identity.dob')
    return (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
        <path d="M3 9h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg {...common}>
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
      <path d="M4 20c0-4 4-6 8-6s8 2 8 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// Category tint used for the autofill checklist icon tiles.
export function tagTile(tag: string, kind: string): { bg: string; text: string } {
  if (kind === 'file') return { bg: 'bg-slate-100', text: 'text-slate-500' };
  if (tag === 'identity.pan' || tag === 'identity.aadhaar')
    return { bg: 'bg-purple-50', text: 'text-purple-600' };
  if (tag.startsWith('address.')) return { bg: 'bg-amber-50', text: 'text-amber-600' };
  if (tag === 'derived.age') return { bg: 'bg-slate-100', text: 'text-slate-500' };
  return { bg: 'bg-blue-50', text: 'text-blue-600' };
}
