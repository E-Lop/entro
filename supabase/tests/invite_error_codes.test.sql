-- Le RPC degli inviti restituiscono un codice in error_message, non una frase
-- (#101): la frase la sceglie il client (src/lib/inviteErrorMessage.ts qui,
-- src/shared/lib/inviteErrorMessage.ts su entro-mobile). Il ramo degli errori
-- imprevisti di join_list_via_invite e accept_pending_invite_by_email è in
-- join_rpcs.test.sql, dove è nato (#74).
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

-- Due utenti di prova: il trigger on_auth_user_created dà a ciascuno una lista.
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000101a01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a101@example.test', now(), now()),
  ('00000000-0000-0000-0000-000000101b01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b101@example.test', now(), now());

-- B ha creato ieri un codice che è appena scaduto (valid_expiry vuole la
-- scadenza dopo la creazione).
insert into public.invites (list_id, token, created_by, created_at, expires_at, short_code)
select lm.list_id, 'tok-101-x', lm.user_id, now() - interval '1 day', now() - interval '1 minute', 'T101EX'
from public.list_members lm where lm.user_id = '00000000-0000-0000-0000-000000101b01';

-- 1-3. Senza sessione auth.uid() è null.
select set_config('request.jwt.claims', '{}', true);
select results_eq(
  $$ select success, error_message from public.accept_pending_invite_by_email() $$,
  $$ values (false, 'not_authenticated'::text) $$,
  'accept_pending_invite_by_email senza sessione: not_authenticated'
);
select results_eq(
  $$ select success, error_message from public.join_list_via_invite('T101EX') $$,
  $$ values (false, 'not_authenticated'::text) $$,
  'join_list_via_invite senza sessione: not_authenticated'
);
select results_eq(
  $$ select success, error_message from public.create_personal_list() $$,
  $$ values (false, 'not_authenticated'::text) $$,
  'create_personal_list senza sessione: not_authenticated'
);

-- 4-6. A con la sua sessione, e tre codici che non portano da nessuna parte.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000101a01","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$ select success, error_message from public.join_list_via_invite('   ') $$,
  $$ values (false, 'invalid_code'::text) $$,
  'join_list_via_invite con un codice vuoto: invalid_code'
);
select results_eq(
  $$ select success, error_message from public.join_list_via_invite('NOPE00') $$,
  $$ values (false, 'invalid_or_expired'::text) $$,
  'join_list_via_invite con un codice che non esiste: invalid_or_expired'
);
select results_eq(
  $$ select success, error_message from public.join_list_via_invite('T101EX') $$,
  $$ values (false, 'expired'::text) $$,
  'join_list_via_invite con un codice scaduto: expired'
);
reset role;

-- 7. create_personal_list davanti a un errore imprevisto: A senza liste, e un
-- trigger che fa fallire l'inserimento in list_members.
delete from public.list_members where user_id = '00000000-0000-0000-0000-000000101a01';
create function pg_temp.fail_101() returns trigger language plpgsql as $$
begin raise exception 'guasto simulato %', 'T101'; end $$;
create trigger fail_101 before insert on public.list_members
  for each row execute function pg_temp.fail_101();
set local role authenticated;
select results_eq(
  $$ select success, error_message from public.create_personal_list() $$,
  $$ values (false, 'unexpected'::text) $$,
  'create_personal_list restituisce unexpected, non il testo di Postgres'
);
reset role;
drop trigger fail_101 on public.list_members;

-- 8. Nessun testo per l'utente nel corpo delle tre funzioni: ogni letterale
-- convertito in text è un codice. Vede anche un ramo che i casi sopra non
-- esercitano, e quello che verrà aggiunto domani.
select is_empty(
  $$ select p.proname::text, m[1]
     from pg_proc p, regexp_matches(p.prosrc, '''((?:[^'']|'''')*)''::text', 'g') m
     where p.oid in (
       'public.accept_pending_invite_by_email'::regproc,
       'public.join_list_via_invite'::regproc,
       'public.create_personal_list'::regproc
     )
     and m[1] !~ '^[a-z_]+$' $$,
  'le RPC degli inviti restituiscono solo codici in error_message'
);

select * from finish();
rollback;
