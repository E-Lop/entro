# Resume Session Guide - Entro Food Expiry Tracker

**Ultima Sessione**: 26 Gennaio 2026
**Status**: 🚀 FASE 6 - PREPARAZIONE IMPLEMENTAZIONE LISTA SINGOLA

---

## Quick Context

**Progetto**: Entro - Food Expiry Tracker Web App
**Tech Stack**: React + TypeScript + Vite + Supabase + Tailwind + shadcn/ui
**Production URL**: https://entroapp.it
**Legacy URL**: https://entro-il.netlify.app
**Repository**: https://github.com/E-Lop/entro
**Status**: Production-Ready ✅

### Fasi Completate
1. ✅ **Fase 1**: MVP Core (CRUD, Auth, Filters, Image Upload, Deploy)
2. ✅ **Fase 2**: Barcode Scanner (ZXing, Open Food Facts, Form Pre-fill)
3. ✅ **Fase 3**: UX Enhancements (Swipe gestures + Calendar WeekView)
4. ✅ **Fase 4**: PWA Essentials (Installable + Offline Mode)
5. ✅ **Fase 5** (7/7 tasks): Dark Mode + Performance + Accessibility + Short Code Invites + Nome Field + Cross-browser Testing + Final Polish

### Prossima Fase
**Fase 6**: Launch & Iteration
- 🔄 **PROSSIMO STEP**: Implementare approccio "Lista Singola per Utente" (2 giorni)
- Successivamente: Beta Testing → Public Release

---

## Prompt per Prossima Sessione

Quando riprendi il lavoro dopo `/clear`, usa questo prompt:

```
Ciao! Pronto per implementare il sistema "Lista Singola per Utente" per entro.

CONTESTO PROGETTO:
- ✅ FASE 5 COMPLETATA AL 100% (7/7 tasks)
- ✅ App PRODUCTION-READY su https://entroapp.it
- ✅ Short Code Invites già funzionanti (ABC123)
- ✅ Database già supporta liste multiple
- 🎯 OBIETTIVO: Implementare UX "una lista per utente"

DECISIONE ARCHITETTURALE PRESA:
Approccio "Lista Singola" - Un utente può appartenere a UNA SOLA lista alla volta.
- Caso d'uso: Famiglia/coppia con 1 lista condivisa
- Perdita dati accettabile con avviso chiaro
- Priorità: Launch veloce (2 giorni vs 1 settimana)

PIANO DETTAGLIATO:
Leggi il piano completo in: docs/SINGLE_LIST_IMPLEMENTATION_PLAN.md

IMPLEMENTAZIONE RICHIESTA:

**FASE 1: Backend Logic (2 ore)**
File: src/lib/invites.ts
- Funzione acceptInviteWithConfirmation(shortCode, forceAccept)
  - Valida invito (status, expiry)
  - Se utente ha già lista E !forceAccept → return requiresConfirmation + foodCount
  - Se forceAccept → rimuovi da lista vecchia, aggiungi a nuova
  - DELETE lista vecchia se 0 membri (CASCADE foods)
- Funzione leaveSharedList()
  - Check se lista è condivisa (>1 membro)
  - Rimuovi utente da lista corrente
  - Crea nuova lista personale con createPersonalList()

**FASE 2: UI AcceptInviteDialog (2 ore)**
File NUOVO: src/components/sharing/AcceptInviteDialog.tsx
- Due stati: initial (Unisciti) e confirmation (Attenzione Perdita Dati)
- State confirmationData con foodCount
- handleAccept(force) → chiama acceptInviteWithConfirmation()
- Se requiresConfirmation → mostra Alert destructive con count cibi
- Buttons: Annulla / Conferma e Unisciti (destructive)

**FASE 3: Menu Inviti Centralizzato (3 ore)**
Files:
- src/components/sharing/InviteButton.tsx: cambia testo "Invita membro" → "Inviti", icona Mail
- src/components/sharing/InviteMenuDialog.tsx (NUOVO): 3 opzioni
  1. Crea invito (UserPlus icon)
  2. Accetta invito (LogIn icon)
  3. Abbandona lista condivisa (LogOut icon, solo se isInSharedList)
- src/components/sharing/AcceptInviteFlowDialog.tsx (NUOVO): input codice + flow
- src/components/sharing/LeaveListDialog.tsx (NUOVO): conferma abbandono
- src/components/layout/AppLayout.tsx:
  - Import InviteMenuDialog
  - State isInSharedList (useEffect check membri lista)
  - Usa InviteMenuDialog invece di InviteDialog

**FASE 4: Route /join/:code (1 ora)**
File NUOVO: src/pages/JoinPage.tsx
- useParams per code
- Se !user → navigate('/signup?code=' + code)
- Se user → mostra AcceptInviteDialog

**FASE 5: Types (15 min)**
File: src/types/invite.types.ts
- Interface AcceptInviteConfirmationResponse

**MOBILE-FIRST REQUIREMENTS** ⚠️ IMPORTANTE:
- Input codice: className="text-center text-xl tracking-widest font-mono h-14"
- Input: autoFocus, autoComplete="off", inputMode="text"
- Dialog: className="sm:max-w-md"
- Bottoni menu: p-4, h-auto, gap-2
- Touch targets: min 44px height
- Icone: h-5 w-5 (20px)

TESTING NECESSARIO (TC1-TC8):
1. Nuovo utente senza invito → crea lista personale
2. Nuovo utente con invito → NO lista personale
3. Utente esistente lista vuota → conferma con "0 alimenti"
4. Utente esistente 10 cibi → conferma con "10 alimenti"
5. Link /join/ABC123 → redirect signup o dialog
6. Riusa stesso codice → no duplicate error
7. Codice scaduto → errore
8. Mobile UX: DevTools iPhone SE, tap con pollice

FILES DA MODIFICARE (10 totali):
Nuovi (5):
- src/components/sharing/AcceptInviteDialog.tsx
- src/components/sharing/InviteMenuDialog.tsx
- src/components/sharing/AcceptInviteFlowDialog.tsx
- src/components/sharing/LeaveListDialog.tsx
- src/pages/JoinPage.tsx

Modificati (5):
- src/lib/invites.ts (+120 righe)
- src/components/sharing/InviteButton.tsx (~5 righe)
- src/components/layout/AppLayout.tsx (+15 righe)
- src/types/invite.types.ts (+10 righe)
- src/router.tsx (+4 righe)

STIMA: 2 giorni (1.5 coding + 0.5 testing)

PRINCIPI DA SEGUIRE:
1. YAGNI - implementa solo ciò che serve
2. Mobile-First - PWA usata principalmente su smartphone
3. Sicurezza - dialog conferma previene perdita dati accidentale
4. Scalabilità - database già pronto per evoluzione futura

Iniziamo con FASE 1: Backend Logic in src/lib/invites.ts
```

