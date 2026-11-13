-- #267 — anon non ha privilegi sulle relazioni di public, tranne il SELECT su
-- categories, e i privilegi di default non glieli danno più.
--
-- Le tabelle nate prima dell'opt-in al Data API hardening (20260517) hanno
-- preso i privilegi di default di Supabase: anon aveva SELECT, TRIGGER e
-- MAINTAIN su foods, lists, list_members e categories, e tutti i privilegi
-- su notification_preferences e push_subscriptions. La 20260706 aveva tolto
-- le scritture, non il resto. E l'opt-in ha revocato dai default solo
-- select/insert/update/delete sulle tabelle e usage/select sulle sequenze:
-- ogni tabella nuova nasceva ancora con TRUNCATE, REFERENCES, TRIGGER e
-- MAINTAIN per anon (inherited_food_images, 20260922), e ogni sequenza nuova
-- con UPDATE.
--
-- Le righe le proteggeva la RLS, e né la PWA né entro-mobile leggono queste
-- tabelle senza una sessione. Ma un errore in una policy sarebbe stato
-- raggiungibile senza accesso.
--
-- Si revoca tutto, invece dei privilegi misurati uno per uno: il risultato è
-- lo stesso su ogni immagine di Postgres, e copre anche quelli che si
-- aggiungeranno. Anche a PUBLIC, che anon eredita (oggi non ha niente).
-- Il guardiano è supabase/tests/relation_grants.test.sql.

revoke all on all tables in schema public from anon, public;
revoke all on all sequences in schema public from anon, public;

-- Category è a «Lettura pubblica» nel bundle di dominio
-- (entro-family/core/entities.md), e la sua policy di lettura è using (true).
grant select on public.categories to anon;

-- I default, in due forme. «in schema public» colpisce la riga che oggi dà i
-- privilegi (convenzione supabase-data-api-grants, «Default privileges»).
-- Senza «in schema» colpisce la riga globale di postgres: dove non dà niente,
-- che è il default di Postgres per tabelle e sequenze, non cambia nulla; dove
-- un'immagine la usa, la chiude.
alter default privileges for role postgres in schema public revoke all on tables from anon, public;
alter default privileges for role postgres in schema public revoke all on sequences from anon, public;
alter default privileges for role postgres revoke all on tables from anon, public;
alter default privileges for role postgres revoke all on sequences from anon, public;
