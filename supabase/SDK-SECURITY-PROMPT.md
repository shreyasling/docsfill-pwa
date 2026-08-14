# DocFill — SDK security coordination prompt

Give this to your SDK agent. It's the SDK half of closing the one real data leak:
today anyone with the public publishable key can dump every session (all users'
`filled_payload` — names, PANs, DOBs, and live file links). The fix is a
per-session **capability token**; the PWA + SQL sides are already done.

Apply `supabase/security-hardening.sql` FIRST (adds `create_session` /
`get_session` / `fill_session` RPCs and revokes direct table access).

---

**Paste this to the SDK agent:**

> We're hardening the shared `sessions` table so it can no longer be dumped with
> the public publishable key. Direct table `select`/`insert`/`update` on
> `sessions` has been **revoked**; access now goes through three SECURITY DEFINER
> RPCs that require a per-session secret token. Update the SDK to match. Do NOT
> change the tag vocabulary or `filled_payload` shape.
>
> **1. Create sessions via RPC (not a direct insert).** Replace the insert with:
> ```ts
> const { data, error } = await supabase
>   .rpc('create_session', { p_form_id: formId, p_required_tags: requiredTags });
> // data => [{ id, access_token }]
> const { id: sessionId, access_token: token } = data[0];
> ```
>
> **2. Put the token in the QR / fill URL** so the PWA can present it:
> ```
> https://<pwaUrl>/fill?session=<sessionId>&k=<token>
> ```
> Keep the token client-side only in memory; it is the capability to read/fill
> THIS one session.
>
> **3. Read status by POLLING the RPC (Realtime is disabled on this table now):**
> ```ts
> const { data } = await supabase
>   .rpc('get_session', { p_id: sessionId, p_token: token });
> const row = data?.[0];
> if (row?.status === 'filled') { /* inject row.filled_payload */ }
> ```
> Poll every ~1.5s until `status === 'filled'` or `expires_at` passes, then stop.
> (If you currently use `.channel(...).on('postgres_changes', ...)`, remove it —
> RLS-locked tables don't stream. Polling is simple and just as fast here.)
>
> **4. The SDK never needs the service key or any table-level access.** All reads
> are the `get_session` RPC with the session's own token; you can no longer read
> other sessions, which is the point.
>
> After this: without a session's `k` token, a stolen publishable key yields
> nothing — no table dump, no cross-session reads, no tampering.

---

## Rollout order (do all three, close together)
1. Run `supabase/security-hardening.sql` (via MCP or SQL editor).
2. Ship the SDK change above (create via RPC, token in URL, poll).
3. PWA is already backward-compatible: it uses the token + RPCs when `&k=` is
   present, and falls back to the old path only while the token is absent.
