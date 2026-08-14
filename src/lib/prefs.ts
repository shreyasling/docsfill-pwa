import type { DriveFolder } from './drivePicker';

// User preference: which Drive folder uploaded documents are saved into.
const FOLDER_KEY = 'docfill.destFolder';

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
