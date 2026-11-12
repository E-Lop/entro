SET local check_function_bodies = off;

CREATE EXTENSION "pg_cron";

CREATE EXTENSION "pg_net" SCHEMA "extensions";

COMMENT ON EXTENSION "pg_cron" IS 'Job scheduler for PostgreSQL';

COMMENT ON EXTENSION "pg_net" IS 'Async HTTP';

SELECT cron.schedule_in_database('send-expiry-notifications', '0 8 * * *', '
      SELECT net.http_post(
        url := ''https://<project>.supabase.co/functions/v1/send-expiry-notifications'',
        headers := jsonb_build_object(
          ''Content-Type'', ''application/json'',
          ''Authorization'', ''Bearer '' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name =
  ''cron_secret'' LIMIT 1)
        ),
        body := ''{}''::jsonb
      );
    ', 'postgres', NULL, true);

