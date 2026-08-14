-- DocFill — sessions security hardening (per-session capability token).
--
-- PROBLEM this fixes: the old policy `sessions select using(true)` lets anyone
-- with the (public) publishable key dump EVERY session row — names, PANs, DOBs,
-- and the live fileUrl links that stream documents. Open update also allows
-- tampering with any pending session.
--
-- FIX: give each session a secret `access_token`, lock the table to nobody, and
-- expose only SECURITY DEFINER functions that require (id + token). The token
-- rides in the QR/fill URL (&k=<token>), so only the holder of that specific QR
-- can read or fill that one session, and the table can never be enumerated.
--
-- Roll out these THREE together: (1) this SQL, (2) the SDK change
-- (supabase/SDK-SECURITY-PROMPT.md), (3) the PWA (already backward-compatible).

create extension if not exists pgcrypto;

alter table sessions add column if not exists access_token text;
alter table sessions add column if not exists origin text;

-- Drop the legacy 2-arg overload so PostgREST never has to pick between two
-- create_session candidates (PGRST203). The 3-arg version below is canonical.
drop function if exists public.create_session(text, jsonb);

-- 1) SDK creates a session and gets back its id + secret token.
--    p_origin is optional so callers that omit it still resolve to one function.
create or replace function public.create_session(
  p_form_id text,
  p_required_tags jsonb,
  p_origin text default null
)
returns table (id uuid, access_token text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  -- Two UUIDs (~244 bits) — built-in, avoids any extensions-schema dependency.
  v_token text := replace(gen_random_uuid()::text, '-', '')
               || replace(gen_random_uuid()::text, '-', '');
begin
  insert into sessions (form_id, required_tags, access_token, origin)
  values (p_form_id, p_required_tags, v_token, p_origin)
  returning sessions.id into v_id;
  return query select v_id, v_token;
end;
$$;

-- 2) Read a single session — only if the caller presents the matching token.
create or replace function public.get_session(p_id uuid, p_token text)
returns setof sessions
language sql
security definer
set search_path = public
as $$
  select * from sessions
  where id = p_id and access_token = p_token;
$$;

-- 3) Fill a session (pending -> filled) — only with the matching token.
create or replace function public.fill_session(p_id uuid, p_token text, p_payload jsonb)
returns sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  r sessions;
begin
  update sessions
     set status = 'filled', filled_payload = p_payload
   where id = p_id and access_token = p_token and status = 'pending'
   returning * into r;
  if not found then
    raise exception 'session not found, wrong token, or already filled';
  end if;
  return r;
end;
$$;

-- Slam the door on direct table access; only the functions above may touch it.
revoke all on sessions from anon, authenticated;
drop policy if exists "sessions_anon_select" on sessions;
drop policy if exists "sessions_anon_insert" on sessions;
drop policy if exists "sessions_anon_update_pending" on sessions;
drop policy if exists "sessions_select" on sessions;
drop policy if exists "sessions_insert" on sessions;
drop policy if exists "sessions_update" on sessions;

grant execute on function public.create_session(text, jsonb, text) to anon, authenticated;
grant execute on function public.get_session(uuid, text) to anon, authenticated;
grant execute on function public.fill_session(uuid, text, jsonb) to anon, authenticated;

-- NOTE on Realtime: with the table locked, Realtime can no longer stream rows
-- to clients. The SDK should POLL get_session(id, token) every ~1.5s until
-- status = 'filled' (see SDK-SECURITY-PROMPT.md). If you prefer to keep
-- Realtime, that requires a separate signed-channel design — polling is simpler
-- and just as fast for this flow.
alter publication supabase_realtime drop table sessions;
