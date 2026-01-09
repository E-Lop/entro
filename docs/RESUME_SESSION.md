# Resume Session Guide

**Last Updated**: 09/01/2026
**Last Completed**: Fase 1 Week 1 Day 3-4 - Authentication System
**Commit**: `b3dbaf5` (ROADMAP update), `de0f9fb` (auth implementation)

---

## Quick Status

### ✅ What's Done
- **Database Setup**: Supabase connected, RLS policies configured, foods table with all columns
- **Authentication System**: Complete signup/login/logout flow with session persistence
- **UI Foundation**: shadcn/ui installed, AppLayout with header and user menu
- **Routing**: React Router configured with public and protected routes
- **State Management**: Zustand store for auth state with Supabase listener
- **Form Validation**: react-hook-form + zod schemas for auth forms

### 🔄 Next Up
**Fase 1 Week 1 Day 5-7**: Food Management Components & API Layer
- FoodCard component (presentational)
- FoodForm component (create/edit with validation)
- React Query setup for foods CRUD
- API service layer for foods operations

---

## Prompt for Next Claude Code Session

```
Ciao! Sto continuando lo sviluppo del progetto 'entro' (food expiry tracker).

## 📊 STATO ATTUALE

**Progetto**: Food expiry tracker con React + TypeScript + Vite + Supabase
**Branch**: main
**Working Directory**: /Users/edmondo/Documents/entro

### ✅ COMPLETATO (Fase 1 Week 1 Day 1-4)

**Day 1-2: Database Setup** (commit: `9bfc037`)
- Supabase progetto configurato e connesso
- Database schema implementato:
  - Tabella `foods` con colonne: id, user_id, name, category, storage_location, purchase_date, expiry_date, quantity, notes, image_url, barcode, created_at, updated_at
  - Trigger `update_updated_at_column()` per timestamp automatico
- RLS policies configurate per user_id
- Migration file: `supabase/migrations/20260109_create_foods_table.sql`
- Frontend test connection page funzionante

**Day 3-4: Authentication System** (commit: `de0f9fb`)
- ✅ Autenticazione Supabase completa (signup/login/logout)
- ✅ React Router con routes pubbliche (/login, /signup) e protette (/)
- ✅ Zustand auth store con listener Supabase onAuthStateChange
- ✅ Custom hook useAuth per componenti
- ✅ Protected routes con loading states
- ✅ AppLayout con header, logo, user menu dropdown
- ✅ Form validation con react-hook-form + zod (min 6 chars password)
- ✅ shadcn/ui components installati: Button, Input, Form, Card, Label, Dropdown Menu
- ✅ Toast notifications con Sonner
- ✅ Session persistence verificata con test completo

**Architettura Auth**:
```
Service Layer (src/lib/auth.ts)
  ↓
Zustand Store (src/stores/authStore.ts)
  ↓
Custom Hook (src/hooks/useAuth.ts)
  ↓
