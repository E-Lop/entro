-- Chi riceve la notifica di scadenza, e con quali alimenti (#154).
--
-- L'invio è uno al giorno, raggruppato, alle 8:00 UTC: le ore silenziose lo
-- facevano saltare invece di rimandarlo, e il limite giornaliero con un invio
-- solo non limitava niente. Si tolgono tutti e due. Il resto della scelta
-- (intervalli, attivazione, alimenti attivi e non cancellati) resta com'era, e
-- i casi 3-5 lo tengono fermo.
--
-- now() è fisso per tutta la transazione, quindi "l'ora dell'invio" è l'ora in
-- cui gira il test: le ore silenziose del caso 1 si costruiscono attorno a lei.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

-- Cinque utenti; il trigger on_auth_user_created dà a ciascuno una lista.
--   q: ore silenziose che coprono l'ora dell'invio
--   l: limite giornaliero già raggiunto oggi
--   d: nessuna preferenza salvata (valori di default)
--   c: solo l'intervallo di 7 giorni
--   x: notifiche disattivate
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000154a01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'q154@example.test', now(), now()),
  ('00000000-0000-0000-0000-000000154b01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'l154@example.test', now(), now()),
  ('00000000-0000-0000-0000-000000154c01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd154@example.test', now(), now()),
  ('00000000-0000-0000-0000-000000154d01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c154@example.test', now(), now()),
  ('00000000-0000-0000-0000-000000154e01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'x154@example.test', now(), now());

-- Le ore silenziose di q vanno dall'ora corrente di Roma all'ora dopo: la
-- funzione le legge come [inizio, fine), anche a cavallo della mezzanotte.
insert into public.notification_preferences
  (user_id, timezone, quiet_hours_enabled, quiet_hours_start, quiet_hours_end)
select '00000000-0000-0000-0000-000000154a01', 'Europe/Rome', true, h, (h + 1) % 24
from (select extract(hour from now() at time zone 'Europe/Rome')::int as h) now_rome;

insert into public.notification_preferences
  (user_id, timezone, max_notifications_per_day, notifications_sent_today, notifications_sent_date)
values
  ('00000000-0000-0000-0000-000000154b01', 'Europe/Rome', 5, 5, (now() at time zone 'Europe/Rome')::date);

insert into public.notification_preferences (user_id, timezone, expiry_intervals) values
  ('00000000-0000-0000-0000-000000154d01', 'Europe/Rome', '{7}');

insert into public.notification_preferences (user_id, timezone, enabled) values
  ('00000000-0000-0000-0000-000000154e01', 'Europe/Rome', false);

-- Gli alimenti: il nome dice di chi sono e fra quanti giorni scadono.
create function pg_temp.add_food(p_user uuid, p_name text, p_days int,
  p_status text default 'active', p_deleted boolean default false)
returns void language sql as $$
  insert into public.foods (user_id, list_id, name, expiry_date, category_id, storage_location, status, deleted_at)
  select p_user,
         (select lm.list_id from public.list_members lm where lm.user_id = p_user limit 1),
         p_name,
         (now() at time zone 'Europe/Rome')::date + p_days,
         (select c.id from public.categories c order by c.id limit 1),
         'fridge', p_status,
         case when p_deleted then now() end
$$;

select pg_temp.add_food('00000000-0000-0000-0000-000000154a01', 'q+1', 1);
select pg_temp.add_food('00000000-0000-0000-0000-000000154b01', 'l+0', 0);
select pg_temp.add_food('00000000-0000-0000-0000-000000154c01', 'd+0', 0);
select pg_temp.add_food('00000000-0000-0000-0000-000000154c01', 'd+1', 1);
select pg_temp.add_food('00000000-0000-0000-0000-000000154c01', 'd+2', 2);
select pg_temp.add_food('00000000-0000-0000-0000-000000154c01', 'd+3', 3);
select pg_temp.add_food('00000000-0000-0000-0000-000000154c01', 'd+5', 5);
select pg_temp.add_food('00000000-0000-0000-0000-000000154c01', 'd-1', -1);
select pg_temp.add_food('00000000-0000-0000-0000-000000154c01', 'd+1 consumato', 1, 'consumed');
select pg_temp.add_food('00000000-0000-0000-0000-000000154c01', 'd+0 cancellato', 0, 'active', true);
select pg_temp.add_food('00000000-0000-0000-0000-000000154d01', 'c+7', 7);
select pg_temp.add_food('00000000-0000-0000-0000-000000154d01', 'c+3', 3);
select pg_temp.add_food('00000000-0000-0000-0000-000000154e01', 'x+0', 0);

-- 1. Le ore silenziose non fanno più saltare la notifica.
select set_eq(
  $$ select food_name from public.get_expiring_foods_for_notifications()
     where user_id = '00000000-0000-0000-0000-000000154a01' $$,
  $$ values ('q+1') $$,
  'chi ha le ore silenziose sull''ora dell''invio riceve la notifica'
);

-- 2. Il limite giornaliero non esclude nessuno.
select set_eq(
  $$ select food_name from public.get_expiring_foods_for_notifications()
     where user_id = '00000000-0000-0000-0000-000000154b01' $$,
  $$ values ('l+0') $$,
  'chi ha già raggiunto il limite giornaliero riceve la notifica'
);

-- 3. Senza preferenze: gli intervalli di default {3, 1, 0}, solo alimenti
-- attivi e non cancellati.
select set_eq(
  $$ select food_name from public.get_expiring_foods_for_notifications()
     where user_id = '00000000-0000-0000-0000-000000154c01' $$,
  $$ values ('d+0'), ('d+1'), ('d+3') $$,
  'senza preferenze: gli alimenti a 3, 1 e 0 giorni, attivi e non cancellati'
);

-- 4. Gli intervalli scelti contano come prima.
select set_eq(
  $$ select food_name from public.get_expiring_foods_for_notifications()
     where user_id = '00000000-0000-0000-0000-000000154d01' $$,
  $$ values ('c+7') $$,
  'con il solo intervallo di 7 giorni: solo l''alimento a 7 giorni'
);

-- 5. Con le notifiche disattivate, niente.
select is_empty(
  $$ select food_name from public.get_expiring_foods_for_notifications()
     where user_id = '00000000-0000-0000-0000-000000154e01' $$,
  'con le notifiche disattivate non si riceve niente'
);

select * from finish();
rollback;
