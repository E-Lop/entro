# Resume Session - Food Expiry Tracker Development

**Data Sessione Precedente**: 10/01/2026
**Ultimo Commit**: `0d696c7` - feat: implement complete image upload system with upload-on-submit pattern
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
**Progress**: Fase 1 Week 2 - 65% completato

### ✅ COMPLETATO (Fase 1 Week 1 + Week 2 Day 1-3)

**Week 1 - Database, Auth & CRUD** (commit: `f6f2d91`)
- ✅ Supabase database con 11 categorie italiane
- ✅ RLS policies e trigger automatici
- ✅ Sistema auth completo (signup/login/logout)
- ✅ Protected routes e session persistence
- ✅ CRUD alimenti completo con React Query
- ✅ FoodCard con color coding scadenze (🟢 >7gg | 🟡 4-7gg | 🟠 1-3gg | 🔴 scaduto)
- ✅ FoodForm con validation (zod + react-hook-form)
- ✅ Dashboard con stats real-time e grid responsive

**Week 2 Day 1-3 - Image Upload System** (commit: `0d696c7`)
- ✅ Supabase Storage bucket privato con RLS policies
- ✅ Signed URLs per accesso sicuro (1 ora expiration)
- ✅ Upload on submit pattern (zero orphan files)
- ✅ Image compression (max 800px, ~1MB target)
- ✅ **HEIC/HEIF support con conversione automatica a JPEG (iPhone/Android compatible)**
- ✅ ImageUpload component riusabile con preview
- ✅ useSignedUrl hook per gestione signed URLs
- ✅ FoodCard con display immagini e loading states
- ✅ Delete cascade automatico da storage
- ✅ Error handling completo per upload/fetch failures

**Architettura Image Upload**:
- Storage path: `{user_id}/{timestamp}-{filename}`
- Private bucket con Row Level Security
- Accepted formats: JPEG, PNG, WebP, HEIC/HEIF (max 5MB)
- HEIC/HEIF (iPhone photos) automatically converted to JPEG using heic2any
- Client-side compression con browser-image-compression
- Upload differito: File object in form state, upload solo al submit
- Signed URLs cached per 1 ora tramite React Query

**File Chiave Implementati**:
```
src/
├── lib/
│   ├── storage.ts                  # Core storage service (upload, delete, signed URLs)
│   ├── foods.ts                    # CRUD + delete cascade per immagini
│   └── validations/
│       └── food.schemas.ts         # Zod schema con File | string support
├── hooks/
│   ├── useFoods.ts                 # React Query hooks
│   └── useSignedUrl.ts             # Signed URL generation hook
├── components/
│   └── foods/
│       ├── ImageUpload.tsx         # Upload component con local preview
│       ├── FoodCard.tsx            # Display con signed URLs
│       └── FoodForm.tsx            # Form con ImageUpload integration
└── pages/
    └── DashboardPage.tsx           # Upload on submit handlers
```

### 🎯 PROSSIMO OBIETTIVO: Fase 1 Week 2 - Filters & Search (Day 4-5)

**Tasks da completare**:

#### 1. Sistema di Filtri (Day 4)
1. Creare `src/components/foods/FoodFilters.tsx` component
2. Implementare filtri dropdown/checkbox:
   - Categoria (select con tutte le 11 categorie)
   - Storage location (fridge, freezer, pantry)
   - Status (active, expired, expiring soon)
3. Mostrare counter badge su filtri attivi
4. Clear all filters button
5. Integrazione con useFoods hook per filtering lato server
6. Loading states durante cambio filtri
7. Persistenza filtri in URL query params (react-router useSearchParams)

#### 2. Ricerca e Ordinamento (Day 5)
1. Search bar con debounce (300ms)
2. Ricerca per nome alimento (case-insensitive)
3. Ordinamenti disponibili:
   - Data scadenza (asc/desc) - default
   - Nome alfabetico (A-Z, Z-A)
   - Data creazione (più recente/più vecchio)
   - Categoria
4. Sort selector dropdown in header
5. Empty state quando nessun risultato da filtri/search
6. Combine filters + search + sort in query Supabase

**Approccio Consigliato**:

