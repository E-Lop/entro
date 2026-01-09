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

#### Tasks (Giorno 5-7) 🔄 PROSSIMO
- [ ] Componente FoodCard (presentational)
- [ ] Componente FoodForm (create/edit)
- [ ] Setup React Query per foods
- [ ] API layer per CRUD operations

### Week 2: UI & Features

#### Tasks (Giorno 1-3)
- [ ] Dashboard page con grid di cards
- [ ] Implementare CREATE food
- [ ] Implementare UPDATE food
- [ ] Implementare DELETE food (con conferma)
- [ ] Upload immagini a Supabase Storage
- [ ] Calcolo giorni alla scadenza con color coding

#### Tasks (Giorno 4-5)
- [ ] Filtri base (categoria, storage location)
- [ ] Search bar con debounce
- [ ] Ordinamenti (scadenza, alfabetico)
- [ ] Empty states e loading states

#### Tasks (Giorno 6-7)
- [ ] Responsive design mobile/desktop
- [ ] Toast notifications
- [ ] Error handling e validation
- [ ] Test manuale completo

### Deliverables Fase 1
**MVP Funzionante**:
- ✅ Login/Signup working
- [ ] CRUD completo alimenti
- [ ] Filtri e ricerca base
- [ ] UI responsive
- [ ] Deployed su Netlify

### Definition of Done
- [ ] Posso creare/modificare/eliminare alimenti
- [ ] Vedo giorni alla scadenza con colori
- [ ] Filtri funzionano correttamente
- [ ] App responsive su mobile
- [ ] Nessun bug bloccante

---

## 📷 Fase 2: Barcode Scanner (Settimana 3)

**Obiettivo**: Scansione barcode funzionante con pre-compilazione dati

### Week 3: Barcode Integration

#### Tasks (Giorno 1-2)
- [ ] Setup html5-qrcode
- [ ] Implementare useBarcodeScanner hook
- [ ] Gestione permessi camera iOS/Android
- [ ] UI scanner modal con feedback

#### Tasks (Giorno 3-4)
- [ ] Integrare Open Food Facts API
- [ ] Creare service client per API
- [ ] Implementare category mapping logic
- [ ] Sistema suggerimenti durata/storage

#### Tasks (Giorno 5-6)
- [ ] Integrazione scanner nel FoodForm
- [ ] Pre-compilazione form con dati barcode
- [ ] Fallback a inserimento manuale
- [ ] Handle prodotti non trovati

#### Tasks (Giorno 7)
- [ ] Testing su device reali (iOS + Android)
- [ ] Ottimizzazioni performance scanner
- [ ] UX polish e error states
- [ ] Documentazione utilizzo

### Deliverables Fase 2
✅ **Barcode Scanning Attivo**:
- Scanner camera funzionante
- Riconoscimento prodotti italiani
- Form pre-compilato automaticamente
- Graceful fallback per prodotti sconosciuti

### Definition of Done
- [ ] Scansiono barcode e vedo dati prodotto
- [ ] Funziona su iPhone e Android
- [ ] Performance accettabile (<3s riconoscimento)
- [ ] UI chiara e intuitiva

---

## 🎨 Fase 3: UX Enhancements (Settimana 4)

**Obiettivo**: Swipe gestures e vista calendario

### Week 4: Mobile UX & Calendar

#### Tasks (Giorno 1-2)
- [ ] Setup react-swipeable
- [ ] Implementare swipe-to-edit gesture
- [ ] Implementare swipe-to-delete gesture
- [ ] Visual feedback durante swipe
- [ ] Settings per abilitare/disabilitare swipe

#### Tasks (Giorno 3-4)
- [ ] Implementare WeekView component
- [ ] Logic per raggruppare alimenti per giorno
- [ ] Navigazione settimane (prev/next)
- [ ] Click su giorno → mostra dettagli

#### Tasks (Giorno 5-6)
- [ ] Implementare MonthView component
- [ ] Calendario grid con heatmap
- [ ] Navigazione mesi
- [ ] Integration con main dashboard

#### Tasks (Giorno 7)
- [ ] Polishing animazioni e transitions
- [ ] Testing gesture su diversi device
- [ ] Accessibility check (keyboard nav)
- [ ] Performance optimization

### Deliverables Fase 3
✅ **Advanced UX**:
- Swipe gestures fluidi su mobile
- Vista calendario settimanale funzionante
- Vista calendario mensile con heatmap
- Animazioni smooth

### Definition of Done
- [ ] Swipe left/right funziona su mobile
- [ ] Calendario mostra scadenze correttamente
- [ ] Navigazione fluida tra viste
- [ ] Feedback positivo da beta tester

---

## 🔔 Fase 4: Notifiche & PWA (Settimana 5)

**Obiettivo**: Push notifications e Progressive Web App

### Week 5: Notifications & PWA

#### Tasks (Giorno 1-2)
- [ ] Setup service worker con Vite PWA plugin
- [ ] Configurare manifest.json
- [ ] Icons per PWA (varie dimensioni)
- [ ] Test install prompt

