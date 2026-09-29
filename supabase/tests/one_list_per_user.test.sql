-- Un utente sta in una lista sola (#195): lo garantisce l'indice unico su
-- list_members(user_id), e le RPC che scrivono in list_members continuano a
-- funzionare con l'indice attivo. La gara fra due create_personal_list
-- concorrenti non si prova qui, dentro una transazione sola: la prova
-- supabase/tests/concurrency/create_personal_list_race.sh.
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

-- Quattro utenti di prova. Il trigger on_auth_user_created dà a ciascuno una
-- lista personale, come in produzione.
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000195a01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a195@example.test', now(), now()),
  ('00000000-0000-0000-0000-000000195b01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b195@example.test', now(), now()),
  ('00000000-0000-0000-0000-000000195c01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c195@example.test', now(), now()),
  ('00000000-0000-0000-0000-000000195d01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd195@example.test', now(), now());

-- 1. Il trigger di registrazione crea una riga sola.
select is(
  (select count(*)::int from public.list_members where user_id = '00000000-0000-0000-0000-000000195a01'),
  1,
  'il trigger di registrazione mette l''utente in una lista'
);

-- 2. Un secondo inserimento per lo stesso utente, in un'altra lista, fallisce.
select throws_ok(
  $$ insert into public.list_members (list_id, user_id)
     select lm.list_id, '00000000-0000-0000-0000-000000195a01'
     from public.list_members lm where lm.user_id = '00000000-0000-0000-0000-000000195b01' $$,
  '23505',
  null,
  'un secondo inserimento in list_members per lo stesso utente viola l''unicità'
);

-- 3. create_personal_list per chi ha già una lista la restituisce, senza crearne un'altra.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000195a01","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$ select list_id, success, error_message from public.create_personal_list() $$,
  $$ select lm.list_id, true, null::text from public.list_members lm
     where lm.user_id = '00000000-0000-0000-0000-000000195a01' $$,
  'create_personal_list restituisce la lista che l''utente ha già'
);
reset role;

-- 4. Per chi non ha liste (il trigger non l'ha creata), create_personal_list
-- la crea una volta sola: la seconda chiamata restituisce la stessa.
delete from public.lists l using public.list_members lm
  where l.id = lm.list_id and lm.user_id = '00000000-0000-0000-0000-000000195d01';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000195d01","role":"authenticated"}', true);
set local role authenticated;
create temp table first_call as select * from public.create_personal_list();
select results_eq(
  $$ select success, error_message from first_call $$,
  $$ values (true, null::text) $$,
  'create_personal_list crea la lista per chi non ne ha'
);
select results_eq(
  $$ select list_id from public.create_personal_list() $$,
  $$ select list_id from first_call $$,
  'la seconda chiamata restituisce la stessa lista'
);
reset role;
select is(
  (select count(*)::int from public.list_members where user_id = '00000000-0000-0000-0000-000000195d01'),
  1,
  'dopo due chiamate l''utente è in una lista sola'
);

-- A invita B per codice e C per email; B invita D per codice.
insert into public.invites (list_id, token, created_by, expires_at, short_code, pending_user_email)
select lm.list_id, 'tok-195-b', lm.user_id, now() + interval '1 day', 'T195BB', null
from public.list_members lm where lm.user_id = '00000000-0000-0000-0000-000000195a01';
insert into public.invites (list_id, token, created_by, expires_at, short_code, pending_user_email)
select lm.list_id, 'tok-195-c', lm.user_id, now() + interval '1 day', 'T195CC', 'c195@example.test'
from public.list_members lm where lm.user_id = '00000000-0000-0000-0000-000000195a01';

-- 5. join_list_via_invite senza forzare, per B che ha la sua lista: chiede conferma e non scrive.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000195b01","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$ select success, requires_confirmation from public.join_list_via_invite('T195BB') $$,
  $$ values (false, true) $$,
  'join_list_via_invite senza p_force chiede conferma a chi ha già una lista'
);

-- 6. join_list_via_invite forzato: B passa nella lista di A, con una riga sola.
select results_eq(
  $$ select success, error_message from public.join_list_via_invite('T195BB', true) $$,
  $$ values (true, null::text) $$,
  'join_list_via_invite forzato riesce con l''indice attivo'
);
reset role;
select results_eq(
  $$ select lm.list_id from public.list_members lm where lm.user_id = '00000000-0000-0000-0000-000000195b01' $$,
  $$ select lm.list_id from public.list_members lm where lm.user_id = '00000000-0000-0000-0000-000000195a01' $$,
  'B è nella lista di A, e solo in quella'
);
select is(
  (select count(*)::int from public.lists where created_by = '00000000-0000-0000-0000-000000195b01'),
  0,
  'la lista vecchia di B, rimasta vuota, è cancellata'
);

-- 7. join_list_via_invite per chi non ha liste: entra direttamente.
insert into public.invites (list_id, token, created_by, expires_at, short_code, pending_user_email)
select lm.list_id, 'tok-195-d', lm.user_id, now() + interval '1 day', 'T195DD', null
from public.list_members lm where lm.user_id = '00000000-0000-0000-0000-000000195b01';
delete from public.lists l using public.list_members lm
  where l.id = lm.list_id and lm.user_id = '00000000-0000-0000-0000-000000195d01';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000195d01","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$ select success, error_message from public.join_list_via_invite('T195DD') $$,
  $$ values (true, null::text) $$,
  'join_list_via_invite per chi non ha liste riesce con l''indice attivo'
);
reset role;
select is(
  (select count(*)::int from public.list_members where user_id = '00000000-0000-0000-0000-000000195d01'),
  1,
  'D è in una lista sola'
);

-- 8. accept_pending_invite_by_email per C senza liste: entra nella lista di A.
delete from public.lists l using public.list_members lm
  where l.id = lm.list_id and lm.user_id = '00000000-0000-0000-0000-000000195c01';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000195c01","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$ select success, error_message from public.accept_pending_invite_by_email() $$,
  $$ values (true, null::text) $$,
  'accept_pending_invite_by_email riesce con l''indice attivo'
);
reset role;
select is(
  (select count(*)::int from public.list_members where user_id = '00000000-0000-0000-0000-000000195c01'),
  1,
  'C è in una lista sola'
);

-- 9. create_personal_list mantiene il search_path vuoto.
select ok(
  (select proconfig @> array['search_path=""'] from pg_proc where oid = 'public.create_personal_list'::regproc),
  'create_personal_list ha il search_path fissato'
);

select * from finish();
rollback;
