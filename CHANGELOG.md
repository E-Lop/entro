# Changelog

Tutte le modifiche rilevanti al progetto Entro sono documentate in questo file.

Il formato segue [Keep a Changelog](https://keepachangelog.com/it/1.1.0/)
e il progetto aderisce al [Semantic Versioning](https://semver.org/lang/it/).

## [Unreleased]

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

[Unreleased]: https://github.com/E-Lop/entro/compare/v1.3.0...HEAD
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
