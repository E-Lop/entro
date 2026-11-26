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

### Dati di prova

L'utente canonico locale, `e2e@example.test`, e i suoi undici alimenti si creano con:

```bash
npm run seed:local                 # crea l'utente se manca, poi ne riscrive gli alimenti
npm run seed:local -- --recreate   # cancella e ricrea l'utente, con le foto della sua cartella
```

Le righe del seme non stanno qui: sono `conventions/test-data-seed.json` del repo `entro-family`, affiancato a questo (o nella cartella indicata da `ENTRO_FAMILY_DIR`). Il perché di ogni riga, i ruoli degli account e la regola dei domini sono in `conventions/test-data.md` dello stesso repo. Le date sono contate dal giorno di oggi a Roma, quindi i badge della dashboard tornano quelli attesi a ogni esecuzione. La password è `E2E_PASSWORD` degli helper E2E, la stessa degli utenti delle spec.

Lo script si ferma se URL o chiave non sono quelli del Supabase locale: usa la guardia degli helper E2E. Come `npm run db:prepush`, serve Node ≥ 22.18, che esegue i file TypeScript senza build.

Gli indirizzi email negli script e nei test stanno su domini che nessuno può registrare: `.test`, `.example`, `example.com`, `example.net`, `example.org`. Gli indirizzi nuovi si scrivono su `@example.test`. Lo controlla `tests/testEmailDomains.test.ts`, dentro `npm test`.

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

## Controllo settimanale delle dipendenze

Ogni lunedì il workflow «Controllo settimanale delle dipendenze» confronta `npm audit` con l'elenco delle segnalazioni già valutate, `ACCEPTED` in `scripts/weekly-audit.mjs`. Si lancia anche a mano dalla scheda Actions. È verde finché non cambia niente, anche se `npm audit` riporta segnalazioni: quelle in elenco sono state valutate e accettate, ciascuna nella issue che la voce nomina.

Quando esce rosso il log dice quale dei tre casi è:

- **una segnalazione non ancora valutata**: si aggiorna il pacchetto, se una versione corretta è installabile. Altrimenti si scrive la valutazione in una issue di questo repo (perché non si corregge, dove gira il codice, quando si rilegge) e si aggiunge la voce ad `ACCEPTED` con il numero della issue e con `patched`, cioè l'insieme delle versioni corrette che l'advisory dichiara oggi per quel pacchetto: un valore per ogni elemento di `vulnerabilities` che lo nomina, una serie ciascuno, e `null` per una serie senza correzione. Si leggono con `gh api /advisories/<GHSA> --jq '[.vulnerabilities[] | select(.package.name=="<pacchetto>") | .first_patched_version]'`. L'insieme intero, non la serie che usiamo: una correzione nuova in qualunque serie va guardata una volta (#254);
- **una accettata non compare più**: si toglie la voce da `ACCEPTED` e dalla issue che la valutava;
- **una accettata ha versioni corrette diverse**: il log dice quali sono comparse e quali sparite. Si rilegge la valutazione. Se una correzione è installabile si aggiorna il pacchetto e si toglie la voce; se non lo è si riscrive `patched` con l'insieme di oggi e si scrive il perché nella issue.

In locale:

```bash
node scripts/weekly-audit.mjs --accepted | while read -r id; do gh api "/advisories/$id"; done | jq -s . > /tmp/advisories.json
npm audit --json --audit-level none | node scripts/weekly-audit.mjs --advisories /tmp/advisories.json
```

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

### Nel browser

`tests/smoke-browser/` guarda la PWA servita: entra come A e controlla che la dashboard mostri i cinque alimenti noti, ciascuno con la sua etichetta di scadenza. Il controllo decisivo è «Scade oggi», che il giorno dopo diventa «Scaduto»: distingue una schermata viva da una vecchia. Non tocca niente. Sul Supabase locale crea le sentinelle se mancano, rimette i dati noti e apre la dashboard in un dev server suo:

```bash
npm run smoke:browser:local
```

Contro un sito vero si lancia **sempre subito dopo il ripristino**, perché le etichette attese valgono nel giorno in cui i dati sono stati riscritti:

```bash
npm run smoke:restore
SMOKE_SITE_URL=https://entroapp.it npm run smoke:browser
```

Le credenziali di A vengono da `SMOKE_A_EMAIL` e `SMOKE_A_PASSWORD`. Senza `SMOKE_SITE_URL` la suite avvia un dev server sulla porta 5174, puntato al Supabase locale, e non ne riusa mai uno già acceso: il `.env.local` di questo repo punta alla produzione. Nessuna corsa lascia tracce, video o scatti, e l'output, come quello della suite API, contiene solo nomi di test e categorie.

