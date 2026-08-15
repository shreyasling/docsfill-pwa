import type { DriveFolder } from './drivePicker';

// User preference: which Drive folder uploaded documents are saved into.
const FOLDER_KEY = 'docfill.destFolder';
const ONBOARDING_KEY = 'docfill.onboardingComplete';
const RECENT_SCANS_KEY = 'docfill.recentScans';

export interface RecentScan {
  path: string;
  createdAt: string;
}

export function getDestFolder(): DriveFolder | null {
  try {
    const raw = localStorage.getItem(FOLDER_KEY);
    return raw ? (JSON.parse(raw) as DriveFolder) : null;
  } catch {
    return null;
  }
}

export function setDestFolder(folder: DriveFolder | null): void {
  try {
    if (folder) localStorage.setItem(FOLDER_KEY, JSON.stringify(folder));
    else localStorage.removeItem(FOLDER_KEY);
  } catch {
    // ignore storage failures
  }
}

export function getOnboardingComplete(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setOnboardingComplete(complete: boolean): void {
  try {
    if (complete) localStorage.setItem(ONBOARDING_KEY, 'true');
    else localStorage.removeItem(ONBOARDING_KEY);
  } catch {
    // ignore storage failures
  }
}

export function getRecentScans(): RecentScan[] {
  try {
    const stored = JSON.parse(localStorage.getItem(RECENT_SCANS_KEY) ?? '[]') as RecentScan[];
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return stored.filter((item) => item.path.startsWith('/fill?session=') && new Date(item.createdAt).getTime() >= weekAgo).slice(0, 3);
  } catch {
    return [];
  }
}

export function addRecentScan(path: string): RecentScan[] {
  const next = [{ path, createdAt: new Date().toISOString() }, ...getRecentScans().filter((item) => item.path !== path)].slice(0, 3);
  try {
    localStorage.setItem(RECENT_SCANS_KEY, JSON.stringify(next));
  } catch {
    // ignore storage failures
  }
  return next;
}
