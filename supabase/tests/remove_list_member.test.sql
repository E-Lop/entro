-- Chi ha creato una lista condivisa può togliere un membro (#196).
--   1. permessi: chi esegue cosa;
--   2. chi può togliere: il creatore, non un membro qualunque; nessuno toglie
--      sé stesso né chi sta in un'altra lista;
--   3. dopo la rimozione: la persona tolta ha una lista sola, sua e vuota; i
--      suoi alimenti e le loro foto restano a chi resta; gli inviti attivi non
--      fanno più entrare; lei non legge più né alimenti né foto degli altri;
--   4. l'avviso: lo legge e lo cancella solo chi è stato tolto;
--   5. lista senza il suo creatore: toglie il membro entrato da più tempo.
begin;
create extension if not exists pgtap with schema extensions;
select plan(37);

-- A crea la lista; B, C ed E ci entrano; D resta nella sua.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000196a01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a196@example.test', '{"full_name":"Anna Arancio"}', now(), now()),
  ('00000000-0000-0000-0000-000000196b01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b196@example.test', '{"full_name":"Bruno Bianchi"}', now(), now()),
  ('00000000-0000-0000-0000-000000196c01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c196@example.test', '{"full_name":"  "}', now(), now()),
  ('00000000-0000-0000-0000-000000196d01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd196@example.test', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000196e01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e196@example.test', '{"full_name":"Elena Ebano"}', now(), now());

delete from public.lists l using public.list_members lm
  where l.id = lm.list_id
    and lm.user_id in ('00000000-0000-0000-0000-000000196b01', '00000000-0000-0000-0000-000000196c01', '00000000-0000-0000-0000-000000196e01');
insert into public.list_members (list_id, user_id, joined_at)
select lm.list_id, u.id, u.joined_at
from public.list_members lm
cross join (values
  ('00000000-0000-0000-0000-000000196b01'::uuid, '2026-02-01'::timestamptz),
  ('00000000-0000-0000-0000-000000196c01'::uuid, '2026-03-01'::timestamptz),
  ('00000000-0000-0000-0000-000000196e01'::uuid, '2026-04-01'::timestamptz)
) u(id, joined_at)
where lm.user_id = '00000000-0000-0000-0000-000000196a01';

create temp table shared as
  select list_id from public.list_members where user_id = '00000000-0000-0000-0000-000000196a01';
grant select on shared to authenticated;

-- Un alimento di A e uno di B, ciascuno con la foto nella cartella di chi
-- l'ha caricata.
insert into public.foods (id, user_id, list_id, name, expiry_date, category_id, storage_location, quantity, image_url)
select v.id, v.user_id, (select list_id from shared), v.name, current_date + 5,
       (select id from public.categories order by 1 limit 1), 'fridge', 1, v.image_url
from (values
  ('00000000-0000-0000-0000-00000196f0a1'::uuid, '00000000-0000-0000-0000-000000196a01'::uuid, 'Latte di A', '00000000-0000-0000-0000-000000196a01/latte.jpg'),
  ('00000000-0000-0000-0000-00000196f0b1'::uuid, '00000000-0000-0000-0000-000000196b01'::uuid, 'Burro di B', '00000000-0000-0000-0000-000000196b01/burro.jpg')
) v(id, user_id, name, image_url);
insert into storage.objects (bucket_id, name) values
  ('food-images', '00000000-0000-0000-0000-000000196a01/latte.jpg'),
  ('food-images', '00000000-0000-0000-0000-000000196b01/burro.jpg');

-- Due inviti attivi sulla lista, di A e di C, e uno già accettato.
insert into public.invites (list_id, token, created_by, expires_at, short_code, status)
select (select list_id from shared), v.token, v.created_by, now() + interval '7 days', v.short_code, v.status
from (values
  ('tok-196-a', '00000000-0000-0000-0000-000000196a01'::uuid, 'T196AA', 'pending'),
  ('tok-196-c', '00000000-0000-0000-0000-000000196c01'::uuid, 'T196CC', 'pending'),
  ('tok-196-x', '00000000-0000-0000-0000-000000196a01'::uuid, 'T196XX', 'accepted')
) v(token, created_by, short_code, status);

-- ─── 1. Permessi ────────────────────────────────────────────────────────────
select ok(
  has_function_privilege('authenticated', 'public.remove_list_member(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.list_members_for_removal()', 'execute'),
  'authenticated esegue remove_list_member e list_members_for_removal'
);
select ok(
  not has_function_privilege('anon', 'public.remove_list_member(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.list_members_for_removal()', 'execute'),
  'anon non esegue nessuna delle due'
);
select ok(
  not has_function_privilege('authenticated', 'public.list_remover(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.list_remover(uuid)', 'execute'),
  'list_remover non è chiamabile dai client'
);
select is(
  (select count(*)::int from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('list_remover', 'remove_list_member', 'list_members_for_removal')
     and p.proconfig = array['search_path=""']),
  3,
  'le tre funzioni hanno il search_path vuoto'
);

-- ─── 2. Chi può togliere ────────────────────────────────────────────────────
-- B è un membro qualunque.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000196b01","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$ select success, error_message from public.remove_list_member('00000000-0000-0000-0000-000000196c01') $$,
  $$ values (false, 'not_authorized'::text) $$,
  'un membro qualunque non toglie un altro membro'
);
select is_empty(
  $$ select * from public.list_members_for_removal() $$,
  'a un membro qualunque l''elenco dei membri non risponde'
);
select throws_ok(
  $$ insert into public.list_removal_notices (user_id) values ('00000000-0000-0000-0000-000000196c01') $$,
  '42501',
  null,
  'un client non scrive un avviso di rimozione'
);
reset role;
select is(
  (select count(*)::int from public.list_members where list_id = (select list_id from shared)),
  4,
  'dopo il rifiuto i membri sono ancora quattro'
);

-- A è il creatore.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000196a01","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$ select success, error_message from public.remove_list_member('00000000-0000-0000-0000-000000196a01') $$,
  $$ values (false, 'cannot_remove_self'::text) $$,
  'nessuno toglie sé stesso'
);
select results_eq(
  $$ select success, error_message from public.remove_list_member('00000000-0000-0000-0000-000000196d01') $$,
  $$ values (false, 'not_a_member'::text) $$,
  'nessuno toglie chi sta in un''altra lista'
);
select results_eq(
  $$ select user_id, display_name from public.list_members_for_removal() $$,
  $$ values ('00000000-0000-0000-0000-000000196b01'::uuid, 'Bruno Bianchi'::text),
            ('00000000-0000-0000-0000-000000196c01'::uuid, 'c196@example.test'::text),
            ('00000000-0000-0000-0000-000000196e01'::uuid, 'Elena Ebano'::text) $$,
  'il creatore vede gli altri membri, dal più vecchio: nome completo, o email se il nome manca'
);

