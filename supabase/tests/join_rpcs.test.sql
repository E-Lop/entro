-- Le RPC di adesione a una lista (#74): lista singola, contratto sugli errori
-- imprevisti, grant e search_path.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- Tre utenti di prova. Il trigger on_auth_user_created dà a ciascuno una
-- lista personale, come in produzione.
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-0000000074a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a74@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000074b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b74@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000074c1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c74@example.test', now(), now());

-- B invita A per email, e crea un codice per C.
insert into public.invites (list_id, token, created_by, expires_at, short_code, pending_user_email)
select lm.list_id, 'tok-74-a', lm.user_id, now() + interval '1 day', 'T74AAA', 'a74@example.test'
from public.list_members lm where lm.user_id = '00000000-0000-0000-0000-0000000074b1';
insert into public.invites (list_id, token, created_by, expires_at, short_code, pending_user_email)
select lm.list_id, 'tok-74-c', lm.user_id, now() + interval '1 day', 'T74CCC', 'c74@example.test'
from public.list_members lm where lm.user_id = '00000000-0000-0000-0000-0000000074b1';

-- 1. A ha già una lista: accettare l'invito per email non lo mette in due.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000074a1","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select success from public.accept_pending_invite_by_email()),
  false,
  'accept_pending_invite_by_email non riesce se l''utente ha già un''altra lista'
);
reset role;
select is(
  (select count(*)::int from public.list_members where user_id = '00000000-0000-0000-0000-0000000074a1'),
  1,
  'l''utente resta in una lista sola'
);
select is(
  (select status from public.invites where short_code = 'T74AAA'),
  'pending',
  'l''invito resta pending, e si può ancora accettare con il codice'
);

-- Un errore imprevisto dentro le due RPC: un trigger che fa fallire
-- l'inserimento in list_members, come farebbe un doppio invio concorrente.
create function pg_temp.fail_74() returns trigger language plpgsql as $$
begin raise exception 'guasto simulato %', 'T74CCC'; end $$;
create trigger fail_74 before insert on public.list_members
  for each row execute function pg_temp.fail_74();

-- 2. join_list_via_invite forzato, per C che ha già la sua lista.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000074c1","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$ select success, error_message from public.join_list_via_invite('T74CCC', true) $$,
  $$ values (false, 'Non è stato possibile accettare l''invito. Riprova.'::text) $$,
  'join_list_via_invite restituisce success = false con un messaggio fisso, non l''errore di Postgres'
);

-- 3. accept_pending_invite_by_email per C senza liste.
reset role;
delete from public.list_members where user_id = '00000000-0000-0000-0000-0000000074c1';
set local role authenticated;
select results_eq(
  $$ select success, error_message from public.accept_pending_invite_by_email() $$,
  $$ values (false, 'Non è stato possibile accettare l''invito. Riprova.'::text) $$,
  'accept_pending_invite_by_email restituisce success = false con un messaggio fisso'
);
reset role;
drop trigger fail_74 on public.list_members;

-- 4. Grant e search_path.
select ok(
  not has_table_privilege('authenticated', 'public.list_members', 'update'),
  'authenticated non ha UPDATE su list_members, che non ha policy di update'
);
select ok(
  (select proconfig @> array['search_path=""'] from pg_proc where oid = 'public.get_user_list_ids'::regproc),
  'get_user_list_ids ha il search_path fissato'
);
select ok(
  (select proconfig @> array['search_path=""'] from pg_proc where oid = 'public.get_shared_list_member_ids'::regproc),
  'get_shared_list_member_ids ha il search_path fissato'
);
select ok(
  (select proconfig @> array['search_path=""'] from pg_proc where oid = 'public.create_personal_list'::regproc),
  'create_personal_list ha il search_path fissato'
);

select * from finish();
rollback;
