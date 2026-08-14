# DocFill — Supabase MCP prompt (security hardening)

Paste the block below into your ChatGPT agent that has the Supabase MCP. It closes
the one real data leak: today anyone with the public publishable key can dump every
row of `sessions` (all users' `filled_payload` — names, PANs, DOBs, and live file
links) and tamper with pending sessions. This replaces the open policies with a
per-session capability token enforced by SECURITY DEFINER functions.

> ⚠️ Run this in lockstep with the SDK change (`supabase/SDK-SECURITY-PROMPT.md`).
> After it runs, the old direct-table access stops working; the SDK must switch to
> the RPCs and the PWA must send `&k=<token>` (the PWA already does when present).

---

You have access to my Supabase project via MCP (ref: `eovrcvoopynjhoxmetgx`). Harden the shared **DocFill** `sessions` table. Do NOT rename any table/column or change the tag vocabulary or `filled_payload` shape. Run the following, then report each statement's result.

**1. Add a secret capability token column:**
```sql
alter table sessions add column if not exists access_token text;
```

**2. Create the three SECURITY DEFINER access functions:**
```sql
-- Drop the legacy 2-arg overload first so PostgREST never sees two candidates (PGRST203).
drop function if exists public.create_session(text, jsonb);

create or replace function public.create_session(
  p_form_id text,
  p_required_tags jsonb,
  p_origin text default null
)
returns table (id uuid, access_token text)
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  -- Two UUIDs (~244 bits) — built-in, no pgcrypto/extensions-schema dependency.
  v_token text := replace(gen_random_uuid()::text, '-', '')
               || replace(gen_random_uuid()::text, '-', '');
begin
  insert into sessions (form_id, required_tags, access_token, origin)
  values (p_form_id, p_required_tags, v_token, p_origin)
  returning sessions.id into v_id;
  return query select v_id, v_token;
end;
$$;

create or replace function public.get_session(p_id uuid, p_token text)
returns setof sessions
language sql security definer set search_path = public as $$
  select * from sessions where id = p_id and access_token = p_token;
$$;

create or replace function public.fill_session(p_id uuid, p_token text, p_payload jsonb)
returns sessions
language plpgsql security definer set search_path = public as $$
declare r sessions;
begin
  update sessions set status = 'filled', filled_payload = p_payload
   where id = p_id and access_token = p_token and status = 'pending'
   returning * into r;
  if not found then
    raise exception 'session not found, wrong token, or already filled';
  end if;
  return r;
end;
$$;
```

**3. Revoke ALL direct table access and drop the open policies:**
```sql
revoke all on sessions from anon, authenticated;
drop policy if exists "sessions_anon_select" on sessions;
drop policy if exists "sessions_anon_insert" on sessions;
drop policy if exists "sessions_anon_update_pending" on sessions;
drop policy if exists "sessions_select" on sessions;
drop policy if exists "sessions_insert" on sessions;
drop policy if exists "sessions_update" on sessions;
```

**4. Grant execute on the functions (this is now the ONLY way in):**
```sql
grant execute on function public.create_session(text, jsonb, text) to anon, authenticated;
grant execute on function public.get_session(uuid, text) to anon, authenticated;
grant execute on function public.fill_session(uuid, text, jsonb) to anon, authenticated;
```

**5. Disable Realtime on the table (a locked table can't stream; the SDK will poll `get_session` instead):**
```sql
alter publication supabase_realtime drop table sessions;
```

**6. Verify and report:**
- `select create_session('mcp-test', '["identity.pan"]');` → returns an `id` + `access_token`.
- `select * from get_session('<that id>'::uuid, '<that token>');` → returns the row.
- `select * from get_session('<that id>'::uuid, 'wrong-token');` → returns **0 rows**.
- Confirm a plain `select * from sessions;` as the **anon** role is now **denied** (permission error) — this proves the table can no longer be dumped.
- `select fill_session('<that id>'::uuid, '<that token>', '{"identity.pan":{"value":"ABCDE1234F"}}');` → row becomes `filled`.
- Delete the test row afterward.

Report every statement run and whether it succeeded, and confirm the anon dump is blocked.
