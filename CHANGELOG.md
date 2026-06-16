# Changelog

Tutte le modifiche rilevanti al progetto Entro sono documentate in questo file.

Il formato segue [Keep a Changelog](https://keepachangelog.com/it/1.1.0/)
e il progetto aderisce al [Semantic Versioning](https://semver.org/lang/it/).

## [Unreleased]

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

[Unreleased]: https://github.com/E-Lop/entro/compare/v1.7.3...HEAD
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