-- ─── 3. A toglie B ──────────────────────────────────────────────────────────
select results_eq(
  $$ select success, error_message from public.remove_list_member('00000000-0000-0000-0000-000000196b01') $$,
  $$ values (true, null::text) $$,
  'il creatore toglie un membro'
);
-- Chi resta vede ancora la foto dell'alimento di B.
select is(
  (select count(*)::int from storage.objects where name = '00000000-0000-0000-0000-000000196b01/burro.jpg'),
  1,
  'chi resta legge ancora la foto dell''alimento di chi è stato tolto'
);
reset role;

select results_eq(
  $$ select count(*)::int, count(*) filter (where lm.list_id = (select list_id from shared))::int
     from public.list_members lm where lm.user_id = '00000000-0000-0000-0000-000000196b01' $$,
  $$ values (1, 0) $$,
  'chi è stato tolto ha una riga sola, e non nella lista condivisa'
);
select results_eq(
  $$ select l.created_by, l.name, (select count(*)::int from public.foods f where f.list_id = l.id)
     from public.lists l join public.list_members lm on lm.list_id = l.id
     where lm.user_id = '00000000-0000-0000-0000-000000196b01' $$,
  $$ values ('00000000-0000-0000-0000-000000196b01'::uuid, 'Lista di Bruno Bianchi'::text, 0) $$,
  'la sua lista nuova è sua, e vuota'
);
select results_eq(
  $$ select list_id, user_id from public.foods where id = '00000000-0000-0000-0000-00000196f0b1' $$,
  $$ select list_id, '00000000-0000-0000-0000-000000196b01'::uuid from shared $$,
  'il suo alimento è ancora nella lista condivisa'
);
select results_eq(
  $$ select short_code::text, status from public.invites where list_id = (select list_id from shared) order by 1 $$,
  $$ values ('T196XX'::text, 'accepted'::text) $$,
  'gli inviti attivi della lista sono spariti, di chiunque fossero; quello accettato resta'
);
select is(
  (select count(*)::int from public.list_members where list_id = (select list_id from shared)),
  3,
  'nella lista condivisa restano gli altri tre'
);

-- D prova a entrare con uno dei codici revocati.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000196d01","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$ select success from public.join_list_via_invite('T196CC', true) $$,
  $$ values (false) $$,
  'un invito revocato dalla rimozione non fa più entrare'
);
reset role;

