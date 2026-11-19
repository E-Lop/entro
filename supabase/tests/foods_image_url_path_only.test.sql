-- foods.image_url contiene solo un percorso d'archivio (#230).
--
-- La forma è `{uuid minuscolo}/{nome senza «/»}`: il primo segmento è la
-- cartella dell'utente che le policy di storage.objects leggono, il resto il
-- nome del file. Prima la colonna era `text` senza vincoli, e in una lista
-- condivisa ogni membro scrive le righe degli alimenti: un client poteva
-- leggere qualunque forma l'avesse scritta un altro.
--   1. un percorso conforme e null entrano;
--   2. URL interi, pending://, percorsi senza cartella o con una cartella che
--      non è un uuid minuscolo, nomi con «/» o vuoti, la stringa vuota non
--      entrano, né in insert né in update;
--   3. una modifica di un'altra colonna su una riga conforme passa;
--   4. la cancellazione dell'account di chi ha alimenti in una lista condivisa
--      riesce, e le righe restano con user_id null.
-- Si lavora come postgres: un CHECK vale per ogni ruolo, a differenza della
-- RLS, e qui non c'è una policy da provare. Ogni rifiuto si confronta col nome
-- del vincolo, così un altro errore non lo fa passare.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

select col_has_check('public', 'foods', 'image_url', 'image_url ha un CHECK');

-- A crea L1 e B ci entra.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000230a01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a230@example.test', '{"full_name":"Anna Arancio"}', now(), now()),
  ('00000000-0000-0000-0000-000000230b01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b230@example.test', '{"full_name":"Bruno Bianchi"}', now(), now());

delete from public.lists l using public.list_members lm
  where l.id = lm.list_id and lm.user_id = '00000000-0000-0000-0000-000000230b01';
insert into public.list_members (list_id, user_id)
select lm.list_id, '00000000-0000-0000-0000-000000230b01'
from public.list_members lm
where lm.user_id = '00000000-0000-0000-0000-000000230a01';

create temp table l1 as
  select list_id from public.list_members where user_id = '00000000-0000-0000-0000-000000230a01';

-- Un alimento di B in L1 con un valore dato: l'istruzione che le prove lanciano.
create function pg_temp.insert_food(image text) returns void language sql as $$
  insert into public.foods (user_id, list_id, name, expiry_date, category_id, storage_location, quantity, image_url)
  values ('00000000-0000-0000-0000-000000230b01', (select list_id from l1), 'Latte di B', current_date + 5,
          (select id from public.categories order by 1 limit 1), 'fridge', 1, image);
$$;

-- 1. Entrano.
select lives_ok(
  $$ select pg_temp.insert_food('00000000-0000-0000-0000-000000230b01/1763550000000-latte.jpg') $$,
  'un percorso {uuid}/{nome} entra'
);
select lives_ok($$ select pg_temp.insert_food(null) $$, 'un alimento senza foto entra');

-- 2. Non entrano.
select throws_ok(
  format($$ select pg_temp.insert_food(%L) $$, v.image),
  '23514',
  'new row for relation "foods" violates check constraint "foods_image_url_is_archive_path"',
  v.description
)
from (values
  ('https://rmbmmwcxtnanacxbkihc.supabase.co/storage/v1/object/sign/food-images/00000000-0000-0000-0000-000000230b01/latte.jpg?token=t',
   'un URL firmato del nostro bucket non entra'),
  ('https://rmbmmwcxtnanacxbkihc.supabase.co/storage/v1/object/public/food-images/00000000-0000-0000-0000-000000230b01/latte.jpg',
   'un URL pubblico del nostro bucket non entra'),
  ('pending://00000000-0000-0000-0000-000000230b01', 'un pending:// non entra'),
  ('latte.jpg', 'un nome senza cartella non entra'),
  ('utente/latte.jpg', 'una cartella che non è un uuid non entra'),
  ('00000000-0000-0000-0000-000000230B01/latte.jpg', 'una cartella con l''uuid maiuscolo non entra'),
  ('00000000-0000-0000-0000-000000230b01/foto/latte.jpg', 'un nome che contiene «/» non entra'),
  ('00000000-0000-0000-0000-000000230b01/', 'una cartella senza nome non entra'),
  ('', 'la stringa vuota non entra')
) v(image, description);

create temp table conforming as
  select id from public.foods
  where image_url = '00000000-0000-0000-0000-000000230b01/1763550000000-latte.jpg';

select throws_ok(
  $$ update public.foods set image_url = 'https://example.com/latte.jpg' where id = (select id from conforming) $$,
  '23514',
  'new row for relation "foods" violates check constraint "foods_image_url_is_archive_path"',
  'un update a un URL non passa'
);

-- 3. Le modifiche che restano nella forma passano.
select lives_ok(
  $$ update public.foods set quantity = 2 where id = (select id from conforming) $$,
  'una modifica di un''altra colonna su una riga conforme passa'
);
select lives_ok(
  $$ update public.foods set image_url = null where id = (select id from conforming) $$,
  'togliere la foto passa'
);

-- 4. La cancellazione dell'account riscrive user_id a null sulle righe di chi
-- se ne va: con righe conformi il vincolo non la ferma.
update public.foods
  set image_url = '00000000-0000-0000-0000-000000230b01/1763550000000-latte.jpg'
  where id = (select id from conforming);
select lives_ok(
  $$ delete from auth.users where id = '00000000-0000-0000-0000-000000230b01' $$,
  'la cancellazione dell''account di B riesce'
);
select ok(
  (select user_id is null and list_id = (select list_id from l1) from public.foods where id = (select id from conforming)),
  'l''alimento di B resta in L1, con user_id null'
);

select * from finish();
rollback;
