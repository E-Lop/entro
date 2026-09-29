-- Tre permessi più larghi di quanto i client usino (#184), e l'uscita da una
-- lista come RPC atomica.
--   1. authenticated non scrive inviti: nascono solo da create-invite;
--   2. un alimento si inserisce solo col proprio user_id, e in update user_id
--      non cambia (ma la cancellazione di un account lo mette a NULL);
--   3. leave_list() toglie l'utente da una lista condivisa e gli dà una lista
--      personale nella stessa transazione, e rifiuta chi è solo.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

-- A, B, C e D. Il trigger on_auth_user_created dà a ciascuno una lista.
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000184a01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a184@example.test', now(), now()),
  ('00000000-0000-0000-0000-000000184b01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b184@example.test', now(), now()),
  ('00000000-0000-0000-0000-000000184c01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c184@example.test', now(), now()),
  ('00000000-0000-0000-0000-000000184d01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd184@example.test', now(), now());

-- B e C entrano nella lista di A, come dopo join_list_via_invite forzato.
delete from public.lists l using public.list_members lm
  where l.id = lm.list_id and lm.user_id in ('00000000-0000-0000-0000-000000184b01', '00000000-0000-0000-0000-000000184c01');
insert into public.list_members (list_id, user_id)
select lm.list_id, u.id
from public.list_members lm
cross join (values ('00000000-0000-0000-0000-000000184b01'::uuid), ('00000000-0000-0000-0000-000000184c01'::uuid)) u(id)
where lm.user_id = '00000000-0000-0000-0000-000000184a01';

create temp table list_of_a as
  select list_id from public.list_members where user_id = '00000000-0000-0000-0000-000000184a01';
grant select on list_of_a to authenticated;

-- Un alimento di A e uno di C nella lista condivisa.
insert into public.foods (id, user_id, list_id, name, expiry_date, category_id, storage_location, quantity)
select v.id, v.user_id, (select list_id from list_of_a), v.name, current_date + 5,
       (select id from public.categories order by 1 limit 1), 'fridge', 1
from (values
  ('00000000-0000-0000-0000-00000184f0a1'::uuid, '00000000-0000-0000-0000-000000184a01'::uuid, 'Latte di A'),
  ('00000000-0000-0000-0000-00000184f0c1'::uuid, '00000000-0000-0000-0000-000000184c01'::uuid, 'Burro di C')
) v(id, user_id, name);

-- ─── 1. Inviti ──────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000184a01","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ insert into public.invites (list_id, token, created_by, expires_at, short_code)
     select list_id, 'tok-184-a', '00000000-0000-0000-0000-000000184a01', '2099-01-01', 'T184AA' from list_of_a $$,
  '42501',
  null,
  'un membro non scrive un invito direttamente in invites'
);

-- ─── 2. Alimenti ────────────────────────────────────────────────────────────
select throws_ok(
  $$ insert into public.foods (user_id, list_id, name, expiry_date, category_id, storage_location, quantity)
     select '00000000-0000-0000-0000-000000184b01', list_id, 'Attribuito a B', current_date + 3,
            (select id from public.categories order by 1 limit 1), 'fridge', 1 from list_of_a $$,
  '42501',
  null,
  'un insert in foods con il user_id di un altro è rifiutato'
);
select lives_ok(
  $$ insert into public.foods (user_id, list_id, name, expiry_date, category_id, storage_location, quantity)
     select '00000000-0000-0000-0000-000000184a01', list_id, 'Uova di A', current_date + 3,
            (select id from public.categories order by 1 limit 1), 'fridge', 1 from list_of_a $$,
  'un insert in foods con il proprio user_id riesce'
);
select throws_ok(
  $$ update public.foods set user_id = '00000000-0000-0000-0000-000000184b01'
     where id = '00000000-0000-0000-0000-00000184f0a1' $$,
  '42501',
  null,
  'il proprietario non cambia user_id del suo alimento'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000184b01","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ update public.foods set user_id = '00000000-0000-0000-0000-000000184b01'
     where id = '00000000-0000-0000-0000-00000184f0a1' $$,
  '42501',
  null,
  'un altro membro non si attribuisce l''alimento di A'
);
select lives_ok(
  $$ update public.foods
     set name = 'Latte intero', expiry_date = current_date + 7, status = 'consumed', consumed_at = now()
     where id = '00000000-0000-0000-0000-00000184f0a1' $$,
  'un altro membro aggiorna nome, data ed esito dell''alimento di A'
);
reset role;
select results_eq(
  $$ select name, status::text, user_id from public.foods where id = '00000000-0000-0000-0000-00000184f0a1' $$,
  $$ values ('Latte intero'::text, 'consumed'::text, '00000000-0000-0000-0000-000000184a01'::uuid) $$,
  'l''aggiornamento di B è scritto, e user_id resta di A'
);

