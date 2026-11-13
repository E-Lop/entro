-- Guardiano dei privilegi di anon (#267) e di authenticated (#271) sulle
-- relazioni di public.
--
-- È il gemello di function_grants.test.sql per tabelle, viste e sequenze.
-- I privilegi contano quelli effettivi: dati al ruolo e dati a PUBLIC, che
-- anon e authenticated ereditano. Molti non stanno in una riga scritta ma nei privilegi di
-- default, quindi il controllo gira sul database. Ogni regola è un'asserzione
-- sola sull'insieme delle violazioni, così il plan non cambia quando nasce una
-- tabella.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

-- Le relazioni di public diverse dalle sequenze, e gli otto privilegi di tabella.
-- L'unica coppia dichiarata:
--   categories, SELECT: Category è a «Lettura pubblica» nel bundle di dominio
--   (entro-family/core/entities.md), e la sua policy è using (true).
select is(
  array(
    select c.relname || ':' || p.privilege
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN']) as p(privilege)
    where n.nspname = 'public'
      and c.relkind in ('r', 'v', 'm', 'p', 'f')
      and has_table_privilege('anon', c.oid, p.privilege)
    order by 1
  ),
  array['categories:SELECT']::text[],
  'anon ha solo i privilegi di relazione dichiarati'
);

select is(
  array(
    select c.relname || ':' || p.privilege
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    cross join unnest(array['USAGE', 'SELECT', 'UPDATE']) as p(privilege)
    where n.nspname = 'public'
      and c.relkind = 'S'
      and has_sequence_privilege('anon', c.oid, p.privilege)
    order by 1
  ),
  array[]::text[],
  'anon non ha privilegi sulle sequenze di public'
);

-- I privilegi di colonna si leggono dalle ACL delle colonne:
-- has_column_privilege è vera anche quando il privilegio sta sulla tabella, e
-- su categories nasconderebbe un grant solo di colonna. Grantee 0 è PUBLIC.
select is(
  array(
    select c.relname || '.' || a.attname || ':' || acl.privilege_type
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    cross join lateral aclexplode(a.attacl) as acl
    where n.nspname = 'public'
      and a.attnum > 0
      and not a.attisdropped
      and a.attacl is not null
      and acl.grantee in ('anon'::regrole::oid, 0)
    order by 1
  ),
  array[]::text[],
  'anon e PUBLIC non hanno privilegi di colonna in public'
);

-- Una tabella e una sequenza create da postgres dopo le migrazioni nascono
-- chiuse ad anon: è ciò che i default devono garantire.
create table public.relation_grants_probe (id int);
create sequence public.relation_grants_probe_seq;

select is(
  array(
    select p.privilege
    from unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN']) as p(privilege)
    where has_table_privilege('anon', 'public.relation_grants_probe', p.privilege)
  ),
  array[]::text[],
  'una tabella nuova non dà niente ad anon'
);

select is(
  array(
    select p.privilege
    from unnest(array['USAGE', 'SELECT', 'UPDATE']) as p(privilege)
    where has_sequence_privilege('anon', 'public.relation_grants_probe_seq', p.privilege)
  ),
  array[]::text[],
  'una sequenza nuova non dà niente ad anon'
);

-- Il comportamento, oltre al catalogo. Il conteggio di postgres passa ad anon
-- con set_config: una tabella temporanea anon non la potrebbe leggere.
select set_config('test.categories_count', (select count(*)::text from public.categories), true);
select set_config('request.jwt.claims', '{}', true);
set local role anon;

select is(
  (select count(*) from public.categories),
  current_setting('test.categories_count')::bigint,
  'anon legge da categories le stesse righe di postgres'
);

select ok(
  (select count(*) from public.categories) > 0,
  'e almeno una'
);

-- Il messaggio conta: su foods, lists e list_members lo stesso codice 42501
-- arrivava già prima, per la funzione get_user_list_ids() della policy. Su
-- inherited_food_images anche il messaggio coincideva già: lì la regressione
-- la prende la prima asserzione.
select throws_ok('select 1 from public.foods limit 1', '42501', 'permission denied for table foods', 'anon non legge foods');
select throws_ok('select 1 from public.lists limit 1', '42501', 'permission denied for table lists', 'anon non legge lists');
select throws_ok('select 1 from public.list_members limit 1', '42501', 'permission denied for table list_members', 'anon non legge list_members');
select throws_ok('select 1 from public.notification_preferences limit 1', '42501', 'permission denied for table notification_preferences', 'anon non legge notification_preferences');
select throws_ok('select 1 from public.push_subscriptions limit 1', '42501', 'permission denied for table push_subscriptions', 'anon non legge push_subscriptions');
select throws_ok('select 1 from public.inherited_food_images limit 1', '42501', 'permission denied for table inherited_food_images', 'anon non legge inherited_food_images');

reset role;

-- ─── authenticated (#271) ───────────────────────────────────────────────────
-- Nessun percorso usa TRUNCATE, REFERENCES, TRIGGER o MAINTAIN di
-- authenticated: le RPC sono SECURITY DEFINER, le Edge Function usano la
-- service_role. TRUNCATE non passa dalla RLS.
select is(
  array(
    select c.relname || ':' || p.privilege
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    cross join unnest(array['TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN']) as p(privilege)
    where n.nspname = 'public'
      and c.relkind in ('r', 'v', 'm', 'p', 'f')
      and has_table_privilege('authenticated', c.oid, p.privilege)
    order by 1
  ),
  array[]::text[],
  'authenticated non ha TRUNCATE, REFERENCES, TRIGGER né MAINTAIN su nessuna relazione'
);

-- REFERENCES è il solo dei quattro che si può dare per colonna, e
-- has_table_privilege non vede i grant di colonna. Su categories anche le
-- scritture di colonna: i client la leggono soltanto.
select is(
  array(
    select c.relname || '.' || a.attname || ':' || acl.privilege_type
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    cross join lateral aclexplode(a.attacl) as acl
    where n.nspname = 'public'
      and a.attnum > 0
      and not a.attisdropped
      and a.attacl is not null
      and acl.grantee in ('authenticated'::regrole::oid, 0)
      and (acl.privilege_type = 'REFERENCES'
           or (c.relname = 'categories' and acl.privilege_type in ('INSERT', 'UPDATE')))
    order by 1
  ),
  array[]::text[],
  'authenticated non ha REFERENCES di colonna, né scritture di colonna su categories'
);

select is(
  array(
    select p.privilege
    from unnest(array['INSERT', 'UPDATE', 'DELETE']) as p(privilege)
    where has_table_privilege('authenticated', 'public.categories', p.privilege)
  ),
  array[]::text[],
  'authenticated non scrive su categories'
);

select is(
  array(
    select 'table:' || p.privilege
    from unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN']) as p(privilege)
    where has_table_privilege('authenticated', 'public.relation_grants_probe', p.privilege)
    union all
    select 'sequence:' || p.privilege
    from unnest(array['USAGE', 'SELECT', 'UPDATE']) as p(privilege)
    where has_sequence_privilege('authenticated', 'public.relation_grants_probe_seq', p.privilege)
  ),
  array[]::text[],
  'una tabella e una sequenza nuove non danno niente ad authenticated'
);

-- I privilegi che i client usano restano. Il perché, per tabella:
--   SELECT su categories, foods, lists, list_members, notification_preferences,
--     invites, list_removal_notices: le letture della PWA e di entro-mobile;
--   INSERT e UPDATE su foods: creazione e modifica di un alimento (la rimozione
--     è un UPDATE di stato);
--   INSERT e UPDATE su notification_preferences: l'upsert delle preferenze;
--   DELETE su invites e list_removal_notices: la revoca di un invito e la
--     lettura dell'avviso di rimozione, dalla PWA.
select is(
  array(
    select k
    from unnest(array[
      'categories:SELECT', 'foods:SELECT', 'lists:SELECT', 'list_members:SELECT',
      'notification_preferences:SELECT', 'invites:SELECT', 'list_removal_notices:SELECT',
      'foods:INSERT', 'foods:UPDATE',
      'notification_preferences:INSERT', 'notification_preferences:UPDATE',
      'invites:DELETE', 'list_removal_notices:DELETE'
    ]) as k
    where not has_table_privilege('authenticated', 'public.' || split_part(k, ':', 1), split_part(k, ':', 2))
  ),
  array[]::text[],
  'authenticated tiene i privilegi che i client usano'
);

-- Il comportamento: il messaggio conta, perché su categories un insert falliva
-- già con 42501, ma per la RLS.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000271a01","role":"authenticated"}', true);
set local role authenticated;
select throws_ok('truncate public.foods', '42501', 'permission denied for table foods', 'authenticated non svuota foods');
select throws_ok(
  $$ insert into public.categories (name, name_it, icon, color, default_storage) values ('probe271', 'Sonda', 'x', '#000000', 'pantry') $$,
  '42501',
  'permission denied for table categories',
  'authenticated non scrive su categories'
);
reset role;

select * from finish();
rollback;