UI Components
```

**File Chiave Creati**:
- `src/lib/auth.ts` - Auth service wrapper
- `src/stores/authStore.ts` - Zustand auth store
- `src/hooks/useAuth.ts` - Auth hook
- `src/lib/validations/auth.schemas.ts` - Zod schemas
- `src/components/auth/AuthForm.tsx` - Reusable form
- `src/components/auth/ProtectedRoute.tsx` - Route guard
- `src/components/layout/AppLayout.tsx` - App layout
- `src/pages/LoginPage.tsx`, `src/pages/SignUpPage.tsx`, `src/pages/DashboardPage.tsx`

### 🎯 PROSSIMO OBIETTIVO: Implementare Food Management (Day 5-7)

**Tasks da completare**:
1. ✅ Installare dipendenze: `@tanstack/react-query`
2. ✅ Creare `src/lib/validations/food.schemas.ts` con zod schema per food form
3. ✅ Creare `src/lib/foods.ts` - Service layer per CRUD operations su Supabase
4. ✅ Creare `src/hooks/useFoods.ts` - React Query hooks (useQuery, useMutation)
5. ✅ Setup QueryClientProvider in `src/main.tsx`
6. ✅ Creare `src/components/foods/FoodCard.tsx` - Presentational component
7. ✅ Creare `src/components/foods/FoodForm.tsx` - Form con react-hook-form + zod
8. ✅ Aggiornare `src/pages/DashboardPage.tsx` - Lista foods con grid layout
9. ✅ Testare CRUD completo (create, read, update, delete)

**Requisiti Tecnici**:
- React Query per data fetching con optimistic updates
- Zod validation per food form (campi obbligatori: name, category, expiry_date)
- Date picker per purchase_date e expiry_date (shadcn/ui calendar + popover + date-fns)
- Select dropdown per category e storage_location
- Form mode: 'create' | 'edit' con stesso component
- FoodCard mostra: nome, categoria, giorni alla scadenza (con color coding)
- Delete con conferma dialog
- Empty state per dashboard senza foods
- Loading states con skeleton loaders

**Categorie predefinite** (da FEATURES.md):
Frutta, Verdura, Latticini, Carne, Pesce, Pane e Prodotti da Forno, Conserve, Surgelati, Bevande, Condimenti, Altro

**Storage Locations predefinite**:
Frigo, Freezer, Dispensa, Cantina, Altro

**Color Coding Scadenza**:
- Verde: > 7 giorni
- Giallo: 4-7 giorni
- Arancione: 1-3 giorni
- Rosso: scaduto o oggi

**Note Importanti**:
- L'utente è già autenticato nel flow, quindi i foods saranno filtrati per `user_id` automaticamente dalle RLS policies
- La dashboard è già dentro AppLayout, quindi ha header e navigation
- Usare toast per feedback operazioni CRUD
- Non implementare ancora upload immagini (Day 1-3 Week 2)
- Non implementare ancora filtri/search (Day 4-5 Week 2)

**Approccio Consigliato**:
1. Inizia creando il service layer (`src/lib/foods.ts`) con funzioni async per Supabase
2. Setup React Query hooks con useFoods
3. Crea FoodCard (solo presentazionale, riceve props)
4. Crea FoodForm con react-hook-form + zod
5. Aggiorna DashboardPage per usare useFoods e renderizzare grid di cards
6. Aggiungi dialog per create/edit (shadcn/ui dialog component)
7. Testa CRUD completo

Puoi procedere direttamente con l'implementazione. Se ci sono domande o decisioni architetturali da prendere, chiedi pure!
```

---

## Environment Info

**Working Directory**: `/Users/edmondo/Documents/entro`
**Git Repo**: Yes
**Main Branch**: `main`
**Platform**: macOS (Darwin 25.1.0)

**Supabase Config**:
- Project URL: In `.env` file
- Anon Key: In `.env` file
- Database: PostgreSQL with RLS enabled

**Dev Server**:
```bash
npm run dev  # Vite on http://localhost:5173 (or 5174/5175 if port busy)
```

---

## Key Files Reference

### Configuration
- `vite.config.ts` - Vite configuration with path aliases
- `tsconfig.json` - TypeScript config
- `.env` - Supabase credentials (not in git)
- `supabase/config.toml` - Supabase project config

### Database
- `supabase/migrations/20260109_create_foods_table.sql` - Foods table migration
- `src/lib/supabaseClient.ts` - Supabase client initialization

### Authentication
- `src/lib/auth.ts` - Auth service layer
- `src/stores/authStore.ts` - Zustand auth store
- `src/hooks/useAuth.ts` - Custom auth hook
- `src/lib/validations/auth.schemas.ts` - Auth form validation

### Routing & Layout
- `src/App.tsx` - React Router configuration
- `src/components/auth/ProtectedRoute.tsx` - Route guard
- `src/components/layout/AppLayout.tsx` - App layout with header

### Pages
- `src/pages/LoginPage.tsx` - Login page
- `src/pages/SignUpPage.tsx` - Signup page
- `src/pages/DashboardPage.tsx` - Main dashboard (currently placeholder)
- `src/pages/TestConnection.tsx` - Database connection test page

### Documentation
- `docs/ROADMAP.md` - Project roadmap with tasks
- `docs/PROJECT_OVERVIEW.md` - Project overview
- `docs/TECHNICAL_SPECS.md` - Technical specifications
- `docs/DATABASE_SCHEMA.md` - Database schema details
- `docs/FEATURES.md` - Feature requirements

