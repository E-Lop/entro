-- Chi esce da una lista condivisa con leave_list() non fa perdere le foto dei
-- suoi alimenti a chi resta (#226).
--
-- La foto sta nella cartella di chi l'ha caricata, e gli altri membri la
-- leggono solo finché lui è nella lista (get_shared_list_member_ids). Gli
-- altri due percorsi di uscita, la cancellazione dell'account (#152) e
-- remove_list_member() (#196), segnano già le foto degli alimenti che restano
-- in inherited_food_images. Qui si prova che leave_list() fa lo stesso:
--   1. prima dell'uscita A legge la foto di B;
--   2. B esce: A legge ancora l'alimento e la foto, B non legge più la lista;
--   3. si segnano solo le foto di chi esce, e solo quelle della sua lista.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

-- A crea la lista e B ci entra. C sta in un'altra lista.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000226a01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a226@example.test', '{"full_name":"Anna Arancio"}', now(), now()),
  ('00000000-0000-0000-0000-000000226b01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b226@example.test', '{"full_name":"Bruno Bianchi"}', now(), now()),
  ('00000000-0000-0000-0000-000000226c01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c226@example.test', '{"full_name":"Carla Corallo"}', now(), now());

delete from public.lists l using public.list_members lm
  where l.id = lm.list_id and lm.user_id = '00000000-0000-0000-0000-000000226b01';
insert into public.list_members (list_id, user_id)
select lm.list_id, '00000000-0000-0000-0000-000000226b01'
from public.list_members lm
where lm.user_id = '00000000-0000-0000-0000-000000226a01';

create temp table shared as
  select list_id from public.list_members where user_id = '00000000-0000-0000-0000-000000226a01';
grant select on shared to authenticated;

-- Nella lista condivisa: un alimento di A e uno di B con la foto nella
-- cartella di chi l'ha caricata, e uno di B senza foto. Nella lista di C, un
-- alimento la cui foto sta nella cartella di B: non è della lista che B lascia,
-- e non va segnato.
insert into public.foods (id, user_id, list_id, name, expiry_date, category_id, storage_location, quantity, image_url)
select v.id, v.user_id, v.list_id, v.name, current_date + 5,
       (select id from public.categories order by 1 limit 1), 'fridge', 1, v.image_url
from (values
  ('00000000-0000-0000-0000-00000226f0a1'::uuid, '00000000-0000-0000-0000-000000226a01'::uuid, (select list_id from shared), 'Latte di A', '00000000-0000-0000-0000-000000226a01/latte.jpg'),
  ('00000000-0000-0000-0000-00000226f0b1'::uuid, '00000000-0000-0000-0000-000000226b01'::uuid, (select list_id from shared), 'Burro di B', '00000000-0000-0000-0000-000000226b01/burro.jpg'),
  ('00000000-0000-0000-0000-00000226f0b2'::uuid, '00000000-0000-0000-0000-000000226b01'::uuid, (select list_id from shared), 'Uova di B', null),
  ('00000000-0000-0000-0000-00000226f0c1'::uuid, '00000000-0000-0000-0000-000000226c01'::uuid,
     (select list_id from public.list_members where user_id = '00000000-0000-0000-0000-000000226c01'), 'Pane di C', '00000000-0000-0000-0000-000000226b01/pane.jpg')
) v(id, user_id, list_id, name, image_url);
insert into storage.objects (bucket_id, name) values
  ('food-images', '00000000-0000-0000-0000-000000226a01/latte.jpg'),
  ('food-images', '00000000-0000-0000-0000-000000226b01/burro.jpg');

-- ─── 1. Prima dell'uscita ───────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000226a01","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select count(*)::int from storage.objects where name = '00000000-0000-0000-0000-000000226b01/burro.jpg'),
  1,
  'prima dell''uscita A legge la foto dell''alimento di B'
);
reset role;

-- ─── 2. B esce ──────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000226b01","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$ select success, error_message from public.leave_list() $$,
  $$ values (true, null::text) $$,
  'B esce dalla lista condivisa'
);
select is(
  (select count(*)::int from public.foods),
  0,
  'chi è uscito non legge più gli alimenti della lista, nemmeno i suoi'
);
select is(
  (select count(*)::int from storage.objects where name = '00000000-0000-0000-0000-000000226a01/latte.jpg'),
  0,
  'chi è uscito non legge più le foto degli altri'
);
select is(
  (select count(*)::int from public.list_members where list_id = (select list_id from shared)),
  0,
  'chi è uscito non vede più i membri della lista'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000226a01","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select count(*)::int from public.foods where id = '00000000-0000-0000-0000-00000226f0b1'),
  1,
  'chi resta legge ancora l''alimento di chi è uscito'
);
select is(
  (select count(*)::int from storage.objects where name = '00000000-0000-0000-0000-000000226b01/burro.jpg'),
  1,
  'chi resta legge ancora la foto dell''alimento di chi è uscito'
);
reset role;

-- ─── 3. Cosa si segna ───────────────────────────────────────────────────────
select results_eq(
  $$ select object_name, list_id from public.inherited_food_images
     where object_name like '00000000-0000-0000-0000-000000226%' order by 1 $$,
  $$ select '00000000-0000-0000-0000-000000226b01/burro.jpg'::text, list_id from shared $$,
  'si segna solo la foto di chi esce, nella lista che lascia'
);

-- Un'uscita che fallisce non segna niente: A, ora sola nella lista, non può
-- uscire.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000226a01","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$ select success, error_message from public.leave_list() $$,
  $$ values (false, 'only_member'::text) $$,
  'l''ultimo membro non esce'
);
reset role;
select is(
  (select count(*)::int from public.inherited_food_images where object_name = '00000000-0000-0000-0000-000000226a01/latte.jpg'),
  0,
  'un''uscita rifiutata non segna le foto di chi ci ha provato'
);

-- I permessi restano quelli di prima.
select ok(
  has_function_privilege('authenticated', 'public.leave_list()', 'execute')
    and not has_function_privilege('anon', 'public.leave_list()', 'execute'),
  'leave_list() la esegue authenticated e non anon'
);

select * from finish();
rollback;
