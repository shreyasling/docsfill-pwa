# DocFill PWA — your document vault

DocFill lets a user store personal documents **once** (in their **own** Google Drive) and then
autofill any tagged web form by scanning its QR code. This repo is the **PWA vault** — one of
three repos in the DocFill project (the others are the `docfill-sdk` npm package and the
`docfill-demo-form` demo site). All three talk only through a shared Supabase backend and a
shared tag vocabulary.

## Demo video

[Watch or download the DocFill PWA demo recording](demo/docfill-pwa-demo.mov).

The recording walks through the mobile-first vault experience, profile, secure document
management, theme options, QR scanning, and sharing history.

## Trust model (the whole point)

- We request **only** the `drive.file` OAuth scope — a per-file, non-sensitive scope. The app
  can see **only** files the user picks in the Google Picker or files the app itself creates.
  Nothing else in their Drive is ever visible to us.
- We **never** store file bytes. The `documents` table keeps only a `drive_file_id` + a view
  URL. The actual files live in the user's Drive.
- Nothing leaves the vault without an explicit **Approve & Send** on the fill screen.

## Stack

React + Vite + TypeScript, Tailwind, `vite-plugin-pwa`, `@supabase/supabase-js`, and Google's
Identity Services + Picker scripts (loaded via `<script>` tags in `index.html`).

## Project layout

```
src/
  pages/     Login, Vault, Profile, Fill (the /fill?session=<id> route)
  lib/       supabase, auth, tags (shared vocab), google (drive.file token), drivePicker, db, types
  components/ ui (icons, banners, spinner)
scripts/gen-icons.mjs   procedural PWA icon generator
supabase/schema.sql     shared schema + RLS (run this in Supabase)
```

## 1. Supabase setup

1. Create a Supabase project.
2. In the SQL editor, run [`supabase/schema.sql`](supabase/schema.sql). It creates the
   `sessions`, `documents`, `profiles` tables and the RLS policies:
   - `documents` / `profiles`: restricted to `auth.uid() = user_id`.
   - `sessions`: anon can select + insert + update-by-id, but updates are only allowed while
     the row is still `pending`, and column privileges limit anon to changing only `status` /
     `filled_payload`.
3. **Authentication → Providers → Google**: enable it and paste your Google OAuth **client ID**
   and **client secret** (from step 2 below).

## 2. Google Cloud setup