---

## Common Commands

```bash
# Development
npm run dev                    # Start dev server
npm run build                  # Build for production
npm run preview                # Preview production build
npm run lint                   # Run ESLint

# Git
git status                     # Check status
git log --oneline -5          # Recent commits
git diff                      # See changes

# Supabase
npx supabase status           # Check Supabase connection
npx supabase db reset         # Reset local DB (if needed)
```

---

## Tips for Claude Code

1. **Always read ROADMAP.md first** to understand current status
2. **Check git status** before starting work
3. **Use TodoWrite tool** for multi-step tasks to track progress
4. **Test incrementally** - don't implement everything before testing
5. **Follow existing patterns**:
   - Service layer → Hook → Component (like auth)
   - Zod validation for all forms
   - shadcn/ui for UI components
   - Toast notifications for user feedback
6. **Update ROADMAP.md** when completing tasks
7. **Create meaningful commits** with Co-Authored-By: Claude Sonnet 4.5
8. **Update this file (RESUME_SESSION.md)** when finishing a session

---

## Known Issues & Notes

### Email Confirmation
- Supabase requires email confirmation by default
- For development, manually confirm users via SQL:
  ```sql
  UPDATE auth.users SET email_confirmed_at = NOW() WHERE email = 'user@example.com';
  ```
- Or disable in Supabase Dashboard → Authentication → Settings

### Port Conflicts
- Vite tries 5173, then 5174, then 5175 if ports are busy
- Check dev server output for actual port

### Missing Dependencies
- If seeing "Failed to resolve import" errors, run `npm install`
- Common missing deps: class-variance-authority, @radix-ui packages

---

## Next Session Goals

**Immediate Next Steps** (Day 5-7):
1. Install @tanstack/react-query
2. Create food validation schemas
3. Create foods service layer
4. Setup React Query hooks
5. Create FoodCard component
6. Create FoodForm component
7. Update DashboardPage with food grid
8. Test full CRUD flow

**Success Criteria**:
- ✅ Posso creare un nuovo alimento dal dashboard
- ✅ Posso vedere lista alimenti in grid layout
- ✅ Posso modificare un alimento esistente
- ✅ Posso eliminare un alimento (con conferma)
- ✅ Vedo giorni alla scadenza con color coding
- ✅ Form validation funziona correttamente
- ✅ Toast notifications per tutte le operazioni
- ✅ Loading states durante fetch/mutations

**After Day 5-7 Completion**:
- Move to Week 2 Day 1-3: Image upload to Supabase Storage
- Then Day 4-5: Filters and search
- Then Day 6-7: Responsive design and error handling

---

## Architecture Decisions Log

### Authentication Pattern (Day 3-4)
**Decision**: Service Layer → Zustand Store → Custom Hook → Components
**Rationale**:
- Service layer keeps Supabase calls isolated (easier to test/mock)
- Zustand for global state (no provider needed, simpler than Context)
- Custom hook provides clean API for components (abstracts store access)
- Supabase onAuthStateChange listener in store keeps state synced

### Form Validation Pattern
**Decision**: react-hook-form + zod schemas in separate files
**Rationale**:
- Zod provides type-safe validation and TypeScript inference
- react-hook-form handles form state efficiently
- Separate schema files allow reuse (e.g., same schema for create/edit)
- zodResolver connects both libraries seamlessly

### UI Component Library
**Decision**: shadcn/ui (not a library, copy-paste components)
**Rationale**:
- Full control over component code (can customize freely)
- Built on Radix UI primitives (accessible, unstyled)
- Tailwind CSS for styling (consistent with project)
- No bundle size overhead (only includes used components)

### Routing Strategy
**Decision**: React Router v6 with nested routes + Outlet
**Rationale**:
- Protected routes wrap authenticated pages with layout
- Public routes (login/signup) have separate layout
- Nested routes allow shared AppLayout for all protected pages
- useNavigate hook for programmatic navigation after auth

---

**Ready to continue! 🚀**
