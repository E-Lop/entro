-- Guardiano dei nomi qualificati nelle funzioni con search_path vuoto (#179).
--
-- Con `search_path = ''` una funzione non risolve i nomi senza schema: un
-- `from list_members` risponde 42P01, e PostgREST lo traduce in 404. Dal 25 set
-- 2026 get_user_list_ids ne era un caso, e tutte le letture di lists e foods
-- fallivano. `alter function … set search_path` cambia il search_path e non il
-- corpo, quindi a leggere la migrazione non si vede: il controllo gira sul
-- database.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

-- Nessuna funzione di public con search_path vuoto nomina una tabella di
-- public senza lo schema davanti.
select is(
  array(
    select distinct p.proname::text
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral (
      select c.relname
      from pg_class c
      where c.relnamespace = 'public'::regnamespace
        and c.relkind in ('r', 'v', 'm', 'p')
    ) t
    where n.nspname = 'public'
      and p.proconfig @> array['search_path=""']
      and p.prosrc ~* ('(from|join|into|update)\s+' || t.relname || '\M')
    order by 1
  ),
  array[]::text[],
  'le funzioni con search_path vuoto qualificano le tabelle di public'
);

-- Le due funzioni che la RLS usa si eseguono.
select lives_ok(
  $$ select * from public.get_user_list_ids() $$,
  'get_user_list_ids si esegue'
);

select lives_ok(
  $$ select * from public.get_shared_list_member_ids() $$,
  'get_shared_list_member_ids si esegue'
);

-- Il sintomo che vedevano i client: la lettura di lists e foods attraverso
-- la RLS, come authenticated.
set local role authenticated;

select lives_ok(
  $$ select count(*) from public.lists $$,
  'authenticated legge lists attraverso la RLS'
);

select lives_ok(
  $$ select count(*) from public.foods $$,
  'authenticated legge foods attraverso la RLS'
);

select * from finish();
rollback;
