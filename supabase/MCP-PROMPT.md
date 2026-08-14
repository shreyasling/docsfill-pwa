# DocFill — Supabase MCP prompt (PWA backend)

Paste everything in the block below into your ChatGPT agent that has the Supabase MCP.
It extends the existing backend (which already has the `sessions` table) with the two
tables the PWA needs (`documents`, `profiles`) and fixes the `sessions` policies so a
logged-in (authenticated) PWA user can read + fill sessions.

---

You have access to my Supabase project via MCP (ref: `eovrcvoopynjhoxmetgx`). Extend the existing **DocFill** backend. The `sessions` table already exists — **do not drop or recreate it**. Do the following, then confirm each step succeeded.

**1. Create two new tables exactly (do not rename columns):**
```sql
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tag text not null,
  drive_file_id text not null,
  drive_file_name text,
  drive_view_url text,
  extracted_fields jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, tag)
);

create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  father_name text,
  date_of_birth date,
  address_current jsonb,
  address_permanent jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists file_grants (
  token text primary key,
  session_id uuid not null,
  tag text not null,
  drive_file_id text not null,
  drive_access_token text not null,
  file_name text,
  max_uses int not null default 3,
  used int not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
```

**2. Enable RLS + owner-only policies (each user sees only their own rows):**
```sql
alter table documents enable row level security;
alter table profiles enable row level security;

create policy "documents_owner_all" on documents for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "profiles_owner_all" on profiles for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- file_grants: RLS ON, NO policies -> anon/authenticated fully denied.
-- Only the file-proxy Edge Function (service role) may touch it.
alter table file_grants enable row level security;
```

**3. Fix the `sessions` policies so a LOGGED-IN user (authenticated role) can also read + fill sessions** — currently they're `to anon` only:
```sql
drop policy if exists "anon can select sessions" on sessions;
drop policy if exists "anon can update sessions" on sessions;
drop policy if exists "anon can insert sessions" on sessions;

create policy "sessions_select" on sessions for select
  to anon, authenticated using (true);
create policy "sessions_insert" on sessions for insert
  to anon, authenticated with check (true);
create policy "sessions_update" on sessions for update
  to anon, authenticated using (status = 'pending')
  with check (status in ('filled','expired','pending'));
```

**4. Verify:** as an authenticated context, update a test `sessions` row from `pending` to `filled` with a `filled_payload`, confirm it persists, then revert. Confirm `documents` and `profiles` reject reads when `auth.uid()` doesn't match `user_id`.

**5. Report** every statement run and whether it succeeded. Do not add extra tables/columns or touch the secret key.

---

## Note: Google sign-in is NOT done here

MCP/SQL can't configure Google OAuth. Do this in the dashboards (details in `README.md` §2):

1. Google Cloud → enable **Drive API** + **Picker API**; add scope `https://www.googleapis.com/auth/drive.file`.
2. Create an **OAuth Web client** → JS origin `http://localhost:5173`, redirect URI `https://eovrcvoopynjhoxmetgx.supabase.co/auth/v1/callback`.
3. Supabase → **Authentication → Providers → Google** → paste the client ID + secret.
4. Create a browser **API key** (restrict to Picker API). Put the client ID in `VITE_GOOGLE_CLIENT_ID` and the API key in `VITE_GOOGLE_API_KEY` in `.env`.

## Note: deploy the file-proxy Edge Function (CLI, not MCP)

The real-file-upload feature needs the `file-proxy` function deployed. Run from the PWA repo:

```bash
supabase link --project-ref eovrcvoopynjhoxmetgx
# Must be --no-verify-jwt: the SDK's GET is anonymous (auth is the grant token).
supabase functions deploy file-proxy --no-verify-jwt
```

No extra secrets are needed — Supabase injects `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` into the function automatically. The `file_grants`
table above must exist first.
