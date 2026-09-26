-- #154 — Né le ore silenziose né il limite giornaliero decidono più chi
-- riceve la notifica di scadenza.
--
-- L'invio è uno al giorno, raggruppato, alle 8:00 UTC (20260329: le 10:00
-- d'estate, le 9:00 d'inverno). Con un invio solo il limite giornaliero non
-- limitava niente; le ore silenziose invece, se la fascia copriva quell'ora,
-- scartavano l'utente e la notifica saltava, senza essere rimandata e senza
-- dirlo: una fascia 22-10 d'inverno lasciava l'utente senza notifiche per
-- sempre. Deciso di toglierle tutte e due (#154, triage della #148).
--
-- Le colonne restano in notification_preferences, inutilizzate: toglierle
-- distruggerebbe dati e cambierebbe i tipi di entro-mobile. L'Edge Function
-- send-expiry-notifications continua a scrivere notifications_sent_today e
-- notifications_sent_date, che da qui nessuno legge più.
--
-- Corpo: quello della 20260925 senza le due condizioni; il resto della scelta
-- (attivazione, intervalli, alimenti attivi e non cancellati) non cambia.
-- Il guardiano è supabase/tests/expiry_notifications.test.sql.

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
  ORDER BY COALESCE(lm.user_id, f.user_id), days_until_expiry ASC;
$$;

-- Create or replace conserva i permessi della 20260925: li si riscrive qui
-- perché chi legge questa migrazione da sola li veda (entro-family,
-- conventions/supabase-data-api-grants.md). La chiama solo l'Edge Function,
-- con la service role.
REVOKE EXECUTE ON FUNCTION public.get_expiring_foods_for_notifications() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_expiring_foods_for_notifications() TO service_role;
