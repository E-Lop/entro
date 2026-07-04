# Contribuire a Entro

Entro e' una PWA italiana per gestire scadenze alimentari, liste condivise e notifiche. Il progetto e' pubblico, ma alcune note operative restano in documenti locali privati: le issue GitHub e questa guida devono essere sufficienti per contribuire.

## English summary

Entro is an Italian food-expiry tracking PWA built with React, Vite, TypeScript, Tailwind and Supabase. Please run lint, typecheck and tests before opening a pull request. Database changes must include RLS and explicit grants.

## Prerequisiti

- Node.js 20
- npm
- Docker, richiesto per Supabase locale
- Supabase CLI
- Un progetto Supabase solo se devi testare flussi remoti; per default usa Supabase locale

## Setup locale

```bash
git clone https://github.com/E-Lop/entro.git
cd entro
npm ci
cp .env.example .env.local
```

Compila `.env.local` con i valori del tuo progetto Supabase locale o remoto:

```bash
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<local-anon-key>
VITE_APP_URL=http://localhost:5173
VITE_APP_NAME=entro
VITE_ENABLE_BARCODE_SCANNER=true
VITE_ENABLE_SWIPE_GESTURES=true
VITE_ENABLE_SHARED_LISTS=true
VITE_ENABLE_NOTIFICATIONS=true
```

## Supabase locale

Avvia Supabase locale con Docker:

```bash
supabase start
supabase db reset
npm run supabase:types
```

La catena canonica delle migration vive in `supabase/migrations/`. I tipi TypeScript generati vivono in `src/lib/supabase.types.ts` e vengono riesportati dal client in `src/lib/supabase.ts`. La cartella storica `migrations/` resta solo come archivio finche' non viene consolidata.

## Comandi di verifica

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

La CI GitHub esegue gli stessi controlli su push e pull request.

## Regole database

Ogni nuova tabella o funzione nello schema `public` deve includere:

- RLS abilitata;
- policy coerenti con il modello dati;
- `GRANT` espliciti per i ruoli necessari;
- test o smoke test che coprano autorizzazione e business rule.

Template minimo per una tabella privata utente:

```sql
ALTER TABLE public.my_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own rows"
  ON public.my_table FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.my_table TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.my_table TO service_role;
```

## Pull request

Prima di aprire una PR:

- mantieni lo scope stretto;
- aggiorna documentazione e `CHANGELOG.md` se cambia comportamento utente;
- aggiungi test per validation, authorization, business rules e azioni distruttive;
- verifica le modifiche UI in viewport mobile.

Usa Conventional Commits per i messaggi principali, per esempio `feat:`, `fix:`, `docs:`, `test:`, `chore:`.
