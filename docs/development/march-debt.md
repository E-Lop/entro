# Piano: Riduzione Debito Cognitivo — Marzo 2026

> **Istruzioni per Claude Code**: Questo documento contiene tutto il necessario per ridurre il debito cognitivo identificato nel project recap. Segui i 4 task nell'ordine indicato. Ogni task è indipendente e committabile separatamente. Dopo ogni task, fai un commit dedicato. Dopo il Task 3, esegui `npm run build` per verificare che non ci siano regressioni. Dopo il Task 4, esegui `npm run test`.

## Contesto

Il project recap ha identificato 4 aree di debito cognitivo nel codebase Entro:

1. `pushNotifications.ts` — file volatile (7 modifiche in 2 settimane), logica stabilizzata ma senza documentazione JSDoc sui guard
2. `DashboardPage.tsx` — god component da 656 righe, punto di accoppiamento per quasi tutti gli hook
3. `invites.ts` — 770 righe di logica business complessa senza alcun test
4. `send-expiry-notifications/index.ts` — pattern auth non ovvio documentato solo in MEMORY.md

**Tech stack**: React 19, TypeScript, Vite 6, Supabase, React Query 5, Tailwind CSS 3, Radix UI.

---

## Task 1: Commento auth flow in send-expiry-notifications (BASSO)

**File**: `supabase/functions/send-expiry-notifications/index.ts`

**Cosa fare**: Sostituire il commento singolo alla riga 16 (`// Auth: verifica shared secret...`) con un blocco JSDoc che documenta il flusso di autenticazione completo. Le righe 17-24 (il codice di verifica Bearer) restano invariate.

**Commento da inserire** (in italiano, coerente con il resto del file):

```typescript
/**
 * Autenticazione cron job: pg_cron → Vault → Edge Function
 *
 * Flusso completo:
 * 1. pg_cron esegue il job schedulato ogni giorno alle 9:00 UTC
 * 2. Il job legge il shared secret da Vault:
 *      SELECT decrypted_secret FROM vault.decrypted_secrets
 *      WHERE name = 'cron_secret' LIMIT 1
 * 3. pg_net invia HTTP POST con header:
 *      Authorization: Bearer {cron_secret}
 * 4. Questa Edge Function confronta il token con la env var CRON_SECRET
 *
 * Perché questo pattern: il nuovo formato API key di Supabase (sb_secret_...)
 * non è un JWT decodificabile, quindi non si può usare come Bearer token
 * standard. Si usa invece un shared secret salvato sia in Vault (letto da
 * pg_cron) che come Edge Function secret (letto qui con Deno.env).
 *
 * Riferimenti:
 * - Migration: supabase/migrations/20260228_push_notifications.sql (sezione 4)
 * - Vault setup: SELECT vault.create_secret('<secret>', 'cron_secret', '...')
 */
```

**Commit**: `docs: add auth flow diagram comment to send-expiry-notifications`

---

## Task 2: JSDoc a pushNotifications.ts (MEDIO)

**File**: `src/lib/pushNotifications.ts` (144 righe)

**Cosa fare**: Aggiungere JSDoc block a 5 funzioni. Nessuna modifica al codice funzionale.

### Funzione `waitForServiceWorker()` (riga 54, interna)
```typescript
/**
 * Attende che il service worker sia pronto, con timeout.
 * Ritorna la ServiceWorkerRegistration attiva o lancia errore
 * se il SW non si attiva entro il timeout specificato.
 *
 * @param timeoutMs - Tempo massimo di attesa in ms (default: 10000)
 * @throws Error se il service worker non è pronto entro il timeout
 */
```

### Funzione `getCurrentSubscription()` (riga 65)
```typescript
/**
 * Ottiene la push subscription corrente dal browser, se esiste.
 * Usa un timeout ridotto (3s) perché il SW dovrebbe già essere attivo.
 * Ritorna null in caso di qualsiasi errore (non supportato, SW non pronto,
 * nessuna subscription esistente).
 */
```

