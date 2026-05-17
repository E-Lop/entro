-- ============================================
-- Data API hardening: opt-in al nuovo comportamento Supabase
-- Ref: https://github.com/orgs/supabase/discussions/45329
-- Ref: https://supabase.com/docs/guides/api/hardening-data-api
--
-- Cosa fa: revoca i DEFAULT PRIVILEGES che il ruolo postgres concedeva
-- automaticamente a anon/authenticated/service_role per ogni nuova TABELLA,
-- FUNZIONE e SEQUENZA creata in schema public.
--
-- Cosa NON fa: non revoca alcun grant gia' concesso. Tutte le tabelle/funzioni
-- esistenti (lists, list_members, invites, foods, push_subscriptions,
-- notification_preferences, get_expiring_foods_for_notifications, etc.)
-- mantengono i loro grant attuali e restano raggiungibili via Data API.
--
-- Effetto: a partire da questa migrazione, ogni nuova tabella/funzione
-- in public richiedera' GRANT espliciti per essere raggiungibile via
-- supabase-js / PostgREST. Senza GRANT, PostgREST risponde con errore 42501.
--
-- Supabase applichera' lo stesso comportamento automaticamente a tutti i
-- progetti esistenti il 30 ottobre 2026. Questo opt-in anticipa l'allineamento.
-- ============================================

alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke execute on functions from public;
