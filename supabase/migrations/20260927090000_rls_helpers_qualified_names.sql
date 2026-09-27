-- Le due funzioni che la RLS usa per trovare le liste dell'utente tornano a
-- funzionare: i nomi nel corpo sono qualificati con lo schema.
--
-- La 20260925120000 (#74) ha fissato `search_path = ''` su get_user_list_ids e
-- get_shared_list_member_ids con `alter function`, che cambia il search_path e
-- lascia il corpo com'è. In produzione il corpo scriveva `from list_members`
-- senza schema (lo schema del 20260109 nel repo invece lo qualifica, ed è per
-- questo che i test locali erano verdi): con il search_path vuoto il nome non si
-- risolve, Postgres risponde 42P01 e PostgREST lo traduce in 404. Dal 25 set
-- 2026 le letture di `lists` e `foods` fallivano per tutti gli utenti, e i client
-- mostravano una lista vuota; le policy dello storage usano la seconda funzione,
-- quindi anche le foto.
--
-- Supabase, Database Functions: «If you use an empty search path
-- (search_path = ''), you must explicitly state the schema for every relation
-- in the function body».
--
-- Corpo: quello in vigore in produzione, con `public.` davanti a list_members.
-- Create or replace conserva i grant (authenticated e service_role).

create or replace function public.get_user_list_ids()
returns table (list_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct lm.list_id
  from public.list_members lm
  where lm.user_id = auth.uid();
$$;

create or replace function public.get_shared_list_member_ids()
returns table (user_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct lm.user_id
  from public.list_members lm
  where lm.list_id in (
    select m.list_id
    from public.list_members m
    where m.user_id = auth.uid()
  );
$$;