### Funzione `subscribeToPush()` (riga 75) — la più importante
```typescript
/**
 * Sottoscrive l'utente alle push notifications.
 *
 * Guard (ritorna errore senza procedere):
 * 1. Push API non supportata dal browser
 * 2. iOS senza installazione PWA (Push richiede Home Screen)
 * 3. Dispositivo offline (registrazione server fallirebbe)
 * 4. Utente nega il permesso di notifica
 * 5. Service worker non pronto entro 10s di timeout
 *
 * In caso di successo, registra la subscription sul server via Edge Function.
 * Se la registrazione server fallisce, esegue ROLLBACK: rimuove la
 * PushSubscription locale per evitare stato inconsistente (browser pensa
 * di essere iscritto, ma il server non ha record).
 *
 * @returns Oggetto con success, subscription (se ok), o messaggio errore
 */
```

### Funzione `syncSubscription()` (riga 116)
```typescript
/**
 * Sincronizza la push subscription locale con il server.
 * Chiamata al caricamento dell'app per assicurare che il server abbia
 * i dati di subscription aggiornati (es. dopo rigenerazione chiavi VAPID
 * o cambio endpoint da pushsubscriptionchange nel SW).
 *
 * Scenari:
 * 1. Nessuna subscription locale → ritorna subito (niente da sincronizzare)
 * 2. Chiamata server ok → subscription sincronizzata
 * 3. Chiamata server fallisce → fallimento silenzioso, riprova al prossimo load
 *
 * Non lancia mai errori e non mostra messaggi all'utente.
 */
```

### Funzione `unsubscribeFromPush()` (riga 131)
```typescript
/**
 * Rimuove la sottoscrizione alle push notifications.
 * Rimuove la subscription dal server (best-effort, ignora errori server)
 * poi rimuove localmente via Push API.
 * Ritorna success anche se non esiste subscription (idempotente).
 */
```

**Commit**: `docs: add JSDoc to pushNotifications.ts explaining guards and scenarios`

---

## Task 3: Decomposizione DashboardPage.tsx (MEDIO)

**File**: `src/pages/DashboardPage.tsx` (656 righe)

Eseguire 3 estrazioni sequenziali. Dopo ciascuna, verificare che `npm run build` passi.

### 3a: Estrarre `DashboardStats` component

**Nuovo file**: `src/components/foods/DashboardStats.tsx`

**Cosa estrarre**: Il JSX dei 3 stat card button (righe ~369-417 del file attuale). Il `useMemo` che calcola `stats` resta in DashboardPage perché `stats.total` è usato anche da `<NotificationPrompt foodCount={stats.total} />`.

**Props interface**:
```typescript
interface DashboardStatsProps {
  stats: { total: number; expiringSoon: number; expired: number }
  currentStatus: FilterParams['status']
  onQuickFilter: (status: 'all' | 'expiring_soon' | 'expired') => void
}
```

**In DashboardPage**: Sostituire il blocco JSX dei 3 card con `<DashboardStats stats={stats} currentStatus={filters.status} onQuickFilter={handleQuickFilter} />`.

**Nota**: Importare le icone Lucide necessarie (Package, AlertTriangle, XCircle) nel nuovo componente. Importare anche i tipi `FilterParams` da dove sono definiti.

### 3b: Estrarre `FoodModals` component

**Nuovo file**: `src/components/foods/FoodModals.tsx`

**Cosa estrarre**: I 3 Dialog wrapper (righe ~577-639):
- Dialog per aggiunta (usa `Dialog` + lazy `FoodForm`)
- Dialog per modifica (usa `Dialog` + lazy `FoodForm` con `initialData`)
- AlertDialog per eliminazione (usa `AlertDialog`)

