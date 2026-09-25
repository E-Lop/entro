-- Guardiano dei permessi EXECUTE sulle funzioni di public (#160).
--
-- Postgres concede EXECUTE a PUBLIC su ogni funzione appena creata, e anon è
-- membro di PUBLIC: una funzione senza revoca esplicita è chiamabile da
-- chiunque abbia la chiave anon, attraverso PostgREST. A leggere le
-- migrazioni non si vede, perché il permesso sta nel default e non in una
-- riga scritta: per questo il controllo gira sul database.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

-- Le sole funzioni che anon può eseguire, ciascuna con il suo perché.
--   register_pending_invite: la chiama il client durante la registrazione,
--   prima che esista una sessione (src/lib/invites.ts, issue #67).
select is(
  array(
    select p.proname::text
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and has_function_privilege('anon', p.oid, 'execute')
    order by 1
  ),
  array['register_pending_invite']::text[],
  'anon esegue solo le funzioni dichiarate'
);

select ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and coalesce(p.proacl::text[], array['=X/' || pg_get_userbyid(p.proowner)])
          && array['=X/' || pg_get_userbyid(p.proowner)]
  ),
  'nessuna funzione di public è eseguibile da PUBLIC'
);

-- La funzione che restituisce gli alimenti in scadenza di tutti gli utenti:
-- la chiama solo l'Edge Function send-expiry-notifications, con la service role.
select ok(
  not has_function_privilege('anon', 'public.get_expiring_foods_for_notifications()', 'execute')
  and not has_function_privilege('authenticated', 'public.get_expiring_foods_for_notifications()', 'execute'),
  'get_expiring_foods_for_notifications non è eseguibile da anon né da authenticated'
);

select ok(
  has_function_privilege('service_role', 'public.get_expiring_foods_for_notifications()', 'execute'),
  'get_expiring_foods_for_notifications resta eseguibile dalla service role'
);

-- Una funzione creata da postgres dopo le migrazioni nasce chiusa: è ciò che
-- i default privileges devono garantire, e che la forma «in schema public»
-- della 20260517 non garantiva.
create function public.function_grants_probe() returns int language sql as 'select 1';
select ok(
  not has_function_privilege('anon', 'public.function_grants_probe()', 'execute'),
  'una funzione nuova non è eseguibile da anon'
);

select * from finish();
rollback;
