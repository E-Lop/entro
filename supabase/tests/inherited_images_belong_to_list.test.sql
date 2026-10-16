-- Una foto ereditata da una lista è dei membri di quella lista (#228).
--
-- La foto sta nella cartella di chi l'ha caricata. Quando lui esce, la lista
-- la eredita (inherited_food_images, #152 #196 #226), ma le policy dello
-- Storage lasciavano ancora passare due clausole di cartella: «cartella mia»
-- per chi è uscito, e «cartella di un co-membro» per chi sta con lui nella
-- lista nuova. Tutti e due potevano leggere, sostituire e cancellare una foto
-- che non era più loro, e chi restava la perdeva.
--   1. B, tolta con remove_list_member(), non legge, non sostituisce e non
--      cancella la foto ereditata; A la legge ancora;
--   2. una foto di B che nessuna lista ha ereditato resta sua;
--   3. C, nuova co-membro di B, non arriva alla foto ereditata da L1, e
--      continua ad arrivare alle altre foto di B;
--   4. B, rientrata in L1, rilegge la foto;
--   5. lo stesso con leave_list();
--   6. i permessi della funzione nuova.
-- Ogni lettura e scrittura passa dal ruolo authenticated con la sessione
-- dell'utente: service_role salterebbe la RLS e non proverebbe niente.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

-- A crea L1 e B ci entra. C sta da sola in L2.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000228a01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a228@example.test', '{"full_name":"Anna Arancio"}', now(), now()),
  ('00000000-0000-0000-0000-000000228b01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b228@example.test', '{"full_name":"Bruno Bianchi"}', now(), now()),
  ('00000000-0000-0000-0000-000000228c01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c228@example.test', '{"full_name":"Carla Corallo"}', now(), now());

delete from public.lists l using public.list_members lm
  where l.id = lm.list_id and lm.user_id = '00000000-0000-0000-0000-000000228b01';
insert into public.list_members (list_id, user_id)
select lm.list_id, '00000000-0000-0000-0000-000000228b01'
from public.list_members lm
where lm.user_id = '00000000-0000-0000-0000-000000228a01';

create temp table l1 as
  select list_id from public.list_members where user_id = '00000000-0000-0000-0000-000000228a01';
grant select on l1 to authenticated;

-- In L1 due alimenti di B con la foto nella sua cartella: il burro serve alla
-- rimozione, il pane all'uscita. La terza foto di B non la usa nessun
-- alimento, e nessuna lista la eredita.
insert into public.foods (user_id, list_id, name, expiry_date, category_id, storage_location, quantity, image_url)
select '00000000-0000-0000-0000-000000228b01', (select list_id from l1), v.name, current_date + 5,
       (select id from public.categories order by 1 limit 1), 'fridge', 1, v.image_url
from (values
  ('Burro di B', '00000000-0000-0000-0000-000000228b01/burro.jpg'),
  ('Pane di B', '00000000-0000-0000-0000-000000228b01/pane.jpg')
) v(name, image_url);
insert into storage.objects (bucket_id, name) values
  ('food-images', '00000000-0000-0000-0000-000000228b01/burro.jpg'),
  ('food-images', '00000000-0000-0000-0000-000000228b01/pane.jpg'),
  ('food-images', '00000000-0000-0000-0000-000000228b01/privata.jpg');

-- Un invito di C alla sua lista. Quello di A per il rientro di B si crea dopo
-- la rimozione, che revoca gli inviti attivi di L1.
insert into public.invites (list_id, token, created_by, expires_at, short_code, status)
select lm.list_id, 'tok-228-c', lm.user_id, now() + interval '7 days', 'T228CC', 'pending'
from public.list_members lm
where lm.user_id = '00000000-0000-0000-0000-000000228c01';

-- ─── 1. A toglie B ──────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000228a01","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$ select success, error_message from public.remove_list_member('00000000-0000-0000-0000-000000228b01') $$,
  $$ values (true, null::text) $$,
  'A toglie B da L1'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000228b01","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select count(*)::int from storage.objects where name = '00000000-0000-0000-0000-000000228b01/burro.jpg'),
  0,
  'chi è stata tolta non legge più la foto che L1 ha ereditato'
);
update storage.objects set metadata = '{"sostituita":"da B"}'
  where name = '00000000-0000-0000-0000-000000228b01/burro.jpg';
reset role;
-- La sostituzione si controlla prima del tentativo di cancellazione: su una
-- riga cancellata metadata sarebbe null comunque.
select is(
  (select metadata from storage.objects where name = '00000000-0000-0000-0000-000000228b01/burro.jpg'),
  null::jsonb,
  'chi è stata tolta non sostituisce la foto ereditata'
);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000228b01","role":"authenticated"}', true);
set local role authenticated;
delete from storage.objects where name = '00000000-0000-0000-0000-000000228b01/burro.jpg';
reset role;
select is(
  (select count(*)::int from storage.objects where name = '00000000-0000-0000-0000-000000228b01/burro.jpg'),
  1,
  'chi è stata tolta non cancella la foto ereditata'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000228a01","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select count(*)::int from storage.objects where name = '00000000-0000-0000-0000-000000228b01/burro.jpg'),
  1,
  'chi resta in L1 legge ancora la foto'
);
reset role;