-- La cancellazione di un account mette a NULL user_id degli alimenti rimasti
-- in una lista condivisa (on delete set null): il divieto non la deve fermare.
-- C la chiede come fa il client, con delete_user().
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000184c01","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ select public.delete_user() $$,
  'la cancellazione dell''account di C riesce'
);
reset role;
select is(
  (select user_id from public.foods where id = '00000000-0000-0000-0000-00000184f0c1'),
  null,
  'l''alimento di C resta nella lista condivisa, con user_id a NULL'
);

-- ─── 3. leave_list() ────────────────────────────────────────────────────────
select ok(
  has_function_privilege('authenticated', 'public.leave_list()', 'execute'),
  'authenticated esegue leave_list'
);

-- B esce dalla lista condivisa con A.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000184b01","role":"authenticated"}', true);
set local role authenticated;
create temp table left_b as select * from public.leave_list();
reset role;
select results_eq(
  $$ select success, error_message from left_b $$,
  $$ values (true, null::text) $$,
  'leave_list da una lista condivisa riesce'
);
select results_eq(
  $$ select list_id from public.list_members where user_id = '00000000-0000-0000-0000-000000184b01' $$,
  $$ select list_id from left_b $$,
  'B ha una riga sola, nella lista nuova che leave_list restituisce'
);
select isnt(
  (select list_id from left_b),
  (select list_id from list_of_a),
  'la lista nuova di B non è quella di A'
);
select is(
  (select count(*)::int from public.list_members where list_id = (select list_id from list_of_a)),
  1,
  'la lista di A ha un membro in meno'
);
select is(
  (select created_by from public.lists where id = (select list_id from left_b)),
  '00000000-0000-0000-0000-000000184b01'::uuid,
  'la lista nuova è di B'
);

-- A è rimasta sola: leave_list rifiuta e non cambia niente.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000184a01","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$ select list_id, success, error_message from public.leave_list() $$,
  $$ values (null::uuid, false, 'only_member'::text) $$,
  'leave_list rifiuta chi è l''unico membro della sua lista'
);
reset role;
select results_eq(
  $$ select list_id from public.list_members where user_id = '00000000-0000-0000-0000-000000184a01' $$,
  $$ select list_id from list_of_a $$,
  'dopo il rifiuto A è ancora nella sua lista'
);

-- D senza lista (il trigger non l'ha creata).
delete from public.lists l using public.list_members lm
  where l.id = lm.list_id and lm.user_id = '00000000-0000-0000-0000-000000184d01';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000184d01","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$ select success, error_message from public.leave_list() $$,
  $$ values (false, 'not_a_member'::text) $$,
  'leave_list rifiuta chi non è in nessuna lista'
);

-- Senza sessione.
select set_config('request.jwt.claims', '{}', true);
select results_eq(
  $$ select success, error_message from public.leave_list() $$,
  $$ values (false, 'not_authenticated'::text) $$,
  'leave_list senza sessione: not_authenticated'
);
reset role;

select ok(
  (select proconfig @> array['search_path=""'] from pg_proc where oid = 'public.leave_list'::regproc),
  'leave_list ha il search_path fissato'
);

select * from finish();
rollback;
