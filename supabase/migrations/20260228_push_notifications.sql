-- ============================================
-- Push Notifications: tabelle e funzione cron
-- ============================================

-- 1. Tabella push_subscriptions
CREATE TABLE public.push_subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth_key text NOT NULL,
  user_agent text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own subscriptions"
  ON public.push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);

-- 2. Tabella notification_preferences
CREATE TABLE public.notification_preferences (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  enabled boolean DEFAULT true NOT NULL,
  expiry_intervals integer[] DEFAULT '{3, 1, 0}' NOT NULL,
  quiet_hours_enabled boolean DEFAULT false NOT NULL,
  quiet_hours_start integer DEFAULT 22 NOT NULL CHECK (quiet_hours_start >= 0 AND quiet_hours_start <= 23),
  quiet_hours_end integer DEFAULT 8 NOT NULL CHECK (quiet_hours_end >= 0 AND quiet_hours_end <= 23),
  max_notifications_per_day integer DEFAULT 5 NOT NULL CHECK (max_notifications_per_day >= 1 AND max_notifications_per_day <= 20),
  timezone text DEFAULT 'Europe/Rome' NOT NULL,
  last_notification_sent_at timestamptz,
  notifications_sent_today integer DEFAULT 0 NOT NULL,
  notifications_sent_date date,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own preferences"
  ON public.notification_preferences
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Funzione per il cron job
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
AS $$
  SELECT DISTINCT
    lm.user_id,
    f.id AS food_id,
    f.name AS food_name,
    f.expiry_date::date AS expiry_date,
    (f.expiry_date::date - (now() AT TIME ZONE COALESCE(np.timezone, 'Europe/Rome'))::date) AS days_until_expiry,
    c.name_it AS category_name,
    COALESCE(np.timezone, 'Europe/Rome') AS timezone
  FROM foods f
  JOIN list_members lm ON f.list_id = lm.list_id
  JOIN categories c ON f.category_id = c.id
  LEFT JOIN notification_preferences np ON np.user_id = lm.user_id
  WHERE
    f.deleted_at IS NULL
    AND f.status = 'active'
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
  ORDER BY lm.user_id, days_until_expiry ASC;
$$;

-- 4. pg_cron schedule (eseguire DOPO deploy Edge Functions)
-- Nota: abilitare pg_cron e pg_net dal Dashboard Supabase > Database > Extensions
--
-- SELECT cron.schedule(
--   'send-expiry-notifications',
--   '0 9 * * *',
--   $$
--     SELECT net.http_post(
--       url := '<SUPABASE_URL>/functions/v1/send-expiry-notifications',
--       headers := jsonb_build_object(
--         'Content-Type', 'application/json',
--         'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
--       ),
--       body := '{}'::jsonb
--     );
--   $$
-- );
