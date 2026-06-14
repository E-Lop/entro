# Entro — Istruzioni per Claude Code

Entro è una PWA italiana per il tracciamento delle scadenze alimentari. Mobile-first, dual-purpose (showcase pubblico + open source).

## Stack

- **Frontend**: React + Vite + TypeScript + Tailwind, PWA con custom service worker (`src/sw.ts`)
- **Backend**: Supabase (Postgres + Auth + Storage + Realtime + Edge Functions Deno)
- **State**: Zustand + React Query
- **Project ref Supabase**: `rmbmmwcxtnanacxbkihc`

## Supabase Migrations — Data API GRANT Pattern (OBBLIGATORIO)

Dal 30 ottobre 2026 ogni nuova tabella/funzione in `public` schema richiede `GRANT` espliciti per essere raggiungibile via supabase-js / PostgREST. Entro ha già fatto opt-in anticipato — vedi `supabase/migrations/20260517_optin_data_api_hardening.sql`.

**Riferimenti ufficiali**:
- [Discussion #45329](https://github.com/orgs/supabase/discussions/45329)
- [Hardening the Data API](https://supabase.com/docs/guides/api/hardening-data-api)

### Template OBBLIGATORIO per nuove tabelle

```sql
-- 1. Tabella
CREATE TABLE public.my_table (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- ...
);

-- 2. RLS (sempre)
ALTER TABLE public.my_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own rows"
  ON public.my_table FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. GRANT espliciti (RICHIESTI: senza questi la tabella è invisibile a supabase-js)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.my_table TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.my_table TO service_role;
-- GRANT SELECT ON public.my_table TO anon;  -- aggiungere SOLO se davvero pubblica

-- 4. Sequences (solo se PK è SERIAL/IDENTITY, non per uuid)
-- GRANT USAGE, SELECT ON SEQUENCE public.my_table_id_seq TO authenticated;
```

### Template per funzioni RPC (esposte via `supabase.rpc()`)

```sql
CREATE OR REPLACE FUNCTION public.my_function(...)
RETURNS ... LANGUAGE plpgsql SECURITY DEFINER AS $$ ... $$;

GRANT EXECUTE ON FUNCTION public.my_function(...) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_function(...) TO service_role;
-- GRANT EXECUTE ON FUNCTION public.my_function(...) TO anon;  -- solo se davvero pubblica
```

### Sintomo se manchi un GRANT

PostgREST risponde con errore strutturato:
```json
{
  "code": "42501",
  "message": "permission denied for table my_table",
  "hint": "Grant the required privileges to the current role with: GRANT SELECT ON public.my_table TO anon;"
}
```

Se vedi `42501` in dev, mancano i GRANT nella migrazione.

### Regola alternativa: schemi separati

Per nuove API molto sensibili considerare uno schema dedicato (`api`, `internal`) invece di `public`, con `GRANT USAGE ON SCHEMA ... TO authenticated` esplicito. Per ora Entro continua a usare `public` per coerenza con le 22 migrazioni storiche.

## Convenzioni di sviluppo

- **Documentazione**: dual-purpose project — separare dev docs interni (`docs/development/`, `docs/private/`) da docs pubblici (`docs/guides/`, `README.md`).
- **Mobile-first**: ogni feature va testata in browser mobile/iOS prima di considerarsi completa.
- **Code simplifier**: invocare la skill `code-simplifier:code-simplifier` dopo ogni feature significativa, prima di committare.
- **Test automatici**: per ogni feature, coprire validation + authorization + business rules + destructive action safeguards (vedi `~/.claude/CLAUDE.md`).

## Edge Functions deploy

La sessione CLI non-TTY non può fare `supabase login` interattivo. Usa:
```bash
SUPABASE_ACCESS_TOKEN=<token> supabase functions deploy <nome-funzione> --project-ref rmbmmwcxtnanacxbkihc
```
Genera token da https://supabase.com/dashboard/account/tokens e **revocalo dopo l'uso**.

## Riferimenti rapidi

- `src/lib/supabase.ts` — client config (heartbeat 15s tuned per mobile, `detectSessionInUrl: true` richiesto per password reset)
- `src/sw.ts` — service worker custom (push + offline)
- `supabase/migrations/` — migrazioni recenti versionate
- `migrations/` — migrazioni storiche (numerate 001-016 + helpers)
- `docs/development/DOMAIN_GLOSSARY.md` — glossario di dominio (categorie, stati Food/Expiry, regole di business, incoerenze note)
- `CHANGELOG.md` — Keep a Changelog in italiano, semver
