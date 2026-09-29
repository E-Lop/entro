-- Seconda metà della #184: authenticated non cancella più righe di
-- list_members. Si esce da una lista solo con leave_list(), che toglie la riga
-- e crea la lista personale nella stessa transazione. Con il DELETE diretto un
-- utente poteva uscire dalla propria lista personale e lasciarla orfana.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

-- A e B. Il trigger on_auth_user_created dà a ciascuno una lista; B entra in
-- quella di A.
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000184f01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a184c@example.test', now(), now()),
  ('00000000-0000-0000-0000-000000184f02', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b184c@example.test', now(), now());
delete from public.lists l using public.list_members lm
  where l.id = lm.list_id and lm.user_id = '00000000-0000-0000-0000-000000184f02';
insert into public.list_members (list_id, user_id)
select lm.list_id, '00000000-0000-0000-0000-000000184f02'
from public.list_members lm where lm.user_id = '00000000-0000-0000-0000-000000184f01';

select ok(
  not has_table_privilege('authenticated', 'public.list_members', 'delete'),
  'authenticated non ha DELETE su list_members'
);
select is(
  (select count(*)::int from pg_policies
   where schemaname = 'public' and tablename = 'list_members' and cmd = 'DELETE'),
  0,
  'list_members non ha policy di DELETE'
);

-- A prova a uscire dalla sua lista cancellando la propria riga.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000184f01","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ delete from public.list_members where user_id = '00000000-0000-0000-0000-000000184f01' $$,
  '42501',
  null,
  'la cancellazione diretta della propria riga di list_members è rifiutata'
);
reset role;
select is(
  (select count(*)::int from public.list_members where user_id = '00000000-0000-0000-0000-000000184f01'),
  1,
  'A è ancora nella sua lista'
);

-- B esce come fanno i client, con leave_list().
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000184f02","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$ select success, error_message from public.leave_list() $$,
  $$ values (true, null::text) $$,
  'leave_list funziona senza il DELETE diretto'
);
reset role;
select is(
  (select count(*)::int from public.list_members lm join public.lists l on l.id = lm.list_id
   where lm.user_id = '00000000-0000-0000-0000-000000184f02' and l.created_by = '00000000-0000-0000-0000-000000184f02'),
  1,
  'B è in una lista sola, la sua'
);

select * from finish();
rollback;