1. Create a project at <https://console.cloud.google.com>.
2. **APIs & Services → Enable APIs**: enable **Google Drive API** and **Google Picker API**.
3. **OAuth consent screen**: add the scope
   `https://www.googleapis.com/auth/drive.file` (it's non-sensitive, so verification is light).
4. **Credentials → OAuth client ID → Web application**:
   - Authorized JavaScript origins: `http://localhost:5173` (and your deployed origin).
   - Authorized redirect URIs: your Supabase callback
     `https://<project>.supabase.co/auth/v1/callback`.
   - Copy the **client ID** (and secret → into Supabase, step 1.3).
5. **Credentials → API key**: create a browser key, restrict it to the **Picker API** + your
   origins. This is the Picker `developerKey`.

## 3. Environment

```bash
cp .env.example .env
# then fill in:
#   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
#   VITE_GOOGLE_CLIENT_ID, VITE_GOOGLE_API_KEY
```

## 4. Run

```bash
npm install
npm run gen:icons   # once, to create the PWA icons in public/icons
npm run dev         # http://localhost:5173
npm run build       # typecheck + production build
npm run preview     # serve the built app (test install + service worker)
```

## How to use DocFill

1. Start the PWA with `npm run dev`, then sign in with Google.
2. Open **Profile** and enter the personal details you commonly reuse. The app encrypts this
   profile data on-device before it is saved.
3. Open **Wallet** and add documents from Google Drive, upload a file, or take a camera photo.
   The file remains in your own Drive; DocFill stores only its reference.
4. Visit a DocFill-enabled website that renders a one-time QR request via `docfill-sdk`.
5. In the PWA, tap **Scan**, scan the QR code (or paste the DocFill link), and review every
   requested value and document.
6. Tap **Approve & Send** only if the requested data is correct. The website’s tagged fields
   are filled, and the approval appears in **Sharing history** for seven days.

### Demo checklist

- Use the **light / dark / auto** controls on Profile to preview the themes.
- The Wallet setup checklist guides first-time users through profile completion, document
  upload, and their first scan.
- Use **Replace** on an existing document card to update a document without changing its tag.
- Sharing history supports time filters and a detail sheet showing exactly what was approved.

## The four screens

- **Login** — Google sign-in via Supabase for **identity only**. All Google Drive access
  (Picker, uploads, and the fill-time proxy token) goes through a single **GIS token client**
  (`VITE_GOOGLE_CLIENT_ID`) so every `drive.file` grant stays under one OAuth client — mixing
  clients makes Drive return 404/401 because `drive.file` access is per-client. The first
  Drive action shows a one-time `drive.file` consent.
- **Vault** — one row per **file** tag; add a document by picking from Drive or snapping a
  photo (uploaded straight into the user's Drive via `files.create`).
- **Scan** — in-app camera QR scanner (`/scan`). Uses the native `BarcodeDetector` when
  available and falls back to `jsQR`; parses the session id out of the QR and routes to
  `/fill?session=<id>`. Includes a manual paste box for same-device testing.
- **Profile** — the **value** tags backed by the `profiles` table (name, father's name, DOB,
  current/permanent address). Age is **computed**, never stored.
- **Fill** (`/fill?session=<id>`) — fetches the session, cross-references `required_tags`
  against the user's documents + profile, shows a satisfied/missing checklist, computes
  `derived.age` on the spot, and on **Approve & Send** writes `filled_payload` and flips
  `status = 'filled'` so the SDK-side listener picks it up.

> Value tags with no profile column (PAN, Aadhaar) are typed **at fill-time only** and are
> never persisted, matching the fixed shared schema.

## Shared contracts (do not drift from the SDK / demo-form)

- **Tag vocabulary**: [`src/lib/tags.ts`](src/lib/tags.ts) is the single source of truth.
- **Schema**: [`supabase/schema.sql`](supabase/schema.sql) — don't rename tables/columns.
- **`filled_payload`** is keyed by tag: value tags → `{ "value": ... }`, file tags →
  `{ "fileName", "driveFileId", "driveUrl", "fileUrl"? }`. `fileUrl` is a short-lived,
  CORS-fetchable proxy URL (see below) that lets the SDK drop the real file into a native
  `<input type="file">`; it's optional — without it the SDK falls back to a reference chip.

## Real-file upload via the streaming proxy (zero-copy)

The SDK runs on the *form's* origin with no auth, so it can't fetch a private Drive file
directly. On **Approve**, the PWA asks the [`file-proxy`](supabase/functions/file-proxy/index.ts)
Edge Function to mint a short-lived, use-limited, unguessable `fileUrl`. When the SDK fetches it,
the function **streams the bytes straight from Drive with CORS headers — nothing is ever
persisted on our side**. Grants live in the `file_grants` table (RLS-locked to the service role),
expire in ≤10 min, and are capped by the Drive token's own lifetime.

Deploy it with `supabase functions deploy file-proxy --no-verify-jwt` (the GET is anonymous —
the grant token is the auth). See [supabase/MCP-PROMPT.md](supabase/MCP-PROMPT.md).

## Where AI fits (stretch goals)

- **OCR + LLM extraction**: on a camera upload, run OCR then an LLM to pull `full_name`, `dob`,
  `pan` off e.g. a PAN card and pre-fill the profile — write results into
  `documents.extracted_fields` (already reserved in the schema).
- **Format/validation** before approve (PAN regex is already wired in `tags.ts`).
- **Freshness prompt**: "This address is 6+ months old — still current?" before reuse.