**Props interface**:
```typescript
interface FoodModalsProps {
  // Add dialog
  isAddDialogOpen: boolean
  onAddDialogChange: (open: boolean) => void
  onCreateFood: (data: FoodFormData) => void
  isCreating: boolean
  // Edit dialog
  editingFood: Food | null
  onEditDialogChange: (open: boolean) => void
  onUpdateFood: (data: FoodFormData) => void
  isUpdating: boolean
  // Delete dialog
  deletingFood: Food | null
  onDeleteDialogChange: (open: boolean) => void
  onDeleteFood: () => void
  isDeleting: boolean
}
```

**In DashboardPage**: Sostituire i 3 blocchi Dialog con `<FoodModals ... />`. Il `Suspense` wrapper per il lazy-loaded `FoodForm` va nel nuovo componente.

### 3c: Estrarre `useFoodFormDialog` hook

**Nuovo file**: `src/hooks/useFoodFormDialog.ts`

**Cosa estrarre**:
- State: `isAddDialogOpen` (useState), `editingFood` (useState<Food | null>), `deletingFood` (useState<Food | null>)
- Handler: `handleEditClick`, `handleDeleteClick`
- Handler CRUD: `handleCreateFood`, `handleUpdateFood`, `handleDeleteFood`
- Funzione helper `resolveImageFile` (attualmente righe ~49-73 di DashboardPage)
- Il hook chiama internamente `useAuth()`, `useCreateFood()`, `useUpdateFood()`, `useDeleteFood()`

**Return type del hook**:
```typescript
{
  // State
  isAddDialogOpen: boolean
  setIsAddDialogOpen: (open: boolean) => void
  editingFood: Food | null
  setEditingFood: (food: Food | null) => void
  deletingFood: Food | null
  setDeletingFood: (food: Food | null) => void
  // Handlers
  handleCreateFood: (data: FoodFormData) => void
  handleUpdateFood: (data: FoodFormData) => void
  handleDeleteFood: () => void
  handleEditClick: (food: Food) => void
  handleDeleteClick: (food: Food) => void
  // Mutation state (per UI loading)
  isCreating: boolean
  isUpdating: boolean
  isDeleting: boolean
}
```

**In DashboardPage**: Sostituire i 3 useState + 5 handler + resolveImageFile con una singola chiamata `const { ... } = useFoodFormDialog()`.

**Attenzione**: `handleCreateFood` e `handleUpdateFood` usano `onlineManager.isOnline()` da React Query e `user!.id` da useAuth. Verificare che questi siano accessibili dentro il hook (lo sono, perché il hook chiama useAuth internamente).

**Risultato**: DashboardPage scende da 656 a ~400 righe.

**Commit**: `refactor: extract DashboardStats, FoodModals, and useFoodFormDialog from DashboardPage`

---

## Task 4: Unit test per invites.ts (MEDIO)

**File target**: `src/lib/invites.ts` (770 righe, 11 funzioni esportate, 0 test)

### 4a: Setup Vitest

**Installazione**:
```bash
npm install -D vitest
```

**Nuovo file**: `vitest.config.ts` (separato da vite.config.ts per non caricare plugin PWA nei test)
```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
  },
})
```

**Modifica `package.json`** — aggiungere agli scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

### 4b: Mock helper Supabase

**Nuovo file**: `src/lib/__tests__/helpers/mockSupabase.ts`

Serve un helper per mockare il pattern chained builder usato in invites.ts:
```typescript
supabase.from('invites').select('*').eq('short_code', code).eq('status', 'pending').maybeSingle()
```

**Approccio**: Creare un mock builder dove ogni metodo ritorna `this` per il chaining, e i metodi terminali (`maybeSingle()`, `single()`) ritornano `{ data, error }` configurabile.

```typescript
import { vi } from 'vitest'

export function createMockSupabase() {
  const terminalResult = { data: null, error: null }

  const builder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(() => Promise.resolve(terminalResult)),
    single: vi.fn(() => Promise.resolve(terminalResult)),
  }

  const mockSupabase = {
    auth: {
      getUser: vi.fn(),
      getSession: vi.fn(),
    },
    from: vi.fn(() => builder),
    rpc: vi.fn(),
  }

  return { mockSupabase, builder, terminalResult }
}
```

