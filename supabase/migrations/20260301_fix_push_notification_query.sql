-- ============================================
-- Fix get_expiring_foods_for_notifications:
--   1. LEFT JOIN list_members → include foods without list_id
--   2. LEFT JOIN categories  → include foods without category_id
--      (category_name was unused in notification messages anyway)
--   3. COALESCE(lm.user_id, f.user_id) as notification target
-- ============================================

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
    COALESCE(lm.user_id, f.user_id) AS user_id,
    f.id AS food_id,
    f.name AS food_name,
    f.expiry_date::date AS expiry_date,
    (f.expiry_date::date - (now() AT TIME ZONE COALESCE(np.timezone, 'Europe/Rome'))::date) AS days_until_expiry,
    c.name_it AS category_name,
    COALESCE(np.timezone, 'Europe/Rome') AS timezone
  FROM foods f
  LEFT JOIN list_members lm ON f.list_id = lm.list_id
  LEFT JOIN categories c ON f.category_id = c.id
  LEFT JOIN notification_preferences np ON np.user_id = COALESCE(lm.user_id, f.user_id)
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