1. **Filtri Component Structure**:
```tsx
// FoodFilters.tsx
interface FilterState {
  category_id: string | null
  storage_location: 'fridge' | 'freezer' | 'pantry' | null
  status: 'all' | 'active' | 'expired' | 'expiring_soon'
  search: string
  sortBy: 'expiry_date' | 'name' | 'created_at' | 'category'
  sortOrder: 'asc' | 'desc'
}
```

2. **URL Query Params**:
   - Use `useSearchParams` from react-router
   - Sync filter state to URL: `?category=123&storage=fridge&sort=expiry_date&order=asc`
   - Restore filters on page load from URL

3. **Server-Side Filtering**:
   - Modify `getFoods()` in `src/lib/foods.ts` to accept filter params
   - Use Supabase query builder filters
   - Example:
   ```typescript
   export async function getFoods(filters?: FilterParams) {
     let query = supabase
       .from('foods')
       .select('*')
       .is('deleted_at', null)

     if (filters?.category_id) query = query.eq('category_id', filters.category_id)
     if (filters?.storage_location) query = query.eq('storage_location', filters.storage_location)
     if (filters?.search) query = query.ilike('name', `%${filters.search}%`)

     query = query.order(filters?.sortBy || 'expiry_date', {
       ascending: filters?.sortOrder === 'asc'
     })

     return query
   }
   ```

4. **Debounced Search**:
   - Use `useDebouncedValue` hook (create custom or use `@uidotdev/usehooks`)
   - Debounce search input by 300ms before triggering query

5. **UI/UX Considerations**:
   - Filtri in sidebar (desktop) o collapsible panel (mobile)
   - Mostrare "X filtri attivi" badge
   - Empty state: "Nessun alimento trovato con i filtri selezionati"
   - Loading skeleton durante filter changes
   - Smooth transitions

**Note Importanti**:
- Dev server già running su http://localhost:5177/
- Tutte le immagini funzionanti con signed URLs
- Dashboard responsive già ottimizzato
- Non implementare ancora barcode scanner (Fase 2)
- Focus su performance: debounce, server-side filtering, loading states

**Estimated Time**: 3-4 ore per filtri e ricerca completi

Dopo filtri e search, i prossimi step saranno:
1. Test completo su device reali
2. Bug fixes da testing
3. Performance optimization
4. Deploy MVP su Netlify

Puoi procedere direttamente con l'implementazione dei filtri. Se ci sono domande o decisioni architetturali da prendere, chiedi pure!
```

---

## 📝 Note Sessione Precedente

### Decisioni Architetturali

1. **Image Upload Pattern**:
   - Upload on submit (non immediate) per evitare orphan files
   - File object in form state fino al submit
   - Validazione File | string per supportare edit mode

2. **Security First**:
   - Private bucket con RLS policies
   - Signed URLs con expiration (1 ora)
   - User può accedere solo alle proprie immagini (`{user_id}` prefix)

3. **Image Optimization**:
   - Compression client-side con browser-image-compression
   - Max dimensions: 800x800px
   - Target size: ~1MB (da max 5MB originale)
   - Accepted formats: JPEG, PNG, WebP, HEIC/HEIF

4. **HEIC/HEIF Support (iPhone Compatibility)**:
   - Automatic detection of HEIC/HEIF files
   - Client-side conversion to JPEG using heic2any
   - Loading state during conversion (1-2 seconds)
   - Seamless UX - user doesn't need to do anything special

5. **Caching Strategy**:
   - Signed URLs cached in React Query per 1 ora
   - useSignedUrl hook gestisce caching e error handling
   - Local preview per File object (FileReader)

### Problemi Risolti

1. **Orphan Images Issue**:
   - Problema: Upload immediato creava file orfani quando user chiudeva dialog senza salvare
   - Soluzione: Upload on submit pattern, File object passa attraverso form state

2. **Private Bucket Access**:
   - Problema: getPublicUrl() non funzionava con private bucket
   - Soluzione: Signed URLs con expiration temporale

3. **Image Not Showing in Edit Mode**:
   - Problema: Preview non mostrava immagine esistente in edit
   - Soluzione: useSignedUrl hook genera signed URL da storage path

4. **Delete Cascade**:
   - Problema: Eliminazione food non rimuoveva immagine da storage
   - Soluzione: deleteFoodImage() chiamata in updateFood() e deleteFood()

5. **HEIC/HEIF iPhone Compatibility**:
   - Problema: iPhone scatta foto in formato HEIC, non supportato nativamente nei browser
   - Soluzione: Conversione automatica HEIC → JPEG con heic2any
   - UX: Loading state durante conversione, messaggio chiaro all'utente

### File Structure Creati

```
src/
├── lib/
│   ├── storage.ts                   # NEW: Storage service layer
│   ├── foods.ts                     # MODIFIED: Delete cascade
│   └── validations/
│       └── food.schemas.ts          # MODIFIED: File | string union
├── hooks/
│   ├── useFoods.ts                  # Existing
│   └── useSignedUrl.ts              # NEW: Signed URL hook
├── components/
│   ├── foods/
│   │   ├── ImageUpload.tsx         # NEW: Upload component
│   │   ├── FoodCard.tsx            # MODIFIED: Image display
│   │   └── FoodForm.tsx            # MODIFIED: ImageUpload integration
│   └── ui/
│       └── ...                     # shadcn/ui components
└── pages/
    └── DashboardPage.tsx           # MODIFIED: Upload on submit