---

## Documenti Chiave

### Per Implementazione Lista Singola (PROSSIMO)
1. **docs/SINGLE_LIST_IMPLEMENTATION_PLAN.md** - Piano completo implementazione (NUOVO ⭐)
2. **docs/SHORT_CODE_INVITES_PLAN.md** - Sistema inviti esistente (codici 6 caratteri)
3. **docs/DATABASE_SCHEMA.md** - Schema già pronto per liste multiple

### Per Fase 6 - Launch
4. **docs/PHASE_6_LAUNCH_CHECKLIST.md** - Guida completa beta testing e lancio
5. **docs/TASK_7_SUMMARY.md** - Summary finale Fase 5
6. **docs/ROADMAP.md** - Roadmap completa (aggiornato con piano lista singola)
7. **docs/USER_GUIDE.md** - Guida utente per beta tester

### Per Capire il Progetto
8. **README.md** - Overview, setup, features (aggiornato 23/01/2026)
9. **docs/ACCESSIBILITY_AUDIT.md** - Report accessibilità WCAG AA
10. **docs/CROSS_BROWSER_TESTING.md** - Report cross-browser (7 browser)

### Per Debugging
11. **docs/BARCODE_BUG.md** - Analisi bug ZXing callback spam (risolto)

---

## Stato Attuale del Progetto

### Features Funzionanti ✅
- ✅ Autenticazione (signup con nome, login, logout, session)
- ✅ CRUD alimenti completo con validazione
- ✅ Upload immagini con HEIC support (iPhone)
- ✅ Filtri avanzati (categoria, storage, status, search)
- ✅ Stats dashboard con color coding scadenze
- ✅ Barcode scanner con ZXing + Open Food Facts
- ✅ Form pre-fill automatico da barcode
- ✅ Swipe gestures (edit/delete) mobile
- ✅ Vista calendario settimanale (WeekView)
- ✅ Toggle Lista/Calendario
- ✅ **Shared Lists con Short Code Invites** (ABC123)
- ✅ **Web Share API** per condivisione mobile
- ✅ **PWA installabile** (iOS, Android, Desktop)
- ✅ **Service Worker** con cache strategy
- ✅ **Offline mode** (UI cached, banner)
- ✅ **Dark mode** (light/dark/system)
- ✅ **Performance ottimizzata** (75% bundle reduction)
- ✅ **Accessibilità WCAG AA** compliant
- ✅ **Nome utente personalizzato** ("Ciao, Mario!")
- ✅ Responsive design mobile-first
- ✅ Deployed su Netlify con CI/CD

### Issues Noti
⚠️ **BUG ATTUALE**: Utente con lista personale che accetta invito finisce con 2 liste
- Codice usa `.single()` che assume una sola lista
- App può rompersi con liste multiple
- **SOLUZIONE**: Implementare piano "Lista Singola" (PROSSIMO STEP)

### Tech Debt / Prossimi Step
- 🚀 **PROSSIMO**: Implementare "Lista Singola per Utente" (2 giorni) ⭐
- Successivamente: Beta testing (Fase 6)
- Future features in Desiderata: MonthView, notifiche push, statistiche

---

## Performance Metrics (Post-Optimization)

