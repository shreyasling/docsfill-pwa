// Google Picker + drive.file upload helpers.
//
// Everything here works within the `drive.file` scope only:
//  - Picker: the user explicitly selects/creates files, which grants our app
//    per-file access to just those files.
//  - files.create: a camera-captured photo is uploaded straight into the
//    user's OWN Drive; we only keep the returned id + view URL (never bytes).

import { gapiReady, getDriveAccessToken } from './google';

const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY as string | undefined;
const APP_ID = import.meta.env.VITE_GOOGLE_APP_ID as string | undefined;

export interface DrivePickResult {
  driveFileId: string;
  fileName: string;
  driveViewUrl: string;
  mimeType?: string;
}

export function driveViewUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

let pickerLoaded = false;
function loadPicker(): Promise<void> {
  return new Promise((resolve) => {
    if (pickerLoaded) return resolve();
    window.gapi!.load('picker', () => {
      pickerLoaded = true;
      resolve();
    });
  });
}

/**
 * Opens the Google Picker so the user can select an existing Drive file OR
 * upload a new one. Resolves with the chosen file, or null if cancelled.
 */
export async function openDrivePicker(): Promise<DrivePickResult | null> {
  if (!API_KEY) {
    throw new Error('Missing VITE_GOOGLE_API_KEY — required by the Google Picker.');
  }
  const token = await getDriveAccessToken(true);
  await gapiReady();
  await loadPicker();

  return new Promise<DrivePickResult | null>((resolve, reject) => {
    try {
      const view = new google.picker.DocsView(google.picker.ViewId.DOCS)
        .setIncludeFolders(true)
        .setSelectFolderEnabled(false)
        .setMode(google.picker.DocsViewMode.LIST);

      const uploadView = new google.picker.DocsUploadView();

      const builder = new google.picker.PickerBuilder()
        .enableFeature(google.picker.Feature.NAV_HIDDEN)
        .setOAuthToken(token)
        .setDeveloperKey(API_KEY)
        .addView(view)
        .addView(uploadView)
        .setCallback((data: google.picker.ResponseObject) => {
          if (data.action === google.picker.Action.PICKED) {
            const doc = data.docs?.[0];
            if (!doc) {
              resolve(null);
              return;
            }
            resolve({
              driveFileId: doc.id,
              fileName: doc.name ?? 'document',
              driveViewUrl: doc.url ?? driveViewUrl(doc.id),
              mimeType: doc.mimeType,
            });
          } else if (data.action === google.picker.Action.CANCEL) {
            resolve(null);
          }
        });

      if (APP_ID) builder.setAppId(APP_ID);

      builder.build().setVisible(true);
    } catch (err) {
      reject(err instanceof Error ? err : new Error('Failed to open Google Picker.'));
    }
  });
}

interface DriveFileResource {
  id: string;
  name: string;
  webViewLink?: string;
  mimeType?: string;
}

export interface DriveFolder {
  id: string;
  name: string;
}

/**
 * Opens the Picker in folder-select mode so the user chooses WHERE uploads are
 * saved. Selecting a folder grants our app `drive.file` access to save into it.
 */
export async function pickDriveFolder(): Promise<DriveFolder | null> {
  if (!API_KEY) {
    throw new Error('Missing VITE_GOOGLE_API_KEY — required by the Google Picker.');
  }
  const token = await getDriveAccessToken(true);
  await gapiReady();
  await loadPicker();

  return new Promise<DriveFolder | null>((resolve, reject) => {
    try {
      const view = new google.picker.DocsView()
        .setIncludeFolders(true)
        .setSelectFolderEnabled(true)
        .setMimeTypes('application/vnd.google-apps.folder');

      const builder = new google.picker.PickerBuilder()
        .setTitle('Choose a folder to save your documents')
        .setOAuthToken(token)
        .setDeveloperKey(API_KEY)
        .addView(view)
        .setCallback((data: google.picker.ResponseObject) => {
          if (data.action === google.picker.Action.PICKED) {
            const doc = data.docs?.[0];
            if (!doc) return resolve(null);
            resolve({ id: doc.id, name: doc.name ?? 'Selected folder' });
          } else if (data.action === google.picker.Action.CANCEL) {
            resolve(null);
          }
        });

      if (APP_ID) builder.setAppId(APP_ID);
      builder.build().setVisible(true);
    } catch (err) {
      reject(err instanceof Error ? err : new Error('Failed to open folder picker.'));
    }
  });
}

/**
 * Uploads a File (e.g. a camera-captured photo) directly into the user's Drive
 * via a multipart files.create request, so it lands in their own Drive from the
 * start. Returns the created file's id + view URL.
 */
export async function uploadFileToDrive(
  file: File,
  fileName?: string,
  onProgress?: (pct: number) => void,
  parentFolderId?: string | null,
): Promise<DrivePickResult> {
  const token = await getDriveAccessToken(true);
  // Use the folder the user chose; otherwise fall back to the "DocFill" folder.
  const folderId = parentFolderId ?? (await getOrCreateAppFolder(token));

  const metadata: { name: string; mimeType: string; parents?: string[] } = {
    name: fileName || file.name || `docfill-${Date.now()}`,
    mimeType: file.type || 'application/octet-stream',
    ...(folderId ? { parents: [folderId] } : {}),
  };

  const boundary = `docfill${Math.random().toString(36).slice(2)}`;
  const head =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${metadata.mimeType}\r\n\r\n`;
  const tail = `\r\n--${boundary}--`;

  const body = new Blob([head, file, tail]);

  // XHR (not fetch) so we can report real upload progress to the UI.
  const created = await new Promise<DriveFileResource>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(
      'POST',
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,mimeType',
    );
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('Content-Type', `multipart/related; boundary=${boundary}`);
    xhr.upload.onprogress = (e) => {
      if (onProgress && e.lengthComputable) {
        onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve(JSON.parse(xhr.responseText) as DriveFileResource);
      } else {
        reject(new Error(`Drive upload failed (${xhr.status}). ${xhr.responseText}`));
      }
    };
    xhr.onerror = () => reject(new Error('Drive upload failed (network error).'));
    xhr.send(body);
  });

  return {
    driveFileId: created.id,
    fileName: created.name,
    driveViewUrl: created.webViewLink ?? driveViewUrl(created.id),
    mimeType: created.mimeType,
  };
}

const APP_FOLDER_NAME = 'DocFill';
let appFolderId: string | null = null;

/**
 * Finds (or creates) a single "DocFill" folder in the user's Drive so uploaded
 * documents live together instead of scattered in the root. Under `drive.file`,
 * `files.list` only returns app-created files, so this reliably finds our own
 * folder. Returns null on any failure (upload then falls back to Drive root).
 */
async function getOrCreateAppFolder(token: string): Promise<string | null> {
  if (appFolderId) return appFolderId;
  const auth = { Authorization: `Bearer ${token}` };
  try {
    const q = encodeURIComponent(
      `mimeType='application/vnd.google-apps.folder' and name='${APP_FOLDER_NAME}' and trashed=false`,
    );
    const found = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`,
      { headers: auth },
    );
    if (found.ok) {
      const data = (await found.json()) as { files?: { id: string }[] };
      if (data.files?.length) {
        appFolderId = data.files[0].id;
        return appFolderId;
      }
    }
    const created = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: APP_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    });
    if (created.ok) {
      const data = (await created.json()) as { id: string };
      appFolderId = data.id;
      return appFolderId;
    }
  } catch {
    // fall through — upload to root
  }
  return null;
}
