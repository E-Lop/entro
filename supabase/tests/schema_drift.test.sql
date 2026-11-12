-- Guardiano della migrazione di riallineamento con la produzione (#182).
--
-- Il corpo di update_updated_at_column() ora è quello di produzione, con le
-- parole in maiuscolo: il test esegue il trigger, perché un corpo cambiato
-- senza eseguirlo non prova niente. I COMMENT sono quelli dell'inventario del
-- 12 nov 2026: devono esserci, e quelli di invites senza a capo.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000182a01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a182@example.test', now(), now());

-- Dentro una transazione now() è sempre lo stesso istante: si parte da ieri,
-- così l'aggiornamento si vede.
insert into public.foods (id, user_id, list_id, name, expiry_date, category_id, storage_location, quantity, updated_at)
select '00000000-0000-0000-0000-000000182f01', '00000000-0000-0000-0000-000000182a01',
       (select lm.list_id from public.list_members lm where lm.user_id = '00000000-0000-0000-0000-000000182a01'),
       'Latte', current_date + 3, (select id from public.categories order by 1 limit 1), 'fridge', 1,
       now() - interval '1 day';

update public.foods set name = 'Latte intero' where id = '00000000-0000-0000-0000-000000182f01';

select is(
  (select updated_at from public.foods where id = '00000000-0000-0000-0000-000000182f01'),
  now(),
  'il trigger di foods porta updated_at all''istante della modifica'
);

select is(
  array(
    select a.attname::text
    from pg_attribute a
    where a.attrelid = 'public.invites'::regclass
      and a.attname in ('email', 'short_code', 'pending_user_email')
      and col_description(a.attrelid, a.attnum) !~ '\n'
    order by 1
  ),
  array['email', 'pending_user_email', 'short_code']::text[],
  'i COMMENT di tre colonne di invites ci sono, su una riga sola'
);

select ok(
  obj_description('public.create_personal_list()'::regprocedure, 'pg_proc') is not null,
  'create_personal_list() ha il suo COMMENT'
);

-- Il COMMENT di prima diceva che la funzione cancella tutti i dati: dalla
-- 20260922 lo fa il trigger, e le liste condivise restano agli altri.
select ok(
  obj_description('public.delete_user()'::regprocedure, 'pg_proc') like '%on_auth_user_deleted%'
  and obj_description('public.delete_user()'::regprocedure, 'pg_proc') not like '%Deletes all user data%',
  'il COMMENT di delete_user() nomina il trigger che fa la pulizia'
);

select is(
  (
    select count(*)::int
    from pg_policy p
    where p.polrelid = 'public.foods'::regclass
      and p.polname in (
        'Users can view foods from their lists',
        'Users can update foods from their lists',
        'Users can delete foods from their lists'
      )
      and obj_description(p.oid, 'pg_policy') is not null
  ),
  3,
  'le tre policy di foods hanno il loro COMMENT'
);

-- CREATE OR REPLACE non cambia i permessi: la funzione resta eseguibile da
-- chi la eseguiva prima, come in produzione.
select ok(
  has_function_privilege('authenticated', 'public.update_updated_at_column()', 'execute'),
  'update_updated_at_column() resta eseguibile da authenticated'
);

select * from finish();
rollback;
