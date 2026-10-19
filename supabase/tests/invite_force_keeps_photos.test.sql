-- Chi accetta un invito confermando di lasciare una lista condivisa non fa
-- perdere le foto dei suoi alimenti a chi resta (#236).
--
-- È il quarto modo di uscire da una lista. Gli altri tre, la cancellazione
-- dell'account (#152), remove_list_member() (#196) e leave_list() (#226),
-- segnano le foto degli alimenti che restano in inherited_food_images; il ramo
-- con conferma di join_list_via_invite() no. Senza il segno valgono le
-- clausole di cartella dello Storage (#228): chi resta perde la foto, e chi è
-- uscito e la sua nuova co-membro la leggono, la sostituiscono e la cancellano.
--   1. prima dell'uscita A legge la foto di B;
--   2. un'accettazione senza conferma non segna niente;
--   3. B accetta l'invito di C con conferma: A legge ancora alimento e foto;
--   4. B e C non leggono, non sostituiscono e non cancellano quella foto;
--   5. si segna solo la foto di B, e solo nella lista che lascia;
--   6. chi era l'unico membro cancella la lista, e non resta niente di segnato;
--   7. i permessi della funzione.
-- Ogni lettura e scrittura passa dal ruolo authenticated con la sessione
-- dell'utente: service_role salterebbe la RLS e non proverebbe niente.
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

-- Le DELETE dirette su storage.objects passano solo con questa impostazione,
-- come fa l'API dello Storage: il perché in inherited_images_belong_to_list.
select set_config('storage.allow_delete_query', 'true', true);

-- A crea L1 e B ci entra. C sta da sola in L2, D da sola in L3.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000236a01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a236@example.test', '{"full_name":"Anna Arancio"}', now(), now()),
  ('00000000-0000-0000-0000-000000236b01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b236@example.test', '{"full_name":"Bruno Bianchi"}', now(), now()),
  ('00000000-0000-0000-0000-000000236c01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c236@example.test', '{"full_name":"Carla Corallo"}', now(), now()),
  ('00000000-0000-0000-0000-000000236d01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd236@example.test', '{"full_name":"Dario Dattero"}', now(), now());

delete from public.lists l using public.list_members lm
  where l.id = lm.list_id and lm.user_id = '00000000-0000-0000-0000-000000236b01';
insert into public.list_members (list_id, user_id)
select lm.list_id, '00000000-0000-0000-0000-000000236b01'
from public.list_members lm
where lm.user_id = '00000000-0000-0000-0000-000000236a01';

create temp table lists236 as
  select
    (select list_id from public.list_members where user_id = '00000000-0000-0000-0000-000000236a01') as l1,
    (select list_id from public.list_members where user_id = '00000000-0000-0000-0000-000000236c01') as l2,
    (select list_id from public.list_members where user_id = '00000000-0000-0000-0000-000000236d01') as l3;
grant select on lists236 to authenticated;

-- In L1 un alimento di A e uno di B con la foto nella cartella di chi l'ha
-- caricata, e uno di B senza foto. In L2 un alimento di C la cui foto sta
-- nella cartella di B: non è della lista che B lascia, e non va segnato. In
-- L3 un alimento di D con la sua foto.
insert into public.foods (id, user_id, list_id, name, expiry_date, category_id, storage_location, quantity, image_url)
select v.id, v.user_id, v.list_id, v.name, current_date + 5,
       (select id from public.categories order by 1 limit 1), 'fridge', 1, v.image_url
from (values
  ('00000000-0000-0000-0000-00000236f0a1'::uuid, '00000000-0000-0000-0000-000000236a01'::uuid, (select l1 from lists236), 'Latte di A', '00000000-0000-0000-0000-000000236a01/latte.jpg'),
  ('00000000-0000-0000-0000-00000236f0b1'::uuid, '00000000-0000-0000-0000-000000236b01'::uuid, (select l1 from lists236), 'Burro di B', '00000000-0000-0000-0000-000000236b01/burro.jpg'),
  ('00000000-0000-0000-0000-00000236f0b2'::uuid, '00000000-0000-0000-0000-000000236b01'::uuid, (select l1 from lists236), 'Uova di B', null),
  ('00000000-0000-0000-0000-00000236f0c1'::uuid, '00000000-0000-0000-0000-000000236c01'::uuid, (select l2 from lists236), 'Pane di C', '00000000-0000-0000-0000-000000236b01/pane.jpg'),
  ('00000000-0000-0000-0000-00000236f0d1'::uuid, '00000000-0000-0000-0000-000000236d01'::uuid, (select l3 from lists236), 'Miele di D', '00000000-0000-0000-0000-000000236d01/miele.jpg')
) v(id, user_id, list_id, name, image_url);
insert into storage.objects (bucket_id, name) values
  ('food-images', '00000000-0000-0000-0000-000000236a01/latte.jpg'),
  ('food-images', '00000000-0000-0000-0000-000000236b01/burro.jpg'),
  ('food-images', '00000000-0000-0000-0000-000000236b01/pane.jpg'),
  ('food-images', '00000000-0000-0000-0000-000000236d01/miele.jpg');

-- Due inviti di C in L2: uno per B, uno per D. Un invito accettato non vale
-- una seconda volta.
insert into public.invites (list_id, token, created_by, expires_at, short_code, status)
select v.list_id, v.token, '00000000-0000-0000-0000-000000236c01', now() + interval '7 days', v.short_code, 'pending'
from (values
  ((select l2 from lists236), 'tok-236-b', 'T236BB'),
  ((select l2 from lists236), 'tok-236-d', 'T236DD')
) v(list_id, token, short_code);

-- ─── 1. Prima dell'uscita ───────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000236a01","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select count(*)::int from storage.objects where name = '00000000-0000-0000-0000-000000236b01/burro.jpg'),
  1,
  'prima dell''uscita A legge la foto dell''alimento di B'
);
reset role;

-- ─── 2. Senza conferma ──────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000236b01","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$ select success, requires_confirmation from public.join_list_via_invite('T236BB') $$,
  $$ values (false, true) $$,
  'senza conferma l''invito chiede la conferma'
);
reset role;
select is(
  (select count(*)::int from public.inherited_food_images where object_name like '00000000-0000-0000-0000-000000236%'),
  0,
  'un''accettazione senza conferma non segna niente'
);

