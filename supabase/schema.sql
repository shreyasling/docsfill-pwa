-- DocFill — shared Supabase schema (see build brief §5).
-- DO NOT rename tables/columns; the SDK and demo-form repos depend on these names.
-- Run this in the Supabase SQL editor.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  form_id text not null,
  required_tags jsonb not null,
  status text not null default 'pending',      -- 'pending' | 'filled' | 'expired'
  filled_payload jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes')
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tag text not null,
  drive_file_id text not null,
  drive_file_name text,
  drive_view_url text,
  extracted_fields jsonb,           -- reserved for the OCR stretch goal
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

-- End-to-end encryption: all profile PII is encrypted client-side (AES-GCM) and
-- stored in `enc_data`; `enc_salt` is the per-user PBKDF2 salt. The plaintext
-- columns above are legacy — migrated into `enc_data` on first unlock, then nulled.
alter table profiles add column if not exists enc_data text;
alter table profiles add column if not exists enc_salt text;

-- Approval activity log (owner-only, 7-day TTL): what the user shared, when,
-- and to which form/site. PWA-only table.
create table if not exists approval_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid,
  form_id text,
  origin text,
  shared_tags jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);

-- Short-lived grants used by the `file-proxy` Edge Function to stream a private
-- Drive file to the SDK once (bytes are never stored here — only a reference +
-- the user's transient Drive access token, capped to the token's own lifetime).
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

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table documents enable row level security;
alter table profiles enable row level security;
alter table sessions enable row level security;

-- file_grants: RLS enabled with NO policies -> anon/authenticated are fully
-- denied. Only the Edge Function (service role, which bypasses RLS) can use it.
alter table file_grants enable row level security;

-- documents: only the owner can see/modify their rows.
drop policy if exists "documents_owner_all" on documents;
create policy "documents_owner_all"
  on documents for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- profiles: only the owner can see/modify their row.
drop policy if exists "profiles_owner_all" on profiles;
create policy "profiles_owner_all"
  on profiles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- approval_logs: only the owner can see/write their activity.
alter table approval_logs enable row level security;
drop policy if exists "approval_logs_owner_all" on approval_logs;
create policy "approval_logs_owner_all"
  on approval_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- sessions: the demo form / SDK create + read them while UNAUTHENTICATED (anon
-- role, publishable key). The PWA reads + fills them while LOGGED IN
-- (authenticated role). So every session policy must cover BOTH roles.
--
-- SECURITY NOTE (hackathon tradeoff): `select using (true)` exposes every
-- session row to anyone with the publishable key. Fine for a demo; before
-- production, gate reads behind a per-session token instead of open select.
drop policy if exists "sessions_anon_select" on sessions;
create policy "sessions_anon_select"
  on sessions for select
  to anon, authenticated
  using (true);

drop policy if exists "sessions_anon_insert" on sessions;
create policy "sessions_anon_insert"
  on sessions for insert
  to anon, authenticated
  with check (true);

-- The PWA only ever moves a row from 'pending' -> 'filled'. Restricting the
-- USING clause to pending rows stops a stale id from overwriting an
-- already-filled session.
drop policy if exists "sessions_anon_update_pending" on sessions;
create policy "sessions_anon_update_pending"
  on sessions for update
  to anon, authenticated
  using (status = 'pending')
  with check (status in ('filled', 'expired', 'pending'));

-- Restrict WHICH columns anon/authenticated may change on sessions to just
-- status + filled_payload (RLS policies alone can't scope columns).
revoke update on sessions from anon, authenticated;
grant update (status, filled_payload) on sessions to anon, authenticated;
grant select, insert on sessions to anon, authenticated;

-- Realtime: lets the SDK-side listener react the instant status flips to 'filled'.
alter publication supabase_realtime add table sessions;

-- ---------------------------------------------------------------------------
-- Optional: auto-expire sweep (call from a scheduled function / cron if desired)
-- ---------------------------------------------------------------------------
-- update sessions set status = 'expired'
--   where status = 'pending' and expires_at < now();

-- Housekeeping for the streaming proxy grants (safe to run on a schedule).
-- delete from file_grants where expires_at < now();