insert into public.invites (list_id, token, created_by, expires_at, short_code, status)
select list_id, 'tok-228-a', '00000000-0000-0000-0000-000000228a01', now() + interval '7 days', 'T228AA', 'pending'
from l1;

-- ─── 2. La foto che nessuna lista ha ereditato resta di B ───────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000228b01","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select count(*)::int from storage.objects where name = '00000000-0000-0000-0000-000000228b01/privata.jpg'),
  1,
  'B legge ancora una sua foto che nessuna lista ha ereditato'
);
update storage.objects set metadata = '{"sostituita":"da B"}'
  where name = '00000000-0000-0000-0000-000000228b01/privata.jpg';
reset role;
select is(
  (select metadata->>'sostituita' from storage.objects where name = '00000000-0000-0000-0000-000000228b01/privata.jpg'),
  'da B',
  'B sostituisce ancora una sua foto che nessuna lista ha ereditato'
);

-- ─── 3. B entra nella lista di C ────────────────────────────────────────────
-- La foto si rimette com'era: senza la correzione B l'ha già cancellata, e le
-- prove su C passerebbero su una riga che non c'è.
insert into storage.objects (bucket_id, name)
  values ('food-images', '00000000-0000-0000-0000-000000228b01/burro.jpg')
  on conflict do nothing;
update storage.objects set metadata = null
  where name = '00000000-0000-0000-0000-000000228b01/burro.jpg';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000228b01","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$ select success from public.join_list_via_invite('T228CC', true) $$,
  $$ values (true) $$,
  'B entra nella lista di C'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000228c01","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select count(*)::int from storage.objects where name = '00000000-0000-0000-0000-000000228b01/burro.jpg'),
  0,
  'la nuova co-membro di B non legge la foto che L1 ha ereditato'
);
select is(
  (select count(*)::int from storage.objects where name = '00000000-0000-0000-0000-000000228b01/privata.jpg'),
  1,
  'la nuova co-membro di B legge le altre foto di B, come ogni co-membro'
);
update storage.objects set metadata = '{"sostituita":"da C"}'
  where name = '00000000-0000-0000-0000-000000228b01/burro.jpg';
reset role;
select is(
  (select metadata from storage.objects where name = '00000000-0000-0000-0000-000000228b01/burro.jpg'),
  null::jsonb,
  'la nuova co-membro di B non sostituisce la foto ereditata da L1'
);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000228c01","role":"authenticated"}', true);
set local role authenticated;
delete from storage.objects where name = '00000000-0000-0000-0000-000000228b01/burro.jpg';
reset role;
select is(
  (select count(*)::int from storage.objects where name = '00000000-0000-0000-0000-000000228b01/burro.jpg'),
  1,
  'la nuova co-membro di B non cancella la foto ereditata da L1'
);

-- ─── 4. B rientra in L1 ─────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000228b01","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$ select success from public.join_list_via_invite('T228AA', true) $$,
  $$ values (true) $$,
  'B rientra in L1'
);
select is(
  (select count(*)::int from storage.objects where name = '00000000-0000-0000-0000-000000228b01/burro.jpg'),
  1,
  'rientrata, B rilegge la foto come ogni membro di L1'
);

-- ─── 5. B esce da L1 con leave_list() ───────────────────────────────────────
select results_eq(
  $$ select success, error_message from public.leave_list() $$,
  $$ values (true, null::text) $$,
  'B esce da L1'
);
select is(
  (select count(*)::int from storage.objects
   where name in ('00000000-0000-0000-0000-000000228b01/burro.jpg', '00000000-0000-0000-0000-000000228b01/pane.jpg')),
  0,
  'uscita con leave_list(), B non legge più le foto che L1 ha ereditato'
);
delete from storage.objects where name = '00000000-0000-0000-0000-000000228b01/pane.jpg';
delete from storage.objects where name = '00000000-0000-0000-0000-000000228b01/privata.jpg';
reset role;
select is(
  (select count(*)::int from storage.objects where name = '00000000-0000-0000-0000-000000228b01/pane.jpg'),
  1,
  'uscita con leave_list(), B non cancella la foto ereditata'
);
select is(
  (select count(*)::int from storage.objects where name = '00000000-0000-0000-0000-000000228b01/privata.jpg'),
  0,
  'B cancella ancora una sua foto che nessuna lista ha ereditato'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000228a01","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select count(*)::int from storage.objects
   where name in ('00000000-0000-0000-0000-000000228b01/burro.jpg', '00000000-0000-0000-0000-000000228b01/pane.jpg')),
  2,
  'chi resta in L1 legge tutte e due le foto'
);
reset role;

-- ─── 6. Permessi ────────────────────────────────────────────────────────────
select ok(
  has_function_privilege('authenticated', 'public.inherited_by_another_list(text)', 'execute')
    and not has_function_privilege('anon', 'public.inherited_by_another_list(text)', 'execute'),
  'inherited_by_another_list la esegue authenticated e non anon'
);

select * from finish();
rollback;
