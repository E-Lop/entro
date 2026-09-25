-- Chi si registra con un codice invito valido nasce nella lista di chi l'ha
-- invitato, e senza una lista propria (#165).
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

-- Chi invita: il trigger gli dà la sua lista.
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values ('00000000-0000-0000-0000-000000165000', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner165@example.test', now(), now());

-- Tre inviti con codice sulla sua lista: valido, scaduto, già accettato.
insert into public.invites (list_id, token, created_by, expires_at, short_code, status, created_at)
select lm.list_id, t.token, lm.user_id, t.expires_at, t.code, t.status, t.created_at
from public.list_members lm
cross join (values
  ('tok-165-ok',  now() + interval '1 day', 'OK165A', 'pending',  now()),
  ('tok-165-exp', now() - interval '1 day', 'EX165A', 'pending',  now() - interval '2 days'),
  ('tok-165-acc', now() + interval '1 day', 'AC165A', 'accepted', now())
) as t(token, expires_at, code, status, created_at)
where lm.user_id = '00000000-0000-0000-0000-000000165000';

-- 1. Codice valido, scritto in minuscolo come può arrivare dall'URL.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000165001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ok165@example.test',
        '{"full_name":"Ok","invite_code":"ok165a"}', now(), now());
select is(
  (select count(*)::int from public.list_members lm join public.invites i on i.list_id = lm.list_id
   where lm.user_id = '00000000-0000-0000-0000-000000165001' and i.short_code = 'OK165A'),
  1, 'con un codice valido si nasce nella lista di chi ha invitato');
select is(
  (select count(*)::int from public.list_members where user_id = '00000000-0000-0000-0000-000000165001'),
  1, 'e in nessun''altra lista');
select is(
  (select count(*)::int from public.lists where created_by = '00000000-0000-0000-0000-000000165001'),
  0, 'nessuna lista propria');
select is(
  (select status from public.invites where short_code = 'OK165A'),
  'accepted', 'l''invito risulta accettato');
select ok(
  (select accepted_at is not null from public.invites where short_code = 'OK165A'),
  'con la data di accettazione');

-- 2. Codice scaduto, già accettato, inesistente, assente: la lista propria.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000165002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'exp165@example.test', '{"full_name":"Exp","invite_code":"EX165A"}', now(), now()),
  ('00000000-0000-0000-0000-000000165003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'acc165@example.test', '{"full_name":"Acc","invite_code":"AC165A"}', now(), now()),
  ('00000000-0000-0000-0000-000000165004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'none165@example.test', '{"full_name":"None","invite_code":"ZZZZZZ"}', now(), now()),
  ('00000000-0000-0000-0000-000000165005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'plain165@example.test', '{"full_name":"Plain"}', now(), now());

select is(
  (select count(*)::int from public.lists where created_by = '00000000-0000-0000-0000-000000165002'),
  1, 'con un codice scaduto si nasce con la lista propria');
select is(
  (select count(*)::int from public.lists where created_by = '00000000-0000-0000-0000-000000165003'),
  1, 'con un codice già accettato si nasce con la lista propria');
select is(
  (select count(*)::int from public.lists where created_by = '00000000-0000-0000-0000-000000165004'),
  1, 'con un codice inesistente si nasce con la lista propria');
select is(
  (select count(*)::int from public.lists where created_by = '00000000-0000-0000-0000-000000165005'),
  1, 'senza codice si nasce con la lista propria');
select is(
  (select status from public.invites where short_code = 'EX165A'),
  'pending', 'un codice scaduto non viene toccato');

select * from finish();
rollback;
