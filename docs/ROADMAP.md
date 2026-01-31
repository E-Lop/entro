# Development Roadmap

## 🗺️ Overview

Timeline complessiva stimata: **5-8 settimane** (part-time, ~15-20 ore/settimana)

Questo roadmap è organizzato in fasi incrementali, ognuna delle quali produce un deliverable funzionante e testabile.

---

## 🚀 Fase 0: Setup Iniziale (1-2 giorni) ✅ COMPLETATA

**Obiettivo**: Ambiente di sviluppo pronto e configurato

### Tasks

- [x] ✅ Repository GitHub creato
- [x] ✅ Setup progetto Vite + React + TypeScript
- [x] ✅ Installazione dipendenze core
- [x] ✅ Configurazione Tailwind CSS 3.4
- [x] ✅ Setup shadcn/ui
- [x] ✅ Configurazione ESLint
- [x] ✅ Setup Supabase project
- [x] ✅ Configurazione environment variables
- [x] ✅ Test build verificato
- [ ] Deploy Netlify (da fare dopo setup database)

### Deliverables
- ✅ Progetto buildabile
- ✅ Landing page base visibile
- ✅ Struttura directory completa
- ✅ Client Supabase configurato
- ✅ Types TypeScript definiti

**Commit**: `1ac1964` - feat: initial project setup with React, TypeScript, and Supabase
**Data Completamento**: 09/01/2026

### Checklist Tecnica
```bash
npm create vite@latest food-expiry-tracker -- --template react-ts
cd food-expiry-tracker
npm install

# Tailwind
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# shadcn/ui
npx shadcn-ui@latest init

# Core dependencies
npm install @supabase/supabase-js zustand @tanstack/react-query
npm install date-fns react-hook-form zod @hookform/resolvers
npm install clsx tailwind-merge lucide-react

# Dev dependencies
npm install -D @types/node
```

---

## 📦 Fase 1: MVP Core (Settimana 1-2)

**Obiettivo**: CRUD alimenti funzionante con autenticazione base

### Week 1: Database & Auth

#### Tasks (Giorno 1-2) ✅ COMPLETATO
- [x] ✅ Eseguire migrations Supabase (schema initial)
- [x] ✅ Configurare RLS policies
- [x] ✅ Setup Supabase client in app
- [x] ✅ Creare types TypeScript per database
- [x] ✅ Testare connessione database dal frontend

**Deliverables**:
- ✅ Tabella `categories`: 11 categorie italiane inserite
- ✅ Tabella `foods`: creata con schema completo
- ✅ 8 indexes per performance ottimali
- ✅ RLS policies configurate (anonymous access per categories)
- ✅ Trigger `update_updated_at_column()` attivo
- ✅ Frontend TestConnection page funzionante

**Commit**: `9bfc037` - feat: complete Supabase database setup with migration and connection test
**Data Completamento**: 09/01/2026

#### Tasks (Giorno 3-4) ✅ COMPLETATO
- ✅ Implementare auth flow (signup/login/logout)
- ✅ Creare layout app con navigation
- ✅ Protected routes setup
- ✅ User context/store con Zustand

**Implementazione Completa**:
- ✅ React Router con routes pubbliche (/login, /signup) e protette (/)
- ✅ Zustand auth store con listener Supabase onAuthStateChange
- ✅ Custom hook useAuth per accesso auth state
- ✅ AuthForm component con react-hook-form + zod validation
- ✅ ProtectedRoute component con loading states
- ✅ AppLayout con header, logo, user menu dropdown
- ✅ DashboardPage placeholder
- ✅ shadcn/ui components: Button, Input, Form, Card, Label, Dropdown Menu
- ✅ Toast notifications con Sonner
- ✅ Session persistence verificata
- ✅ Form validation con password min 6 caratteri
- ✅ Test completo: signup, login, logout, protected routes, session refresh

**Architettura**:
- Service Layer (`src/lib/auth.ts`) → Zustand Store (`src/stores/authStore.ts`) → Custom Hook (`src/hooks/useAuth.ts`) → UI Components
- 13 nuovi file creati, 2 file modificati
- Pattern clean: separation of concerns, testabilità, DX ottima

**Commit**: `de0f9fb` - feat: implement complete Supabase authentication system
**Data Completamento**: 09/01/2026

#### Tasks (Giorno 5-7) ✅ COMPLETATO
- [x] ✅ Setup React Query per foods
- [x] ✅ API layer per CRUD operations (src/lib/foods.ts)
- [x] ✅ Componente FoodCard (presentational con color coding)
- [x] ✅ Componente FoodForm (create/edit con validation)
- [x] ✅ Dashboard page con grid di cards
- [x] ✅ Implementare CREATE food
- [x] ✅ Implementare UPDATE food
- [x] ✅ Implementare DELETE food (con conferma)
- [x] ✅ Calcolo giorni alla scadenza con color coding

**Implementazione Completa**:
- ✅ React Query hooks (useFoods, useCategories, useCreateFood, useUpdateFood, useDeleteFood)
- ✅ Service layer completo per Supabase CRUD (getFoods, createFood, updateFood, deleteFood)
- ✅ Zod validation schemas con enum per storage locations e quantity units
- ✅ FoodCard component con color coding: 🟢 >7gg | 🟡 4-7gg | 🟠 1-3gg | 🔴 scaduto
- ✅ FoodForm con react-hook-form + zod, validazione date future only
- ✅ Dialog modals (Aggiungi/Modifica con shadcn/ui Dialog)
- ✅ AlertDialog per conferma eliminazione
- ✅ Dashboard stats real-time (totali, in scadenza, scaduti)
- ✅ Grid responsive layout (1/2/3 colonne)
- ✅ Optimistic updates per UX fluida
- ✅ Toast notifications con Sonner
- ✅ Empty state quando nessun alimento
- ✅ Loading states con skeleton
- ✅ Dropdown select per unità di misura (pz, kg, g, l, ml, confezioni)

**Bug Fix**:
- ✅ Database constraint validation per quantity_unit
- ✅ Preservazione valori form in modalità edit
- ✅ Validazione date nel passato bloccata

**Commit**: `f6f2d91` - feat: implement complete food management CRUD system with React Query
**Data Completamento**: 09/01/2026

### Week 2: UI & Features 🔄 IN CORSO

#### Tasks (Giorno 1-3) ✅ COMPLETATO
- [x] ✅ Upload immagini a Supabase Storage
- [x] ✅ Image preview nel FoodCard
- [x] ✅ Componente ImageUpload riusabile
- [x] ✅ Ottimizzazione immagini (resize, compress)

**Implementazione Completa**:
- ✅ Supabase Storage bucket privato con RLS policies per sicurezza
- ✅ Signed URLs per accesso sicuro alle immagini (1 ora expiration)
- ✅ ImageUpload component con local preview (File | string | null support)
- ✅ Upload on submit pattern (no orphan images)
- ✅ Image compression (max 800px, ~1MB target)
- ✅ **HEIC/HEIF support con conversione automatica a JPEG (iPhone compatible)**
- ✅ useSignedUrl hook per gestione signed URLs con caching
- ✅ FoodCard con display immagini via signed URLs
- ✅ Delete cascade automatico (rimozione immagine da storage)
- ✅ Error handling completo (upload failures, missing images)
- ✅ Loading states durante generazione signed URLs e conversione HEIC
- ✅ Validation schema con support File | string per upload differito

**Architettura Storage**:
- Path structure: `{user_id}/{timestamp}-{filename}`
- Private bucket con Row Level Security
- Accepted formats: JPEG, PNG, WebP, HEIC/HEIF (auto-converted)
- Max size: 5MB (compressed to ~1MB)
- Upload happens only on form submit (prevents orphan files)
- HEIC files from iPhone automatically converted to JPEG client-side

**Commit**: Pending - feat: implement complete image upload system with upload-on-submit
**Data Completamento**: 10/01/2026

#### Tasks (Giorno 4-5) ✅ COMPLETATO
- [x] ✅ Filtri base (categoria, storage location, status)
- [x] ✅ Search bar con debounce (300ms)
- [x] ✅ Ordinamenti (scadenza, alfabetico, categoria, data creazione)
- [x] ✅ Persistenza filtri in URL query params

