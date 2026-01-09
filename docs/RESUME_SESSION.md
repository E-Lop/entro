# Resume Session - Food Expiry Tracker Development

**Data Sessione Precedente**: 09/01/2026
**Ultimo Commit**: `a87cb87` - docs: update ROADMAP with food CRUD completion
**Branch**: main

---

## 🎯 PROMPT PER PROSSIMA SESSIONE

Copia e incolla questo prompt dopo `/clear` per continuare il lavoro:

```
Ciao! Sto continuando lo sviluppo del progetto 'entro' (food expiry tracker).

## 📊 STATO ATTUALE

**Progetto**: Food expiry tracker con React + TypeScript + Vite + Supabase
**Branch**: main
**Working Directory**: /Users/edmondo/Documents/entro

### ✅ COMPLETATO (Fase 1 Week 1)

**Day 1-2: Database Setup** (commit: `9bfc037`)
- Supabase progetto configurato e connesso
- Database schema completo con 11 categorie italiane
- RLS policies attive
- Trigger update_updated_at_column() funzionante

**Day 3-4: Authentication System** (commit: `de0f9fb`)
- Sistema auth Supabase completo (signup/login/logout)
- React Router con protected routes
- Zustand auth store con session persistence
- AppLayout con header e user menu

**Day 5-7: Food Management CRUD** (commit: `f6f2d91`)
- ✅ React Query setup con QueryClientProvider
- ✅ Service layer completo (src/lib/foods.ts)
- ✅ React Query hooks (useFoods, useCategories, mutations)
- ✅ FoodCard component con color coding scadenze
- ✅ FoodForm con validation (zod + react-hook-form)
- ✅ Dashboard completa: grid layout, dialogs, stats real-time
- ✅ CRUD funzionante: create, read, update, delete
- ✅ Optimistic updates + toast notifications
- ✅ Bug fixes: quantity_unit enum, date validation, form preservation

**Statistiche**: Totali, in scadenza (7gg), scaduti
**Color Coding**: 🟢 >7gg | 🟡 4-7gg | 🟠 1-3gg | 🔴 scaduto
**Validazione**: Date future only, unità predefinite (pz, kg, g, l, ml, confezioni)

### 🎯 PROSSIMO OBIETTIVO: Fase 1 Week 2 - Image Upload & Filters (Day 1-3)

**Tasks da completare**:

#### 1. Image Upload a Supabase Storage (Day 1-3)
1. Configurare Supabase Storage bucket per food images
2. Creare policy RLS per storage
3. Creare `src/components/foods/ImageUpload.tsx` component riusabile
4. Implementare upload con preview
5. Aggiungere compress/resize immagini prima upload (max 1MB)
6. Integrare ImageUpload in FoodForm
7. Mostrare immagine in FoodCard (con fallback icon)
8. Implementare delete immagine da storage quando si elimina food
9. Loading states durante upload
10. Error handling upload failures

**Requisiti Tecnici Image Upload**:
- Supabase Storage bucket: `food-images`
- Path struttura: `{user_id}/{food_id}/{timestamp}-{filename}`
- Accept: image/jpeg, image/png, image/webp
- Max size: 5MB (compress a 1MB prima upload)
- Preview thumbnail prima di submit
- Mostra placeholder icon se no image
- Delete cascade: rimuovi da storage quando elimini food

#### 2. Filters & Search (Day 4-5) - DOPO UPLOAD
1. Creare `src/components/foods/FoodFilters.tsx`
2. Implementare filtri: categoria, storage_location, status
3. Search bar con debounce (300ms) per nome alimento
4. Ordinamenti: scadenza (asc/desc), alfabetico, data creazione
5. Persistenza filtri in URL query params
6. Clear all filters button
7. Counter badge su filtri attivi
8. Filter/search in useFoods hook (server-side via Supabase query)
9. Loading states durante filter changes
10. Empty state quando nessun risultato filtri

**Approccio Consigliato per Image Upload**:
1. Prima configura Supabase Storage via dashboard o migration SQL
2. Crea ImageUpload component standalone (input file + preview)
3. Aggiungi compress/resize logic con browser-image-compression
4. Integra in FoodForm (optional field)
5. Aggiorna FoodCard per mostrare immagine
6. Aggiungi delete cascade in deleteFood service
7. Testa upload/delete flow completo

**Note Importanti**:
- L'utente è già autenticato, foods filtrati per user_id automaticamente
- Dashboard è già responsive e funzionante
- Non implementare ancora barcode scanner (Fase 2)
- Focus su UX: loading states, error messages, feedback chiaro
- Usa toast per conferme upload/delete immagini

**Domande da considerare**:
- Vuoi usare una libreria per image compression (es. browser-image-compression) o gestire resize manualmente?
- Preferisci upload drag & drop oltre al file input classico?
- Crop immagine prima upload o solo resize automatico?

Puoi procedere direttamente con l'implementazione image upload. Se ci sono domande o decisioni architetturali da prendere, chiedi pure!
```

