-- Chi ha creato un invito lo può cancellare, in qualunque stato (#194).
-- Pending è una revoca, accettato o scaduto è pulizia. Nessun altro cancella
-- inviti: né gli altri membri della lista, né un estraneo, né chi non ha
-- sessione. Un codice revocato non fa più entrare, e chi è già entrato resta.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

-- A crea gli inviti; B è nella lista di A; C è un estraneo; D entra con un
-- invito che poi A cancella.
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000194a01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a194@example.test', now(), now()),
  ('00000000-0000-0000-0000-000000194b01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b194@example.test', now(), now()),
  ('00000000-0000-0000-0000-000000194c01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c194@example.test', now(), now()),
  ('00000000-0000-0000-0000-000000194d01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd194@example.test', now(), now());

delete from public.lists l using public.list_members lm
  where l.id = lm.list_id and lm.user_id = '00000000-0000-0000-0000-000000194b01';
insert into public.list_members (list_id, user_id)
select lm.list_id, '00000000-0000-0000-0000-000000194b01'
from public.list_members lm where lm.user_id = '00000000-0000-0000-0000-000000194a01';

-- Quattro inviti di A (pending, accettato, scaduto, uno per D) e uno di B.
insert into public.invites (id, list_id, token, created_by, created_at, expires_at, short_code, status)
select v.id, lm.list_id, v.token, v.created_by, v.expires_at - interval '7 days', v.expires_at, v.code, v.status
from public.list_members lm
cross join (values
  ('00000000-0000-0000-0000-00000194e0a1'::uuid, 'tok-194-p', '00000000-0000-0000-0000-000000194a01'::uuid, now() + interval '5 days', 'T194PP', 'pending'),
  ('00000000-0000-0000-0000-00000194e0a2'::uuid, 'tok-194-a', '00000000-0000-0000-0000-000000194a01'::uuid, now() + interval '5 days', 'T194AC', 'accepted'),
  ('00000000-0000-0000-0000-00000194e0a3'::uuid, 'tok-194-e', '00000000-0000-0000-0000-000000194a01'::uuid, now() - interval '1 day', 'T194EX', 'expired'),
  ('00000000-0000-0000-0000-00000194e0a4'::uuid, 'tok-194-d', '00000000-0000-0000-0000-000000194a01'::uuid, now() + interval '5 days', 'T194DD', 'pending'),
  ('00000000-0000-0000-0000-00000194e0b1'::uuid, 'tok-194-b', '00000000-0000-0000-0000-000000194b01'::uuid, now() + interval '5 days', 'T194BB', 'pending')
) v(id, token, created_by, expires_at, code, status)
where lm.user_id = '00000000-0000-0000-0000-000000194a01';

-- D entra con T194DD, come fa il client.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000194d01","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$ select success from public.join_list_via_invite('T194DD', true) $$,
  $$ values (true) $$,
  'D entra nella lista di A con T194DD'
);
reset role;

-- ─── Chi non l'ha creato non cancella ───────────────────────────────────────
-- Una DELETE filtrata dalla policy non è un errore: tocca zero righe.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000194b01","role":"authenticated"}', true);
set local role authenticated;
select is_empty(
  $$ delete from public.invites where id = '00000000-0000-0000-0000-00000194e0a1' returning id $$,
  'un altro membro della lista non cancella l''invito di A'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000194c01","role":"authenticated"}', true);
set local role authenticated;
select is_empty(
  $$ delete from public.invites returning id $$,
  'un estraneo non cancella nessun invito'
);
reset role;

select set_config('request.jwt.claims', '{}', true);
set local role anon;
select throws_ok(
  $$ delete from public.invites where id = '00000000-0000-0000-0000-00000194e0a1' $$,
  '42501',
  null,
  'senza sessione non si cancella niente'
);
reset role;

select is(
  (select count(*)::int from public.invites where short_code like 'T194%'),
  5,
  'dopo i tentativi altrui gli inviti sono ancora cinque'
);

-- ─── Il creatore cancella, in qualunque stato ───────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000194a01","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$ delete from public.invites where id = '00000000-0000-0000-0000-00000194e0a1' returning status $$,
  $$ values ('pending'::text) $$,
  'A revoca il suo invito pending'
);
select results_eq(
  $$ delete from public.invites where id = '00000000-0000-0000-0000-00000194e0a2' returning status $$,
  $$ values ('accepted'::text) $$,
  'A cancella il suo invito accettato'
);
select results_eq(
  $$ delete from public.invites where id = '00000000-0000-0000-0000-00000194e0a3' returning status $$,
  $$ values ('expired'::text) $$,
  'A cancella il suo invito scaduto'
);
select is_empty(
  $$ delete from public.invites where id = '00000000-0000-0000-0000-00000194e0b1' returning id $$,
  'A non cancella l''invito di B, anche se è della sua lista'
);
select lives_ok(
  $$ delete from public.invites where id = '00000000-0000-0000-0000-00000194e0a4' $$,
  'A cancella l''invito con cui D è entrato'
);
reset role;

-- ─── Effetto della revoca ───────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000194c01","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$ select success, error_message from public.join_list_via_invite('T194PP', true) $$,
  $$ values (false, 'invalid_or_expired'::text) $$,
  'un codice revocato risponde come un codice che non esiste'
);
reset role;
select results_eq(
  $$ select list_id from public.list_members where user_id = '00000000-0000-0000-0000-000000194d01' $$,
  $$ select list_id from public.list_members where user_id = '00000000-0000-0000-0000-000000194a01' $$,
  'D, entrato con un invito poi cancellato, resta nella lista di A'
);

select * from finish();
rollback;
