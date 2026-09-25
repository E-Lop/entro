-- #160 — Nessuna funzione di public è eseguibile da PUBLIC.
--
-- Postgres concede EXECUTE a PUBLIC su ogni funzione appena creata, e anon è
-- membro di PUBLIC: i `revoke … from anon` delle migrazioni precedenti non
-- toglievano niente. Il caso con effetti era get_expiring_foods_for_notifications,
-- SECURITY DEFINER e senza controllo di auth.uid(): chiunque avesse la chiave
-- anon leggeva nomi e scadenze degli alimenti di tutti gli utenti.
--
-- La 20260517 doveva impedirlo per le funzioni nuove, con
-- `alter default privileges … in schema public revoke execute on functions
-- from public`, copiata dalla guida di Supabase «Hardening the Data API». Non
-- ha effetto: una revoca per schema non toglie un default globale (Postgres,
-- ALTER DEFAULT PRIVILEGES: «you cannot accomplish that effect with a command
-- limited to a single schema»). Qui la stessa revoca è scritta senza schema.
--
-- I grant espliciti ad authenticated e service_role delle migrazioni
-- precedenti restano. Le funzioni di trigger si chiudono anche loro: EXECUTE
-- serve per creare il trigger, non perché scatti (misurato il 25 set 2026).
-- Il guardiano è supabase/tests/function_grants.test.sql.

revoke execute on all functions in schema public from public, anon;

-- La chiama il client durante la registrazione, prima che esista una sessione
-- (src/lib/invites.ts, #67).
grant execute on function public.register_pending_invite(text, text) to anon;

-- La chiama solo l'Edge Function send-expiry-notifications, con la service role.
revoke execute on function public.get_expiring_foods_for_notifications() from authenticated;

-- Le funzioni che postgres creerà da qui in poi nascono chiuse.
alter default privileges for role postgres revoke execute on functions from public;

-- Stesso corpo della 20260301, con search_path fissato e nomi qualificati:
-- una funzione SECURITY DEFINER non deve risolvere i nomi con il search_path
-- di chi la chiama. CREATE OR REPLACE conserva i permessi.
CREATE OR REPLACE FUNCTION public.get_expiring_foods_for_notifications()
RETURNS TABLE (
  user_id uuid,
  food_id uuid,
  food_name text,
  expiry_date date,
  days_until_expiry integer,
  category_name text,
  timezone text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT DISTINCT
    COALESCE(lm.user_id, f.user_id) AS user_id,
    f.id AS food_id,
    f.name AS food_name,
    f.expiry_date::date AS expiry_date,
    (f.expiry_date::date - (now() AT TIME ZONE COALESCE(np.timezone, 'Europe/Rome'))::date) AS days_until_expiry,
    c.name_it AS category_name,
    COALESCE(np.timezone, 'Europe/Rome') AS timezone
  FROM public.foods f
  LEFT JOIN public.list_members lm ON f.list_id = lm.list_id
  LEFT JOIN public.categories c ON f.category_id = c.id
  LEFT JOIN public.notification_preferences np ON np.user_id = COALESCE(lm.user_id, f.user_id)
  WHERE
    f.deleted_at IS NULL
    AND f.status = 'active'
    AND COALESCE(lm.user_id, f.user_id) IS NOT NULL
    AND COALESCE(np.enabled, true) = true
    AND (f.expiry_date::date - (now() AT TIME ZONE COALESCE(np.timezone, 'Europe/Rome'))::date)
        = ANY(COALESCE(np.expiry_intervals, '{3, 1, 0}'))
    AND (
      np.notifications_sent_date IS NULL
      OR np.notifications_sent_date != (now() AT TIME ZONE COALESCE(np.timezone, 'Europe/Rome'))::date
      OR np.notifications_sent_today < COALESCE(np.max_notifications_per_day, 5)
    )
    AND (
      COALESCE(np.quiet_hours_enabled, false) = false
      OR NOT (
        CASE
          WHEN np.quiet_hours_start < np.quiet_hours_end THEN
            EXTRACT(HOUR FROM now() AT TIME ZONE COALESCE(np.timezone, 'Europe/Rome'))
              BETWEEN np.quiet_hours_start AND np.quiet_hours_end - 1
          ELSE
            EXTRACT(HOUR FROM now() AT TIME ZONE COALESCE(np.timezone, 'Europe/Rome'))
              >= np.quiet_hours_start
            OR EXTRACT(HOUR FROM now() AT TIME ZONE COALESCE(np.timezone, 'Europe/Rome'))
              < np.quiet_hours_end
        END
      )
    )
  ORDER BY COALESCE(lm.user_id, f.user_id), days_until_expiry ASC;
$$;
