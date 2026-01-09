# 🔄 Resume Session - Setup Database Supabase

## 📍 Contesto Progetto

**Nome:** entro - Food Expiry Tracker
**Tipo:** Web app PWA React + TypeScript per tracciare scadenze alimenti
**Stack:** React 19, TypeScript, Vite, Tailwind CSS, Supabase, Zustand, TanStack Query

**Repository:** https://github.com/E-Lop/entro
**Branch:** main
**Ultimo Commit:** `fc868a8` - docs: update ROADMAP with Fase 0 completion

---

## ✅ Stato Attuale (Fase 0 Completata)

### Cosa è Già Configurato

#### 1. Progetto Base
- ✅ Vite + React 19 + TypeScript setup completo
- ✅ Tailwind CSS 3.4 configurato con variabili CSS
- ✅ shadcn/ui base configurato (components.json, src/lib/utils.ts)
- ✅ ESLint configurato
- ✅ Build verificato funzionante
- ✅ Dev server: `npm run dev` → http://localhost:5174

#### 2. Dipendenze Installate
```json
{
  "@supabase/supabase-js": "^2.90.1",
  "zustand": "^5.0.9",
  "@tanstack/react-query": "^5.90.16",
  "date-fns": "^4.1.0",
  "react-hook-form": "^7.70.0",
  "zod": "^4.3.5",
  "clsx": "^2.1.1",
  "tailwind-merge": "^3.4.0",
  "lucide-react": "^0.562.0",
  "sonner": "^2.0.7"
}
```

#### 3. Supabase Client Configurato
- **File:** `src/lib/supabase.ts` ✅ Già creato
- **URL:** `https://rmbmmwcxtnanacxbkihc.supabase.co`
- **Anon Key:** `sb_publishable_z3U1GiNSYhbi_9WccIzOjg_aD0mUyYY`
- **Environment:** `.env.local` già configurato (gitignored)

#### 4. Struttura Directory Completa
```
src/
├── components/
│   ├── ui/              # shadcn components
│   ├── foods/           # (vuoto, pronto)
│   ├── barcode/         # (vuoto, pronto)
│   ├── calendar/        # (vuoto, pronto)
│   ├── layout/          # (vuoto, pronto)
│   └── common/          # (vuoto, pronto)
├── hooks/               # (vuoto, pronto)
├── lib/
│   ├── supabase.ts      # ✅ Client configurato
│   └── utils.ts         # ✅ cn() utility
├── stores/              # (vuoto, pronto)
├── types/
│   ├── food.types.ts    # ✅ Types completi
│   └── auth.types.ts    # ✅ Types completi
├── pages/               # (vuoto, pronto)
├── App.tsx              # Placeholder base
├── main.tsx             # Entry point
└── index.css            # Tailwind + shadcn vars
```

#### 5. Types TypeScript Definiti
- `src/types/food.types.ts` - Food, Category, FoodFormData, FoodFilters
- `src/types/auth.types.ts` - User, AuthState, LoginCredentials
- `src/lib/supabase.ts` - Database types stub

---

## 🎯 PROSSIMO OBIETTIVO: Setup Database Supabase

### Fase 1 - Week 1: Database & Auth (Giorni 1-2)

**Obiettivo Sessione:** Creare database PostgreSQL su Supabase con tabelle e RLS

### Task da Completare

#### 1. **Accesso Supabase Dashboard**
   - URL: https://supabase.com/dashboard/project/rmbmmwcxtnanacxbkihc
   - Progetto: "entro"
   - Verificare che il progetto sia accessibile

#### 2. **Eseguire Migration SQL**
   - Usare SQL Editor nel dashboard Supabase
   - Copiare migration completa da: `docs/DATABASE_SCHEMA.md` (linee 480-575)
   - La migration include:
     - Tabella `categories` con 11 categorie predefinite italiane
     - Tabella `foods` con tutti i campi necessari
     - Indexes per performance
     - Row Level Security (RLS) policies
     - Trigger per updated_at automatico

#### 3. **Verificare Tabelle Create**
   - Verificare nel Table Editor che esistano:
     - `categories` (11 rows inserite automaticamente)
     - `foods` (vuota inizialmente)
   - Verificare RLS abilitato su entrambe le tabelle

#### 4. **Testare Connessione dal Frontend**
   - Creare pagina di test che:
     - Mostra connessione a Supabase
     - Fetcha e mostra le categorie
     - Verifica che il client funzioni

---

## 📚 Documentazione Rilevante

### File da Consultare (in ordine di importanza)

1. **`docs/DATABASE_SCHEMA.md`** ⭐ ESSENZIALE
   - Contiene la migration SQL completa (linee 480-575)
   - Schema completo tabelle
   - RLS policies dettagliate
   - Funzioni database

2. **`docs/ROADMAP.md`**
   - Task dettagliati per Fase 1
   - Checklist per completamento

3. **`docs/TECHNICAL_SPECS.md`**
   - Architettura generale
   - Specifiche implementazione

4. **`docs/FEATURES.md`**
   - Specifiche funzionalità CRUD
   - User stories

5. **`.env.local`** (gitignored)
   - Credenziali Supabase già configurate

---

## 🔑 Credenziali & Accesso

### Supabase Project
- **Project ID:** rmbmmwcxtnanacxbkihc
- **URL:** https://rmbmmwcxtnanacxbkihc.supabase.co
- **Anon Key:** sb_publishable_z3U1GiNSYhbi_9WccIzOjg_aD0mUyYY
- **Dashboard:** https://supabase.com/dashboard/project/rmbmmwcxtnanacxbkihc