## Smoke in produzione

Tre workflow fanno girare le due suite contro entroapp.it e il suo database. Durante la #179 l'API ha risposto 404 per 41 ore e se n'è accorto un utente: questi giri lo dicono entro un'ora.

| Workflow | Quando | Cosa | Chi avvisa |
|---|---|---|---|
| `smoke-hourly.yml` | ogni ora al minuto 17 (UTC), lo avvia Netlify | livello (a), sola lettura | Healthchecks |
| `smoke-daily.yml` | ogni giorno alle 05:43 UTC, lo avvia Netlify | ripristino, poi la suite nel browser | Healthchecks |
| `smoke-deploy.yml` | a ogni push su `main`, e a mano | ripristino, livelli a, b e c, ripristino, suite nel browser | GitHub, a chi ha fatto il push o il lancio |

Dopo un push su `main` il primo job di `smoke-deploy.yml` legge `https://entroapp.it/version.json` ogni 15 secondi, finché lo SHA non è quello del push, per dieci minuti al massimo. Il file lo scrive la build (`scripts/versionFile.ts`), e il dev server lo serve uguale. Netlify non manda a GitHub un evento di deploy di produzione, quindi si interroga. Un push più recente cancella l'attesa di quello prima.

Le corse contro la produzione stanno in un gruppo di `concurrency` solo, `smoke-production`, quindi si mettono in fila. GitHub tiene in attesa al massimo una corsa per gruppo: se ne arriva una terza, quella in attesa viene cancellata.