-- B, tolto, non legge più niente della lista.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000196b01","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select count(*)::int from public.foods),
  0,
  'chi è stato tolto non legge più gli alimenti della lista, nemmeno il suo'
);
select is(
  (select count(*)::int from storage.objects where name = '00000000-0000-0000-0000-000000196a01/latte.jpg'),
  0,
  'chi è stato tolto non legge più le foto degli altri'
);
select is(
  (select count(*)::int from public.list_members where list_id = (select list_id from shared)),
  0,
  'chi è stato tolto non vede più i membri della lista'
);
select results_eq(
  $$ select success, error_message from public.remove_list_member('00000000-0000-0000-0000-000000196c01') $$,
  $$ values (false, 'not_a_member'::text) $$,
  'chi è stato tolto non toglie nessuno dalla lista di prima'
);

-- ─── 4. L'avviso ────────────────────────────────────────────────────────────
select results_eq(
  $$ select user_id, list_id from public.list_removal_notices $$,
  $$ select '00000000-0000-0000-0000-000000196b01'::uuid, list_id from shared $$,
  'chi è stato tolto trova il suo avviso, con la lista da cui è stato tolto'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000196c01","role":"authenticated"}', true);
set local role authenticated;
select is_empty(
  $$ select * from public.list_removal_notices $$,
  'un altro utente non legge l''avviso di B'
);
delete from public.list_removal_notices where user_id = '00000000-0000-0000-0000-000000196b01';
reset role;
select is(
  (select count(*)::int from public.list_removal_notices),
  1,
  'e non lo cancella'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000196b01","role":"authenticated"}', true);
set local role authenticated;
delete from public.list_removal_notices where user_id = '00000000-0000-0000-0000-000000196b01';
reset role;
select is(
  (select count(*)::int from public.list_removal_notices),
  0,
  'chi è stato tolto cancella il suo avviso, che così compare una volta sola'
);

-- Il rientro non è impedito: B torna con un invito nuovo ed è un membro come
-- gli altri. Poi A lo toglie di nuovo: l'avviso si riscrive, non si duplica.
insert into public.invites (list_id, token, created_by, expires_at, short_code)
select list_id, 'tok-196-b2', '00000000-0000-0000-0000-000000196a01', now() + interval '7 days', 'T196B2' from shared;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000196b01","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$ select success from public.join_list_via_invite('T196B2', true) $$,
  $$ values (true) $$,
  'chi è stato tolto rientra con un invito nuovo'
);
select is(
  (select count(*)::int from public.foods),
  2,
  'e rilegge gli alimenti della lista'
);
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000196a01","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$ select success from public.remove_list_member('00000000-0000-0000-0000-000000196b01') $$,
  $$ values (true) $$,
  'il creatore lo toglie una seconda volta'
);
reset role;
select is(
  (select count(*)::int from public.list_removal_notices where user_id = '00000000-0000-0000-0000-000000196b01'),
  1,
  'l''avviso è uno solo'
);

-- ─── 5. Lista senza il suo creatore ─────────────────────────────────────────
-- A esce con leave_list(): restano C (da marzo) ed E (da aprile).
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000196a01","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$ select success from public.leave_list() $$,
  $$ values (true) $$,
  'il creatore esce dalla sua lista'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000196e01","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$ select success, error_message from public.remove_list_member('00000000-0000-0000-0000-000000196c01') $$,
  $$ values (false, 'not_authorized'::text) $$,
  'senza il creatore, il membro più recente non toglie il più vecchio'
);
reset role;

-- La regola resta la stessa anche quando le date non decidono: una data che
-- manca vale come la più antica, e a parità decide l'id della riga.
update public.list_members set joined_at = null where user_id = '00000000-0000-0000-0000-000000196e01';
select is(
  public.list_remover((select list_id from shared)),
  '00000000-0000-0000-0000-000000196e01'::uuid,
  'una data d''ingresso che manca vale come la più antica'
);
update public.list_members set joined_at = '2026-03-01' where list_id = (select list_id from shared);
select is(
  public.list_remover((select list_id from shared)),
  (select user_id from public.list_members where list_id = (select list_id from shared) order by id limit 1),
  'a parità di data decide l''id della riga'
);
update public.list_members set joined_at = '2026-04-01' where user_id = '00000000-0000-0000-0000-000000196e01';

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000196c01","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$ select success, error_message from public.remove_list_member('00000000-0000-0000-0000-000000196e01') $$,
  $$ values (true, null::text) $$,
  'senza il creatore, toglie il membro entrato da più tempo'
);
reset role;

-- Se il creatore rientra, il compito torna a lui.
delete from public.lists l using public.list_members lm
  where l.id = lm.list_id and lm.user_id = '00000000-0000-0000-0000-000000196a01';
insert into public.list_members (list_id, user_id) select list_id, '00000000-0000-0000-0000-000000196a01' from shared;
select is(
  public.list_remover((select list_id from shared)),
  '00000000-0000-0000-0000-000000196a01'::uuid,
  'se il creatore rientra, torna a togliere lui'
);

select * from finish();
rollback;
