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

La CI GitHub esegue gli stessi controlli su push e pull request. Per contribuire basta che questi siano verdi: `npm test` passa in un clone nuovo, senza nient'altro accanto.

### Guardiani di famiglia

Alcuni test confrontano entro con due repo affiancati, `entro-family` (il dominio condiviso della famiglia di app) ed `entro-mobile` (l'app nativa). Sono **privati**, quindi quei test non stanno in `npm test`: stanno in `npm run test:family`, e si riconoscono dal nome, `*.family.test.ts`. Senza i repo affiancati falliscono di proposito, con un messaggio che dice cosa manca.

La CI li esegue in un job a parte, «Guardiani di famiglia», sul repo principale e su `main`. Sulle pull request aperte da un fork quel job non parte, perché i token per leggere i repo privati non arrivano ai fork, e non fa fallire il resto: li verifica chi mantiene il repo.

Un test nuovo che legge i repo affiancati va chiamato `*.family.test.ts`. Se non lo è, `npm test` diventa rosso su `familyTestsBoundary.test.ts`.

### Regole che i test e il lint fanno rispettare

- **Codice in inglese.** Nomi di variabili, funzioni, tipi, proprietà e file sono in inglese; prosa, commenti e testo a schermo in italiano. Lo controlla `englishNames.family.test.ts`, che fa parte dei guardiani di famiglia perché la lista delle parole italiane sta in `entro-family`.
- **Niente dati della risposta nei log.** `console.error`, `console.warn` e simili non possono ricevere un secondo argomento: ne stamperebbero le proprietà, dove i client Supabase mettono i dati della risposta. Si usano `logError` e `logWarn` da `@/lib/safeLog`. È la regola `no-restricted-syntax` in `eslint.config.js`, quindi `npm run lint` la fa rispettare.

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

## Suite di smoke API

`tests/smoke/` dice se l'app funziona contro un database vero, con due account sentinella, A e B, e senza mai una chiave `service_role`. Ha tre livelli: (a) lettura, (b) scritture reversibili sulla lista di A, (c) inviti fra A e B. Sul Supabase locale un comando solo crea le sentinelle, rimette i dati noti, lancia i tre livelli e rimette di nuovo i dati:

```bash
npm run smoke:local
```

Contro un altro database la suite si configura dall'ambiente (`SMOKE_SUPABASE_URL`, `SMOKE_SUPABASE_ANON_KEY`, `SMOKE_A_EMAIL`, `SMOKE_A_PASSWORD`, `SMOKE_B_EMAIL`, `SMOKE_B_PASSWORD`): `npm run smoke:restore` rimette i dati noti, `SMOKE_LEVELS=a npm run smoke` lancia i livelli scelti. L'output riporta solo il nome del test e una categoria d'errore, perché gira anche in produzione e i log di questo repo sono pubblici.

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

## Migrazioni in produzione

Il 25 settembre 2026 una migrazione verde su pgTAP e sugli E2E ha rotto ogni lettura in produzione per circa 41 ore (#179). I test giravano sullo schema ricostruito dalle migrazioni del repo, e in produzione c'era un corpo di funzione diverso. Da allora vale questo.

**Prima lo schema, poi il client.**
- Le migrazioni sono additive (*expand/contract*): il client in produzione deve continuare a funzionare con lo schema nuovo.
- Il `db push` si fa dal ramo della PR, dopo la CI verde; poi il merge.
- Dopo il push un file di migrazione non si tocca più: la correzione è una migrazione nuova.
- Una migrazione che non si può scrivere additiva si spezza in due PR: prima quella che aggiunge, poi, a client aggiornato, quella che toglie.

**Il pre-push.** Prima di ogni `db push`, dal ramo della PR e con l'albero pulito, nel terminale dove è esportato `SUPABASE_ACCESS_TOKEN`:

```bash
npm run db:prepush -- <numero della issue>
```

Serve Node ≥ 22.18, perché il comando esegue i suoi moduli TypeScript senza build. I passi:

1. **Precondizioni**: token, albero pulito, e le migrazioni che mancano in produzione devono essere **esattamente** quelle nuove del ramo. Il push applica tutto ciò che manca: il 22 settembre mancava anche una migrazione di agosto.
2. **Backup**: `backup_pre<issue>_<data>-<ora>_{schema,data}.sql` nella radice (per esempio `backup_pre184_20260929-153012_schema.sql`: due corse nello stesso giorno non si sovrascrivono), ignorati da git, permessi 600.
3. **Diff pg-delta** fra produzione e migrazioni, da leggere. Non blocca finché la #182 non chiude la deriva di oggi.
4. **Impronta di produzione**, solo catalogo:
   - funzioni di `public` con corpo, `search_path` e permessi;
   - policy di `public` e `storage`;
   - trigger su `auth.users`;
   - permessi, RLS e privilegi di default di `public`;
   - bucket e categorie.
5. **Stack ombra** `entro-prodshape`, con lo stack di sviluppo fermo ma i suoi volumi conservati. Ci si carica la forma di produzione: il dump di schema, più ciò che il dump non porta (policy di storage, trigger su `auth.users`, bucket, i permessi esatti e le categorie). La sua impronta deve essere identica a quella di produzione, o il comando si ferma con «forma di produzione non fedele» e nomina gli oggetti.
6. **Prova**: le migrazioni del ramo, poi pgTAP e la suite di smoke (`npm run smoke:local`) sullo stack ombra.
7. **Pulizia**, anche su errore o Ctrl-C:
   - si toglie lo stack ombra, con i soli volumi `com.supabase.cli.project=entro-prodshape`;
   - riparte lo stack di sviluppo;
   - il comando controlla che utenti, alimenti e volumi siano quelli di prima.
8. **Esito**: se è tutto verde stampa `supabase db push --linked --dry-run` e `supabase db push --linked`. **Il push lo fai tu**: il comando non lo fa mai.

Durate misurate: **129 secondi** per la prima corsa vera contro la produzione, il 28 settembre 2026, backup compresi; da 70 a 80 secondi in modalità locale. In tutte e due, circa 30 secondi sono l'avvio dello stack ombra. Lo stack di sviluppo resta fermo per circa un minuto e mezzo.

**Quando si ferma**, il messaggio dice il passo e cosa guardare; i dettagli stanno nel log, di cui stampa il percorso.
- Al passo 1, una migrazione mancante che non è del ramo si decide prima: o entra in una sua PR, o si spiega perché va con questa.
- Al passo 5, un oggetto diverso vuol dire che la copia non è fedele: la prova non vale finché non lo è.
- Al passo 6, la migrazione ha rotto qualcosa sulla forma di produzione: è esattamente il caso della #179.

**Autoverifica.** `npm run db:prepush -- <issue> --local` fa tutto uguale, ma con lo stack di sviluppo al posto della produzione: nessun token e nessun push, e i backup vanno nella cartella temporanea della corsa. Con `PREPUSH_TAMPER_SQL=<file.sql>`, accettato solo in locale, il file si esegue sullo stack ombra fra il caricamento e il confronto delle impronte. Serve a provare che il confronto se ne accorge, per esempio togliendo una policy di `storage.objects`.

## Pull request

Prima di aprire una PR:

- mantieni lo scope stretto;
- aggiorna documentazione e `CHANGELOG.md` se cambia comportamento utente;
- aggiungi test per validation, authorization, business rules e azioni distruttive;
- verifica le modifiche UI in viewport mobile.

Usa Conventional Commits per i messaggi principali, per esempio `feat:`, `fix:`, `docs:`, `test:`, `chore:`.

**La parola chiave che chiude una issue va scritta in inglese**, anche in un messaggio per il resto in italiano: `Closes #123`, non «Chiude #123». GitHub riconosce solo `close/closes/closed`, `fix/fixes/fixed`, `resolve/resolves/resolved`, e ignora in silenzio qualunque altra cosa — quindi la issue resta aperta e non c'è nessun errore che lo segnali. La convenzione «documentazione in italiano» non si applica qui: quelle parole non sono prosa, sono l'interfaccia con cui la PR parla al tracker.

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
