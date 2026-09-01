# Changelog

Tutte le modifiche rilevanti al progetto Entro sono documentate in questo file.

Il formato segue [Keep a Changelog](https://keepachangelog.com/it/1.1.0/)
e il progetto aderisce al [Semantic Versioning](https://semver.org/lang/it/).

## [1.11.12] - 2026-09-01

### Changed
- **Le etichette dello stato di scadenza diventano una fonte sola, e c'è un guardiano che lo prova.** «Scaduto», «Scade oggi» e il conteggio dei giorni erano scritti a mano dentro `FoodCard.tsx`, accoppiati alle classi Tailwind, e di nuovo sul client nativo. Coincidevano per copia manuale, e **niente avrebbe fatto rumore se avessero smesso**: la classificazione era già fonte unica (`expiry.ts`), la sua traduzione in parole no ([entro-mobile#44](https://github.com/E-Lop/entro-mobile/issues/44)).

  A schermo non cambia niente: le parole sono le stesse. Cambia dove vivono e cosa succede se divergono.

  Il testo è **dominio** e sta nel bundle di famiglia, `core/expiry-status.md`, sezione «Le parole che l'utente legge»; da lì lo trascrive `src/lib/expiryLabels.ts`, identico sui due client. I **colori** restano nel componente, ed è deliberato: `bg-destructive` qui e `bg-scaduto-fondo` di NativeWind non devono essere la stessa cosa. La linea passa fra la parola e il colore.

  Spostare le stringhe in un modulo per parte non le renderebbe uniche, solo ordinate: due moduli scritti a mano divergono come due componenti. A renderle una fonte sola è `src/lib/__tests__/expiryLabels.test.ts`, che **legge la tabella del bundle** e fa fallire il codice se dice altro. Provato che rompe in tutte e tre le direzioni: codice divergente → rosso, bundle divergente → rosso, bundle assente → **errore**, non verde — perché un test che si salta quando non trova la sorgente passa esattamente quando non sta guardando niente.

## [1.11.11] - 2026-09-01

### Fixed
- **Le categorie si mostravano in italiano ma erano ordinate per il nome inglese.** `getCategories` ordinava per `name`, la colonna canonica, mentre a schermo compare `name_it`: l'elenco era alfabetico davvero, ma in una lingua che l'utente non vede mai, e si apriva con «Pane e Pasta, Bevande, Condimenti, Latticini». Il difetto non ha sintomi — l'elenco è completo e persino ordinato — e non lo prendeva nessun test, perché `getCategories` non era coperta. Scoperto a schermo sul client nativo ([entro-mobile#47](https://github.com/E-Lop/entro-mobile/issues/47)), dove `getCategories` è lo **stesso** codice: il difetto era identico qui, e correggerne uno solo è la premessa che ha prodotto la convenzione `expiry-status-ssot`.

  **La collazione è stata misurata invece che temuta.** Il database è `en_US.UTF-8` con provider ICU e `name_it` è `text not null` senza `COLLATE`, ma gli undici nomi del seed sono ASCII con iniziale maiuscola uniforme: `order by name_it` e `order by name_it collate "it-IT-x-icu"` restituiscono la **stessa** sequenza. Una delle prove nuove tiene ferma quella precondizione e fallirà quando entrerà un accento, una minuscola iniziale o una categoria definita dall'utente — perché allora la correzione non sarà più nel client: la sintassi `order` di PostgREST porta colonna, direzione e posizione dei null e **non sa trasportare un `COLLATE`**. Servirebbe una collazione sulla colonna o una vista, cioè una migrazione.

  Cinque prove nuove (`src/lib/__tests__/foodsCategories.test.ts`), che sono tre cose diverse: che la query chieda la colonna mostrata; che sul vocabolario vero — letto dal seed nelle migrazioni, non da una lista riscritta accanto al test — i due nomi ordinino davvero diverso (`bakery`/`beverages` si inverte in «Pane e Pasta»/«Bevande»); e la precondizione sulla collazione. Nessuna vede l'ordine vero, perché l'ordinamento lo fa Postgres: la sequenza è stata verificata con una query diretta e attraverso PostgREST con la query esatta che manda il codice. Fissato come convenzione di famiglia in `ordinamento-sulla-colonna-mostrata`.

## [1.11.10] - 2026-08-22

### Security
- **Chiuse tutte e 21 le segnalazioni Dependabot aperte.** Una sola riguarda il codice che gira nel browser degli utenti — `react-router`, con cinque avvisi; le altre sedici vivono nell'albero di sviluppo (test, lint, build degli asset) e non finiscono nel bundle. La distinzione conta per la fretta, non per la decisione: sono state chiuse tutte insieme perché lasciarne aperta una parte avrebbe fatto perdere il segnale sulle prossime.
  - **`react-router` / `react-router-dom` da 7.16.0 a 7.18.2** (dipendenza di esercizio) — cinque avvisi: denial of service non autenticato per route matching inefficiente ([GHSA-chx6-hx7r-mcp5](https://github.com/advisories/GHSA-chx6-hx7r-mcp5), alta), bypass CSRF in modalità RSC ([GHSA-qwww-vcr4-c8h2](https://github.com/advisories/GHSA-qwww-vcr4-c8h2), alta), open redirect via backslash in `<Link>` e `useNavigate` ([GHSA-337j-9hxr-rhxg](https://github.com/advisories/GHSA-337j-9hxr-rhxg)), constructor injection in `deserializeErrors()` ([GHSA-h8fp-f39c-q6mh](https://github.com/advisories/GHSA-h8fp-f39c-q6mh)) e XSS in `RSCErrorHandler` ([GHSA-wrjc-x8rr-h8h6](https://github.com/advisories/GHSA-wrjc-x8rr-h8h6)). Entro non usa né RSC né SSR, quindi tre dei cinque erano inerti qui; il DoS sul route matching e l'open redirect no.
  - **`undici` a 7.29.0** via `overrides` (transitiva da `jsdom`, ambiente dei test) — cinque avvisi tra divulgazione di informazioni cross-utente nella cache ([GHSA-4cwx-7wf7-3272](https://github.com/advisories/GHSA-4cwx-7wf7-3272), alta), CRLF injection, cookie attribute injection e desincronizzazione delle risposte nell'interceptor di retry.
  - **`fast-uri` da 3.1.2 a 3.1.5** via `overrides` (transitiva da `vite-plugin-pwa` → `workbox-build` → `ajv`) — tre avvisi di host confusion, tutti per varianti del backslash e della canonicalizzazione IDN ([GHSA-4c8g-83qw-93j6](https://github.com/advisories/GHSA-4c8g-83qw-93j6), [GHSA-v2hh-gcrm-f6hx](https://github.com/advisories/GHSA-v2hh-gcrm-f6hx), [GHSA-7p8r-x3mc-p8w7](https://github.com/advisories/GHSA-7p8r-x3mc-p8w7), alte).
  - **`brace-expansion` a 1.1.18 / 2.1.4 / 5.0.9** — un solo avviso ([GHSA-3jxr-9vmj-r5cp](https://github.com/advisories/GHSA-3jxr-9vmj-r5cp), alta: DoS per espansione esponenziale di gruppi `{}` consecutivi) che conta per tre perché l'albero contiene tre major incompatibili tra loro; gli `overrides` per-parente già in essere sono stati alzati, non aggiunti.
  - **`js-yaml` da 4.2.0 a 4.3.1** via `overrides` (transitiva da `eslint`) — due avvisi di consumo quadratico di CPU: catene di merge key ([GHSA-52cp-r559-cp3m](https://github.com/advisories/GHSA-52cp-r559-cp3m)) e risoluzione di `!!omap` ([GHSA-5p4m-2wfm-xmqj](https://github.com/advisories/GHSA-5p4m-2wfm-xmqj)), entrambe alte. Resta sulla major 4 perché è quella che `eslint` si aspetta.
  - **`postcss` da 8.5.15 a 8.5.26** — path traversal nel caricamento automatico della source map precedente ([GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849), alta) e il suo fix incompleto ([GHSA-fxqj-rqcc-2cmp](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp)). Aggiunto anche come `override` perché `tailwindcss` se lo porta dietro per conto suo.
  - **`sharp` da 0.34.5 a 0.35.3** (usata solo da `scripts/generate-icons.js`) — quattro CVE ereditate da libvips ([GHSA-f88m-g3jw-g9cj](https://github.com/advisories/GHSA-f88m-g3jw-g9cj), alta).
- `npm audit`: 0 vulnerabilità. Verificati typecheck, lint, 392 test unitari, build di produzione e i 22 e2e Playwright contro Supabase locale — quest'ultimo è l'unico banco che esercita il routing reale dopo il salto di `react-router`.

## [1.11.9] - 2026-08-20

### Fixed
- **Il messaggio del server non arriva a schermo nemmeno dagli inviti.** La v1.11.8 aveva chiuso `foods.ts`; `invites.ts` restava intatto, con **quattro** percorsi che arrivano all'utente — «genera codice invito», «verifica codice», «accetta invito» e «abbandona lista condivisa». Il difetto aveva due forme distinte, e provarne una sola avrebbe lasciato credere di aver provato l'altra. **Fuga**: `createInvite`, `validateInvite` e `acceptInvite` rilanciavano il campo `error` che una Edge Function restituisce nel corpo, quindi a schermo finiva testo del server intatto — misurato, `JWT expired at 1755000000`. **Lingua**: `leaveSharedList` faceva `throw removeError`, e poiché un `PostgrestError` **non è** un'istanza di `Error` il ramo `error instanceof Error ? … : new Error('Unknown error')` cadeva sul ripiego, mostrando `Unknown error`. Ora tutti e dieci i percorsi di `invites.ts` dicono una frase italiana, e l'originale resta in `Error.cause`.
- **Le stringhe inglesi scritte da noi sparivano dietro lo stesso sintomo.** `'Unknown error'` (dieci volte), `'Not authenticated'` (quattro), `'Failed to create invite'`, `'List not found'`, `'No data returned from create_personal_list()'`: non erano messaggi del server, ma per chi legge erano indistinguibili da una fuga. Tradotte insieme, perché correggere solo la fuga avrebbe lasciato lo stesso effetto a schermo.

### Changed
- **`userFacingError` esce da `foods.ts` e diventa `src/lib/userFacingError.ts`**, condiviso con `invites.ts`. Nel farlo cambia nome: nella v1.11.8 si chiamava `erroreUtente` ed era l'**unico identificatore italiano** di tutto `src/lib` — la convenzione di fatto del progetto è codice in inglese e prosa in italiano.

## [1.11.8] - 2026-08-20

### Fixed
- **Il messaggio di Postgres non arriva a schermo, stavolta da tutte le strade.** La v1.11.7 lo dichiarava già, ma valeva per la sola `createFood`: le altre sei funzioni di `foods.ts` — `getCategories`, `getFoods`, `getFoodById`, `updateFood`, `softDeleteFood` e `updateFoodStatus` — rilanciavano ancora `new Error(error.message)`, e `useFoods` passa `error.message` a `toast.error`. Chi provava a togliere un alimento con la scrittura rifiutata leggeva `permission denied for table foods`: inglese, col nome della tabella dentro. È la stessa decisione già applicata su `entro-mobile` ([#23](https://github.com/E-Lop/entro-mobile/pull/23)), dove la copia condivisa di queste funzioni era stata sistemata due giorni prima — quindi i due client dicevano cose diverse sullo stesso errore. Ora l'utente legge un messaggio in italiano e il `PostgrestError` originale resta in `Error.cause`, disponibile a chi diagnostica ma su nessun percorso che porti a schermo.
- **Un test fissava il difetto invece di impedirlo.** `foodsSoftDelete.test.ts` asseriva `expect(error?.message).toBe('permission denied for table foods')`: verde, e verde *perché* la fuga c'era. Ora asserisce il messaggio italiano e la presenza dell'originale in `cause`.

### Changed
- **`lib` di TypeScript passa da ES2020 a ES2022**, che è ciò che serve per `Error.cause`. Verificato sulla BCD MDN `javascript.builtins.Error.cause` il 2026-08-20: Chrome 93, Firefox 91, Safari e Safari iOS 15, tutti da fine 2021 — sotto il minimo che questa PWA già richiede. Nessun altro codice cambia comportamento.

## [1.11.7] - 2026-08-18

### Fixed
- **La lista personale nasce con l'utente, nel database.** `public.create_default_list_for_user()` esisteva dalla migrazione baseline — completa, con tanto di rispetto per gli inviti pendenti — ma **nessun trigger la chiamava**: era una funzione orfana, e `git log -S "on auth.users"` non trova quel collegamento in nessun punto della storia. Nel frattempo la lista la creava il client dopo l'accesso, con la RPC `create_personal_list`. Funziona quasi sempre, ed è per questo che il buco è passato inosservato per mesi. Ma è asincrona: finché non risponde l'utente non ha una lista, e la policy di inserimento su `foods` pretende `list_id is not null` con appartenenza — quindi ogni salvataggio in quella finestra veniva rifiutato. Se poi la RPC **fallisce**, `authStore` marca il tentativo come fatto per non rientrare e l'utente resta senza lista per l'intera sessione: non una finestra, uno stato. Ora la creazione avviene nel database alla registrazione, dove non può correre con l'interfaccia, e vale anche per `entro-mobile`, che condivide questo backend. Il percorso client resta come rete di sicurezza. Chiude [#94](https://github.com/E-Lop/entro/issues/94).

### Security
- **`create_default_list_for_user` ha `set search_path = ''`.** Era `security definer` senza, dalla migrazione baseline: la convenzione condivisa [`security-definer-rpc-gating`](https://github.com/E-Lop/entro-family/blob/main/conventions/security-definer-rpc-gating.md) lo vieta perché senza `search_path` una definer è un vettore di privilege escalation. Collegarla a un trigger senza sistemarla avrebbe messo in esercizio un difetto che finora era inerte perché la funzione non veniva mai eseguita.

### Changed
- **`createFood` non tenta più una scrittura che non può riuscire.** Quando la lista mancava, il codice proseguiva con `list_id: null` e un commento che lo descriveva come «personal food», citando un trigger di auto-creazione **che non esisteva**. La policy pretende `list_id is not null`: quel percorso finiva sempre nel rifiuto della RLS. Ora si ferma prima e dice all'utente cosa fare.
- **Il messaggio di Postgres non arriva più a schermo.** L'utente vedeva `new row violates row-level security policy for table "foods"` — in inglese, col nome della tabella dentro. Il dettaglio tecnico resta nei log, dove serve.
- **Un backfill dà una lista a chi non l'ha mai avuta.** Il trigger vale da adesso in avanti; chi è passato da un fallimento della RPC era rimasto senza, e l'app non lo diceva.

## [1.11.6] - 2026-08-18

### Fixed
- **Dopo un'eliminazione il fuoco ripartiva dall'inizio del documento.** La rimozione è ottimistica: la card sparisce dalla lista *prima* che il dialogo di conferma finisca di chiudersi, e Radix prova a restituire il fuoco al pulsante di una card che non esiste più. Il fuoco cadeva su `document.body`, quindi il primo `Tab` ripartiva dall'inizio della pagina — dopo **ogni** eliminazione, anche a rete perfetta: su una lista di venti alimenti chi ne elimina tre ripercorre la lista tre volte. Ora va sulla card che ha preso il posto di quella rimossa, e sull'intestazione della lista quando la rimossa era l'ultima o la lista resta vuota. L'intestazione, che era riservata agli screen reader, diventa visibile quando riceve il fuoco — stesso trattamento del link «vai al contenuto» — perché un'intestazione `sr-only` lascerebbe senza indicatore chi naviga da tastiera guardando lo schermo. La destinazione non è una scelta di questo client: è la convenzione condivisa [`fuoco-dopo-una-rimozione`](https://github.com/E-Lop/entro-family/blob/main/conventions/fuoco-dopo-una-rimozione.md), che entro-mobile applica con `AccessibilityInfo.setAccessibilityFocus`. Chiude [#87](https://github.com/E-Lop/entro/issues/87).
- **Anche annullare la conferma perdeva il fuoco.** Difetto **preesistente e distinto** dalla #87, che dava quel percorso per sano: il dialogo è controllato — nessun `AlertDialogTrigger`, apertura da stato — e Radix non riportava il fuoco al pulsante che l'aveva aperto. Misurato su Chromium: finiva su `document.body` esattamente come dopo un'eliminazione. Non è emerso dai test di componente ma dalla verifica su browser, scritta proprio perché la issue nasceva da una misura del fuoco e non da jsdom.
- **Il fuoco torna sulla card quando l'eliminazione fallisce.** `onError` ripristina la lista e la card ricompare: senza questo, il fuoco restava dove l'aveva messo la rimozione, cioè su una riga che non è più quella che l'utente stava guardando, e nel momento in cui è già disorientato dall'errore. È l'obbligo simmetrico che la issue non menzionava.

## [1.11.5] - 2026-08-18

### Changed
- **Fast Refresh non perde più lo stato dei componenti a ogni salvataggio.** I cinque warning `react-refresh/only-export-components` non erano rumore: un modulo che esporta insieme un componente e qualcos'altro non è ricaricabile a caldo, quindi salvando quel file l'albero viene rimontato e lo stato locale sparisce — un costo pagato a ogni modifica di `BarcodeScanner`, `ThemeProvider` e delle card apribili. `localizeScanError` esce da `BarcodeScanner.tsx`, `ThemeContext` e i suoi tipi escono da `ThemeProvider.tsx`, e contesto e hook escono dal file di `SwipeableCardProvider`. Nessun comportamento toccato: gli spostamenti sono meccanici e i test lo verificano.
- **La regola di Fast Refresh non si applica più a `src/components/ui/`.** Quei componenti sono **vendorizzati**: li genera la CLI di shadcn e li riscrive `shadcn add` a ogni aggiornamento. Che `button.tsx` esporti `buttonVariants` accanto a `Button`, e `form.tsx` esporti `useFormField`, è la convenzione dell'upstream: spostare quegli export li farebbe divergere, e il primo aggiornamento li rimetterebbe com'erano. La regola resta accesa ovunque altrove, ed è stata rispettata spostando il codice, non zittendola.

## [1.11.4] - 2026-08-18

### Fixed
- **Il logout lasciava l'utente dentro l'app quando Supabase rifiutava `signOut`.** `AppLayout` navigava al login solo sul percorso felice: se la chiamata falliva non succedeva nulla oltre a un toast rosso, e l'utente restava sulla dashboard a guardare i propri alimenti serviti dalla cache di React Query — con i token già rimossi da `localStorage` dalla [v1.11.0](#1110---2026-08-13). Fino al ricaricamento della pagina l'app mostrava i dati di una sessione che non esisteva più. La domanda che decideva la forma del rimedio — se supabase-js emetta `SIGNED_OUT` anche sul percorso d'errore — non è stata risolta leggendo la documentazione ma montando il client vero con `fetch` sotto controllo (`lib/__tests__/supabaseSignOutEvents.test.ts`): `_signOut` **ingoia** 401, 403 e 404 e prosegue fino a `_removeSession()`, mentre su ogni altro errore ritorna **prima** di rimuoverla. Quindi la sessione scaduta lato server — il caso che sembrava il più probabile — era già gestita, e il difetto si manifesta davvero quando la **rete cade**: lì nessun evento viene emesso, `authStore` resta pieno e `ProtectedRoute` non interviene. `signOut()` ora ritorna anche `localSessionCleared`, ed è quello il discriminante: se i token locali sono spariti l'utente **è** uscito da questo browser e va portato al login, che Supabase abbia risposto o no. Se invece è la pulizia a fallire — `localStorage` bloccato dal browser — l'utente non viene buttato fuori, perché i token possono essere ancora lì e mandarlo al login mentirebbe sullo stato del dispositivo.
- **L'avviso di logout fallito non è più il messaggio del server.** `useAuth` mostrava `error.message` così com'era: testo in inglese, e per la sessione scaduta contiene l'identificativo di sessione (`Session from session_id claim in JWT does not exist`). Un avviso a schermo non è più innocuo di una riga di log — uno screenshot lo porta più lontano. Ora il messaggio è nostro e dice la sola cosa che serve, distinguendo i due casi: uscito da qui ma forse ancora dentro altrove, oppure disconnessione non completata. Il dettaglio tecnico resta nei log, via `logError`.

## [1.11.3] - 2026-08-14

### Fixed
- **`safeLog` dava per scontato che `error.message` fosse testo, e non lo è.** Tutta la protezione introdotta dalla v1.10.7 poggiava su un assunto: stampare il solo messaggio dell'errore, senza le proprietà, basta. Non basta. `_getErrorMessage` di `@supabase/auth-js` (v2.98.0, `dist/main/lib/fetch.js`) cerca nell'ordine `msg`, `message`, `error_description`, `error` — e se non trova nessuno di quei campi ripiega su `JSON.stringify(err)`. Una `Response` non ne ha nessuno, quindi finisce **serializzata dentro `error.message`**: su un client con `fetch` polyfillato ne escono URL con query, header e handle del corpo. Ora `messageOf` riconosce un messaggio che è in realtà un oggetto e lo sostituisce con il solo stato HTTP quando l'errore ne porta uno numerico — è la parte diagnostica, ed è un numero, che non può portarsi dietro né URL né corpo. Per i valori che non sono `Error` è sparito anche `String()`: su un array univa gli elementi e su un oggetto con `toString()` proprio era l'oggetto stesso a decidere cosa stampare. Passa una stringa; di qualunque altra cosa resta il tipo. Scoperto eseguendo un logout fallito su `entro-mobile`, dove il polyfill React Native rende il difetto visibile; su entro la `Response` nativa serializza a `{}`, ma il ripiego di `auth-js` vale per **qualunque** oggetto privo di quei quattro campi, e le proprietà proprie un oggetto qualunque ce le ha.

### Security
- **I `console.*` con un secondo argomento non stampano più le proprietà degli errori, in nessun punto rimasto.** `console.error('contesto:', error)` non stampa solo il messaggio: stampa anche le **proprietà** dell'oggetto, ed è lì che i client Supabase attaccano i dati della risposta — la sessione compresa. Nessuna riga stampava un segreto di proposito: uscivano di rimbalzo. La [v1.10.7](#1107---2026-08-11) aveva coperto i percorsi auth; qui passano gli altri **30 punti in 15 file**, da `logError`/`logWarn` di `lib/safeLog.ts`. I due che potevano portarsi dietro un token sono la creazione di un signed URL e la sottoscrizione push, e sono i due che il test esegue davvero invece di limitarsi a rileggerli.
- **Il percorso immagine non finisce più intero nel messaggio di errore dei signed URL.** `getSignedImageUrls` interpolava il percorso nel testo del log, e per le righe più vecchie quel «percorso» è l'URL firmato completo — che porta il token nella query. Ora passa da `redactUrl`, che tiene origine e percorso e butta la query. Un percorso d'archivio normale (`utente/foto.jpg`) resta invece leggibile: sapere *quale* immagine è fallita è l'unico motivo per cui quel log esiste.

### Added
- **Una regola eslint impedisce al difetto di rientrare.** Finora niente lo impediva meccanicamente: il prossimo `console.error('contesto:', error)` scritto per abitudine lo reintrodurrebbe, e la v1.10.7 ha dimostrato che a rileggere il codice a occhio non si vede. `no-restricted-syntax` ora rifiuta come **errore** qualunque `console.error/warn/log/info/debug` con più di un argomento. L'ambito è tutto `src/`, non solo `lib/` e `stores/`: due dei punti più a rischio — `hooks/useSignedUrl.ts` e `components/settings/DeleteAccountDialog.tsx` — stanno fuori da entrambe quelle cartelle, e un ambito che esclude i punti pericolosi è peggio di nessun ambito, perché sembra copertura. Le tre eccezioni (i due `console.*` dentro `safeLog.ts`, che sono il punto d'uscita autorizzato, e l'avviso di sicurezza strutturato di `authStore.ts`) sono marcate una per una con la motivazione.
- **Il test dei log esegue i due flussi che possono perdere un token.** `lib/__tests__/noSecretsInLogs.test.ts` fa fallire davvero la creazione di un signed URL e la `subscribe` push, con un JWT sentinella appeso all'errore, e verifica che in console non finisca. Un caso in più tiene ferma la direzione opposta: che il percorso d'archivio normale resti nel log, perché una redazione che cancella a caso smette di servire a diagnosticare.

## [1.11.2] - 2026-08-14

### Changed
- **Il vocabolario delle colonne `text` + `CHECK` ha una sola fonte in TypeScript, e i tipi lo fanno rispettare.** `foods.status`, `foods.storage_location` e `foods.quantity_unit` non sono `enum` di Postgres: sono `text` con un `CHECK`, e il generatore di tipi Supabase non legge i check constraint. Da `supabase gen types` uscivano quindi come `string` e `string | null`, così `updateFoodStatus(id, 'banana')` compilava e lo sbaglio si manifestava come 400 a runtime invece che come errore del compilatore. Gli enum Zod di `validations/food.schemas.ts` diventano la fonte unica lato TypeScript — sono gli unici dei punti che ridichiaravano quelle liste a validare davvero qualcosa — e un nuovo `lib/supabase.overrides.ts` li usa per restringere le righe generate. Passando dal punto in cui il client viene costruito, il restringimento vale anche per le scritture. Sono sparite sei copie inline del vocabolario, sparse fra `lib/foods.ts`, `types/openfoodfacts.types.ts` e tre componenti.

### Added
- **Un test tiene ferma la cucitura fra il `CHECK` e gli enum Zod.** Ridurre il numero di definizioni non basta: le due che restano — il constraint, unico punto che rifiuta davvero una scrittura, e gli enum — possono ancora divergere, e lo farebbero in silenzio. `lib/__tests__/foodVocabulary.test.ts` legge i valori ammessi dal DDL delle migrazioni e li confronta con gli enum, e fallisce anche se una migrazione successiva ridefinisce quei constraint, perché a quel punto starebbe leggendo una riga di SQL superata.

## [1.11.1] - 2026-08-12

### Fixed
- **La validazione della quantità accettava valori che il database rifiuta.** Lo schema Zod usava `min(0)` — «La quantità non può essere negativa» — mentre la colonna è `numeric(10,2)` con `check (quantity > 0)`: lo zero superava la validazione del form e faceva fallire la scrittura. Il minimo non è nemmeno «maggiore di zero» sul valore digitato, ma **0.01**, il più piccolo positivo che la colonna sa memorizzare: un 0,004 passerebbe un controllo `> 0` e diventerebbe `0.00` alla scrittura, dove il CHECK scatta comunque. `null` resta valido e continua a significare «quantità non tracciata», che è cosa diversa da zero — se non ne hai più, l'alimento va toglierlo dalla lista. L'editor rapido non ci cadeva, perché `src/lib/quantity.ts` colmava già il divario lato stepper; ci cadeva il form.

## [1.11.0] - 2026-08-12

### Added
- **L'eliminazione di un alimento ora chiede com'è finita.** La conferma non domanda più «sei sicuro?» — una domanda che non produce nessun dato, visto che l'utente ha già deciso premendo Elimina — ma offre tre uscite: «L'ho consumato», «L'ho buttato», «Toglilo e basta». La terza resta deliberatamente **senza esito**, perché è l'errore di inserimento: sporcare la metrica anti-spreco con gli errori la renderebbe inutile quanto lasciarla vuota. È la stessa interazione di prima, chiesta diversamente.
- **Un menu azioni sempre presente sulle card.** Il pulsante ⋮ apre Modifica ed Elimina alle larghezze da telefono. I pulsanti in fondo alla card sono `hidden sm:flex`, e `display: none` non è «nascosto visivamente»: toglie dall'albero di accessibilità. Sotto i 640px lo swipe era l'unica strada, ed è `aria-hidden` — quindi su telefono con uno screen reader **non esisteva alcun modo di modificare o eliminare un alimento**. Un gesto basato su percorso deve avere un'alternativa a puntatore singolo: WCAG 2.5.1 *Pointer Gestures*, livello A. Il menu è `sm:hidden`, complemento esatto del footer: una sola strada a ogni larghezza. Lo swipe resta invariato per chi lo usa.

### Changed
- **Eliminare un alimento non distrugge più la riga.** Era una `DELETE` vera, quindi registrare l'esito e poi eliminare avrebbe scritto un dato e subito dopo l'avrebbe buttato: la metrica anti-spreco non avrebbe trovato niente. Ora è una sola `UPDATE` che imposta `deleted_at`, azzera `image_url` e registra l'esito — atomica, senza stati intermedi, e offline **una sola voce in coda** invece di due che si possono separare. `getFoods` già filtrava su `deleted_at IS NULL`, quindi per chi usa l'app la lista si comporta esattamente come prima.
- **L'immagine invece viene cancellata davvero**, da Storage o da IndexedDB se era ancora in coda di caricamento. È un blob pesante che non serve a nessuna metrica, e tenerlo farebbe crescere lo spazio occupato a ogni eliminazione. È l'unica parte irreversibile: la riga si può ripristinare, la foto no. Se la cancellazione fallisce l'alimento esce comunque dalla lista — l'utente ha chiesto quello, e un blob rimasto indietro è un problema di spazio, non un motivo per disobbedire.

- La cancellazione dell'immagine, quando fallisce, logga tramite `logError` (introdotto dalla 1.10.7) invece che con un messaggio muto: il branch era partito prima che quel modulo esistesse.

### Removed
- La funzione di eliminazione definitiva (`deleteFood`), rimasta senza chiamanti. Restava accanto a `softDeleteFood` come alternativa apparentemente equivalente, ed è esattamente il tipo di ambiguità che ha prodotto questa situazione: `softDeleteFood` e `useUpdateFoodStatus` esistevano da tempo e non erano mai state collegate a niente.

## [1.10.7] - 2026-08-11

### Security
- I log dei percorsi auth non possono più contenere token di sessione né codici invito. Nessuna riga stampava un segreto di proposito: uscivano di rimbalzo, perché `console.error('contesto:', error)` stampa anche le **proprietà** dell'errore, e i client Supabase ci attaccano i dati della risposta — inclusa la sessione che stavano tentando di rinnovare. Nuovo modulo `src/lib/safeLog.ts`: `logError`/`logWarn` stampano il solo messaggio, ripulito dalle stringhe con la forma di un JWT, applicati in `auth.ts`, `authStore.ts`, `useRealtimeFoods.ts` e `SignUpPage.tsx`. Per il punto dell'invito non basta redigere e il messaggio del server non viene stampato affatto: `register_pending_invite` riceve il codice fra i parametri, quindi è il messaggio stesso a poterlo contenere. La PWA non ha Sentry — quei log restavano nella console del browser, non in un servizio esterno — ma erano comunque visibili a chiunque aprisse i devtools, su una macchina condivisa o durante una condivisione schermo. (#79)
- Ripulito anche `src/lib/invites.ts`, che non era nell'elenco della issue e rendeva il resto aggirabile: `registerPendingInvite` stampava l'errore della RPC un frame sotto il punto già sistemato in `SignUpPage`, quindi il codice invito sarebbe finito in console lo stesso. Lì, come nel chiamante, il messaggio del server non viene stampato affatto; gli altri tredici punti del modulo passano da `logError`.
- Anche `VerifyEmailPage` passa da `logError`: chiama `supabase.auth.getUser()` direttamente e stampava l'errore grezzo, quindi era un percorso auth a tutti gli effetti pur non comparendo nell'elenco della issue.
- L'avviso di sicurezza sull'auto-login inatteso non logga più l'URL completo, ma solo origine e percorso. Era il punto più esposto e non era nell'elenco della issue: stampava `window.location.href` **proprio quando sospettava che l'URL contenesse un token di auth**, che è lo scenario descritto dall'avviso stesso. Query e frammento vengono scartati interi invece che ripuliti, perché il `refresh_token` di Supabase è opaco e nessun pattern lo intercetterebbe.

## [1.10.6] - 2026-08-11

### Security
- Il logout pulisce lo storage anche quando Supabase rifiuta `signOut()`. La pulizia stava dentro il `try`, dopo il `throw` che segnalava l'errore, quindi non veniva mai eseguita: con una sessione già scaduta lato server l'utente premeva «esci» e i token `sb-*` restavano in `localStorage`, leggibili da chiunque aprisse i devtools. Su un browser condiviso — computer di famiglia, postazione in ufficio, portatile prestato — è la differenza fra un logout e un logout apparente. La pulizia è ora fuori dal percorso d'errore, e a sua volta protetta perché `localStorage` solleva quando il browser blocca lo storage: nessun wrapper di `src/lib/auth.ts` deve mai sollevare. L'errore riportato al chiamante resta quello di Supabase, che è la causa. (#78)

## [1.10.5] - 2026-08-11

### Changed
- Il filtro della dashboard non si chiama più «stato» ma «scadenza», nel codice e nell'interfaccia. Sulla tabella `foods` convivono due assi indipendenti: `deleted_at` («lo traccio ancora?») e `status` («com'è finita?», con i valori `active`/`consumed`/`expired`/`wasted`). Il filtro non ha mai letto la colonna `status` — confronta `expiry_date` con la data di oggi — e chiamarlo «stato» faceva sembrare collegate due cose che non lo sono. `FilterParams.status` diventa quindi `FilterParams.expiry`, con i valori `all | not_expired | expiring_soon | expired`.
- Nell'interfaccia, l'etichetta del gruppo passa da «Stato» a «Scadenza» e l'opzione «✅ Attivi» diventa «✅ Non scaduti». È la metà visibile della stessa ambiguità: quell'opzione ha sempre filtrato per «non scaduto», mentre «Attivi» richiamava il valore `active` del ciclo di vita, che è un'altra cosa.
- I link già salvati e condivisi continuano a funzionare: il vecchio parametro `?status=` resta accettato in lettura, e `status=active` viene tradotto in `expiry=not_expired` conservando il significato e non la parola. In scrittura l'URL usa solo il nome nuovo. La mappatura vive ora in `src/lib/foodFilterParams.ts`, estratta dalla dashboard perché una promessa verso link esterni va coperta da test senza dover montare l'intera pagina.

### Fixed
- Un parametro d'URL fuori vocabolario non svuota più la lista: `?storage=banana` finiva così com'era nel confronto con `food.storage_location` e non lasciava passare nessun alimento. Ora ogni parametro non riconosciuto (`storage`, `expiry`, `sortBy`, `sortOrder`) torna al proprio default. Per `sortBy` e `sortOrder` il valore non validato era finora innocuo a valle, ma passava comunque.

## [1.10.4] - 2026-08-07

### Fixed
- I link di navigazione isolati delle schermate auth ("Password dimenticata?" e i tre "Torna al login") erano alti 17px, sotto i 24×24 px CSS richiesti da WCAG 2.2 SC 2.5.8 (AA): ora hanno un'area toccabile di almeno 44px, allineata alla soglia della app nativa. I link inline in una frase ("Non hai un account? **Registrati**") restano invariati, perché il criterio li esenta esplicitamente. Nuovo e2e che misura la geometria reale invece delle classi CSS.

## [1.10.3] - 2026-07-20

### Security
- La membership a una lista è ora ottenibile solo tramite un invito valido, mediata da RPC `SECURITY DEFINER`: rimosso l'INSERT diretto client su `list_members` (un utente autenticato non può più auto-aggiungersi a liste altrui) e ristretta la lettura degli inviti (niente più harvest di `short_code` altrui). (#70, #71)

## [1.10.2] - 2026-07-20

### Fixed
- Il menu **Inviti** non sfora più il bordo dello schermo su mobile: le descrizioni delle opzioni (racchiuse nei pulsanti) ora vanno a capo invece di essere troncate a destra. La causa era il `whitespace-nowrap` di default del componente `Button`, che impediva l'a-capo del testo lungo dentro il dialog a larghezza fissa. (#59)

## [1.10.1] - 2026-07-20

### Security
- Chiuso l'accesso del ruolo `anon` alla tabella `public.invites` (#67): rimossi i GRANT legacy e le due policy `USING(true)` che permettevano a un client anonimo di leggere e aggiornare **tutti** gli inviti. L'unico accesso anonimo legittimo (registrazione email su invito pending durante il signup) passa ora dalla RPC `register_pending_invite` `SECURITY DEFINER`; le policy SELECT/UPDATE su `invites` sono ristrette a `authenticated`; revocati anche i privilegi di scrittura legacy di `anon` su `foods`/`lists`/`list_members`/`categories` (difesa in profondità). Migration additiva, deploy in produzione con backup preventivo e verifica end-to-end. (#69)

## [1.10.0] - 2026-07-06

### Added
- Baseline Supabase ricostruttiva in `supabase/migrations/` per rendere `supabase db reset` riproducibile da clone pulito.
- CI GitHub Actions con lint, typecheck, test e build su push/PR.
- Documenti contributor/community: `CONTRIBUTING.md`, `SECURITY.md`, template issue e template PR.
- Tipi Supabase generati in `src/lib/supabase.types.ts` con comando `npm run supabase:types`.
- E2E Playwright minimi in CI su stack Supabase locale.
- Issue GitHub autosufficienti per backlog prodotto: demo mode (#54), API/MCP agenti (#51), report anti-spreco (#60), shelf-life (#61), OCR scadenza (#62), lista spesa (#63), PWA avanzata (#64), import dati (#65).
- Test unit per gli helper auth/cron delle Edge Functions (`_shared/auth.ts`) e per il toast di benvenuto invito.

### Changed
- Il client Supabase ora usa i tipi generati come fonte unica invece dei tipi manuali incorporati in `src/lib/supabase.ts`.
- La documentazione pubblica di deploy privilegia Supabase locale come ambiente di verifica, con staging remoto opzionale.
- `netlify.toml` non contiene piu' URL/key Supabase pubblicabili: quei valori passano dalle environment variables Netlify.
- `authStore.initialize()` non ricarica piu' l'intera pagina dopo accettazione invito o creazione lista personale: aggiorna la cache React Query e resta nel flusso SPA.
- Le Supabase Edge Functions condividono helper `_shared/` per CORS ristretto, risposte JSON, client service-role e validazione auth/cron secret.
- `FoodForm` valida a runtime i valori DB `storage_location`/`quantity_unit` in modifica (parsing Zod) invece di cast senza controllo.

### Fixed
- Aggiunti GRANT espliciti alle tabelle/funzione push notification nella migration dedicata, coerenti con il Data API hardening.
- La migration cron notification ora e' difensiva quando `pg_cron` non e' disponibile in locale.
- Il toast di benvenuto dopo l'accettazione di un invito compare anche quando la dashboard e' gia' montata (regressione introdotta rimuovendo il reload); prima poteva apparire solo alla visita successiva.
- L'export dati GDPR mantiene `null` esplicito per `joined_at` mancante invece di sostituirlo con la stringa `'N/A'`.

## [1.9.0] - 2026-07-02

### Added
- **Modifica rapida della quantità**: lo swipe verso destra su una card apre al volo un editor di quantità (`−  valore  +`) *sulla card stessa*, sullo stesso asse orizzontale del gesto, lasciando visibile uno spicchio della card originale per richiuderla. Sotto lo stepper, un pulsante "Modifica completa" porta alla modifica estesa di prima. Salvataggio automatico e ottimistico (funziona anche offline), passo per unità (pz/confezioni di 1, kg/l di 0,1, g/ml di 10) e tocco sul numero per digitare un valore preciso. Una sola card aperta per volta; scorrere la lista la richiude. Pensato per l'azione più frequente in cucina, con una mano.
- **Recupero notifiche disattivate**: se le notifiche push si spengono da sole (iOS invalida periodicamente la subscription senza preavviso), l'app ora se ne accorge e mostra un avviso "Le notifiche si sono disattivate. Riattivale" in home e nelle impostazioni — basta un tap per ripristinarle. Prima il permesso restava `granted` ma il dispositivo spariva dal server in silenzio, senza più notifiche. (#52)

### Changed
- Lo **swipe verso destra** sulle card non apre più direttamente la modifica completa dell'alimento, ma il nuovo editor rapido di quantità (la modifica completa resta comunque a un tap). Lo swipe verso sinistra (elimina) è invariato.
- Service worker: l'handler `pushsubscriptionchange` ri-sottoscrive seguendo il pattern canonico MDN (utile su Chrome/Firefox/Safari desktop quando il browser rinnova la subscription). Su iOS Safari l'evento non viene mai emesso (BCD `api.ServiceWorkerGlobalScope.pushsubscriptionchange_event` `safari_ios=false`, verificato 2026-06-26) → su iPhone il recupero passa dall'avviso in-app. (#52)

## [1.8.0] - 2026-06-17

> _Modifiche già in produzione su [entroapp.it](https://entroapp.it) — deploy Netlify verificato il 2026-06-17: il bundle servito conferma `navigator.storage.persist()` attivo e il nuovo `isIOS()` (`userAgent` + `maxTouchPoints`), con il check deprecato `navigator.platform`/`MacIntel` rimosso._

### Added
- **Storage persistente**: all'avvio l'app chiede al browser di esentare la cache offline (IndexedDB) dalla cancellazione automatica via `navigator.storage.persist()` (supportato su Chrome 55+, Firefox 57+, Safari/iOS 15.2+). Mitiga la perdita dei dati offline dovuta alla cancellazione ~7 giorni di iOS per lo storage non-persistente. Best-effort: su iOS Safari la concessione è euristica, installare l'app in schermata Home resta la garanzia migliore.

### Fixed
- `isIOS()` non usa più `navigator.platform` (API legacy, segnalata come deprecata da TypeScript): la detection iOS ora si basa su `userAgent` + `navigator.maxTouchPoints`. Verifica MDN: `navigator.userAgentData` è assente su Safari/iOS (quindi inutile per rilevare iOS), `maxTouchPoints` è supportato da iOS/Safari 13+. Riconoscimento di iPhone e iPadOS (che si presenta come "Macintosh") invariato, distinto da un Mac reale tramite il touch. (#47)

### Documentation
- Allineate alla realtà (verifica su MDN Browser Compatibility Data) le assunzioni di compatibilità di piattaforma in codice e documentazione: feedback aptico non attivo su Firefox (desktop rimosso in v129, Android lo no-op pur esponendo l'API), opzione `vibrate` delle notifiche limitata ad Android Chromium, detection PWA iOS che dipende da `navigator.standalone` (WebKit riporta `display-mode: fullscreen` per le PWA installate, webkit#264218), push iOS solo da 16.4+ con app in Home.

## [1.7.5] - 2026-06-16

### Fixed
- I filtri rapidi "In scadenza" e "Scaduti" ora funzionano anche offline e restano sempre coerenti con il conteggio delle card: filtro e ordinamento sono calcolati dai dati già in cache (stessa fonte dei conteggi), invece di una query separata che offline non era disponibile.

### Changed
- Aggiornato **Vite da 6 a 8** (nuovo bundler Rolldown + transformer Oxc) con i plugin correlati (`vite-plugin-pwa` 1.3, `@vitejs/plugin-react-swc` 4.3); il raggruppamento dei chunk passa da `manualChunks` a `advancedChunks`. Nessun cambiamento funzionale per chi usa l'app.
- Suite di test resa compatibile con Node 25+ (polyfill di `localStorage` per l'ambiente jsdom).

### Security
- Risolte le ultime 2 segnalazioni Dependabot:
  - **esbuild** (GHSA-gv7w-rqvm-qjhr, severità alta): l'upgrade a Vite 8 rimuove esbuild dall'albero delle dipendenze (sostituito da Rolldown/Oxc).
  - **js-yaml** (GHSA-h67p-54hq-rp68, DoS): forzato a 4.2.0 via `overrides` (dipendenza di sviluppo, tramite eslint).
- `npm audit`: 0 vulnerabilità.

## [1.7.4] - 2026-06-16

### Fixed
- **Feedback aptico onesto su iOS**: WebKit non espone la Vibration API e il workaround `<input switch>` non vibra su trigger programmatico, quindi su iPhone/Safari (anche come PWA installata) il feedback aptico non può funzionare. L'impostazione "Feedback aptico" ora compare solo dove il browser supporta davvero la vibrazione (Android) e non viene più mostrata su iOS, dove prometteva qualcosa che non poteva mantenere.
- **Movimento ridotto rispettato ovunque**: la preferenza di sistema "riduci movimento" (`prefers-reduced-motion`) è ora onorata globalmente per tutte le animazioni (spinner, swipe, transizioni, toast); la dimostrazione automatica dello swipe non parte più con il movimento ridotto.

### Changed
- Le sezioni del modulo "aggiungi/modifica alimento" (accordion) ora si aprono e si chiudono con una transizione fluida invece di comparire e sparire di scatto.

## [1.7.3] - 2026-06-11

### Removed
- Rimossa la pagina di diagnostica `/test-connection`, un residuo del setup iniziale (verifica della connessione a Supabase): non era collegata da nessuna parte dell'app ma restava raggiungibile in produzione dagli utenti autenticati, mostrando dettagli tecnici interni.

## [1.7.2] - 2026-06-11

### Changed
- Form "Aggiungi/Modifica alimento": la sezione richiudibile "Dettagli aggiuntivi", quando è chiusa, mostra ora uno sfondo neutro invece di una leggera velatura verde — il verde resta riservato agli elementi attivi dell'identità dell'app.
- Liste di alimenti più leggere su smartphone: il rilevamento del dispositivo touch è ora condiviso da tutte le card con un'unica sottoscrizione, invece di registrarne una per ogni card della lista.

### Fixed
- Eliminazione account: con una dispensa vuota (0 alimenti) la finestra non ripete più il conteggio degli alimenti a ogni apertura.

## [1.7.1] - 2026-06-11

### Security
- Aggiornate le dipendenze per risolvere 8 segnalazioni di sicurezza Dependabot ancora aperte sul branch principale:
  - `react-router` / `react-router-dom` da 7.12.0 a **7.16.0** — risolve 6 segnalazioni: una vulnerabilità di esecuzione di codice non autenticata (RCE) tramite il turbo-stream incluso, due cross-site scripting (XSS), un open redirect e due denial-of-service.
  - `vitest` da 4.0.18 a **4.1.8** — risolve la segnalazione critica di lettura/esecuzione di file arbitrari quando il server della UI di test è in ascolto (solo ambiente di sviluppo).
  - `ws` da 8.19.0 a **8.21.0** (tramite `overrides`, dipendenza transitiva di `@supabase/supabase-js`) — risolve la divulgazione di memoria non inizializzata.
- `npm audit` ora riporta 0 vulnerabilità.

### Removed
- Rimossa la dipendenza inutilizzata `@radix-ui/react-toast`: dalla revisione UI il sistema di notifiche temporanee usa `sonner`, ma la libreria Radix era rimasta nel `package.json` senza alcun utilizzo nel codice.

## [1.7.0] - 2026-06-10

### Added
- Colori semantici per gli stati di scadenza ("in scadenza" ambra, "fresco" verde) come token del tema: ora gli stati si adattano correttamente al tema scuro e restano coerenti con l'identità dell'app.

### Changed
- Pagine di autenticazione (accesso, registrazione, conferma email) uniformate a uno stile coerente basato sui token del tema: rimosso lo sfondo a gradiente, layout e tipografia allineati alle pagine di recupero password e pronti per il tema scuro.
- Dashboard e lista alimenti allineate all'identità verde del brand: lo stato selezionato delle statistiche rapide (Totali / In scadenza / Scaduti) usa ora il verde del brand invece del blu, e la card "Come funziona" passa da un tema blu a uno coerente col brand.
- Form "Aggiungi/Modifica alimento": campi (nome, categoria, posizione, data, quantità) e pulsanti principali portati a un'area tattile di almeno 44px, più comoda da toccare con una mano.
- Vista calendario ridisegnata ad agenda verticale: ora vedi l'intera settimana a colpo d'occhio in un'unica schermata, scorrendo in verticale, invece di scorrere di lato tra colonne quasi vuote. Ogni giorno mostra "Oggi"/"Domani", il numero di alimenti in scadenza e l'urgenza (oggi evidenziato in rosso, i giorni successivi in ambra).
- Filtri e ricerca allineati all'identità verde del brand: il contatore dei filtri attivi usa ora il verde invece del blu; il campo di ricerca e i menu dei filtri sono portati a un'area tattile di almeno 44px, e l'etichetta "Cancella" è visibile anche su smartphone.
- Intestazione dell'app uniformata: le icone di guida, tema e account hanno ora lo stesso stile (rimosso l'accento verde isolato sull'icona account) e un'area tattile di almeno 44px; la descrizione sotto il logo è in italiano ("Scadenze sotto controllo").
- Condivisione e inviti: la schermata "Crea invito" indica ora per quanto è valido il codice ("Valido per 7 giorni"); i titoli e i testi degli inviti sono uniformati (es. "Crea invito") e l'icona della voce "Inviti" nel menu account è più riconoscibile.
- Impostazioni: titoli e testi uniformati allo stile italiano del resto dell'app (es. "Esporta i tuoi dati", "Privacy e dati", "Zona pericolosa", "Feedback aptico"); i pulsanti di notifiche, feedback aptico, esportazione dati ed eliminazione account, le caselle degli avvisi e i menu a tendina delle notifiche sono portati a un'area tattile di almeno 44px.
- Guida utente: le icone delle sezioni sono ora neutre e coerenti (prima ognuna aveva un colore diverso, fuori dall'identità verde dell'app), i titoli sono in stile italiano come il resto dell'app, e l'istruzione per aggiungere un alimento distingue ora tra smartphone (pulsante verde tondo in basso a destra) e computer; la voce è allineata all'etichetta corrente "Crea invito".
- Tema scuro su tutte le pagine pubbliche: accesso, registrazione, conferma email, recupero password e adesione a una lista rispettano ora la preferenza di tema (chiaro / scuro / sistema). Prima queste pagine restavano sempre chiare anche con il tema scuro attivo.
- Notifiche e messaggi temporanei (toast): i colori seguono ora l'identità dell'app e si adattano al tema scuro, invece di una palette fissa con accenti azzurri fuori dal brand.
- Finestre di dialogo e conferme: i pulsanti di azione e annulla e il pulsante di chiusura (X) hanno ora un'area tattile di almeno 44px su tutta l'app; l'etichetta di chiusura è in italiano ("Chiudi").

### Removed
- Rimosse le pagine interne segnaposto Privacy (`/privacy`) e Termini (`/terms`): non erano collegate da nessuna parte dell'app (i link legali puntano già ai documenti ospitati su LegalBlink) e mostravano solo un avviso "documento in preparazione".

### Fixed
- Avvisi "sei offline" e "sincronizzazione in corso": usano ora i colori del tema (ambra per offline, verde per la sincronizzazione) invece di tinte fisse fuori dall'identità, si adattano al tema scuro e vengono annunciati agli screen reader; l'icona di sincronizzazione rispetta la preferenza di sistema "riduci animazioni".
- Invito ad attivare le notifiche: i pulsanti "Attiva"/"Non ora" e la X di chiusura hanno ora un'area tattile di almeno 44px.
- Note degli alimenti: il riquadro delle note usa ora un colore neutro del tema, leggibile anche in tema scuro (prima un'ambra fissa fuori palette).
- Accessibilità dei moduli di autenticazione: il pulsante mostra/nascondi password è ora raggiungibile da tastiera e annunciato dagli screen reader, i titoli di pagina sono heading semantici (`<h1>`) e gli stati di caricamento vengono annunciati.
- Gli errori di accesso e registrazione restano visibili come messaggio sotto il modulo invece di comparire come notifica temporanea.
- Risolto un raro reindirizzamento errato dalla pagina di conferma email alla registrazione.
- Tema scuro della Dashboard: i badge di scadenza degli alimenti e i conteggi per giorno del calendario ora si adattano allo sfondo scuro invece di restare riquadri chiari poco leggibili.
- Caricamento di lista e calendario ora annunciato agli screen reader.
- Etichetta di scadenza al singolare corretta ("1 giorno" invece di "1 giorni"); nome dell'alimento reso come heading per una navigazione più chiara con screen reader; pulsanti Lista/Calendario portati a un'area tattile di almeno 44px.
- Scanner barcode: i messaggi di errore della fotocamera sono ora in italiano e spiegano cosa fare (fotocamera non supportata dal browser, permesso negato, fotocamera occupata da un'altra app) invece del testo tecnico in inglese.
- Caricamento foto dell'alimento: il pulsante "Rimuovi" è ora sempre visibile su smartphone (prima compariva solo al passaggio del mouse, di fatto irraggiungibile da touch).
- Tema scuro del form alimento: anteprima foto, riquadri di errore e testi di aiuto del caricamento immagine si adattano ora allo sfondo scuro usando i colori del tema; il banner "alimento modificato da un altro utente" usa l'ambra di sistema.
- Accessibilità del form alimento: gli stati di caricamento (scanner, conversione foto, salvataggio) sono annunciati agli screen reader e il pulsante "Scansiona Barcode" è identificabile dal suo testo visibile, utile per i comandi vocali.
- Vista calendario: gli alimenti sono ora raggiungibili e apribili da tastiera (prima erano selezionabili solo con tocco o mouse), con area tattile di almeno 44px e struttura per giorno leggibile dagli screen reader.
- Coerenza in tema scuro dello sfondo che appare facendo swipe sulle card (verde "modifica" / rosso "elimina"): ora usa i colori del tema invece di tinte fisse.
- Guida rapida: la voce sullo stato di scadenza ora spiega che ogni alimento mostra i giorni mancanti e un'etichetta colorata (verde oltre una settimana, ambra negli ultimi 7 giorni, rossa alla scadenza e dopo), invece di elencare colori che non corrispondevano all'app e che escludevano chi non distingue bene le tinte.
- Guida utente, sezione "Stato di scadenza": ora mostra i tre stati reali dell'app con la stessa etichetta testuale e colorata che vedi sulle card ("5 giorni"/"3 giorni" su verde o ambra, "Scade oggi" e "Scaduto" su rosso), invece di elencare quattro colori — incluso giallo e arancione — che nell'app non esistono e che affidavano l'informazione al solo colore, escludendo chi non distingue bene le tinte.
- Accessibilità della Guida utente: i titoli delle sezioni sono ora heading semantici (`<h2>`) per una navigazione più chiara con screen reader (prima erano semplici riquadri senza struttura).
- Selettore del tema (Chiaro / Scuro / Sistema): l'opzione attiva è ora annunciata correttamente agli screen reader.
- Schermata di caricamento a tutta pagina: ora viene annunciata agli screen reader e rispetta la preferenza di sistema "riduci animazioni".
- Link legali nel footer (Privacy, Termini, Cookie): area tattile più ampia su smartphone e indicazione, per gli screen reader, che si aprono in una nuova scheda.
- Pulsante di disconnessione nel menu account: usa ora il colore di pericolo del tema, leggibile anche in tema scuro.
- Accessibilità del menu account: la voce "Inviti" è ora una voce di menu standard, raggiungibile con la tastiera, che chiude il menu alla selezione (prima restava aperto dietro la finestra inviti); il codice invito appena creato viene annunciato agli screen reader.
- Accetta invito: gli errori sul codice (campo vuoto, lunghezza diversa da 6 caratteri, codice non valido) compaiono ora come messaggio sotto il campo invece che come notifica temporanea, e restano visibili mentre correggi.
- Apertura di un link d'invito (/join): la pagina mostra ora il logo e una breve spiegazione dietro la finestra di adesione, invece di una finestra su sfondo vuoto.
- Le animazioni di caricamento delle finestre di condivisione rispettano ora la preferenza di sistema "riduci animazioni".
- Eliminazione account: se la password di conferma è errata, il messaggio compare ora sotto il campo e la finestra resta aperta per riprovare, invece di chiudersi mostrando solo una notifica temporanea.
- Accessibilità della pagina Impostazioni: i titoli delle sezioni (Profilo, Notifiche, Privacy e dati, Zona pericolosa…) sono ora heading semantici per una navigazione più chiara con screen reader; gli interruttori Notifiche e Feedback aptico annunciano il proprio stato attivo/disattivo.
- Notifiche: il banner "installa l'app" su iOS usa ora l'ambra di sistema (corretta anche in tema scuro); i menu a tendina di ore silenziose e numero massimo di notifiche hanno un'etichetta leggibile dagli screen reader; togliendo l'ultimo intervallo di avviso l'app spiega ora che ne deve restare almeno uno attivo, invece di non rispondere.
- Patch vulnerabilità `vite` (≤ 6.4.1): Arbitrary File Read via Dev Server WebSocket ([GHSA-p9ff-h696-f583](https://github.com/advisories/GHSA-p9ff-h696-f583), High) e Path Traversal in Optimized Deps `.map` Handling ([GHSA-4w7w-66w2-5vf9](https://github.com/advisories/GHSA-4w7w-66w2-5vf9), Moderate) — bump a `^6.4.2`
- Patch vulnerabilità `postcss` (< 8.5.10): XSS via Unescaped `</style>` in CSS Stringify Output ([GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93), Moderate) — bump a `^8.5.10`
- Patch vulnerabilità `fast-uri` (≤ 3.1.1) via npm override `^3.1.2`: path traversal via percent-encoded dot segments ([GHSA-q3j6-qgpj-74h6](https://github.com/advisories/GHSA-q3j6-qgpj-74h6), High) e host confusion via percent-encoded authority delimiters ([GHSA-v39h-62p7-jpjc](https://github.com/advisories/GHSA-v39h-62p7-jpjc), High) — transitiva da `vite-plugin-pwa` → `workbox-build` → `ajv`
- Patch vulnerabilità `@babel/plugin-transform-modules-systemjs` (≤ 7.29.3) via npm override `^7.29.4`: generazione arbitraria di codice da input malevolo ([GHSA-fv7c-fp4j-7gwp](https://github.com/advisories/GHSA-fv7c-fp4j-7gwp), High) — transitiva da `vite-plugin-pwa` → `workbox-build` → `@babel/preset-env`
- Patch vulnerabilità `brace-expansion`: DoS via "Zero-step sequence causes process hang and memory exhaustion" ([GHSA-f886-m6hf-6m8v](https://github.com/advisories/GHSA-f886-m6hf-6m8v), Moderate) — override per-parente in tre rami (`minimatch@3` → `^1.1.13`, `minimatch@5` → `^2.0.3`, fallback `^5.0.5`) perché l'API tra le major v1/v2/v5 non è retro-compatibile

## [1.6.2] - 2026-05-17

### Fixed
- Orario notifiche push allineato a 10:00 ora italiana tutto l'anno: `pg_cron` non supporta timezone per-job, quindi lo schedule è stato spostato da `0 9 * * *` (UTC) a `0 8 * * *` (UTC) — durante l'ora legale CEST le notifiche arrivavano alle 11:00 anziché alle 10:00

### Security
- Opt-in anticipato al [Supabase Data API hardening](https://github.com/orgs/supabase/discussions/45329): revocati i default privileges su `public` schema. Le tabelle esistenti restano raggiungibili (grandfathered), ma ogni nuova tabella/funzione richiederà `GRANT` espliciti — allineamento al comportamento che Supabase applicherà di default a tutti i progetti il 30 ottobre 2026
- Aggiunto `CLAUDE.md` alla root con template obbligatorio (CREATE TABLE + RLS + GRANT) per future migrazioni, così da prevenire tabelle silenziosamente non esposte

## [1.6.1] - 2026-04-04

### Changed
- Layout mobile del form inserimento/modifica alimenti: accordion a due sezioni ("Dati alimento" e "Dettagli aggiuntivi") per eliminare lo scroll su smartphone. I campi obbligatori e la quantità sono visibili in un unico schermo; foto e note sono collassate in una sezione espandibile. I pulsanti d'azione restano sempre visibili
- Rimossa la descrizione ridondante sotto il titolo nei dialog di aggiunta e modifica alimento per recuperare spazio verticale su mobile
- Auto-apertura intelligente della sezione "Dati alimento" se la validazione trova un campo obbligatorio mancante
- Le sezioni accordion chiuse ora hanno uno sfondo sottile (`bg-muted`) per renderle più visibili, sia in light che dark mode

### Fixed
- La scansione barcode non sposta più il focus sulla sezione "Dettagli aggiuntivi" — la sezione principale resta aperta per permettere l'inserimento di data di scadenza e quantità
- Aggiornata la guida utente con il comportamento corretto dopo scansione barcode
- Corretto link rotto a DATABASE_SCHEMA.md nel README

### Security
- Patch vulnerabilità serialize-javascript (RCE) e flatted
- Patch vulnerabilità picomatch via npm override

### Removed
- Rimossi documenti di sviluppo interni dal repository pubblico (spostati in .gitignore)

## [1.6.0] - 2026-03-07

### Added
- Feedback aptico (vibrazione) sulle interazioni principali tramite libreria `web-haptics`
  - Swipe card: `nudge` al raggiungimento della soglia, `buzz` all'azione confermata
  - Crea/modifica alimento: `success`
  - Elimina alimento/account: `error` (warning tattile)
- Toggle feedback aptico nella pagina Impostazioni (nascosto su dispositivi non supportati)
- Supporto iOS Safari 17.4+ tramite workaround `<input type="checkbox" switch>` (la Vibration API non esiste su iOS)
- Preferenza utente in `localStorage` con cache in memoria per performance durante swipe
- Sezione "Supporto" nella pagina Impostazioni con link email per contattare lo sviluppatore (`mailto:support@entroapp.it`)

## [1.5.2] - 2026-03-01

### Fixed
- Query notifiche push: cibi senza `list_id` o `category_id` venivano esclusi silenziosamente dalle notifiche a causa di INNER JOIN nella funzione SQL — convertiti in LEFT JOIN
- Sincronizzazione subscription push: se il browser rigenera la subscription (es. iOS mensile) senza finestra aperta, l'endpoint veniva perso — aggiunta ri-registrazione automatica al caricamento dell'app
- Rate limiter notifiche: il contatore giornaliero veniva sovrascritto invece di essere incrementato in caso di esecuzioni multiple del cron

### Changed
- Estratti helper `restorePreviousLists()` e `onlineToast()` in `useFoods.ts` per ridurre duplicazione nei mutation hooks

## [1.5.1] - 2026-03-01

### Fixed
- Attivazione notifiche push offline: aggiunto controllo connessione prima del tentativo e rollback della subscription locale se la registrazione server fallisce, evitando stato inconsistente
- Documentazione: completata lista delle funzionalità non disponibili offline — aggiunte preferenze notifiche, gestione liste condivise/inviti, esportazione dati (USER_GUIDE e guida in-app)

## [1.5.0] - 2026-03-01

### Added
- Persistenza immagini offline: le foto scattate durante la creazione/modifica di un alimento offline vengono compresse e salvate in IndexedDB, mostrate in anteprima locale e caricate su Supabase Storage alla riconnessione

## [1.4.1] - 2026-03-01

### Changed
- Guida utente in-app: sezione "Utilizzo Offline" riscritta per distinguere tra app installata (cache persistente, offline completo, push su tutti i dispositivi) e browser mobile (limitazioni iOS Safari: cache cancellata dopo 7 giorni, no push)
- Guida rapida: voce "Installa app" aggiornata con benefici offline e nota su iPhone
- FAQ in-app: aggiunta domanda "Perché offline non vedo i miei dati su iPhone?"
- README: aggiunte funzionalità offline e push notifications, aggiornati tech stack, architettura e scelte tecniche; corretti link documentazione (rimossi riferimenti a docs/private/ non accessibili pubblicamente)
- USER_GUIDE.md: aggiunta sezione "Notifiche Scadenza", aggiornati vantaggi installazione PWA, riscritta sezione offline con distinzione PWA vs browser, aggiunte FAQ su notifiche e offline iPhone

## [1.4.0] - 2026-03-01

### Added
- Esperienza offline completa: cache persistente in IndexedDB e mutazioni offline con coda automatica
- Creazione, modifica, eliminazione e cambio stato alimenti funzionano offline con optimistic updates
- UUID generati client-side (`crypto.randomUUID()`) per inserimenti offline
- Le mutazioni in pausa vengono riprese automaticamente al ritorno della connessione
- Le mutazioni persistite sopravvivono al ricaricamento della pagina e vengono rieseguite all'avvio
- Banner offline migliorato: mostra il numero di modifiche in attesa e indicatore di sincronizzazione
- Pulizia automatica della cache IndexedDB al logout per prevenire leak di dati tra account

### Fixed
- Le foto degli alimenti ora sono visibili offline grazie alla normalizzazione delle cache key nel service worker (i token delle signed URL venivano trattati come chiavi uniche, impedendo il cache hit)

### Changed
- Migrazione da `QueryClientProvider` a `PersistQueryClientProvider` con `gcTime` di 24 ore
- Tutte le mutazioni food ora utilizzano `mutationKey` e optimistic updates consistenti
- Logica `mutationFn` centralizzata in `mutationDefaults.ts` (singola fonte di verità)
- Cache immagini Supabase Storage: aumentati limiti a 200 immagini e 7 giorni di retention

## [1.3.1] - 2026-03-01

### Security
- Aggiornamento `serialize-javascript` a 7.0.3 via override npm per vulnerabilità RCE (GHSA-5c6j-r48x-rmvq)

## [1.3.0] - 2026-02-28

### Added
- Push notifications per scadenze alimenti (Web Push API con VAPID)
- Service worker custom con handler push, notificationclick e pushsubscriptionchange
- Edge Functions: `register-push` (subscribe/unsubscribe) e `send-expiry-notifications` (cron giornaliero)
- Tabelle DB: `push_subscriptions` e `notification_preferences` con RLS
- Funzione DB `get_expiring_foods_for_notifications()` per il cron job
- Cron schedule pg_cron (ogni giorno alle 9:00 UTC)
- Impostazioni notifiche nella pagina Settings: toggle, intervalli scadenza, ore silenziose, max giornaliero
- Banner opt-in notifiche nella Dashboard (dismissibile, mostrato dopo 3+ alimenti)
- Navigazione automatica al click su notifica push
- Unsubscribe automatico al logout

### Fixed
- Sostituita libreria `web-push` (Node.js) con `@negrel/webpush` (Deno-nativo) per compatibilità Supabase Edge Functions
- Auth Edge Function cron: sostituito confronto con `SUPABASE_SERVICE_ROLE_KEY` con shared secret `CRON_SECRET` via Vault (compatibile con nuovo formato API key Supabase)
- Stato iniziale bottone notifiche calcolato in modo sincrono da `Notification.permission` per evitare blocco su "Caricamento..."
- Aggiunto timeout 10s a `navigator.serviceWorker.ready` in `subscribeToPush()` per evitare hang dopo cache clear
- Label bottone notifiche contestuali: "Attivazione..." / "Disattivazione..." invece del generico "Caricamento..."

### Changed
- vite-plugin-pwa: switch da `generateSW` a `injectManifest` per supporto push handler nel SW
- Runtime caching migrato da config Vite al service worker custom

## [1.2.0] - 2026-02-26

### Added
- Changelog completo del progetto con storico da v0.1.0
- Tag git e GitHub Releases per tutte le versioni

## [1.1.0] - 2026-02-26

### Added
- Torcia/flashlight nel barcode scanner per ambienti con poca luce
- Guida utente in-app con dialog di aiuto rapido e pagina guida completa
- SEO: robots.txt, sitemap, titoli dinamici per pagina, canonical URL, lazy loading immagini

### Fixed
- Le statistiche ora vengono calcolate sul dataset completo, stabili anche filtrando per stato

### Changed
- Lazy-load di FoodForm e heic2any — chunk della DashboardPage ridotto da 1416 KB a 46 KB
- Semplificazione codebase: deduplica auth helpers, rimosso try/catch ridondanti, pulizia utils
- Rimossi console.log di sviluppo residui

## [1.0.0] - 2026-02-19

Lancio pubblico di Entro su LinkedIn.

### Changed
- Migliorata UX di registrazione con requisiti password più robusti

### Security
- Fix persistenza sessione e vulnerabilità auto-login
- Pulizia selettiva dello storage al logout (preserva service worker e preferenze)
- Fix errore 400 alla cancellazione account

## [0.10.0] - 2026-02-01

### Added
- Dettagli tecnici espandibili nel dialog di cancellazione account
- UX dialog mobile migliorata con padding e layout bottoni responsive

### Fixed
- Cascade delete manuale nella funzione delete_user
- Gestione corretta delle liste eliminate in getUserList
- Eliminazione inviti ricevuti dall'utente alla cancellazione account
- Migliorato contrasto dark mode e allineamento liste su mobile
- Testo bianco sui bottoni di azione rossi in dark mode
- Spaziatura consistente tra bottoni di azione su mobile

## [0.9.0] - 2026-01-31

### Added
- Conformità GDPR (Art. 17, 20) con pagina impostazioni
- Esportazione dati completa con URL firmati per le immagini
- Funzione RPC delete_user per cancellazione account GDPR-compliant
- Bottone supporto Ko-fi con configurazione via variabile d'ambiente
- Integrazione documenti legali Aruba LegalBlink
- Navigazione migliorata: logo cliccabile, dashboard semplificata
- Licenza MIT

### Fixed
- Recovery real-time su mobile per iOS Safari e Android Chrome
- Risolto dipendenza circolare tra useRealtimeFoods e useFoods
- Prevenuto loop di riconnessione cancellando timeout pendenti
- Aggiunto reconnectTrigger per forzare re-setup subscription su iOS
- Refresh sessione dopo ripristino rete su iOS
- Prevenuto caching di index.html per evitare errori di caricamento chunk
- Layout pagine auth ristrutturato per prevenire sovrapposizione footer
- Aggiornamento lodash a 4.17.23 per vulnerabilità di sicurezza

## [0.8.0] - 2026-01-27

### Added
- Sincronizzazione real-time per gli alimenti
- UX Single List con flusso di conferma inviti

### Fixed
- Race condition RLS nella creazione lista personale alla conferma email
- Funzione PostgreSQL per creazione lista personale (risolve race condition RLS)
- Case sensitivity delle email nel flusso di accettazione inviti
- Robustezza del flusso di accettazione inviti, prevenuti stati bloccati
- Policy RLS DELETE per permettere l'uscita dalle liste condivise
- Invalidazione cache alimenti dopo accettazione inviti e uscita da liste
- Policy RLS corrette per prevenire visibilità dati tra liste diverse
- Prevenuto input di quantità negative nel form
- Migliorata visibilità icona date picker in dark mode
- Migliorato layout e leggibilità dei dialog di avviso

## [0.7.0] - 2026-01-24

### Added
- Funzionalità di reset password
- Toggle visibilità password
- Dominio personalizzato entroapp.it con Netlify e Resend

### Fixed
- Creazione lista personale spostata dal signup al primo login
- Gestione evento PASSWORD_RECOVERY per prevenire redirect indesiderati
- `force=false` nei redirect Netlify per non intercettare asset statici

## [0.6.0] - 2026-01-21

### Added
- Liste condivise con inviti via email
- Integrazione Resend per invio email di invito
- Codici invito brevi anonimi per condivisione mobile
- Prefill e blocco campo email per signup da invito
- Mostra nome del creatore invece del nome lista nei messaggi di invito
- Bottone di chiusura desktop per InstructionCard

### Fixed
- Auto-accettazione inviti dopo conferma email
- Accettazione inviti tramite pending_user_email
- Migliorata messaggistica toast durante il flusso inviti
- Consistenza dark mode per select nel FoodForm

## [0.5.0] - 2026-01-16

### Added
- Dark mode con toggle tema
- Accessibilità WCAG AA completa
- Campo nome completo per registrazione e saluto personalizzato

### Changed
- Code splitting e ottimizzazione bundle

### Fixed
- Errore bottone annidato in FoodFilters, migliorato stile stats cards
- Gestione errori migliorata per immagini mancanti nello storage
- Soppressi errori console "Auth session missing" al logout/refresh
- Fotocamera posteriore forzata per scanner barcode su iOS
- Prevenuta doppia estensione file e invii form duplicati

## [0.4.0] - 2026-01-14

### Added
- Supporto PWA con service worker e modalità offline
- Icona header aggiornata in stile PWA

## [0.3.0] - 2026-01-13

### Added
- Gesture di swipe per le card alimenti su mobile
- Card istruzioni per nuovi utenti con demo swipe
- Calendario WeekView con finestra scorrevole di 7 giorni

### Changed
- Sostituito html5-qrcode con @zxing/browser per compatibilità iOS/Android
- Hint animato al posto dei visual cues sulle card

### Fixed
- Calcolo dinamico qrbox basato sulle dimensioni video
- Risolto loop infinito scanner e problemi rilevamento fotocamera iPhone
- Stop scanner immediato dopo prima rilevazione barcode
- Debounce 500ms per prevenire spam callback ZXing
- Fuso orario locale per formattazione date calendario

## [0.2.0] - 2026-01-10

### Added
- Upload immagini con pattern upload-on-submit
- Supporto HEIC/HEIF per compatibilità foto iPhone
- Sistema filtri e ricerca completo
- Layout ottimizzato mobile-first
- Scanner barcode con integrazione Open Food Facts
- Configurazione deploy Netlify
- Bottoni separati fotocamera e galleria per Android 14+

### Fixed
- Date normalizzate a mezzanotte nel calcolo statistiche
- Video fotocamera non visibile su iPhone — forzato display con CSS inline
- Errori inizializzazione scanner su iOS Safari

## [0.1.0] - 2026-01-09

### Added
- Setup iniziale progetto con React, TypeScript e Supabase
- Setup database Supabase con migration e test connessione
- Sistema di autenticazione Supabase completo
- CRUD completo gestione alimenti con React Query

[Unreleased]: https://github.com/E-Lop/entro/compare/v1.11.12...HEAD
[1.11.12]: https://github.com/E-Lop/entro/compare/v1.11.11...v1.11.12
[1.11.11]: https://github.com/E-Lop/entro/compare/v1.11.10...v1.11.11
[1.11.10]: https://github.com/E-Lop/entro/compare/v1.11.9...v1.11.10
[1.11.9]: https://github.com/E-Lop/entro/compare/v1.11.8...v1.11.9
[1.11.8]: https://github.com/E-Lop/entro/compare/v1.11.7...v1.11.8
[1.11.7]: https://github.com/E-Lop/entro/compare/v1.11.6...v1.11.7
[1.11.6]: https://github.com/E-Lop/entro/compare/v1.11.5...v1.11.6
[1.11.5]: https://github.com/E-Lop/entro/compare/v1.11.4...v1.11.5
[1.11.4]: https://github.com/E-Lop/entro/compare/v1.11.3...v1.11.4
[1.11.3]: https://github.com/E-Lop/entro/compare/v1.11.2...v1.11.3
[1.11.2]: https://github.com/E-Lop/entro/compare/v1.11.1...v1.11.2
[1.11.1]: https://github.com/E-Lop/entro/compare/v1.11.0...v1.11.1
[1.11.0]: https://github.com/E-Lop/entro/compare/v1.10.7...v1.11.0
[1.10.7]: https://github.com/E-Lop/entro/compare/v1.10.6...v1.10.7
[1.10.6]: https://github.com/E-Lop/entro/compare/v1.10.5...v1.10.6
[1.10.5]: https://github.com/E-Lop/entro/compare/v1.10.4...v1.10.5
[1.10.4]: https://github.com/E-Lop/entro/compare/v1.10.3...v1.10.4
[1.10.3]: https://github.com/E-Lop/entro/compare/v1.10.2...v1.10.3
[1.10.2]: https://github.com/E-Lop/entro/compare/v1.10.1...v1.10.2
[1.10.1]: https://github.com/E-Lop/entro/compare/v1.10.0...v1.10.1
[1.10.0]: https://github.com/E-Lop/entro/compare/v1.9.0...v1.10.0
[1.9.0]: https://github.com/E-Lop/entro/compare/v1.8.0...v1.9.0
[1.8.0]: https://github.com/E-Lop/entro/compare/v1.7.5...v1.8.0
[1.7.5]: https://github.com/E-Lop/entro/compare/v1.7.4...v1.7.5
[1.7.4]: https://github.com/E-Lop/entro/compare/v1.7.3...v1.7.4
[1.7.3]: https://github.com/E-Lop/entro/compare/v1.7.2...v1.7.3
[1.7.2]: https://github.com/E-Lop/entro/compare/v1.7.1...v1.7.2
[1.7.1]: https://github.com/E-Lop/entro/compare/v1.7.0...v1.7.1
[1.7.0]: https://github.com/E-Lop/entro/compare/v1.6.3...v1.7.0
[1.6.3]: https://github.com/E-Lop/entro/compare/v1.6.2...v1.6.3
[1.6.2]: https://github.com/E-Lop/entro/compare/v1.6.1...v1.6.2
[1.6.1]: https://github.com/E-Lop/entro/compare/v1.6.0...v1.6.1
[1.6.0]: https://github.com/E-Lop/entro/compare/v1.5.2...v1.6.0
[1.5.2]: https://github.com/E-Lop/entro/compare/v1.5.1...v1.5.2
[1.5.1]: https://github.com/E-Lop/entro/compare/v1.5.0...v1.5.1
[1.5.0]: https://github.com/E-Lop/entro/compare/v1.4.1...v1.5.0
[1.4.1]: https://github.com/E-Lop/entro/compare/v1.4.0...v1.4.1
[1.4.0]: https://github.com/E-Lop/entro/compare/v1.3.1...v1.4.0
[1.3.1]: https://github.com/E-Lop/entro/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/E-Lop/entro/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/E-Lop/entro/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/E-Lop/entro/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/E-Lop/entro/compare/v0.10.0...v1.0.0
[0.10.0]: https://github.com/E-Lop/entro/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/E-Lop/entro/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/E-Lop/entro/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/E-Lop/entro/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/E-Lop/entro/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/E-Lop/entro/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/E-Lop/entro/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/E-Lop/entro/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/E-Lop/entro/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/E-Lop/entro/releases/tag/v0.1.0