-- ─── 3. B accetta con conferma ──────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000236b01","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$ select success, list_id from public.join_list_via_invite('T236BB', true) $$,
  $$ select true, l2 from lists236 $$,
  'B accetta l''invito di C confermando di lasciare L1'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000236a01","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select count(*)::int from public.foods where id = '00000000-0000-0000-0000-00000236f0b1'),
  1,
  'chi resta legge ancora l''alimento di chi è uscito'
);
select is(
  (select count(*)::int from storage.objects where name = '00000000-0000-0000-0000-000000236b01/burro.jpg'),
  1,
  'chi resta legge ancora la foto dell''alimento di chi è uscito'
);
reset role;

-- ─── 4. Chi è uscito e la sua nuova co-membro ───────────────────────────────
-- Ogni tentativo si prova da solo: dopo ognuno la foto torna com'era, così
-- una scrittura riuscita di B non fa passare per buona quella di C.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000236b01","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select count(*)::int from storage.objects where name = '00000000-0000-0000-0000-000000236b01/burro.jpg'),
  0,
  'chi è uscito non legge la foto che L1 ha ereditato'
);
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000236c01","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select count(*)::int from storage.objects where name = '00000000-0000-0000-0000-000000236b01/burro.jpg'),
  0,
  'la nuova co-membro di B non legge la foto che L1 ha ereditato'
);
select is(
  (select count(*)::int from storage.objects where name = '00000000-0000-0000-0000-000000236b01/pane.jpg'),
  1,
  'la nuova co-membro di B legge le altre foto di B, come ogni co-membro'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000236b01","role":"authenticated"}', true);
set local role authenticated;
update storage.objects set metadata = '{"sostituita":"da B"}' where name = '00000000-0000-0000-0000-000000236b01/burro.jpg';
reset role;
select is(
  (select metadata from storage.objects where name = '00000000-0000-0000-0000-000000236b01/burro.jpg'),
  null::jsonb,
  'chi è uscito non sostituisce la foto che L1 ha ereditato'
);
update storage.objects set metadata = null where name = '00000000-0000-0000-0000-000000236b01/burro.jpg';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000236c01","role":"authenticated"}', true);
set local role authenticated;
update storage.objects set metadata = '{"sostituita":"da C"}' where name = '00000000-0000-0000-0000-000000236b01/burro.jpg';
reset role;
select is(
  (select metadata from storage.objects where name = '00000000-0000-0000-0000-000000236b01/burro.jpg'),
  null::jsonb,
  'la nuova co-membro di B non sostituisce la foto che L1 ha ereditato'
);
update storage.objects set metadata = null where name = '00000000-0000-0000-0000-000000236b01/burro.jpg';

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000236b01","role":"authenticated"}', true);
set local role authenticated;
delete from storage.objects where name = '00000000-0000-0000-0000-000000236b01/burro.jpg';
reset role;
select is(
  (select count(*)::int from storage.objects where name = '00000000-0000-0000-0000-000000236b01/burro.jpg'),
  1,
  'chi è uscito non cancella la foto che L1 ha ereditato'
);
insert into storage.objects (bucket_id, name) values ('food-images', '00000000-0000-0000-0000-000000236b01/burro.jpg') on conflict do nothing;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000236c01","role":"authenticated"}', true);
set local role authenticated;
delete from storage.objects where name = '00000000-0000-0000-0000-000000236b01/burro.jpg';
reset role;
select is(
  (select count(*)::int from storage.objects where name = '00000000-0000-0000-0000-000000236b01/burro.jpg'),
  1,
  'la nuova co-membro di B non cancella la foto che L1 ha ereditato'
);
insert into storage.objects (bucket_id, name) values ('food-images', '00000000-0000-0000-0000-000000236b01/burro.jpg') on conflict do nothing;

-- ─── 5. Cosa si segna ───────────────────────────────────────────────────────
select results_eq(
  $$ select object_name, list_id from public.inherited_food_images
     where object_name like '00000000-0000-0000-0000-000000236%' order by 1 $$,
  $$ select '00000000-0000-0000-0000-000000236b01/burro.jpg'::text, l1 from lists236 $$,
  'si segna solo la foto di chi esce, nella lista che lascia'
);

-- ─── 6. L'unico membro ──────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000236d01","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$ select success from public.join_list_via_invite('T236DD', true) $$,
  $$ values (true) $$,
  'D, unico membro di L3, accetta l''invito di C con conferma'
);
reset role;
select is(
  (select count(*)::int from public.lists where id = (select l3 from lists236)),
  0,
  'la lista di chi era l''unico membro si cancella, come prima'
);
select is(
  (select count(*)::int from public.inherited_food_images where object_name like '00000000-0000-0000-0000-000000236d01/%'),
  0,
  'chi era l''unico membro non lascia niente di segnato'
);

-- ─── 7. Permessi ────────────────────────────────────────────────────────────
select ok(
  has_function_privilege('authenticated', 'public.join_list_via_invite(text, boolean)', 'execute')
    and not has_function_privilege('anon', 'public.join_list_via_invite(text, boolean)', 'execute'),
  'join_list_via_invite() la esegue authenticated e non anon'
);

select * from finish();
rollback;