**Nota**: Per test con multiple chiamate `from()` a tabelle diverse, usare `vi.fn().mockReturnValueOnce()` in sequenza. Il mock va iniettato con `vi.mock('@/lib/supabase', ...)`.

### 4c: Test file

**Nuovo file**: `src/lib/__tests__/invites.test.ts`

**Test case per funzione (19 test totali)**:

#### `acceptInviteByEmail()` — 7 test
| # | Scenario | Setup | Assert |
|---|----------|-------|--------|
| 1 | User non autenticato | `getUser` → null | `{ success: false }` |
| 2 | User senza email | `getUser` → user senza email | `{ success: false }` |
| 3 | Nessun invito pendente | `maybeSingle` → null | `{ success: false, error: null }` |
| 4 | Invito scaduto | invite con `expires_at` nel passato | update status → 'expired', ritorna errore |
| 5 | Utente già membro | `list_members` query trova il record | update invite → 'accepted', success |
| 6 | Happy path | invite valido, user non membro | insert member + update invite + success |
| 7 | Email case-insensitive | email "User@Test.COM" | `.ilike()` chiamato con email lowercase |

#### `acceptInviteWithConfirmation()` — 5 test
| # | Scenario | Setup | Assert |
|---|----------|-------|--------|
| 1 | Invito non trovato | validate → errore | throw |
| 2 | Invito scaduto | invite expired | throw + update status |
| 3 | User senza lista | `getUserList` → null | aggiunge direttamente |
| 4 | User già nella stessa lista | lista user = lista invite | idempotente, success |
| 5 | `forceAccept: true` | user ha altra lista | rimuove da vecchia lista, aggiunge a nuova |

#### `registerPendingInvite()` — 3 test
| # | Scenario | Assert |
|---|----------|--------|
| 1 | Email normalizzata | " User@TEST.com " → "user@test.com" |
| 2 | Update riuscito | success |
| 3 | Errore Supabase | ritorna errore |

#### `leaveSharedList()` — 3 test
| # | Scenario | Assert |
|---|----------|--------|
| 1 | User non in nessuna lista | throw |
| 2 | Lista con 1 solo membro | throw (non può lasciare lista personale) |
| 3 | Happy path | rimuove membro + crea lista personale via RPC |

**Strategy mock per fetch**: Le funzioni che chiamano Edge Function (`createInvite`, `validateInvite`, `acceptInvite`) usano `fetch`. Mockare con `vi.stubGlobal('fetch', vi.fn())`. Le funzioni che usano Supabase direttamente (`acceptInviteByEmail`, etc.) richiedono il mock del builder.

**Commit**: `test: add Vitest setup and unit tests for invites.ts`

---

## Riepilogo file

| File | Azione |
|------|--------|
| `supabase/functions/send-expiry-notifications/index.ts` | Modifica: commento auth |
| `src/lib/pushNotifications.ts` | Modifica: JSDoc |
| `src/pages/DashboardPage.tsx` | Modifica: estrazione componenti |
| `src/components/foods/DashboardStats.tsx` | **Nuovo** |
| `src/components/foods/FoodModals.tsx` | **Nuovo** |
| `src/hooks/useFoodFormDialog.ts` | **Nuovo** |
| `vitest.config.ts` | **Nuovo** |
| `src/lib/__tests__/helpers/mockSupabase.ts` | **Nuovo** |
| `src/lib/__tests__/invites.test.ts` | **Nuovo** |
| `package.json` | Modifica: script test + devDep vitest |

## Verifica

- **Task 1-2**: Review visuale dei commenti, nessun test
- **Task 3**: `npm run build` senza errori. Verifica manuale: Dashboard funziona (CRUD, filtri, stats, calendario, modali)
- **Task 4**: `npm run test` passa tutti i 19 test
- **Dopo ogni task**: commit dedicato
