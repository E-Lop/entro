-- L'impronta della forma di un database (#188): una sola definizione, eseguita
-- sulla sorgente (produzione, o lo sviluppo in modalità locale) e sullo stack
-- ombra. Solo catalogo: nessuna riga di dati degli utenti.
--
-- Un solo statement, perché `supabase db query` non ne accetta di più. Le ACL
-- si confrontano scomposte con `aclexplode` (ruolo, privilegio, grant option):
-- senza il concedente, che cambia la stringa senza cambiare il permesso, e con
-- il default di Postgres al posto di un'ACL nulla. I trigger si descrivono dai
-- campi del catalogo e non da `pg_get_triggerdef`, che qualifica i nomi secondo
-- il `search_path` della sessione.
select kind, name, value from (
  -- Funzioni di public, tranne quelle delle estensioni: corpo, configurazione, ACL.
  select 'function' as kind,
         n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as name,
         md5(p.prosrc) || ' config=' || coalesce(p.proconfig::text, '-')
           || ' secdef=' || p.prosecdef::text
           || ' acl=' || coalesce((
                select string_agg(
                         case when a.grantee = 0 then 'public' else a.grantee::regrole::text end
                           || '=' || a.privilege_type || case when a.is_grantable then '*' else '' end,
                         ',' order by case when a.grantee = 0 then 'public' else a.grantee::regrole::text end, a.privilege_type)
                from aclexplode(coalesce(p.proacl, acldefault('f'::"char", p.proowner))) a), '-') as value
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')

  union all
  -- Policy di public e di storage.
  select 'policy',
         schemaname || '.' || tablename || '.' || policyname,
         permissive || ' ' || cmd || ' roles=' || roles::text[]::text
           || ' using=' || coalesce(qual, '-') || ' check=' || coalesce(with_check, '-')
  from pg_policies
  where schemaname in ('public', 'storage')

  union all
  -- Trigger su auth.users: la funzione con il suo schema, il tipo e lo stato.
  select 'trigger',
         'auth.users.' || t.tgname,
         fn.nspname || '.' || p.proname || ' type=' || t.tgtype::text || ' enabled=' || t.tgenabled::text
  from pg_trigger t
  join pg_proc p on p.oid = t.tgfoid
  join pg_namespace fn on fn.oid = p.pronamespace
  where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal

  union all
  -- Tabelle, viste e sequenze di public: grant e RLS.
  select case when c.relkind = 'S' then 'sequence' else 'table' end,
         n.nspname || '.' || c.relname,
         'acl=' || coalesce((
             select string_agg(
                      case when a.grantee = 0 then 'public' else a.grantee::regrole::text end
                        || '=' || a.privilege_type || case when a.is_grantable then '*' else '' end,
                      ',' order by case when a.grantee = 0 then 'public' else a.grantee::regrole::text end, a.privilege_type)
             from aclexplode(coalesce(c.relacl, acldefault((case when c.relkind = 'S' then 's' else 'r' end)::"char", c.relowner))) a), '-')
           || ' rls=' || c.relrowsecurity::text
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'S')

  union all
  -- Privilegi di default in public: decidono i permessi degli oggetti che la
  -- migrazione nuova creerà.
  select 'default_acl',
         d.defaclrole::regrole::text || '.' || d.defaclobjtype::text,
         coalesce((
             select string_agg(
                      case when a.grantee = 0 then 'public' else a.grantee::regrole::text end
                        || '=' || a.privilege_type || case when a.is_grantable then '*' else '' end,
                      ',' order by case when a.grantee = 0 then 'public' else a.grantee::regrole::text end, a.privilege_type)
             from aclexplode(d.defaclacl) a), '-')
  from pg_default_acl d
  where d.defaclnamespace = 'public'::regnamespace

  union all
  -- Bucket: id e flag, mai gli oggetti.
  select 'bucket',
         id,
         'public=' || public::text || ' size=' || coalesce(file_size_limit::text, '-')
           || ' mime=' || coalesce(allowed_mime_types::text, '-')
  from storage.buckets

  union all
  -- I dati di riferimento: le categorie. Non sono dati degli utenti.
  select 'reference', 'public.categories', md5(coalesce(string_agg(c::text, '|' order by c::text), ''))
  from public.categories c
) fingerprint
order by kind, name