### Git Repository
- **Remote:** https://github.com/E-Lop/entro.git
- **Branch:** main
- **Ultimo commit:** fc868a8

---

## 📋 Schema Database (Quick Reference)

### Tabella: categories
```sql
- id: UUID (PK)
- name: TEXT (english key)
- name_it: TEXT (nome italiano)
- icon: TEXT (lucide icon name)
- color: TEXT (hex color)
- default_storage: ENUM('fridge', 'freezer', 'pantry')
- average_shelf_life_days: INTEGER
- created_at: TIMESTAMP
```

**11 Categorie Predefinite:** dairy, meat, fish, fruits, vegetables, bakery, beverages, frozen, condiments, snacks, other

### Tabella: foods
```sql
- id: UUID (PK)
- user_id: UUID (FK → auth.users)
- name: TEXT (required)
- quantity: DECIMAL
- quantity_unit: ENUM('pz', 'kg', 'g', 'l', 'ml', 'confezioni')
- expiry_date: DATE (required)
- category_id: UUID (FK → categories)
- storage_location: ENUM('fridge', 'freezer', 'pantry')
- image_url: TEXT
- barcode: TEXT
- notes: TEXT
- status: ENUM('active', 'consumed', 'expired', 'wasted')
- consumed_at: TIMESTAMP
- created_at: TIMESTAMP
- updated_at: TIMESTAMP (auto-update trigger)
- deleted_at: TIMESTAMP (soft delete)
```

### RLS Policies
- Users can only see/modify their own foods
- Categories are public (read-only)

---

## 🚀 Come Procedere (Step-by-Step)

### Step 1: Verifica Ambiente
```bash
cd /Users/edmondo/Documents/entro
npm run dev  # Verifica che parta su localhost:5174
```

### Step 2: Accedi a Supabase Dashboard
- Aprire: https://supabase.com/dashboard/project/rmbmmwcxtnanacxbkihc
- Navigare a: SQL Editor (sidebar sinistra)

### Step 3: Esegui Migration
1. Leggere `docs/DATABASE_SCHEMA.md` linee 480-575
2. Copiare l'intero SQL block dalla migration
3. Incollare nel SQL Editor
4. Cliccare "Run" o CMD+Enter
5. Verificare che l'esecuzione completi senza errori

### Step 4: Verifica Tabelle Create
- Navigare a: Table Editor
- Verificare presenza di:
  - `categories` (11 rows)
  - `foods` (0 rows inizialmente)

### Step 5: Test Connessione
Creare `src/pages/TestConnection.tsx` per verificare:
- Client Supabase funzionante
- Query alle categorie
- Visualizzazione dati

---

## ⚠️ Note Importanti

### Prima Volta con Supabase
- **SQL Editor:** Sidebar → SQL Editor → New Query
- **Esecuzione Query:** CMD+Enter o bottone "Run"
- **Table Editor:** Visualizzazione dati come Excel
- **RLS:** Policies definiscono chi può vedere/modificare dati

### Zustand (Non Ancora Usato)
State management globale - verrà usato dopo per auth e UI state

### TanStack Query (Non Ancora Usato)
Data fetching/caching - verrà configurato dopo database setup

---

## 🎯 Obiettivo Fine Sessione

Al termine di questa sessione dovremmo avere:

✅ Database Supabase completo con:
  - Tabella `categories` popolata (11 categorie)
  - Tabella `foods` creata e pronta
  - RLS policies attive
  - Indexes configurati

✅ Connessione verificata:
  - Test query dal frontend funzionante
  - Categorie visualizzate nell'app
  - Nessun errore di connessione

✅ Pronto per:
  - Implementare autenticazione (Fase 1 - Giorni 3-4)
  - Creare CRUD alimenti (Fase 1 - Week 2)

---

## 📞 Domande Frequenti

**Q: Le credenziali in .env.local sono sicure?**
A: Sì, il file è in .gitignore. La anon key è pubblica per design di Supabase (protetta da RLS).

**Q: Posso modificare lo schema dopo?**
A: Sì, Supabase supporta migrations. Creare nuovi file SQL per modifiche future.

**Q: Come verifico che RLS funzioni?**
A: Le policies impediscono accesso non autorizzato automaticamente. Testeremo con l'auth.

---

## 🚀 Prompt per Prossima Sessione

**Incolla questo nel nuovo chat dopo /clear:**

```
Ciao! Sto continuando lo sviluppo del progetto "entro" (food expiry tracker).

Ho appena fatto /clear dopo aver completato la Fase 0 (setup iniziale).

STATO ATTUALE:
- Progetto React + TypeScript + Vite + Supabase configurato ✅
- Repository: /Users/edmondo/Documents/entro
- Ultimo commit: fc868a8
- Fase 0 completata al 100%

PROSSIMO OBIETTIVO:
Guidami passo-passo nel setup del database Supabase:
1. Accesso al dashboard Supabase
2. Esecuzione migration SQL da docs/DATABASE_SCHEMA.md
3. Verifica tabelle create (categories + foods)
4. Test connessione dal frontend

Ho letto il file RESUME_SESSION.md che contiene tutti i dettagli del progetto.

CREDENZIALI SUPABASE:
- URL: https://rmbmmwcxtnanacxbkihc.supabase.co
- Anon Key: sb_publishable_z3U1GiNSYhbi_9WccIzOjg_aD0mUyYY
- Dashboard: https://supabase.com/dashboard/project/rmbmmwcxtnanacxbkihc

Questa è la prima volta che uso Supabase, quindi guidami passo-passo.

Pronto per iniziare! 🚀
```

---

**File Creato:** `/Users/edmondo/Documents/entro/RESUME_SESSION.md`
**Ready for `/clear`** ✅