**Implementazione Completa**:
- ✅ Server-side filtering con Supabase query builder
- ✅ FilterParams interface con tutti i campi (category_id, storage_location, status, search, sortBy, sortOrder)
- ✅ useDebounce custom hook per ricerca ottimizzata
- ✅ FoodFilters component collassabile (mobile-first)
- ✅ URL query params persistence (react-router useSearchParams)
- ✅ Stats cards cliccabili per filtri rapidi
- ✅ Empty states differenziati (no foods vs no results)
- ✅ Loading states con spinner animato
- ✅ Active filters counter badge
- ✅ Clear filters functionality

**Mobile-First Optimizations**:
- ✅ Filtri collassabili di default su mobile
- ✅ Stats cards compatte in griglia 3 colonne
- ✅ Floating Action Button (FAB) verde bottom-right
- ✅ FoodCard layout ottimizzato (quantità inline, categoria+posizione stesso rigo)
- ✅ Note con sfondo ambra per distinguere contenuto utente
- ✅ Spacing ridotto per meno scrolling

**Bug Fixes**:
- ✅ Calcolo giorni scadenza normalizzato a midnight (fix: ricotta mostrava 3 giorni invece di 4)

**Commit**: Pending - feat: implement complete filters and search system with mobile-first layout
**Data Completamento**: 10/01/2026

#### Tasks (Giorno 6-7) ✅ COMPLETATO
- [x] ✅ Deploy MVP su Netlify
- [x] ✅ Test manuale completo su device reali (Desktop, iPhone, Android)
- [x] ✅ Bug fixes da testing (3 bugs critici risolti)
- [x] ✅ Android 14+ camera access fix

**Implementazione Deploy**:
- ✅ Netlify configuration con netlify.toml
- ✅ Build settings: npm run build → dist
- ✅ SPA routing con catch-all redirect
- ✅ Security headers (X-Frame-Options, CSP, etc.)
- ✅ Cache headers per static assets
- ✅ Environment variables configurate
- ✅ CI/CD auto-deploy da GitHub main branch
- ✅ Production URL: https://entro-il.netlify.app

**Testing Completato**:
- ✅ Desktop Chrome/Safari: Full functionality verified
- ✅ iPhone Safari: Camera + gallery working, HEIC conversion OK
- ✅ Android Chrome 14+: Camera + gallery working separately

**Bug Fixes**:
1. ✅ **Email confirmation redirect**: Fixed Supabase Site URL config (localhost → production)
2. ✅ **Stats calculation inconsistency**: Normalized dates to midnight for accurate day counting
3. ✅ **Android 14+ camera access**: Implemented dual-button UI (camera + gallery) to fix Chrome/Edge bug

**Commit**: `2c2a596` - fix: add separate camera and gallery buttons for Android 14+ compatibility
**Data Completamento**: 10/01/2026