**Chi avvia i giri pianificati.** Non lo `schedule` di GitHub: dal 25 nov 2026 ha fatto partire 2 giri orari su 22, ore dopo, e nessun giornaliero, e la community lo segnala da agosto senza una risposta di GitHub (#286). Li avviano due Netlify Scheduled Function, `netlify/functions/smoke-hourly-dispatch.mts` e `smoke-daily-dispatch.mts`, che chiedono a GitHub un `workflow_dispatch` su `main` e non fanno altro. Girano solo sul deploy pubblicato e non hanno un URL. Si provano dalla pagina Functions del sito su Netlify, con «Run now». Se la chiamata fallisce la funzione fallisce e non riprova: il giro mancato lo segnala Healthchecks. Superare le invocazioni del piano gratuito di Netlify metterebbe in pausa tutti i siti dell'account.

Il token sta nella variabile d'ambiente `SMOKE_DISPATCH_TOKEN` di Netlify. È un fine-grained PAT del maintainer con questi limiti:
- vale per il solo repo `E-Lop/entro`, con il solo permesso *Actions: write*;
- scade dopo un anno.

La variabile è segnata come segreta («Contains secret values»), quindi Netlify la maschera nell'interfaccia, nell'API, nella CLI e nei log di build. Ha un valore solo nel contesto **Production**. Deploy Previews, Branch deploys, Preview Server & Agent Runners e Local development restano vuoti, perché le funzioni pianificate girano solo sul deploy pubblicato: così la build di una pull request, anche da un fork, non riceve il token. Sul piano gratuito invece una variabile non si può limitare alle sole Functions, quindi il token lo vedono anche la build di produzione e gli script d'installazione delle dipendenze. Il rischio è accettato, perché il danno possibile è limitato:
- chi lo ruba può avviare, annullare o spegnere workflow, ma non scrivere codice né leggere secret;
- una corsa avviata su un altro ramo non riceve i secret dell'Environment `production`;
- se i giri venissero spenti, Healthchecks avviserebbe.

Per rinnovarlo:
1. si rigenera il token su GitHub, in *Settings → Developer settings → Fine-grained tokens*;
2. si sostituisce su Netlify il valore di Production, lasciando vuoti gli altri contesti;
3. si fa un deploy nuovo, perché le funzioni leggono le variabili del deploy in cui sono nate;
4. si prova con «Run now».

**Secret.** Il job che tocca la produzione legge i secret dall'Environment `production`, che va legato al solo ramo `main`: così una pull request non li vede. La regola sul ramo la imposta il maintainer nella #189, prima di metterci i secret. Fino ad allora l'Environment può non esistere: lo crea GitHub, senza regole, al primo giro che lo nomina. Sono otto secret, nessuno è la chiave `service_role`, e li crea il maintainer:

- `SMOKE_SUPABASE_URL`, `SMOKE_SUPABASE_ANON_KEY`, `SMOKE_A_EMAIL`, `SMOKE_A_PASSWORD`, `SMOKE_B_EMAIL`, `SMOKE_B_PASSWORD`, con le sentinelle della #189;
- `HEALTHCHECKS_HOURLY_URL` e `HEALTHCHECKS_DAILY_URL`, gli indirizzi dei due controlli, con l'account Healthchecks e l'app Pushover della #190. Sono secret perché chi li conosce può mandare segnali falsi.

Ogni passo riceve solo i secret che usa: `npm ci` non ne vede nessuno. Finché ne manca uno il giro si ferma al primo passo, verde, e l'avviso della corsa nomina quelli mancanti (`scripts/smoke/require-secrets.sh`). Quando la #189 li crea, i giri partono da soli. L'eccezione è `smoke-deploy.yml` lanciato a mano: senza secret è rosso, perché chi lo lancia vuole una prova.

**Healthchecks.** I due giri pianificati passano dentro `scripts/smoke/healthchecks.mjs`, che manda il segnale d'inizio, esegue il giro e manda quello di successo o di fallimento. Un fallimento avvisa subito. Un segnale che non arriva avvisa allo scadere della tolleranza, ed è il caso del giro che non parte: la funzione di Netlify che non chiama o riceve un errore, GitHub che non avvia la corsa chiesta, un workflow spento, le Actions sospese. Gli avvisi arrivano solo quando i due controlli esistono, e li crea il maintainer: Healthchecks consegna gli avvisi su Pushover, e l'email di GitHub sui fallimenti fa da seconda strada. **Dopo aver creato un controllo, il primo giro si lancia a mano:** un controllo che non ha mai ricevuto un segnale resta «new», e da «new» Healthchecks non avvisa, nemmeno se il giro non parte mai. Il giro manda il segnale solo se nell'Environment ci sono tutti i secret, compreso l'indirizzo del controllo: senza, si ferma verde al primo passo e il controllo resta «new». Dopo il giro si guarda su Healthchecks che il controllo sia uscito da «new». Periodo e tolleranza sono quelli decisi nella #185:

| Controllo | Periodo | Tolleranza |
|---|---|---|
| ogni ora | 1 ora | 30 minuti |
| giornaliero | 1 giorno | 2 ore |

La tolleranza si conta dall'ultimo segnale. Se il giro prima è partito in orario, un solo giro orario che non parte avvisa. Se invece il giro prima è partito con mezz'ora di ritardo, il turno mancato subito dopo può non avvisare. Esempio: successo alle 10:50, giro delle 11:17 mancato, successo alle 12:17. Fra i due segnali passano 87 minuti, meno di 1 h + 30 min. Avvisano invece due turni mancati di fila.

### Quando arriva un avviso

Il log della corsa dice il nome del test e la categoria dell'errore, mai un valore letto dalla produzione: il repo è pubblico.

- **Fallimento del giro orario o di quello dopo il deploy.** Si apre la corsa nella scheda Actions e si legge la categoria. Una lettura che fallisce su `lists` o `foods` è la forma della #179: si guarda prima l'ultimo `db push`, poi l'ultimo deploy. Se il rosso arriva subito dopo un deploy, su Netlify si ripubblica il deploy precedente, poi si cerca la causa.
- **Fallimento del giro giornaliero.** Se il ripristino è verde e la suite nel browser no, l'API funziona e la schermata no: la categoria dice quale card manca o quale etichetta è sbagliata.
- **Segnale mancato, senza un fallimento.** Il giro non è partito, o si è piantato.
  - Prima si guarda la corsa: nella scheda Actions, se ce n'è una `workflow_dispatch` all'ora attesa.
  - Se non c'è, si guarda il log della funzione su Netlify (pagina Functions, `smoke-hourly-dispatch` o `smoke-daily-dispatch`). Il log dice il codice con cui GitHub ha risposto, mai il token.
  - Un **401** vuol dire token scaduto o revocato: si rinnova come detto sopra.
  - Se il log manca del tutto, la funzione non è partita: si controlla che l'ultimo deploy di produzione sia pubblicato e la contenga.
  - Se la corsa non è partita, si guarda anche che il workflow sia attivo. Uno spento si riaccende con `gh workflow enable smoke-hourly.yml` (o `smoke-daily.yml`).
- **«il sito non ha servito il commit atteso»** in `smoke-deploy.yml`: il deploy di Netlify è fallito o è ancora in coda. Si guarda il log del deploy su Netlify.
- **«Giro saltato: all'Environment production mancano …»**: non è un guasto, mancano i secret nominati.

Un giro si rilancia a mano dalla scheda Actions, o con `gh workflow run <file> --ref main`.

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

Serve Node ≥ 22.18, perché il comando esegue i suoi moduli TypeScript senza build, e la CLI Supabase v3: le sue letture usano `db query --read-only`, che la v2 non ha e senza il quale la v3 chiede una conferma su ogni query alla produzione (#266). I passi:

1. **Precondizioni**: CLI v3, token, albero pulito, nessun `SUPABASE_PROJECT_ID` nell'ambiente o in un `.env` (nella CLI v3 rinomina i container, nella v2 sceglie anche il progetto ospitato), e le migrazioni che mancano in produzione devono essere **esattamente** quelle nuove del ramo. Il push applica tutto ciò che manca: il 22 settembre mancava anche una migrazione di agosto.
2. **Backup**: `backup_pre<issue>_<data>-<ora>_{schema,data}.sql` nella radice (per esempio `backup_pre184_20260929-153012_schema.sql`: due corse nello stesso giorno non si sovrascrivono), ignorati da git, permessi 600.
3. **Diff pg-delta fra le migrazioni di `main` e la produzione**, cioè tutte tranne quelle del ramo, che il diff mostrerebbe sempre. **Blocca**: tolte le derive dichiarate, qualunque differenza ferma il comando e viene elencata. Una voce dichiarata che non compare più nel diff viene segnalata, senza fermare.
4. **Impronta di produzione**, solo catalogo:
   - funzioni di `public` con corpo, `search_path` e permessi;
   - policy di `public` e `storage`;
   - trigger su `auth.users`;
   - permessi, RLS e privilegi di default di `public`;
   - bucket e categorie.
5. **Stack ombra** `entro-prodshape`, con lo stack di sviluppo fermo ma i suoi volumi conservati. Lo stack di sviluppo ha il nome che gli dà la CLI: il `project_id` di `supabase/config.toml`, o il nome della cartella se manca; nella configurazione dell'ombra quel `project_id` è sostituito, non ripetuto (#258). Ci si carica la forma di produzione: il dump di schema, più ciò che il dump non porta (policy di storage, trigger su `auth.users`, bucket, i permessi esatti e le categorie). La sua impronta deve essere identica a quella di produzione, o il comando si ferma con «forma di produzione non fedele» e nomina gli oggetti.
6. **Prova**: le migrazioni del ramo, poi pgTAP e la suite di smoke (`npm run smoke:local`) sullo stack ombra.
7. **Pulizia**, anche su errore o Ctrl-C:
   - si toglie lo stack ombra, con i soli volumi `com.supabase.cli.project=entro-prodshape`;
   - riparte lo stack di sviluppo;
   - il comando controlla che utenti, alimenti e volumi siano quelli di prima.
8. **Esito**: se è tutto verde stampa `supabase db push --linked --dry-run` e `supabase db push --linked`. **Il push lo fai tu**: il comando non lo fa mai.

**Dopo il push**, ultimo passo della procedura e prima del merge, il giro contro la produzione: `gh workflow run smoke-deploy.yml --ref main`, poi si aspetta la corsa verde con `gh run watch`. Lanciato a mano il giro non si ferma verde per mancanza di secret, come fa al push: senza secret è rosso, quindi un verde vuol dire che ripristino, livelli e browser hanno girato. Non aspetta nessun deploy: prova la suite API e la PWA servita contro lo schema appena cambiato, cioè il controllo che durante la #179 mancava. Se è rossa non si mergia, e la categoria si legge come in «Smoke in produzione».

Durate misurate: **129 secondi** per la prima corsa vera contro la produzione, il 28 settembre 2026, backup compresi; da 70 a 80 secondi in modalità locale. In tutte e due, circa 30 secondi sono l'avvio dello stack ombra. Lo stack di sviluppo resta fermo per circa un minuto e mezzo.

**Quando si ferma**, il messaggio dice il passo e cosa guardare; i dettagli stanno nel log, di cui stampa il percorso.
- Al passo 1, una migrazione mancante che non è del ramo si decide prima: o entra in una sua PR, o si spiega perché va con questa.
- Al passo 3, la produzione ha qualcosa che le migrazioni di `main` non producono, o il contrario. Si decide voce per voce, col criterio della #182: sui permessi vince il più restrittivo; sul corpo di una funzione vince il repo solo se quello di produzione è sbagliato, altrimenti il repo si adegua. La correzione è una migrazione in una sua PR, prima di questa.
- Al passo 5, un oggetto diverso vuol dire che la copia non è fedele: la prova non vale finché non lo è.
- Al passo 6, la migrazione ha rotto qualcosa sulla forma di produzione: è esattamente il caso della #179.

**Derive dichiarate.** Ciò che è proprio dell'ambiente e non può entrare nelle migrazioni sta in `scripts/prepush/declared-drift.json`: oggi le estensioni `pg_cron` e `pg_net`, accese dalla dashboard, e il job `send-expiry-notifications`, che contiene l'URL del progetto. Ogni voce ha un nome, la ragione per cui non può essere uguale, e le espressioni regolari che riconoscono i suoi statement nel diff, ancorate all'inizio (per esempio `^CREATE EXTENSION "pg_cron"`). Una voce nuova si aggiunge in una PR, con la ragione: senza, il comando non parte. Il test del pre-push controlla il file contro il diff vero di produzione del 12 novembre 2026 (`tests/fixtures/`, con l'URL del progetto tolto).

**Autoverifica.** `npm run db:prepush -- <issue> --local` fa tutto uguale, ma con lo stack di sviluppo al posto della produzione: nessun token e nessun push, e i backup vanno nella cartella temporanea della corsa. Con `PREPUSH_TAMPER_SQL=<file.sql>`, accettato solo in locale, il file si esegue sullo stack ombra fra il caricamento e il confronto delle impronte. Serve a provare che il confronto se ne accorge, per esempio togliendo una policy di `storage.objects`.

## Pull request

Prima di aprire una PR:

- mantieni lo scope stretto;
- aggiorna documentazione e `CHANGELOG.md` se cambia comportamento utente;
- aggiungi test per validation, authorization, business rules e azioni distruttive;
- verifica le modifiche UI in viewport mobile.

Dopo averla aperta, chiedi la revisione di CodeRabbit con un commento `@coderabbitai review`. Il repo ha meno di 10 stelle, e sotto quella soglia CodeRabbit non parte da solo: dal 13 nov 2026 quattro PR sono state mergiate senza la sua revisione (#232). Va chiesta prima del merge, perché su una PR chiusa CodeRabbit rifiuta il comando, e prima del merge si aspetta che finisca: la risposta «Review triggered» arriva in pochi secondi e dice solo che è partita, la revisione è finita quando il check CodeRabbit della PR è completato. Va chiesta di nuovo dopo ogni push successivo: senza revisioni automatiche, i commit nuovi li rivede solo una richiesta nuova. Il piano gratuito dà una revisione l'ora per tutto il repo: se risponde «Review limit reached», si rilancia il comando all'ora che indica. Ogni suo commento riceve una risposta prima del merge, come quello di una persona. È consultivo: non blocca il merge.

**Le PR di sola documentazione non la chiedono** (deciso dal maintainer il 24 nov 2026). Sono quelle definite in «Release» qui sotto: ogni file che cambia è uno di quelli che la CI salta in `paths-ignore`. Il limite di una revisione l'ora vale per tutto il repo, e una pagina di documentazione in coda dietro una PR di codice aspettava un'ora per niente. Basta un file fuori da quei percorsi, anche in una PR quasi tutta di testo, perché la revisione si chieda come sopra.

Usa Conventional Commits per i messaggi principali, per esempio `feat:`, `fix:`, `docs:`, `test:`, `chore:`.

**La parola chiave che chiude una issue va scritta in inglese**, anche in un messaggio per il resto in italiano: `Closes #123`, non «Chiude #123». GitHub riconosce solo `close/closes/closed`, `fix/fixes/fixed`, `resolve/resolves/resolved`, e ignora in silenzio qualunque altra cosa — quindi la issue resta aperta e non c'è nessun errore che lo segnali. La convenzione «documentazione in italiano» non si applica qui: quelle parole non sono prosa, sono l'interfaccia con cui la PR parla al tracker.

## Release

Entro **non ha un commit di release separato**: la PR di feature porta anche il rilascio. Il tag punta poi al commit di squash-merge di quella stessa PR.

Una PR di sola documentazione non porta una release: niente versione, niente sezione nel CHANGELOG, niente tag (#104, #105). È di sola documentazione quando ogni file che cambia è uno di quelli che la CI salta in `paths-ignore` (`.github/workflows/ci.yml`): un file `.md`, la cartella `docs/`, `LICENSE`, `.github/ISSUE_TEMPLATE/`. Basta un file fuori da questi percorsi perché valga quanto segue.

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
