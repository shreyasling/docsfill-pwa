// Throwaway verification for the sessions security hardening.
// Uses ONLY the public publishable key — proves the capability-token RPCs work
// and that direct table access is now denied. Run: node scripts/verify-security.mjs
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l && !l.trimStart().startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const ok = (b) => (b ? 'PASS' : 'FAIL');

// 1) create_session
const create = await supabase.rpc('create_session', {
  p_form_id: 'verify-security',
  p_required_tags: ['identity.pan'],
});
if (create.error) throw new Error('create_session failed: ' + create.error.message);
const { id, access_token } = create.data[0];
console.log('1. create_session          ->', ok(!!id && !!access_token), `(id=${id.slice(0, 8)}…)`);

// 2) get_session with correct token -> row
const good = await supabase.rpc('get_session', { p_id: id, p_token: access_token });
console.log('2. get_session (correct)   ->', ok(!good.error && good.data?.length === 1));

// 3) get_session with wrong token -> empty
const bad = await supabase.rpc('get_session', { p_id: id, p_token: 'wrong-token' });
console.log('3. get_session (wrong tok) ->', ok(!bad.error && (bad.data?.length ?? 0) === 0));

// 4) direct table dump must be DENIED
const dump = await supabase.from('sessions').select('*').limit(1);
console.log('4. direct table dump       ->', ok(!!dump.error), dump.error ? `(blocked: ${dump.error.message})` : '(!! NOT blocked)');

// 5) fill_session with correct token -> filled
const fill = await supabase.rpc('fill_session', {
  p_id: id,
  p_token: access_token,
  p_payload: { 'identity.pan': { value: 'ABCDE1234F' } },
});
console.log('5. fill_session            ->', ok(!fill.error && fill.data?.status === 'filled'));

// 6) fill again -> must fail (already filled)
const refill = await supabase.rpc('fill_session', {
  p_id: id,
  p_token: access_token,
  p_payload: { 'identity.pan': { value: 'ZZZZZ0000Z' } },
});
console.log('6. fill_session (re-fill)  ->', ok(!!refill.error), refill.error ? '(blocked)' : '(!! allowed)');

console.log('\nNote: the test row (form_id=verify-security) stays — anon has no DELETE grant (by design).');