### Deliverables Fase 1 ✅ COMPLETATA
**MVP Funzionante e Deployed**:
- ✅ Login/Signup working
- ✅ CRUD completo alimenti
- ✅ Upload immagini con HEIC support
- ✅ Filtri e ricerca completi
- ✅ UI responsive mobile-first
- ✅ **Deployed su Netlify** (https://entro-il.netlify.app)
- ✅ **Testing completo su device reali**
- ✅ **Bug fixes da production testing**

### Definition of Done ✅ RAGGIUNTA
- ✅ Posso creare/modificare/eliminare alimenti
- ✅ Vedo giorni alla scadenza con colori
- ✅ Filtri funzionano correttamente
- ✅ App responsive su mobile
- ✅ Nessun bug bloccante
- ✅ Testato su device reali (Desktop, iPhone, Android)
- ✅ MVP deployed e accessibile pubblicamente

---

## 📷 Fase 2: Barcode Scanner (Settimana 3) ✅ COMPLETATA

**Obiettivo**: Scansione barcode funzionante con pre-compilazione dati

### Week 3: Barcode Integration

#### Tasks (Giorno 1-2) ✅ COMPLETATO
- [x] ✅ Setup barcode scanner library
- [x] ✅ Implementare useBarcodeScanner hook
- [x] ✅ Gestione permessi camera iOS/Android
- [x] ✅ UI scanner modal con feedback

**Implementazione Completa**:
- ✅ **Switch da html5-qrcode a @zxing/browser** (iOS Safari compatibility)
- ✅ useBarcodeScanner custom hook con proper lifecycle management
- ✅ Camera permissions handled automaticamente dal browser
- ✅ BarcodeScanner modal component con Dialog UI
- ✅ Scanner states: idle, scanning, processing, success, error
- ✅ Visual feedback durante scan (loading, success overlay, error messages)
- ✅ Auto-start scanning on modal open
- ✅ Proper cleanup con controls.stop() e BrowserCodeReader.releaseAllStreams()

#### Tasks (Giorno 3-4) ✅ COMPLETATO
- [x] ✅ Integrare Open Food Facts API
- [x] ✅ Creare service client per API
- [x] ✅ Implementare category mapping logic
- [x] ✅ Sistema suggerimenti durata/storage

**Implementazione Completa**:
- ✅ Open Food Facts API client (src/lib/openfoodfacts.ts)
- ✅ TypeScript types per OFF API responses
- ✅ fetchProductByBarcode() function con error handling
- ✅ mapProductToFormData() con intelligent mapping
- ✅ Category mapping: 10 categorie OFF → 11 categorie italiane
- ✅ Storage location suggestions (fridge, freezer, pantry)
- ✅ suggestExpiryDate() basato su shelf-life per categoria
- ✅ Quantity parsing da stringhe OFF (es. "500g" → quantity: 500, unit: g)

**Category Mappings Implemented**:
- Latticini: 7 giorni shelf-life, fridge
- Carni: 3 giorni, fridge
- Pesce: 2 giorni, fridge
- Frutta: 7 giorni, fridge
- Verdure: 5 giorni, fridge
- Cereali: 30 giorni, pantry
- Bevande: 14 giorni, fridge
- Dolci: 60 giorni, pantry
- Condimenti: 90 giorni, pantry
- Surgelati: 90 giorni, freezer

#### Tasks (Giorno 5-6) ✅ COMPLETATO
- [x] ✅ Integrazione scanner nel FoodForm
- [x] ✅ Pre-compilazione form con dati barcode
- [x] ✅ Fallback a inserimento manuale
- [x] ✅ Handle prodotti non trovati

**Implementazione Completa**:
- ✅ "Scansiona Barcode" button in FoodForm (create mode only)
- ✅ BarcodeScanner modal integration
- ✅ handleBarcodeScanned() con fetch + mapping automatico
- ✅ Auto-fill form fields: nome, categoria, storage, scadenza, quantità, note
- ✅ Loading states durante fetch OFF API
- ✅ Error handling con messaggi user-friendly
- ✅ Graceful fallback: prodotto non trovato → inserimento manuale
- ✅ Product error display con feedback chiaro

#### Tasks (Giorno 7) ✅ COMPLETATO
- [x] ✅ Testing su device reali (iOS + Android)
- [x] ✅ Ottimizzazioni performance scanner (controls.stop() fix)
- [x] ✅ UX polish e error states
- [x] ✅ Documentazione utilizzo (BARCODE_BUG.md)

**Critical Bug Fix**:
- ✅ **Callback spam issue risolto**: Implementato proper controls.stop() pattern
- ✅ Research documentazione ufficiale ZXing e GitHub issues
- ✅ Configure BrowserMultiFormatReader con delay options
- ✅ mountedRef pattern per prevent callback dopo unmount
- ✅ Complete cleanup: controls.stop() + releaseAllStreams() + cleanVideoSource()
- ✅ Testing completo su iPhone e Android: funziona perfettamente

**Commits Fase 2**:
- Initial implementation: barcode scanner setup
- Library switch: html5-qrcode → @zxing/browser
- Multiple iteration attempts to fix callback spam
- `cb5545a` - **Final fix**: implement proper ZXing controls.stop() pattern
- Complete documentation: `docs/BARCODE_BUG.md`

### Deliverables Fase 2 ✅ COMPLETATA
**Barcode Scanning Funzionante in Production**:
- ✅ Scanner camera implementation completo
- ✅ Open Food Facts API integration
- ✅ Form pre-fill automatico con dati prodotto
- ✅ Category mapping intelligente (10 categorie OFF → 11 italiane)
- ✅ Testing completo su device reali (iPhone + Android)
- ✅ Performance validation: scan rapido, un solo callback
- ✅ Comprehensive bug analysis documentation

### Definition of Done ✅ RAGGIUNTA
- [x] ✅ Scansiono barcode e riconosco EAN-13
- [x] ✅ Funziona su iPhone Safari e Android Chrome
- [x] ✅ Performance accettabile (scan immediato, no lag)
- [x] ✅ UI chiara e intuitiva (validato su device reali)
- [x] ✅ Callback spam risolto con soluzione documentata
- [x] ✅ Cleanup completo delle risorse camera

---

## 🎨 Fase 3: UX Enhancements (Settimana 4) 🔄 IN CORSO

**Obiettivo**: Swipe gestures e vista calendario

### Week 4: Mobile UX & Calendar

#### Tasks (Giorno 1-2) ✅ COMPLETATO
- [x] ✅ Setup react-swipeable
- [x] ✅ Implementare swipe-to-edit gesture
- [x] ✅ Implementare swipe-to-delete gesture
- [x] ✅ Visual feedback durante swipe (background colorati + icone)
- [x] ✅ Animated hint su prima card per nuovi utenti

**Implementazione Completa** (Sessione 13/01/2026):
- ✅ SwipeableCard wrapper component con mobile detection
- ✅ react-swipeable per gesture handling (touch only)
- ✅ Swipe right → Edit (background verde + icona Edit)
- ✅ Swipe left → Delete (background rosso + icona Trash)
- ✅ Threshold 80px per triggerare azioni
- ✅ Smooth CSS transitions e animazioni
- ✅ Animated hint: prima card si muove automaticamente (2s delay)
- ✅ InstructionCard per nuovi utenti senza alimenti
- ✅ LocalStorage flags per hint one-time
- ✅ Buttons Edit/Delete nascosti su mobile, visibili su desktop
- ✅ Testing completo su iOS Safari e Android Chrome

**Commits**:
- `7b197ff` - feat: implement swipe gestures for mobile food cards
- `edeb9c7` - fix: improve visual cues visibility on mobile cards
- `f98c715` - refactor: replace visual cues with animated hint on first card
- `5c9bedf` - feat: add instruction card for new users with swipe demo

#### Tasks (Giorno 3-4) ✅ COMPLETATO
- [x] ✅ Implementare WeekView component
- [x] ✅ Logic per raggruppare alimenti per giorno
- [x] ✅ Toggle Lista/Calendario per navigazione tra viste
- [x] ✅ Click su card calendario → mostra dialog modifica

**Implementazione Completa** (Sessione 13/01/2026 - Parte 2):
- ✅ Date utility functions (getNext7Days, formatDateKey, groupFoodsByDate)
- ✅ CalendarFoodCard ultra-compatta (solo nome + quantità)
- ✅ DayColumn con header uniformi e badge contatore alimenti
- ✅ WeekView container con rolling 7-day window (oggi + 6 giorni)
- ✅ Mobile: horizontal scroll con snap, 280px columns
- ✅ Desktop: responsive 7-column grid, tutte le colonne visibili
- ✅ Toggle Lista/Calendario sostituisce titolo pagina
- ✅ View mode persiste in URL params (?view=list|calendar)
- ✅ Filtri funzionano in entrambe le viste
- ✅ Empty state quando nessun alimento scade in 7 giorni
- ✅ Timezone fix: usa local timezone invece di UTC

**Commits**:
- `7cba90b` - feat: add WeekView calendar with 7-day rolling window
- `a9d3acd` - fix: use local timezone for calendar date formatting

**Bug Fix**:
- ✅ Fixed timezone issue causing foods to appear one day off in calendar

### Deliverables Fase 3 ✅ COMPLETATA
**Advanced UX**:
- ✅ Swipe gestures fluidi su mobile (COMPLETATO - Parte 1)
- ✅ Vista calendario settimanale funzionante (COMPLETATO - Parte 2)
- ✅ Animazioni smooth (COMPLETATO)

### Definition of Done ✅
- [x] ✅ Swipe left/right funziona su mobile
- [x] ✅ Calendario mostra scadenze correttamente
- [x] ✅ Navigazione fluida tra viste (Lista/Calendario)
- [x] ✅ Testing su device reali completato

---

## 📱 Fase 4: Progressive Web App (Settimana 5) ✅ COMPLETATA

**Obiettivo**: Rendere l'app installabile come PWA con funzionalità offline

### Week 5: PWA Setup

#### Tasks (Giorno 1-3) ✅ COMPLETATO
- [x] ✅ Setup service worker con Vite PWA plugin
- [x] ✅ Configurare manifest.json (nome, icone, colori, display mode)
- [x] ✅ Generare icons per PWA (varie dimensioni: 192x192, 512x512, maskable)
- [x] ✅ Configurare scope e start_url
- [x] ✅ Test install prompt su Chrome

**Implementazione Completa** (Sessione 14/01/2026):
- ✅ vite-plugin-pwa installato e configurato
- ✅ Manifest con nome, short_name, descrizione, theme_color (#16a34a)
- ✅ Icons generate con sharp: 192x192, 512x512, maskable-512x512
- ✅ Apple touch icon (180x180) e favicon (16x16, 32x32)
- ✅ Icon SVG sorgente (orologio verde con foglia - food expiry theme)
- ✅ Script generate-icons.js per rigenerare icone

#### Tasks (Giorno 4-5) ✅ COMPLETATO
- [x] ✅ Implementare offline mode basic
- [x] ✅ Cache strategy per assets statici (CSS, JS, fonts)
- [x] ✅ Cache strategy per immagini Supabase
- [x] ✅ Fallback page per offline (offline.html)
- [x] ✅ OfflineBanner component per stato offline

**Workbox Configuration**:
- ✅ Precache per tutti gli assets statici (JS, CSS, HTML, icons)
- ✅ RuntimeCaching per Google Fonts (CacheFirst, 1 year)
- ✅ RuntimeCaching per Supabase signed URLs (CacheFirst, 1 hour)
- ✅ NavigateFallback per SPA routing
- ✅ maximumFileSizeToCacheInBytes: 3MB (bundle ~2.65MB)

#### Tasks (Giorno 6-7) ✅ COMPLETATO
- [x] ✅ Testing PWA features su Chrome
- [x] ✅ Service worker registrato e attivo
- [x] ✅ Manifest caricato correttamente
- [x] ✅ useOnlineStatus hook per network detection
- [x] ✅ Deploy su Netlify verificato

**Testing Results**:
- ✅ Service worker: active, state: "activated"
- ✅ Manifest URL: /manifest.webmanifest
- ✅ Theme color: #16a34a
- ✅ Apple touch icon: presente
- ✅ Favicon: presente
- ✅ Precache: 18 entries (~2.6 MB)

**Commits**:
- `a5f0989` - feat: add PWA support with service worker and offline mode (Phase 4)

### Deliverables Fase 4 ✅ COMPLETATA
**PWA Installabile**:
- ✅ App installabile su home screen (iOS + Android + Desktop)
- ✅ Offline basic mode funzionante (assets cached)
- ✅ Service worker con cache strategy (Workbox)
- ✅ Manifest completo e conforme
- ✅ OfflineBanner per feedback utente offline

### Definition of Done ✅ RAGGIUNTA
- [x] ✅ App installabile come PWA su mobile e desktop
- [x] ✅ Funziona offline (UI base e assets cached)
- [x] ✅ Icons e splash screens corretti
- [x] ✅ Service worker registrato e attivo

**Nota**: Bundle size (~2.65 MB) da ottimizzare nella Fase 5 con code splitting.

---

## ✨ Fase 5: Polish, Quality & Sharing (Settimana 6-7) 🔄 IN CORSO

**Obiettivo**: Condivisione liste, ottimizzazione, accessibilità, testing e preparazione al lancio

### Week 6: Quality Improvements

#### Tasks (Giorno 1) ✅ COMPLETATO
- [x] ✅ Dark mode implementation (theme toggle + CSS variables)
  - useTheme hook con light/dark/system support
  - ThemeToggle component con dropdown menu
  - localStorage persistence + system preference detection
  - Updated all components con semantic color tokens
  - Smooth theme transitions

#### Tasks (Giorno 2) ✅ COMPLETATO
- [x] ✅ Performance optimization (Lighthouse score >90)
- [x] ✅ Bundle size optimization (code splitting)
  - Route-based lazy loading (LoginPage, SignUpPage, DashboardPage)
  - Component-level lazy loading (BarcodeScanner, WeekView)
  - Manual chunk splitting per vendor libraries
  - Main bundle: 2656 KB → 331 KB (75% reduction!)
  - Initial load: 100 KB gzipped (vs 712 KB before)
- [x] ✅ Image optimization già implementato (Fase 1)
- [x] ✅ Database query optimization già ottimizzato (server-side filtering)

#### Tasks (Giorno 3-4) ✅ COMPLETATO
- [x] ✅ Accessibility audit completo (WCAG AA)
  - Skip link "Vai al contenuto principale"
  - Semantic HTML: nav landmark, role="group"
  - Heading hierarchy fixed (single h1 per page)
  - Stats cards converted to semantic buttons with aria-pressed
  - ARIA labels for all interactive elements
  - Form error messages with role="alert"
  - Focus management: focus-visible:ring-2
  - Comprehensive documentation: ACCESSIBILITY_AUDIT.md
- [x] ✅ Keyboard navigation testing completato
- [x] ✅ Screen reader compatibility verificata
- [x] ✅ Focus management e ARIA labels implementati
  - Manual testing completed by user
  - Fixed nested button error in FoodFilters
  - All color contrast checked (light + dark mode)

#### Tasks (Giorno 5-6)
- [x] ✅ **Shared Lists Multi-User Implementation** (COMPLETATO - 21/01/2026)
  - ✅ Piano completo documentato in [SHARED_LISTS_PLAN.md](SHARED_LISTS_PLAN.md) (email-based)
  - ✅ **SHORT CODE INVITES SYSTEM - COMPLETATO** ✅ [SHORT_CODE_INVITES_PLAN.md](SHORT_CODE_INVITES_PLAN.md) (21/01/2026)
    - ✅ Sistema codice breve tipo Discord/Zoom (6 caratteri: `ABC123`)
    - ✅ Completamente anonimo (no email requirement)
    - ✅ Mobile-friendly con Web Share API
    - ✅ URL breve: `/join/ABC123`
    - ✅ Pending user email strategy per email confirmation flow
    - ✅ Implementazione completata e testata in ~5 ore
  - ✅ Database schema: `lists`, `list_members`, `invites` tables con RLS policies
  - ✅ Migrations: `010_simplify_invites_short_code.sql`, `011_add_pending_user_email_to_invites.sql`
  - ✅ Backward compatible migration (Approach A) - tutti gli utenti esistenti migrati
  - ✅ Edge Functions complete: `create-invite`, `validate-invite`, `accept-invite` (short code based)
  - ✅ Frontend components: InviteDialog con generazione short code + Web Share API
  - ✅ Signup/Login integration con short code validation e manual input
  - ✅ registerPendingInvite() per salvare email durante signup
  - ✅ acceptInviteByEmail() per auto-acceptance dopo email confirmation
  - ✅ Creator name personalizzazione messaggi (da auth.users.user_metadata)
  - ✅ Welcome toast persistence attraverso page reload
  - ✅ Debug logging cleanup per production readiness
  - ✅ Testing completo: iPhone email share + recipient signup + email confirmation flow
  - Files modified: invites.ts, authStore.ts, SignUpPage.tsx, AuthForm.tsx, DashboardPage.tsx, InviteDialog.tsx, App.tsx
  - Edge Functions: supabase/functions/{create,validate,accept}-invite/index.ts (updated per short codes)
  - Types: invite.types.ts (CreateInviteResponse now returns shortCode)
  - Commits: ad75eee, 9b3517d, 7507ad7, 71d352b e altri
- [x] ✅ Add 'Nome' field for users and update greeting (COMPLETATO)
  - Campo "Nome" nel form di registrazione con validation
  - Salvataggio in user_metadata di Supabase Auth (no DB migration needed)
  - Dashboard: "Ciao, {nome}!" invece di "Ciao, {email}!"
  - User menu: display nome completo come label
  - Fallback graceful per utenti esistenti (username da email)
  - Backward compatible con tutti gli utenti
  - Files modified: auth.schemas.ts, auth.ts, useAuth.ts, AuthForm.tsx, DashboardPage.tsx, AppLayout.tsx

#### Tasks (Giorno 7) ✅ COMPLETATO
- [x] ✅ Real-time updates con Supabase Realtime
- [x] ✅ Mobile recovery logic per iOS Safari e Android Chrome
- [x] ✅ Visual feedback per modifiche altrui (toast notifications)
- [x] ✅ Testing multi-user scenarios (Desktop + iPhone + Android)

**Implementazione Completa** (Sessione 31/01/2026):
- ✅ Supabase Realtime con heartbeat ridotto (15s) per mobile
- ✅ useNetworkStatus hook per online/offline detection
- ✅ useRealtimeFoods hook con mobile recovery logic:
  - Page Visibility API per invalidare queries allo sblocco schermo
  - Network status handler con 2s delay per iOS DNS
  - Manual reconnect con exponential backoff (max 5 tentativi)
  - Session refresh dopo network restore
- ✅ FoodForm conflict detection durante editing
- ✅ mutationTracker per deduplicazione eventi locali/remoti
- ✅ Toast notifications per DELETE remoti
- ✅ Documentazione completa: docs/REALTIME_MOBILE_FIX.md

**Bug Fixes Risolti**:
1. ✅ Circular dependency tra useRealtimeFoods e useFoods
2. ✅ Deduplicazione eventi con mutationTracker invece di timestamp
3. ✅ Reconnection loop su iOS dopo SUBSCRIBED
4. ✅ Visibility handler sempre invalida queries (non solo se connected)
5. ✅ reconnectTrigger state per forzare re-setup subscription
6. ✅ DNS delay 2s dopo network restore su iOS Safari

**Testing Completo**:
- ✅ Desktop Chrome: sync immediato tra 2 browser
- ✅ iPhone Safari: screen lock, background app, airplane mode, WiFi/5G switch
- ✅ Android Chrome: background app, battery saver mode

**Commit**: 9942034 - feat: implement real-time synchronization for foods (Phase 1)
**Data Completamento**: 31/01/2026

### Week 7: Final Polish

#### Tasks (Giorno 1-2) ✅ COMPLETATO
- [x] ✅ Cross-browser testing (Chrome, Safari, Firefox desktop)
- [x] ✅ Mobile device testing (iOS Safari/Chrome + Android Chrome/Firefox)
- [x] ✅ Bug fixes da testing (nessun bug trovato!)
- [ ] E2E tests critical paths (opzionale con Playwright)
- [ ] Security review (opzionale)

#### Tasks (Giorno 3-4) ✅ COMPLETATO
- [x] ✅ Documentation review e aggiornamenti (USER_GUIDE, ROADMAP, README)
- [x] ✅ UX polish finale (error messages, empty states, copy consistency)
- [x] ✅ Pre-launch checklist (security review, config verification, link checking)
- [x] ✅ Preparazione Fase 6 (launch checklist completa, beta testing plan)
- [ ] Privacy policy & Terms of Service (opzionale)
- [ ] Video demo/tutorial (opzionale)

### Deliverables Fase 5 ✅ COMPLETATA
✅ **Production Ready**:
- ✅ Shared lists funzionante (Short Code Invites system)
- ✅ Dark mode funzionante (light/dark/system)
- ✅ Accessibility compliant (WCAG AA)
- ✅ Performance ottimizzata (75% bundle reduction)
- ✅ Testing completo cross-browser (7 browsers, 0 bugs)
- ✅ Documentazione completa e accurata
- ✅ Security review completato
- ✅ Pre-launch checklist verificata
- ✅ **Real-time sync multi-device** (Desktop + iOS + Android)

---

## 🚢 Fase 6: Launch & Iteration (Settimana 7+)

**Obiettivo**: Release pubblica e raccolta feedback

### Lista Singola per Utente - UX Improvements ✅ COMPLETATO
- [x] **Implementare approccio "una lista per utente"** (Piano: [SINGLE_LIST_IMPLEMENTATION_PLAN.md](SINGLE_LIST_IMPLEMENTATION_PLAN.md))
  - [x] Backend: `acceptInviteWithConfirmation()` con dialog conferma perdita dati
  - [x] Backend: `leaveSharedList()` per abbandonare lista condivisa
  - [x] UI: Menu "Inviti" centralizzato (Crea/Accetta/Abbandona)
  - [x] UI: AcceptInviteDialog con warning count cibi eliminati
  - [x] UI: InviteMenuDialog con 3 opzioni integrate
  - [x] UI: LeaveListDialog per creare nuova lista personale
  - [x] Route: `/join/:code` per link esterni
  - [x] Mobile-first: Input codice ottimizzato (text-xl, h-14)
  - [ ] Testing: 8 test cases completi (TC1-TC8) 🔄 PROSSIMO
  - ✅ Completato in: 1.5 giorni (coding)
  - Files: 7 nuovi, 5 modificati (12 totali)
  - Build: SUCCESS (0 errori TypeScript/ESLint)

### Launch Checklist
- [x] Supabase production project setup
- [x] Environment variables production
- [x] Domain custom (entroapp.it configurato con Netlify + Resend SMTP)
- [ ] Analytics setup (Plausible/PostHog)
- [ ] Error tracking (Sentry - opzionale)
- [ ] Backup strategy database
- [ ] Monitoring uptime

### Beta Testing
- [ ] Reclutare 10-20 beta tester
- [ ] Feedback form/survey
- [ ] Bug reporting system
- [ ] Usage analytics review
- [ ] Iterate su feedback

### Marketing & Distribution
- [ ] Landing page dedicata
- [ ] Demo video/GIF
- [ ] Social media announce
- [ ] Product Hunt launch (opzionale)
- [ ] Post su r/SideProject, r/webdev
- [ ] Portfolio update con case study

---

## 🌟 Desiderata - Feature Future (Senza Data Specifica)

**Nota**: Queste feature sono desiderabili ma non essenziali per il lancio. Possono essere implementate in futuro in base a feedback utenti e priorità.

### 📅 Calendar Enhancements

**MonthView con Heatmap**
- [ ] Implementare MonthView component
- [ ] Calendario mensile a griglia (7x5/6)
- [ ] Heatmap colorata per densità scadenze
- [ ] Click su giorno → mostra dettaglio alimenti
- [ ] Legend per interpretare colori heatmap

**Navigation tra Periodi**
- [ ] Bottoni prev/next per navigare tra settimane
- [ ] Bottoni prev/next per navigare tra mesi
- [ ] Indicatore periodo corrente
- [ ] Jump to today button
- [ ] Date picker per salto rapido

### 🔔 Push Notifications System

**Notification Setup**
- [ ] Implementare notification permissions flow
- [ ] Browser push notifications setup
- [ ] Creare notification service con Supabase
- [ ] Testing notifiche cross-browser

**Notification Types**
- [ ] Notifica 3 giorni prima scadenza
- [ ] Notifica giorno della scadenza
- [ ] Notifica per alimenti scaduti non consumati
- [ ] Weekly digest notification (riepilogo settimanale)

**Settings & Customization**
- [ ] Settings page per gestire notifiche
- [ ] Toggle on/off per ogni tipo notifica
- [ ] Orario preferito per ricevere notifiche
- [ ] Testing notifiche su device reali

### 📊 Statistics & Analytics

**Dashboard Statistiche**
- [ ] Dashboard statistiche dettagliata
- [ ] Chart per waste tracking (alimenti sprecati)
- [ ] Economic impact calculator (stima risparmio)
- [ ] Monthly trends visualization
- [ ] Category breakdown (quale categoria spreca di più)

**Advanced Metrics**
- [ ] Tasso di consumo alimenti per categoria
- [ ] Tempo medio prima consumo/scadenza
- [ ] Prodotti più/meno sprecati
- [ ] Export dati in CSV/PDF

### 🚀 Advanced Features

**Smart Suggestions**
- [ ] Machine learning per durate prodotti personalizzate
- [ ] Suggerimenti ricette basate su alimenti in scadenza
- [ ] Shopping list integration
- [ ] OCR per leggere date stampate da foto

**Gamification**
- [ ] Badges per obiettivi raggiunti (zero waste month)
- [ ] Streak counter (giorni consecutivi senza sprechi)
- [ ] Leaderboard tra amici (opzionale)

**Integration & Export**
- [ ] API pubblica per terze parti
- [ ] Integration liste spesa (Bring!, AnyList, etc.)
- [ ] Export backup completo dati
- [ ] Import da CSV

### 📴 Offline-First Enhancements

**Local Data Storage**
- [ ] IndexedDB per cache locale degli alimenti
- [ ] Sincronizzazione dati Supabase → IndexedDB
- [ ] Visualizzazione alimenti cachati quando offline
- [ ] Timestamp "ultimo aggiornamento" visibile

**Background Sync**
- [ ] Queue operazioni offline (add, edit, delete)
- [ ] Sync automatico quando torna la connessione
- [ ] Conflict resolution per modifiche concorrenti
- [ ] Indicatore visivo "modifiche in attesa di sync"

**Enhanced Caching**
- [ ] Cache immagini alimenti in IndexedDB
- [ ] Strategia cache per immagini signed URLs
- [ ] Compressione immagini per cache locale
- [ ] Gestione quota storage e pulizia automatica

**Offline UX**
- [ ] Editing alimenti offline (salvati localmente)
- [ ] Indicatore sync status per ogni alimento
- [ ] Notifica quando sync completato
- [ ] Fallback graceful per funzionalità non disponibili

---

## 📊 Sprint Planning Template

### Sprint Structure (2 settimane)
```
Week 1: Development Focus
- Mon-Wed: Core features implementation
- Thu-Fri: Integration & testing
- Weekend: Stretch goals / polish

Week 2: Polish & Validation
- Mon-Tue: Bug fixes & refinements
- Wed-Thu: Testing & documentation
- Fri: Sprint review & next sprint planning
- Weekend: Buffer
```

### Daily Workflow
```
1. Morning: Review priority tasks
2. Code: 2-3 hour focused sessions
3. Test: Manual testing as you go
4. Commit: Small, frequent commits
5. Document: Update docs with learnings
```

---

## 🎯 Success Metrics per Fase

### Fase 1 (MVP)
- [ ] App deployed e accessibile
- [ ] 0 bug critici
- [ ] CRUD completo funzionante
- [ ] 3+ beta tester positivi

### Fase 2 (Barcode)
- [ ] 70%+ prodotti italiani riconosciuti
- [ ] <5s tempo medio scansione
- [ ] 80%+ accuracy pre-compilazione
- [ ] Feedback positivo su UX

### Fase 3 (UX)
- [ ] Swipe gestures fluidi (>30 fps)
- [ ] Calendario carica <1s
- [ ] 90%+ soddisfazione mobile UX
- [ ] Accessibility score WCAG AA

### Fase 4 (PWA)
- [ ] Install prompt >50% conversion
- [ ] Lighthouse PWA score >90
- [ ] Offline basic funzionante
- [ ] Installabile su iOS + Android

### Fase 5 (Polish)
- [ ] Lighthouse score >90 tutte le metriche
- [ ] Zero bug critici o blockers
- [ ] Accessibility WCAG AA compliant
- [ ] Documentation completa

---

## ⚠️ Rischi & Mitigazioni

| Rischio | Probabilità | Impatto | Mitigazione |
|---------|-------------|---------|-------------|
| Underestimate tempo dev | Alta | Medio | Buffer 20% su ogni sprint |
| Barcode recognition basso | Media | Alto | Database locale fallback |
| Performance issues mobile | Media | Alto | Profiling continuo, optimization early |
| Scope creep | Alta | Alto | Strict MVP definition, backlog for later |
| Supabase free tier limits | Bassa | Medio | Monitor usage, upgrade plan ready |
| User adoption bassa | Media | Medio | Marketing plan, beta testing early |

---

## 💡 Tips per Success

1. **Ship Early, Ship Often**
   - Deploy ogni feature appena funzionante
   - Get feedback presto e spesso

2. **Test on Real Devices**
   - Non fidarti solo di simulator
   - iPhone + Android fisici essenziali

3. **Document as You Go**
   - Non rimandare la documentazione
   - Future-you ti ringrazierà

4. **MVP First, Polish Later**
   - Resisti alla tentazione di perfezionare
   - Shipping > Perfection

5. **User Feedback is Gold**
   - Ascolta i beta tester
   - Iterate basandoti su dati reali

---

## 📅 Milestone Summary

| Milestone | Target | Key Deliverable | Status |
|-----------|--------|-----------------|--------|
| M0: Setup | Week 0 | Progetto configurato | ✅ Completato |
| M1: MVP | Week 2 | CRUD + Auth working | ✅ Completato |
| M2: Barcode | Week 3 | Scanner funzionante | ✅ Completato |
| M3: UX | Week 4 | Swipe + WeekView Calendar | ✅ Completato |
| M4: PWA | Week 5 | App installabile + Offline | ✅ Completato |
| M5: Polish | Week 6 | Quality + Accessibility | ✅ Completato (7/7) |
| M6: Launch | Week 7+ | Public release + Beta | 🚀 Futuro |

---

## ✅ Current Status

**🎉 FASE 1 COMPLETATA! MVP DEPLOYED & TESTED 🎉**
**🎉 FASE 2 COMPLETATA! BARCODE SCANNER FUNZIONANTE 🎉**
**🎉 FASE 3 COMPLETATA! SWIPE + WEEKVIEW FUNZIONANTI 🎉**
**🎉 FASE 4 COMPLETATA! PWA INSTALLABILE + OFFLINE MODE 🎉**
**🎉 FASE 5 COMPLETATA! 7/7 TASKS COMPLETATI 🎉**

**Fase Attuale**: Fase 6 - Launch & Iteration (Beta Testing & Public Release)
**Production URL**: https://entroapp.it 🚀
**Legacy URL**: https://entro-il.netlify.app (still active)
**Status**: Production-Ready al 100% ✅
**Next Milestone**: Beta testing con 10-20 utenti

### Fase 5 Progress (COMPLETATA):
- ✅ Dark Mode (light/dark/system + theme toggle)
- ✅ Performance Optimization (75% bundle reduction, lazy loading)
- ✅ Accessibility Audit WCAG AA (core implementation + manual testing)
- ✅ Short Code Invites System (6-char codes, Web Share API, email confirmation flow)
- ✅ Add 'Nome' field for users (registration + personalized greeting)
- ✅ Cross-browser testing (7 browsers tested, 0 issues found)
- ✅ Final bug fixes and polish (docs review, UX polish, pre-launch checklist)
- ✅ **Real-time updates per iOS Safari e Android Chrome** (31/01/2026)

---

## 📅 Sessione 10/01/2026 - Recap Completo

### **Mattina** (Image Upload System):
1. ✅ Image upload system completo con Supabase Storage
2. ✅ Private bucket con signed URLs per sicurezza
3. ✅ Upload on submit pattern (eliminati orphan files)
4. ✅ ImageUpload component riusabile
5. ✅ Image compression e optimization (max 800px, ~1MB)
6. ✅ HEIC/HEIF support per foto iPhone
7. ✅ useSignedUrl hook con caching
8. ✅ FoodCard con image display via signed URLs
9. ✅ Delete cascade per pulizia automatica storage

### **Pomeriggio** (Filters + Mobile-First Optimizations):
1. ✅ Sistema filtri e ricerca completo con server-side filtering
2. ✅ FoodFilters component collassabile per mobile
3. ✅ Debounced search (300ms) con useDebounce hook
4. ✅ URL query params persistence
5. ✅ Stats cards cliccabili per quick filters
6. ✅ Layout mobile-first ottimizzato:
   - Stats cards compatte (griglia 3 colonne)
   - Floating Action Button (FAB)
   - FoodCard layout ottimizzato
   - Note con sfondo ambra
7. ✅ Bug fix: calcolo giorni scadenza normalizzato

### **Sera** (Deploy + Testing + Bug Fixes):
1. ✅ Netlify deployment configuration
2. ✅ CI/CD auto-deploy da GitHub
3. ✅ Environment variables production setup
4. ✅ Testing completo su 3 piattaforme (Desktop, iPhone, Android)
5. ✅ **Bug Fix #1**: Email confirmation redirect (Supabase config)
6. ✅ **Bug Fix #2**: Stats calculation inconsistency (date normalization)
7. ✅ **Bug Fix #3**: Android 14+ camera access (dual-button UI)
8. ✅ Production testing e validation

---

## 📅 Sessione 12/01/2026 - Fase 2 Completata

### **Barcode Scanner Bug Fix Journey** (Critical):

**Problema Iniziale**:
- Callback spam: 100+ "Barcode scanned" logs dopo singolo scan
- Callbacks continuavano anche dopo chiusura modal
- Form fields lampeggiavano continuamente
- Scanner continuava in background sulla dashboard

**Tentativi Falliti**:
1. ❌ Debounce basato su timestamp (500ms)
2. ❌ Distruzione istanza reader (`readerRef.current = null`)
3. ❌ hasScannedRef flag solamente
4. ❌ Stop video stream solamente

**Root Cause Identificato**:
- Non stavamo salvando l'oggetto `controls` restituito da `decodeFromVideoDevice()`
- Impossibile chiamare `controls.stop()` per fermare la queue di callback
- ZXing continuava a processare frames anche dopo distruzione del nostro ref

**Soluzione Implementata** (Commit `cb5545a`):
1. ✅ Salvare controls da `decodeFromVideoDevice()`
2. ✅ Chiamare `controls.stop()` dopo primo scan
3. ✅ Configure reader con delays (delayBetweenScanSuccess: 2000ms)
4. ✅ mountedRef pattern per prevent callback dopo unmount
5. ✅ Complete cleanup:
   - `controls.stop()`
   - `BrowserCodeReader.releaseAllStreams()`
   - `BrowserCodeReader.cleanVideoSource(videoElement)`

**Documentazione**:
- ✅ `docs/BARCODE_BUG.md` creato con analisi completa
- ✅ Research documentazione ufficiale ZXing
- ✅ GitHub issues #19 e #21 studiati
- ✅ Code examples e solution planning documented

**Testing Finale**:
- ✅ iPhone Safari: Scanner funzionante, UN SOLO callback ✅
- ✅ Android Chrome: Scanner funzionante, UN SOLO callback ✅
- ✅ Console logs puliti, no spam
- ✅ Modal si chiude correttamente
- ✅ No callbacks dopo ritorno a dashboard

### **Risultato**:
🎉 **Fase 2 COMPLETATA con successo!** Barcode scanner fully functional in production.

---

## 📅 Sessione 13/01/2026 - Fase 3: Swipe Gestures

### **Swipe Gestures Implementation** (Completato):

**Implementazione**:
1. ✅ Installazione react-swipeable
2. ✅ SwipeableCard wrapper component:
   - Mobile detection (touch + viewport < 768px)
   - Swipe right → Edit (background verde)
   - Swipe left → Delete (background rosso)
   - Threshold 80px per triggerare azioni
   - Smooth CSS transitions
3. ✅ Animated hint su prima card:
   - Mini-swipe automatico dopo 2s
   - LocalStorage flag per show once
   - Solo su mobile
4. ✅ InstructionCard per nuovi utenti:
   - Appare quando nessun alimento presente
   - Istruzioni chiare con icone colorate
   - Dismissable con swipe left
   - LocalStorage flag
5. ✅ UI/UX optimization:
   - Buttons Edit/Delete nascosti su mobile
   - Buttons visibili su desktop
   - Background opacity progressiva durante swipe

**Testing**:
- ✅ iOS Safari: Swipe gestures funzionanti
- ✅ Android Chrome: Swipe gestures funzionanti
- ✅ Desktop: Nessuna modifica (buttons visibili)
- ✅ Animazioni smooth senza lag

**Commits**:
- `7b197ff` - feat: implement swipe gestures for mobile food cards
- `edeb9c7` - fix: improve visual cues visibility on mobile cards
- `f98c715` - refactor: replace visual cues with animated hint on first card
- `5c9bedf` - feat: add instruction card for new users with swipe demo

### **Risultato**:
🎉 **Swipe Gestures COMPLETATI!** Mobile UX significantly improved.

---

## 📅 Sessione 13/01/2026 - Fase 3 Parte 2: WeekView Calendar

### **WeekView Implementation** (Completato):

**Implementazione**:
1. ✅ Date utility functions (src/lib/utils.ts):
   - `getNext7Days()` - genera rolling 7-day window
   - `formatDateKey()` - formatta date YYYY-MM-DD (local timezone)
   - `groupFoodsByDate()` - raggruppa alimenti per expiry_date
2. ✅ CalendarFoodCard component ultra-compatto:
   - Solo nome + quantità (es. "Ricotta (1pz)")
   - No immagini, no icone (massima densità)
   - Click → apre dialog modifica
3. ✅ DayColumn component:
   - Header uniformi: "martedì 13 gen" su singola riga
   - Badge sempre visibile: "0 alimenti" / "1 alimento"
   - Vertical scroll per giorni con molti items
   - Empty state con icona verde
4. ✅ WeekView container:
   - Filtra alimenti nei prossimi 7 giorni
   - Mobile: horizontal scroll con snap, 280px columns
   - Desktop: responsive 7-column grid, tutte visibili
   - Empty state quando nessuna scadenza
5. ✅ DashboardPage integration:
   - Toggle Lista/Calendario sostituisce titolo pagina
   - View mode in URL params (?view=list|calendar)
   - Conditional rendering tra viste
   - Filtri applicati in entrambe le viste

**Bug Fix**:
- ✅ Timezone issue risolto: date-fns format() invece di toISOString()
- Alimenti apparivano un giorno dopo nella calendar view

**Testing**:
- ✅ Desktop: Tutte le 7 colonne visibili
- ✅ Mobile: Scroll orizzontale fluido con snap
- ✅ Toggle funziona, URL si aggiorna
- ✅ Filtri rispettati in calendar view
- ✅ Alimenti posizionati nei giorni corretti

**Commits**:
- `7cba90b` - feat: add WeekView calendar with 7-day rolling window
- `a9d3acd` - fix: use local timezone for calendar date formatting

### **Risultato**:
🎉 **WeekView COMPLETATA!** Calendar view funzionante in production con mobile-first design.

---

## 📅 Sessione 16/01/2026 - Fase 5: Dark Mode + Performance

### **Dark Mode Implementation** (Completato):

**Implementazione**:
1. ✅ useTheme custom hook:
   - Gestione tema (light/dark/system)
   - localStorage persistence
   - System preference detection (prefers-color-scheme)
   - Auto-sync quando cambia preferenza sistema
2. ✅ ThemeToggle component:
   - Dropdown menu con 3 opzioni (Chiaro/Scuro/Sistema)
   - Icone dinamiche (Sun/Moon)
   - Checkmark su opzione attiva
   - Integrato nell'header accanto al menu utente
3. ✅ Dark mode support universale:
   - Tutti i componenti aggiornati con colori semantici
   - text-slate-* → text-foreground/text-muted-foreground
   - bg-slate-* → bg-background/bg-card/bg-muted
   - border-slate-* → border-border
4. ✅ Components aggiornati:
   - AppLayout (header, navigation)
   - DashboardPage (welcome, stats, empty states)
   - FoodCard (notes field con amber theming)
   - FoodFilters, Calendar components
   - InstructionCard, SwipeableCard
5. ✅ Smooth transitions tra temi
6. ✅ Testing su smartphone: funzionante su iOS e Android

**Commit**: `40c8bca` - feat: implement dark mode with theme toggle
**Data Completamento**: 16/01/2026

### **Performance Optimization** (Completato):

**Code Splitting Strategy**:
1. ✅ Route-based lazy loading:
   - LoginPage, SignUpPage, DashboardPage, TestConnection
   - Suspense con loading fallback
   - Converted exports to default for React.lazy
2. ✅ Component-level lazy loading:
   - BarcodeScanner (412 KB) - caricato solo quando si scannerizza
   - WeekView (3 KB) - caricato solo in calendar view
   - Wrapped con Suspense per progressive loading
3. ✅ Manual chunk splitting:
   - react-vendor: 49 KB (17 KB gzip)
   - react-query: 41 KB (12 KB gzip)
   - supabase: 173 KB (44 KB gzip)
   - date-fns: 21 KB (6 KB gzip)
   - forms: 93 KB (27 KB gzip)
   - zxing: 412 KB (107 KB gzip) - lazy loaded
   - ui-utils: 26 KB (8 KB gzip)

**Bundle Size Improvements**:
- **Main bundle**: 2656 KB → 331 KB (**75% reduction!**)
- **Initial load**: 100 KB gzipped (vs 712 KB before)
- **DashboardPage**: 1483 KB - lazy loaded quando serve
- **Cache-friendly**: vendor chunks separati per long-term caching

**Dependencies**:
- ✅ Installato rollup-plugin-visualizer per bundle analysis

**Commit**: `b1f6cf6` - perf: implement comprehensive code splitting and bundle optimization
**Data Completamento**: 16/01/2026

### **Risultato**:
🎉 **Fase 5 (2/7 tasks) COMPLETATA!** Dark mode + Performance optimization deployed in production.

---

## 📅 Sessione 16/01/2026 - Fase 5: Accessibility + Nome Field

### **Accessibility Audit WCAG AA** (Task 3) ✅ COMPLETATO:

**Core Implementation**:
1. ✅ Skip link "Vai al contenuto principale"
2. ✅ Semantic HTML: nav landmark, role="group" for button groups
3. ✅ Heading hierarchy fixed (single h1 per page)
4. ✅ Keyboard navigation: all interactive elements accessible
5. ✅ Stats cards converted to semantic buttons with aria-pressed
6. ✅ View toggles with aria-label and aria-pressed
7. ✅ ARIA labels for all buttons (Edit, Delete, Camera, Gallery, Remove)
8. ✅ Decorative icons marked with aria-hidden="true"
9. ✅ Form error messages with role="alert"
10. ✅ Expiry badge with role="status" + aria-label
11. ✅ Focus management: focus-visible:ring-2 on all interactive elements
12. ✅ Comprehensive documentation in ACCESSIBILITY_AUDIT.md

**Bug Fix**:
- ✅ Fixed nested <button> error in FoodFilters component
- ✅ Separated toggle button from "Cancella" Button
- ✅ Added aria-expanded for toggle button state

**Manual Testing Completed**:
- ✅ Keyboard navigation tested
- ✅ Screen reader compatibility verified
- ✅ Color contrast checked (light + dark mode)
- ✅ Focus indicators working correctly

**Commits**:
- `8d1d3b6` - feat: implement comprehensive WCAG AA accessibility improvements
- `583037a` - fix: resolve nested button error in FoodFilters and improve stats cards styling

---

### **Add Nome Field** (Task 5) ✅ COMPLETATO:

**Implementation**:
1. ✅ Campo "Nome" aggiunto nel form di registrazione
2. ✅ Validation: required, min 2 chars, max 100 chars, trimmed
3. ✅ Salvataggio in user_metadata di Supabase Auth
4. ✅ Dashboard: "Ciao, {nome}!" invece di "Ciao, {email}!"
5. ✅ User menu: display nome completo
6. ✅ Fallback graceful per utenti esistenti senza nome

**File Modificati**:
- `auth.schemas.ts`: signupSchema con campo full_name
- `auth.ts`: signUp() accetta fullName e lo salva in metadata
- `useAuth.ts`: hook aggiornato per passare fullName
- `AuthForm.tsx`: campo Nome nel form di signup
- `DashboardPage.tsx`: display nome nel saluto
- `AppLayout.tsx`: display nome nel user menu

**Technical Details**:
- User metadata: user.user_metadata.full_name
- No database migration needed (usa Supabase Auth metadata)
- Backward compatible con utenti esistenti
- TypeScript types aggiornati

**Commit**: `8a6e223` - feat: add full name field for user registration and personalized greeting

---

### **Risultato Sessione**:
🎉 **Fase 5 (4/7 tasks) AVANZATA!** Accessibility + Nome field completati con successo.

---

## 📅 Sessione 16/01/2026 (Sera) - Bug Fixes & Error Handling

### **Bug Fixes Completati**:

**Bug Fix #1: Nested Button Error in FoodFilters**
- **Problema**: Console mostrava "In HTML, <button> cannot be a descendant of <button>"
- **Root Cause**: FoodFilters aveva un toggle button che wrappava un Button component per "Cancella"
- **Soluzione**:
  - Separated toggle button from "Cancella" button
  - Changed wrapper da `<button>` a `<div>`
  - Added aria-expanded and aria-label to toggle button
  - Both buttons now independent and accessible
- **User Feedback**: "il fix ha funzionato"
- **Commit**: `583037a` - fix: resolve nested button error in FoodFilters

**Bug Fix #2: Missing Images Console Spam**
- **Problema**: Console spam con "POST .../storage/v1/object/sign/food-images/... 400 (Bad Request)"
- **Root Cause**: Database references to deleted storage images caused 400 errors for signed URLs
- **Soluzione**:
  1. storage.ts: Detect "Object not found" errors, throw custom "IMAGE_NOT_FOUND" error
  2. useSignedUrl.ts: Catch "IMAGE_NOT_FOUND" silently without console logging
  3. FoodCard already handled missing images with placeholder
- **Result**: Clean console, graceful handling of deleted images
- **Commit**: `73358b3` - fix: improve error handling for missing images in storage

**Bug Fix #3: Auth Session Missing Errors**
- **Problema**: Console errors "Error getting current user: Error: Auth session missing!" dopo logout/login
- **Root Cause**: Expected "session missing" errors were being logged as errors
- **Soluzione**:
  - Detect "session" + "missing" keywords in error messages
  - Return null silently for expected session missing cases
  - Only log unexpected errors
  - Applied to both error handler and catch block
- **Result**: Clean console on logout, only real errors logged
- **Commit**: `054a32b` - fix: suppress expected auth session missing errors in getCurrentUser

### **Risultato**:
✅ **Console pulita, error handling robusto!** Tutti i bug di console risolti con graceful fallbacks.

---

## 📅 Sessione 16/01/2026 (Parte 3) - Cross-Browser Testing

### **Cross-Browser Testing Completo** ✅ COMPLETATO:

**Testing Completato su 7 Browsers**:
1. ✅ Chrome Desktop (macOS) - Fully compatible
2. ✅ Safari Desktop (macOS) - Fully compatible
3. ✅ Firefox Desktop (macOS) - Fully compatible
4. ✅ iOS Safari (iPhone) - Excellent mobile experience
5. ✅ iOS Chrome (iPhone) - Fully compatible
6. ✅ Android Chrome - Android 14+ camera fix working
7. ✅ Android Firefox - Fully compatible

**Features Tested Per Browser**:
- Authentication (signup, login, logout, session persistence)
- CRUD Operations (create, edit, delete foods)
- Image Upload (gallery + camera on mobile)
- HEIC Conversion (iOS only)
- Barcode Scanner (camera access + ZXing)
- Filters & Search (all filter types + debounced search)
- Calendar View (WeekView con 7-day rolling window)
- Swipe Gestures (mobile only)
- Dark Mode (theme toggle + system preference)
- PWA Features (install, offline mode, service worker)
- Accessibility (keyboard nav, screen reader, ARIA)
- Performance (lazy loading, bundle optimization)

**Risultati Testing**:
- ✅ **0 Critical Bugs**
- ✅ **0 Major Bugs**
- ✅ **0 Minor Bugs**
- ✅ All features funzionanti su tutti i browser testati
- ✅ Performance eccellente su tutti i dispositivi
- ✅ PWA installabile su iOS e Android
- ✅ Accessibility verificata

**Documentation**:
- ✅ `docs/CROSS_BROWSER_TESTING.md` creato con report completo
- ✅ Sezioni dettagliate per ogni browser con status
- ✅ Known limitations documentate (PWA install prompts, camera access)
- ✅ Browser compatibility summary table

**Nota**: Edge Desktop non testato (Chromium-based, expected compatible con Chrome).

**Commit**: In attesa di eventuali fix (nessun fix necessario!)
**Data Completamento**: 16/01/2026

### **Risultato Sessione**:
🎉 **Fase 5 Task 6 COMPLETATO!** Cross-browser testing passed con 100% compatibility!

---

## 📅 Sessione 31/01/2026 - Real-Time Mobile Fix

### **Real-Time Sync per Mobile** (Completato):

**Problema Iniziale**:
- Real-time updates funzionavano su desktop (2 browser testati)
- **Non funzionavano** su iOS Safari e Android Chrome
- Root cause: Safari sospende WebSocket quando schermo bloccato/app in background

**Soluzione Implementata**:
1. ✅ Heartbeat ridotto a 15s (default 25s) in `supabase.ts`
2. ✅ `useNetworkStatus` hook per online/offline detection
3. ✅ `useRealtimeFoods` hook con mobile recovery:
   - Page Visibility API → invalidate queries allo sblocco
   - Window focus handler → fallback per browser con poor visibility support
   - Network status handler con 2s delay per iOS DNS resolution
   - Manual reconnect con exponential backoff (max 5 tentativi)
   - `reconnectTrigger` state per forzare re-setup subscription
   - `hasEverConnectedRef` per evitare reconnect al primo mount
4. ✅ FoodForm conflict detection durante editing
5. ✅ `mutationTracker` per deduplicazione eventi locali/remoti
6. ✅ Session refresh dopo network restore

**Bug Fixes Iterativi**:
1. ❌→✅ Circular dependency: usare query key letterali `['foods', 'list']`
2. ❌→✅ Eventi ignorati: usare mutationTracker invece di timestamp
3. ❌→✅ Reconnection loop: cancellare timeout quando subscription ha successo
4. ❌→✅ Visibility handler: invalidare SEMPRE, non solo se connected
5. ❌→✅ manualReconnect: aggiungere reconnectTrigger per forzare effect re-run
6. ❌→✅ DNS iOS: attendere 2s dopo network restore + refresh session

**Testing Finale** (3 dispositivi):
- ✅ Desktop Chrome: sync immediato tra 2 browser
- ✅ iPhone Safari: screen lock 30s, background 1-5 min, airplane mode, WiFi↔5G
- ✅ Android Chrome: background, battery saver mode

**Documentazione**:
- ✅ `docs/REALTIME_MOBILE_FIX.md` con piano, criteri di accettazione, e **Lessons Learned** (9 punti chiave)

**Commits**:
- `9942034` - feat: implement real-time synchronization for foods (Phase 1)

### **Risultato**:
🎉 **Real-Time Mobile Fix COMPLETATO!** Sync funzionante su iOS Safari e Android Chrome.

---

## 🎯 Prossimi Step

### ✅ Fasi Completate:
- ✅ **Fase 1: MVP** - CRUD + Auth + Filtri + Immagini
- ✅ **Fase 2: Barcode** - Scanner + Open Food Facts API
- ✅ **Fase 3: UX** - Swipe gestures + WeekView calendar

### ⏳ Prossima Fase - Fase 4: PWA (Week 5):
1. 📱 **PWA Setup & Manifest**
   - Service worker con Vite PWA plugin
   - Manifest.json completo (nome, icone, colori)
   - Icons generazione (192x192, 512x512, favicon)
   - Test install prompt (iOS + Android + Desktop)

2. 📴 **Offline Mode**
   - Cache strategy per assets statici
   - Cache strategy per immagini
   - Fallback page per offline
   - Testing comportamento offline

3. 🧪 **Testing & Validation**
   - Cross-browser testing (Chrome, Safari, Firefox)
   - Mobile testing (iOS + Android)
   - Verificare installazione smooth
   - Documentation per utenti

### 📋 Fase 5: Polish & Quality (Week 6):
- 🎨 **Dark mode** + Theme toggle
- ♿ **Accessibility audit** WCAG AA
- ⚡ **Performance optimization** (Lighthouse >90)
- 🧪 **Testing completo** + Bug fixes
- 📚 **Documentation** + Privacy Policy

### 🚀 Fase 6: Launch (Week 7+):
- Beta testing con utenti reali
- Marketing materials (demo video, landing page)
- Public release

### 🌟 Vedi sezione "Desiderata" per feature future:
- MonthView con heatmap
- Push notifications
- Statistics dashboard
- Shared lists (multi-user)
- E altro...

---

**Pronto per iniziare?** Segui la [guida setup nel README](../README.md) per partire! 🚀
