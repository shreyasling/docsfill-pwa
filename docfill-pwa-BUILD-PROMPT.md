# DocFill PWA — Build Prompt

> Give this file verbatim to your AI coding tool (Claude Code or similar) as the brief for
> **this repository only**. This PWA is one of three independently hosted repos in the DocFill
> project. It only connects to the other two through a shared Supabase backend and a shared
> tag vocabulary — both defined below and must not be changed without updating all three repos.

## 1. What DocFill is (context only)

DocFill lets a user store personal documents once (in their own Google Drive) and then
"autofill" any tagged web form by scanning a QR code with this app. Three repos:

1. **`docfill-sdk`** — an npm package other sites embed to show the QR and receive filled data.
2. **`docfill-pwa`** (THIS REPO) — the user's document vault, and the app that matches a
   form's required tags against the user's stored documents/profile and sends the approved data.
3. **`docfill-demo-form`** — a dummy form site used to demo the SDK, consuming this PWA.

## 2. What THIS repo must deliver

A React PWA (installable, works well on mobile Chrome since that's the demo device) with:

1. **Google sign-in** via Supabase Auth's Google provider, requesting the additional Drive
   scope needed for step 2 during the same OAuth consent (see §3).
2. **Document vault screen** — one row per tag in the shared vocabulary (file tags only),
   showing "uploaded" or "missing," with an "Add" action that either:
   - opens the **Google Picker** to select/create a file directly in the user's own Drive, or
   - opens the device camera (`<input type="file" accept="image/*" capture="environment">`)
     to photograph a paper document, then uploads that photo into the user's Drive via the
     Drive API (still scoped to `drive.file` — see §3) and records it.
3. **Profile screen** — plain form for the text/value tags (`identity.full_name`,
   `identity.father_name`, `identity.dob`, `address.current`, `address.permanent`) so these
   don't require re-uploading an ID document just to autofill a name field.
4. **Fill flow** at route `/fill?session=<id>`:
   - Fetch the session row by id.
   - Cross-reference `required_tags` against the user's `documents` + `profile` rows.
   - Show a checklist: satisfied tags with a green check, missing ones flagged so the user
     knows to add them before approving.
   - `derived.age` is never stored — compute it at this point from `identity.dob`.
   - "Approve & Send" writes `filled_payload` (shape in §5) and sets `status = 'filled'`.
5. **PWA installability** — manifest.json, service worker, icons (vite-plugin-pwa handles
   most of this).

### Stretch goals (only attempt if the core loop above is fully working)
- In-app QR scanner (camera-based) as an alternative to opening the phone's own camera app —
  useful when testing on the same device that's showing the form.
- OCR + LLM field extraction from an uploaded document (e.g. pull `full_name`, `dob` off a
  scanned PAN card automatically instead of the user typing it into the profile screen).
- Regex/format validation on values before allowing "Approve" (e.g. PAN format check).
- "This address is 6+ months old, still current?" prompt before reuse.

## 3. Google Drive integration — use `drive.file`, not full Drive access

Request the `https://www.googleapis.com/auth/drive.file` OAuth scope. This is a **non-sensitive,
per-file scope**: it only grants access to files the user picks via the Google Picker or files
your app creates itself — nothing else in their Drive is visible to your app. It only requires
basic app verification, not the multi-week restricted-scope review, so it's realistic to wire
up on a short timeline. This is the core trust story of the whole product — do not substitute
a broader Drive scope for convenience.

Flow for a fresh upload (camera-captured doc): create the file directly via the Drive API
(`files.create` with the scoped token) so it lands in the user's own Drive from the start,
then store only the returned `driveFileId` + a shareable/view URL in your `documents` table —
never store the file bytes in Supabase.

## 4. Shared tag vocabulary — DO NOT INVENT NEW TAGS

```
identity.full_name
identity.father_name
identity.dob              # date, ISO 8601
identity.pan              # text value, format ^[A-Z]{5}[0-9]{4}[A-Z]$
identity.aadhaar          # text value
derived.age               # NOT stored — always computed at fill-time from identity.dob
address.current
address.permanent
education.10th_marksheet  # file
education.12th_marksheet  # file
education.degree_certificate # file
photo.passport_size       # file
```

## 5. Shared Supabase schema — DO NOT rename tables/columns

```sql
create table sessions (
  id uuid primary key default gen_random_uuid(),
  form_id text not null,
  required_tags jsonb not null,
  status text not null default 'pending',      -- 'pending' | 'filled' | 'expired'
  filled_payload jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes')
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  tag text not null,
  drive_file_id text not null,
  drive_file_name text,
  drive_view_url text,
  extracted_fields jsonb,           -- reserved for the OCR stretch goal
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, tag)
);

create table profiles (
  user_id uuid primary key references auth.users(id),
  full_name text,
  father_name text,
  date_of_birth date,
  address_current jsonb,
  address_permanent jsonb,
  updated_at timestamptz not null default now()
);
```

RLS: `documents` and `profiles` must be restricted to `auth.uid() = user_id`. `sessions` needs
anonymous select/update-by-id since the demo form that creates it is unauthenticated — scope
the update policy to only allow changing `status`/`filled_payload` on rows that are still
`pending`, so a stale session id can't be reused to overwrite an already-filled one.

`filled_payload` shape written on approve (keyed by tag):
```json
{
  "identity.full_name": { "value": "Jane Doe" },
  "identity.dob": { "value": "2001-04-12" },
  "derived.age": { "value": 25 },
  "education.12th_marksheet": { "fileName": "12th_marksheet.pdf", "driveFileId": "1AbC...", "driveUrl": "https://drive.google.com/..." }
}
```

## 6. Suggested structure

```
docfill-pwa/
├── src/
│   ├── pages/
│   │   ├── Vault.tsx
│   │   ├── Profile.tsx
│   │   └── Fill.tsx          # the /fill?session=<id> route
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── drivePicker.ts    # Google Picker + drive.file upload helpers
│   │   └── tags.ts           # shared vocabulary constant, single source of truth
│   ├── App.tsx
│   └── main.tsx
├── public/
│   └── manifest.json
├── vite.config.ts            # with vite-plugin-pwa
└── README.md
```

## 7. Tooling

- React + Vite + `vite-plugin-pwa`
- `@supabase/supabase-js`
- Google Identity Services script + Google Picker API script (loaded via `<script>` tags,
  not npm packages — this is how Google ships them)
- Tailwind for speed

## 8. Build order

1. Supabase project setup — run the schema in §5, enable Google auth provider, add the
   `drive.file` scope to the Google OAuth consent screen.
2. Auth + Profile screen (fastest path to a working login + text-tag data).
3. Vault screen with Google Picker upload (file tags).
4. Camera-capture-to-Drive upload path.
5. `/fill` route: fetch session, checklist, approve-and-write.
6. PWA manifest/service worker/install prompt polish.
7. Stretch goals only if time remains, in the order listed in §2.

## 9. Acceptance criteria

- Can sign in with Google and see the Drive consent screen show only the `drive.file`
  permission (not full Drive access).
- Can upload/tag at least two documents, each landing as a real file in the user's own
  Google Drive.
- Can fill out and save the Profile screen.
- Given a real `session` id (created by the SDK or demo form), `/fill?session=<id>` correctly
  shows which required tags are satisfied vs missing, and "Approve & Send" updates the
  `sessions` row so the SDK-side listener picks it up.