```

### Dependencies Aggiunte

```json
{
  "browser-image-compression": "^2.0.2",
  "heic2any": "^0.0.4"
}
```

---

## 🔍 Quick Reference

### Comandi Utili

```bash
# Start dev server (già running)
npm run dev

# Build
npm run build

# Lint
npm run lint

# Git status
git status

# View recent commits
git log --oneline -5

# Push to remote
git push
```

### Supabase Info

**Storage Bucket**: `food-images` (private)
**Path Structure**: `{user_id}/{timestamp}-{filename}`
**RLS Policies**: Users can only access their own images
**Max Upload Size**: 5MB (compressed to ~1MB)
**Accepted Formats**: JPEG, PNG, WebP, HEIC/HEIF (auto-converted to JPEG)

### Important Files to Review

1. `docs/ROADMAP.md` - Development roadmap (updated)
2. `docs/FEATURES.md` - Feature specifications
3. `supabase_storage_setup.sql` - Storage bucket setup
4. `src/lib/storage.ts` - Storage service layer
5. `src/hooks/useSignedUrl.ts` - Signed URL hook
6. `src/components/foods/ImageUpload.tsx` - Upload component

---

## 🎨 Image Upload Implementation Details

### Upload Flow

```
User selects image
    ↓
ImageUpload: Validate file (type, size)
    ↓
ImageUpload: Create local preview (FileReader)
    ↓
ImageUpload: Pass File object to parent via onChange
    ↓
FoodForm: Store File in form state
    ↓
User clicks "Salva"
    ↓
DashboardPage: Check if image_url is File
    ↓
DashboardPage: Upload to Supabase Storage
    ↓
DashboardPage: Get storage path
    ↓
DashboardPage: Create/Update food with path
```

### Display Flow

```
FoodCard renders
    ↓
Check if food.image_url exists
    ↓
useSignedUrl(food.image_url)
    ↓
Generate signed URL from storage path
    ↓
Display image with signed URL
    ↓
Show loading spinner while generating
    ↓
Show fallback icon on error
```

### Delete Flow

```
User deletes food
    ↓
DashboardPage: deleteMutation triggered
    ↓
deleteFood(id) in foods.ts
    ↓
Fetch food to get image_url
    ↓
If image_url exists, deleteFoodImage()
    ↓
Delete food from database
    ↓
React Query invalidates cache
```

---

## 🚀 Next Session Goals

**Primary Goal**: Implementare filtri e ricerca completi
**Secondary Goal**: Persistenza filtri in URL
**Stretch Goal**: Test completo e preparazione per deploy

**Estimated Time**: 3-4 ore per completare filtri e search

**After This**:
- Test su device reali
- Performance optimization
- Deploy MVP su Netlify
- Fase 2: Barcode Scanner

---

**Per qualsiasi domanda sulla sessione precedente, consulta questo documento!**
