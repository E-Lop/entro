-- Fix: il cron a '0 9 * * *' (9:00 UTC) invia la notifica alle 11:00
-- dopo il passaggio all'ora legale (CEST = UTC+2).
-- pg_cron su Supabase non supporta timezone per-job, quindi usiamo 8:00 UTC
-- che corrisponde a 10:00 CEST (estate) / 9:00 CET (inverno).

SELECT cron.unschedule('send-expiry-notifications');

SELECT cron.schedule(
  'send-expiry-notifications',
  '0 8 * * *',
  $$
    SELECT net.http_post(
      url := '<SUPABASE_URL>/functions/v1/send-expiry-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1)
      ),
      body := '{}'::jsonb
    );
  $$
);