#### Tasks (Giorno 3-4)
- [ ] Implementare notification permissions flow
- [ ] Browser push notifications setup
- [ ] Creare notification service
- [ ] Notifica 3 giorni prima scadenza

#### Tasks (Giorno 5-6)
- [ ] Notifica giorno della scadenza
- [ ] Weekly digest notification (opzionale)
- [ ] Settings per configurare notifiche
- [ ] Testing notifiche cross-browser

#### Tasks (Giorno 7)
- [ ] Offline mode basic (cache assets)
- [ ] Loading states per offline
- [ ] Testing PWA features
- [ ] Documentation PWA install

### Deliverables Fase 4
✅ **PWA Completa**:
- Installabile su home screen
- Push notifications funzionanti
- Settings notifiche personalizzabili
- Offline basic mode

### Definition of Done
- [ ] App installabile come PWA
- [ ] Ricevo notifiche per scadenze
- [ ] Posso customizzare timing notifiche
- [ ] Funziona offline (basic)

---

## 🎯 Fase 5: Polish & Features Extra (Settimana 6-7)

**Obiettivo**: Statistiche, condivisione liste, ottimizzazioni

### Week 6: Statistics & Sharing

#### Tasks (Giorno 1-3)
- [ ] Database schema per shared_lists
- [ ] UI per invitare utenti
- [ ] Email invito con link
- [ ] Accept/decline inviti

#### Tasks (Giorno 4-5)
- [ ] Real-time updates con Supabase Realtime
- [ ] Visual feedback per modifiche altrui
- [ ] Conflict resolution strategy
- [ ] Testing multi-user scenarios

#### Tasks (Giorno 6-7)
- [ ] Dashboard statistiche
- [ ] Chart per waste tracking
- [ ] Economic impact calculator
- [ ] Monthly trends visualization

### Week 7: Final Polish

#### Tasks (Giorno 1-2)
- [ ] Dark mode implementation
- [ ] Accessibility audit completo
- [ ] Performance optimization (Lighthouse >90)
- [ ] Bundle size optimization

#### Tasks (Giorno 3-4)
- [ ] E2E tests critical paths (Playwright)
- [ ] Cross-browser testing
- [ ] Mobile device testing
- [ ] Bug fixes da testing

#### Tasks (Giorno 5-7)
- [ ] Documentation completa per utenti
- [ ] Video demo/tutorial
- [ ] Privacy policy & Terms
- [ ] Preparazione launch

### Deliverables Fase 5
✅ **Production Ready**:
- Condivisione liste funzionante
- Statistiche complete
- Performance ottimizzata
- Testing completo

---

## 🚢 Fase 6: Launch & Iteration (Settimana 8+)

**Obiettivo**: Release pubblica e raccolta feedback

### Launch Checklist
- [ ] Supabase production project setup
- [ ] Environment variables production
- [ ] Domain custom (opzionale)
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
- [ ] Notifiche delivery rate >80%
- [ ] Lighthouse PWA score >90
- [ ] Offline basic funzionante

### Fase 5 (Polish)
- [ ] Lighthouse score >90 tutte le metriche
- [ ] Zero bug critici o blockers
- [ ] Shared lists funzionante
- [ ] Documentation completa

---

## 🔮 Post-Launch Roadmap (Opzionale)

### Q1 Post-Launch
- Machine learning per durate prodotti
- OCR per date stampate
- Integrazione liste spesa
- Recipe suggestions AI

### Q2 Post-Launch
- App native iOS/Android (React Native)
- Voice commands (Alexa/Google Home)
- B2B features per ristoranti
- API pubblica per terze parti

### Q3 Post-Launch
- Freemium model implementation
- Premium features
- Team collaboration features
- Advanced analytics

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

| Milestone | Target | Key Deliverable |
|-----------|--------|-----------------|
| M0: Setup | Week 0 | Progetto configurato |
| M1: MVP | Week 2 | CRUD + Auth working |
| M2: Barcode | Week 3 | Scanner funzionante |
| M3: UX | Week 4 | Swipe + Calendar |
| M4: PWA | Week 5 | Notifications + PWA |
| M5: Polish | Week 7 | Feature complete |
| M6: Launch | Week 8 | Public release |

---

## ✅ Current Status

**Fase Attuale**: Fase 1 - MVP Core (Week 1: Database & Auth)
**Progress**: 15% (Fase 0 completata ✅)
**Ultimo Commit**: `1ac1964` (09/01/2026)
**Next Action**: Database setup + Migrations Supabase

**Prossimi Step Immediati**:
1. ✅ ~~Vite setup + Tailwind config~~ COMPLETATO
2. ✅ ~~Configure environment variables~~ COMPLETATO
3. 🔄 Create initial database schema (Supabase migrations)
4. 🔄 Configure RLS policies
5. 🔄 Setup basic auth flow (signup/login/logout)

---

**Pronto per iniziare?** Segui la [guida setup nel README](../README.md) per partire! 🚀
