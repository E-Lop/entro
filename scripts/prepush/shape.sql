-- Il DDL dei pezzi della forma di produzione che `supabase db dump` non porta
-- (#188): policy di storage, trigger su auth.users, bucket, e i privilegi
-- esatti di public.
--
-- I privilegi: il dump scrive i GRANT e i REVOKE rispetto al default di
-- Postgres, ma nello stack ombra gli oggetti nascono con i privilegi di default
-- di Supabase, che danno tutto anche ad `anon`. Il passo 0 toglie ogni
-- privilegio non del proprietario, i passi 4 e 5 rimettono quelli della
-- sorgente. Il passo 6 fa lo stesso con i privilegi di default del ruolo
-- `postgres` in public, per i tipi di oggetto che la sorgente dichiara: decidono
-- i permessi degli oggetti che la migrazione nuova creerà. Quelli di
-- `supabase_admin` da qui non si cambiano: se differiscono, lo dice l'impronta.
--
-- Il passo 8 porta le righe di `public.categories`: sono dati di riferimento,
-- non degli utenti, e senza di loro nessun alimento si può scrivere.
--
-- Un solo statement, che restituisce una riga di SQL per oggetto. Il quoting
-- lo fa Postgres (`format('%I')`, `%L`), non chi legge l'output.
select ddl from (
  select 0 as step, $strip$do $do$
declare statement text;
begin
  for statement in
    select format('revoke all on %s %I.%I from %s', case when c.relkind = 'S' then 'sequence' else 'table' end,
                  n.nspname, c.relname, case when a.grantee = 0 then 'public' else a.grantee::regrole::text end)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    cross join lateral aclexplode(coalesce(c.relacl, acldefault((case when c.relkind = 'S' then 's' else 'r' end)::"char", c.relowner))) a
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'S') and a.grantee <> c.relowner
    union
    select format('revoke all on function %I.%I(%s) from %s', n.nspname, p.proname,
                  pg_get_function_identity_arguments(p.oid), case when a.grantee = 0 then 'public' else a.grantee::regrole::text end)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f'::"char", p.proowner))) a
    where n.nspname = 'public' and a.grantee <> p.proowner
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute statement;
  end loop;
end
$do$;$strip$ as ddl, '' as ord

  union all
  select 1, format(
           'drop policy if exists %I on %I.%I; create policy %I on %I.%I as %s for %s to %s%s%s;',
           policyname, schemaname, tablename,
           policyname, schemaname, tablename,
           permissive, cmd,
           (select string_agg(case when role = 'public' then 'public' else quote_ident(role) end, ', ')
              from unnest(roles::text[]) as role),
           case when qual is null then '' else ' using (' || qual || ')' end,
           case when with_check is null then '' else ' with check (' || with_check || ')' end
         ) as ddl,
         schemaname || tablename || policyname as ord
  from pg_policies
  where schemaname = 'storage'

  union all
  select 2, format('drop trigger if exists %I on auth.users; %s;', t.tgname, pg_get_triggerdef(t.oid)),
         t.tgname
  from pg_trigger t
  where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal

  union all
  select 3, format(
           'insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values (%L, %L, %L, %s, %s) '
             || 'on conflict (id) do update set name = excluded.name, public = excluded.public, '
             || 'file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;',
           id, name, public,
           coalesce(file_size_limit::text, 'null'),
           coalesce(quote_literal(allowed_mime_types::text) || '::text[]', 'null')
         ),
         id
  from storage.buckets

  union all
  select 4, format('grant %s on %s %I.%I to %s%s;', a.privilege_type,
                   case when c.relkind = 'S' then 'sequence' else 'table' end, n.nspname, c.relname,
                   case when a.grantee = 0 then 'public' else a.grantee::regrole::text end,
                   case when a.is_grantable then ' with grant option' else '' end),
         c.relname || a.privilege_type
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  cross join lateral aclexplode(coalesce(c.relacl, acldefault((case when c.relkind = 'S' then 's' else 'r' end)::"char", c.relowner))) a
  where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'S') and a.grantee <> c.relowner

  union all
  select 5, format('grant execute on function %I.%I(%s) to %s%s;', n.nspname, p.proname,
                   pg_get_function_identity_arguments(p.oid),
                   case when a.grantee = 0 then 'public' else a.grantee::regrole::text end,
                   case when a.is_grantable then ' with grant option' else '' end),
         p.proname || pg_get_function_identity_arguments(p.oid)
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  cross join lateral aclexplode(coalesce(p.proacl, acldefault('f'::"char", p.proowner))) a
  where n.nspname = 'public' and a.grantee <> p.proowner
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')

  union all
  select 6, format('alter default privileges for role postgres in schema public revoke all on %s from public, anon, authenticated, service_role;',
                   case d.defaclobjtype when 'r' then 'tables' when 'S' then 'sequences' when 'f' then 'functions' when 'T' then 'types' end),
         d.defaclobjtype::text
  from pg_default_acl d
  where d.defaclnamespace = 'public'::regnamespace and d.defaclrole = 'postgres'::regrole
    and d.defaclobjtype in ('r', 'S', 'f', 'T')

  union all
  select 7, format('alter default privileges for role postgres in schema public grant %s on %s to %s%s;', a.privilege_type,
                   case d.defaclobjtype when 'r' then 'tables' when 'S' then 'sequences' when 'f' then 'functions' when 'T' then 'types' end,
                   case when a.grantee = 0 then 'public' else a.grantee::regrole::text end,
                   case when a.is_grantable then ' with grant option' else '' end),
         d.defaclobjtype::text || a.privilege_type || a.grantee::text
  from pg_default_acl d
  cross join lateral aclexplode(d.defaclacl) a
  where d.defaclnamespace = 'public'::regnamespace and d.defaclrole = 'postgres'::regrole
    and d.defaclobjtype in ('r', 'S', 'f', 'T') and a.grantee <> d.defaclrole

  union all
  select 8, format('insert into public.categories select * from json_populate_recordset(null::public.categories, %L) on conflict do nothing;',
                   json_agg(c)),
         ''
  from public.categories c
) shape
order by step, ord
