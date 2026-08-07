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

## Test end-to-end

I test Playwright usano Supabase locale e creano utenti temporanei con la service role key locale standard:

```bash
supabase start
supabase db reset
npx playwright install chromium
npm run test:e2e
```

Se preferisci usare Chrome gia' installato invece del browser scaricato da Playwright:

```bash
E2E_BROWSER_CHANNEL=chrome npm run test:e2e
```

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

## Release

Entro **non ha un commit di release separato**: la PR di feature porta anche il rilascio. Il tag punta poi al commit di squash-merge di quella stessa PR.

Dentro la PR:

- porta la versione secondo [Semantic Versioning](https://semver.org/lang/it/) con `npm version --no-git-tag-version X.Y.Z`, che aggiorna insieme `package.json` e `package-lock.json`;
- aggiungi in cima a `CHANGELOG.md` la sezione `## [X.Y.Z] - AAAA-MM-GG`, con le intestazioni di [Keep a Changelog](https://keepachangelog.com/it/1.1.0/) in inglese (`Added`, `Changed`, `Fixed`, `Security`);
- aggiungi in fondo allo stesso file la link reference `[X.Y.Z]: https://github.com/E-Lop/entro/compare/vPRECEDENTE...vX.Y.Z` e riporta `[Unreleased]` a partire dal nuovo tag. È il passaggio che sfugge più spesso: le definizioni si erano fermate a `[1.9.0]` per quattro release, lasciando i riferimenti nelle intestazioni non risolti.

Dopo il merge:

```bash
git checkout main && git pull
git tag -a vX.Y.Z -m "vX.Y.Z — descrizione breve"
git push origin vX.Y.Z
gh release create vX.Y.Z --title "vX.Y.Z — descrizione breve" --notes "..."
```

Le note della Release riprendono la sezione del CHANGELOG, con in più il contesto che a un lettore esterno non è ovvio: perché il difetto esisteva e come è stato verificato.

> L'app nativa (`entro-mobile`) usa una convenzione **diversa**: un commit `chore: release vX.Y.Z` separato su `main` e lo script `scripts/bump-version.mjs`, che allinea anche `app.json`, `ios.buildNumber` e `android.versionCode`. Non trasferire questa procedura là.