---

## 📝 Note Sessione Precedente

### Decisioni Architetturali

1. **React Query** scelto per data fetching:
   - Optimistic updates per delete
   - Cache invalidation automatica
   - Stale time: 5 minuti default

2. **Form Validation**:
   - Zod schema per type-safety
   - react-hook-form per gestione stato
   - Validazione lato client + database constraints

3. **Color Coding Scadenze**:
   - Verde: > 7 giorni
   - Giallo: 4-7 giorni
   - Arancione: 1-3 giorni
   - Rosso: scaduto o oggi

4. **Quantity Units**:
   - Enum stretto: pz, kg, g, l, ml, confezioni
   - Dropdown select invece di input libero
   - Match constraint database

### Bug Risolti

1. **quantity_unit constraint error**:
   - Problema: Input libero permetteva valori non validi
   - Soluzione: Select dropdown con enum

2. **Form value preservation in edit**:
   - Problema: Campo unità cambiava valore in edit
   - Soluzione: Gestione esplicita value/onChange

3. **Date validation**:
   - Problema: Nessuna validazione date passate
   - Soluzione: Zod refine + HTML min attribute

### File Structure Creati

```
src/
├── lib/
│   ├── foods.ts                    # Service layer Supabase CRUD
│   └── validations/
│       └── food.schemas.ts         # Zod schemas
├── hooks/
│   └── useFoods.ts                 # React Query hooks
├── components/
│   ├── foods/
│   │   ├── FoodCard.tsx           # Presentational card
│   │   └── FoodForm.tsx           # Create/Edit form
│   └── ui/
│       ├── dialog.tsx             # Modal wrapper
│       ├── alert-dialog.tsx       # Confirmation dialog
│       └── textarea.tsx           # Text area input
└── pages/
    └── DashboardPage.tsx          # Main dashboard
```

### Dependencies Aggiunte

```json
{
  "@radix-ui/react-dialog": "^2.1.16",
  "@radix-ui/react-alert-dialog": "^2.1.16"
}
```

---

## 🔍 Quick Reference

### Comandi Utili

```bash
# Start dev server
npm run dev

# Build
npm run build

# Lint
npm run lint

# Git status
git status

# View recent commits
git log --oneline -5
```

### Supabase Info

**Project URL**: Stored in `.env.local` as `VITE_SUPABASE_URL`
**Tables**: `categories`, `foods`
**RLS**: Enabled per user_id
**Storage**: Not yet configured (next task)

### Important Files to Review

1. `docs/ROADMAP.md` - Full development plan
2. `docs/FEATURES.md` - Feature specifications
3. `supabase_migration.sql` - Database schema
4. `src/lib/supabase.ts` - Database types
5. `src/lib/foods.ts` - Service layer API

---

## 🎨 Design Decisions

### UI/UX
- Responsive grid: 1 col mobile, 2 col tablet, 3 col desktop
- Toast position: bottom-right
- Modal max width: 2xl (672px)
- Empty state: centered con CTA button
- Color palette: slate + semantic colors (red/orange/yellow/green)

### Forms
- Required fields marcati con asterisco (*)
- Date picker: native HTML input type="date"
- Select dropdowns: native HTML select (no libreria)
- Validation: real-time con react-hook-form

### Data Flow
```
UI Component → React Query Hook → Service Layer → Supabase → Database
                     ↓
                 Cache + Optimistic Updates
```

---

## 🚀 Next Session Goals

**Primary**: Image upload funzionante end-to-end
**Secondary**: Start filtri e search
**Stretch**: Deploy MVP su Netlify

**Estimated Time**: 3-4 ore per image upload completo

---

**Per qualsiasi domanda sulla sessione precedente, consulta questo documento!**
