-- #271 — authenticated non ha più TRUNCATE, REFERENCES, TRIGGER e MAINTAIN sulle
-- relazioni di public, né le scritture su categories, e i default non glieli
-- danno più.
--
-- È la stessa causa della #267: le tabelle nate prima dell'opt-in hanno i
-- default completi di Supabase, e l'opt-in ha tolto dai default solo
-- select/insert/update/delete sulle tabelle e usage/select sulle sequenze.
-- Nessun percorso usa i privilegi che si tolgono:
-- - i client (PWA ed entro-mobile) su categories fanno solo select, e nessuno
--   dei due usa TRUNCATE, REFERENCES, TRIGGER o MAINTAIN;
-- - le 14 funzioni che authenticated chiama come RPC sono SECURITY DEFINER;
--   l'unica invoker che può eseguire è la funzione di trigger
--   update_updated_at_column, che tocca solo la riga;
-- - le Edge Function usano la service_role.
-- TRUNCATE non passa dalla RLS: svuoterebbe le righe di tutti gli utenti.
--
-- Non si usa revoke all: authenticated tiene i privilegi che i client usano.
-- Il minimo privilegio completo (per esempio DELETE su lists e foods) resta
-- fuori, da decidere a parte. Il guardiano è supabase/tests/relation_grants.test.sql.

revoke truncate, references, trigger, maintain on all tables in schema public from authenticated;
revoke insert, update, delete on public.categories from authenticated;

-- I default, nelle due forme della #267. Le tabelle nuove danno ad
-- authenticated solo i grant espliciti del modello di tabella (CLAUDE.md).
alter default privileges for role postgres in schema public revoke all on tables from authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from authenticated;
alter default privileges for role postgres revoke all on tables from authenticated;
alter default privileges for role postgres revoke all on sequences from authenticated;