### Bundle Size
- **Before**: 2656 KB (712 KB gzipped)
- **After**: 331 KB (100 KB gzipped)
- **Reduction**: 75% 🎉

### Expected Lighthouse Scores
- **Performance**: >90
- **Accessibility**: >95 (WCAG AA compliant)
- **Best Practices**: >90
- **SEO**: >90
- **PWA**: 100

---

## Piano Lista Singola - Overview

### Decisione Architetturale
**Approccio**: Un utente può appartenere a UNA SOLA lista alla volta

### Comportamento Sistema

**Scenario 1: Nuovo Utente SENZA Invito**
- Primo login → crea "La mia lista" personale

**Scenario 2: Nuovo Utente CON Invito**
- Signup con codice → conferma email → auto-join lista condivisa
- NON crea lista personale

**Scenario 3: Utente Esistente Accetta Invito (CRITICO)**
- Ha lista personale con N cibi
- Inserisce codice invito
- Dialog: "Accettando perderai la tua lista personale. Tutti i tuoi N alimenti saranno eliminati. Vuoi continuare?"
- Se conferma → elimina lista personale + cibi, unisciti a lista condivisa
- Se annulla → mantiene lista personale

**Scenario 4: Utente Abbandona Lista Condivisa**
- Menu Inviti → Abbandona lista condivisa
- Dialog: "Lasciando la lista condivisa verrà creata una nuova lista personale vuota"
- Se conferma → lascia lista condivisa, crea nuova lista personale

### Menu "Inviti" Centralizzato
Nel dropdown avatar, bottone "Inviti" apre dialog con 3 opzioni:
1. **Crea invito** - Genera codice per condividere lista
2. **Accetta invito** - Inserisci codice per unirti a lista
3. **Abbandona lista condivisa** - Lascia lista e crea nuova personale (solo se in lista condivisa)

### Mobile-First UX
- Input codice: font-size XL (24px), height 56px, spacing wide
- Dialog responsive: sm:max-w-md
- Touch targets: min 44px
- Icone: 20px per visibilità
- inputMode="text" per tastiera alfabetica mobile

---

## Comandi Utili

### Development
```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm run preview      # Preview build
```

### Deploy
```bash
git push origin main  # Auto-deploy su Netlify
```

### Bundle Analysis
```bash
npm run build        # Genera stats.html
open dist/stats.html # Visualizza bundle
```

---

## Fase 6 - Launch Roadmap

### Step 1: Lista Singola UX (2 giorni) 🔄 PROSSIMO
- [ ] Implementare backend logic (acceptInviteWithConfirmation, leaveSharedList)
- [ ] Creare UI components (AcceptInviteDialog, InviteMenuDialog, etc.)
- [ ] Integrare menu "Inviti" centralizzato
- [ ] Route /join/:code per link esterni
- [ ] Testing completo (TC1-TC8)
- [ ] Deploy e validazione mobile

### Step 2: Beta Testing Phase (1-2 settimane)
- [ ] Reclutare 10-20 beta tester
- [ ] Creare feedback form (Google Forms/Typeform)
- [ ] Setup analytics opzionale (Plausible/PostHog)
- [ ] Monitorare metriche (registrazioni, alimenti, liste)
- [ ] Raccogliere feedback strutturato

### Step 3: Iterate & Improve (3-5 giorni)
- [ ] Analizzare feedback
- [ ] Fix bug critici (<48h)
- [ ] Implementare quick wins
- [ ] Aggiornare docs se necessario

### Step 4: Marketing Materials (Opzionale)
- [ ] Screenshot per social
- [ ] Demo video (30-60s) o GIF
- [ ] Social media post templates
- [ ] Landing page semplice (opzionale)

### Step 5: Public Release
- [ ] Launch Reddit (r/SideProject, r/webdev, r/italy)
- [ ] LinkedIn post
- [ ] Product Hunt (opzionale)
- [ ] Twitter/X thread

### Step 6: Post-Launch (1 settimana)
- [ ] Monitor production errors
- [ ] Rispondere a feedback (24h)
- [ ] Fix bug critici (48h)
- [ ] Ringraziare beta tester

---

## Celebrazioni 🎉

- **Fase 1 Completata**: 10 Gennaio 2026
- **Fase 2 Completata**: 12 Gennaio 2026
- **Fase 3 Completata**: 14 Gennaio 2026 (mattina)
- **Fase 4 Completata**: 14 Gennaio 2026 (pomeriggio)
- **Fase 5 Completata**: 23 Gennaio 2026 (7/7 tasks) 🎉
- **Piano Lista Singola Creato**: 26 Gennaio 2026 📋

**L'app è PRODUCTION-READY!** 🚀
**Prossimo milestone**: Implementazione Lista Singola UX (2 giorni)

---

**Ultimo Update**: 26 Gennaio 2026
**Next Session**: Implementare "Lista Singola per Utente" (docs/SINGLE_LIST_IMPLEMENTATION_PLAN.md)
**Production URL**: https://entroapp.it ✅
