# Piano: Esperienza Offline per Entro

## Contesto

Entro oggi è **cloud-dependent**: tutti i dati vivono su Supabase, React Query (`@tanstack/react-query` v5.90.16) funge da cache in-memory, e il service worker gestisce solo asset caching e push notifications. **Non c'è persistenza dei dati offline**: senza connessione l'app mostra un'interfaccia vuota con un banner "Sei offline".

Questo impatta soprattutto gli utenti **smartphone** (il target primario di Entro):
- **iOS**: il sistema operativo termina aggressivamente le PWA in background → ogni ritorno all'app richiede fetch completo dal server
- **Rete instabile** (metro, zone rurali): l'app è inutilizzabile
- **Refresh/ricaricamento**: tutta la cache in-memory viene persa

**Obiettivo**: Implementare un'esperienza offline completa in due fasi:
1. **Fase 1**: Persistenza cache → consultazione dati offline
2. **Fase 2**: Mutazioni offline → creazione/modifica/eliminazione alimenti offline con sync automatico

---

## Supporto Browser delle Tecnologie

### IndexedDB (storage layer)
| Piattaforma | Supporto | Quota Storage | Note |
|-------------|----------|---------------|------|
| Chrome Android | ✅ | Fino a ~20% disco per origin | Nessun limite pratico per Entro |
| Safari iOS (PWA installata) | ✅ | Fino a 500MB | **Esente da eviction 7 giorni** |
| Safari iOS (solo browser) | ✅ | Stessi limiti | ⚠️ Eviction dopo 7gg senza visita |
| Firefox Android | ✅ | Fino a 50% disco per gruppo origin | OK |
| Chrome/Edge/Firefox Desktop | ✅ | Ampio | OK |
| **Copertura globale** | **~98%** | | Universalmente supportato |

**Dato critico per iOS**: La policy di eviction dati dopo 7 giorni di Safari **NON si applica alle PWA installate sulla Home Screen**. Entro è una PWA → gli utenti che la installano mantengono i dati IndexedDB indefinitamente.

### `crypto.randomUUID()` (per UUID client-side nella Fase 2)
| Piattaforma | Supporto | Note |
|-------------|----------|------|
| Chrome | ✅ | Da Chrome 92+ |
| Safari/iOS | ✅ | Da Safari 15.4+ (iOS 15.4+) |
| Firefox | ✅ | Da Firefox 95+ |
| **Copertura globale** | **~96%** | Richiede contesto sicuro (HTTPS) |

### Dipendenze da aggiungere (per entrambe le fasi)

```bash
npm install @tanstack/react-query-persist-client idb-keyval
```

- `@tanstack/react-query-persist-client` (~2KB) — Pacchetto ufficiale TanStack Query v5
- `idb-keyval` (~600 bytes gzipped) — Wrapper minimale per IndexedDB

---

## Impatto sull'Esperienza Mobile

### Android (Chrome PWA)
| Scenario | Oggi | Dopo Fase 1 | Dopo Fase 2 |
|----------|------|-------------|-------------|
| Apertura app dopo ore | Schermo caricamento | **Dati istantanei** | **Dati istantanei** |
| Metro/tunnel (no rete) | Schermo vuoto | **Dati consultabili** | **CRUD completo** (sync al ritorno) |
| Rete lenta 3G | Attesa 2-5s | **Dati immediati** | **Dati immediati + scrittura** |

### iOS (Safari PWA installata)
| Scenario | Oggi | Dopo Fase 1 | Dopo Fase 2 |
|----------|------|-------------|-------------|
| iOS chiude la PWA in background | Ricarica tutto | **Cache preservata** | **Cache + mutazioni preservate** |
| Modalità aereo | App inutilizzabile | **Lettura offline** | **Lettura + scrittura offline** |

### iOS (Safari browser, senza installare la PWA)
- Stessi benefici MA i dati possono essere eliminati da Safari dopo 7 giorni senza visita

---

## Cosa funziona offline (entrambe le fasi)

| Funzionalità | Fase 1 | Fase 2 | Note |
|--------------|--------|--------|------|
| Vedere lista alimenti | ✅ | ✅ | Cache persistita |
| Consultare scadenze | ✅ | ✅ | Cache persistita |
| Cercare/filtrare | ✅ | ✅ | Client-side sui dati cached |
| Vista calendario | ✅ | ✅ | Cache persistita |
| **Creare alimento** | ❌ | ✅ | UUID client-side + optimistic cache |
| **Modificare alimento** | ❌ | ✅ | Optimistic update in cache |
| **Eliminare alimento** | ❌ | ✅ | Optimistic removal da cache |
| **Cambiare stato** | ❌ | ✅ | Optimistic update |
| Caricare foto | ❌ | ⚠️ | Creazione senza foto offline, upload al ritorno online |
| Scansione barcode | ❌ | ❌ | Richiede Open Food Facts API |
| Login/Logout | ❌ | ❌ | Richiede server auth |

---

# FASE 1: Persistenza Cache (consultazione offline)

**Effort**: ~4h | **Rischio**: Basso

## Implementazione Fase 1

### Step 1.1: Creare il persister IndexedDB

**Nuovo file**: `src/lib/queryPersister.ts`

```typescript
import { get, set, del } from 'idb-keyval'
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client'

export const IDB_CACHE_KEY = 'entro-react-query-cache'

export function createIDBPersister(): Persister {
  return {
    persistClient: async (client: PersistedClient) => {
      await set(IDB_CACHE_KEY, client)
    },
    restoreClient: async () => {
      return await get<PersistedClient>(IDB_CACHE_KEY)
    },
    removeClient: async () => {
      await del(IDB_CACHE_KEY)
    },
  }
}
```

### Step 1.2: Aggiornare `src/main.tsx`

Codice completo del file aggiornato:

```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createIDBPersister } from './lib/queryPersister'
import './index.css'
import App from './App.tsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 60 * 24, // 24 hours (must be >= persister maxAge)
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

const persister = createIDBPersister()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister }}
      onSuccess={() => {
        queryClient.resumePausedMutations().then(() => {
          queryClient.invalidateQueries()
        })
      }}
    >
      <App />
    </PersistQueryClientProvider>
  </StrictMode>,
)
```

### Step 1.3: Pulire la cache al logout

**File da modificare**: `src/lib/auth.ts`

Nella funzione `signOut()`, DOPO la pulizia selettiva dei `sb-*` keys, aggiungere:

```typescript
import { del } from 'idb-keyval'
import { IDB_CACHE_KEY } from './queryPersister'

// Nella funzione signOut, dopo la pulizia degli auth keys:
await del(IDB_CACHE_KEY)
```

### Riepilogo file Fase 1

| File | Azione |
|------|--------|
| `src/lib/queryPersister.ts` | **NUOVO** |
| `src/main.tsx` | Modificare (provider, gcTime) |
| `src/lib/auth.ts` | Modificare (pulizia IndexedDB al logout) |

---

# FASE 2: Mutazioni Offline (CRUD completo offline)

**Effort**: ~3-5 giorni | **Rischio**: Medio | **Prerequisito**: Fase 1 completata

## Come funziona

React Query v5 supporta nativamente la persistenza delle mutazioni:

```
UTENTE OFFLINE → crea/modifica/elimina alimento
  1. useMutation viene invocata
  2. onMutate: optimistic update applicato alla cache React Query
  3. mutationFn: NON eseguita → mutation in stato "paused"
  4. PersistQueryClientProvider salva cache + mutation state in IndexedDB
  5. L'utente vede il cambiamento immediatamente nella UI ✅

UTENTE TORNA ONLINE (o riapre l'app con connessione)
  6. PersistQueryClientProvider ripristina cache + mutations da IndexedDB
  7. onSuccess del provider → resumePausedMutations()
  8. mutationFn eseguita per ogni mutazione pausata → dati inviati a Supabase
  9. onSuccess/onError della mutazione → cache invalidata → refetch freschi dal server
```

**Dopo page reload**: le `mutationFn` non sono serializzabili, quindi servono `setMutationDefaults()` che forniscono le funzioni di fallback per le mutazioni ripristinate.

## Implementazione Fase 2

### Step 2.1: Definire mutation keys

**File da modificare**: `src/hooks/useFoods.ts`

Aggiungere mutation keys esplicite (necessarie per `setMutationDefaults` e per il resume):

```typescript
export const foodMutationKeys = {
  create: ['foods', 'create'] as const,
  update: ['foods', 'update'] as const,
  delete: ['foods', 'delete'] as const,
  updateStatus: ['foods', 'updateStatus'] as const,
}
```

### Step 2.2: Aggiungere `mutationKey` a tutte le mutazioni

**File da modificare**: `src/hooks/useFoods.ts`

Ogni hook di mutazione deve avere un `mutationKey` corrispondente. Esempio per `useCreateFood`:

```typescript
export function useCreateFood() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: foodMutationKeys.create, // ← AGGIUNGERE
    mutationFn: async (data: FoodInsert) => {
      return createFood(data)
    },
    onMutate: async (newFood) => {
      // Optimistic update: aggiungere alla cache
      await queryClient.cancelQueries({ queryKey: foodsKeys.lists() })
      const previousFoods = queryClient.getQueryData(foodsKeys.lists())

      // Creare un oggetto food ottimistico con tutti i campi necessari
      const optimisticFood = {
        ...newFood,
        id: newFood.id || crypto.randomUUID(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'active' as const,
        consumed_at: null,
        deleted_at: null,
        _isPending: true, // ← flag per UI "in sincronizzazione"
      }

      // Aggiungere alla cache (inserire all'inizio della lista)
      queryClient.setQueryData(foodsKeys.lists(), (old: any) => {
        if (!old) return [optimisticFood]
        return [optimisticFood, ...old]
      })

      return { previousFoods }
    },
    onError: (_err, _newFood, context) => {
      // Rollback
      if (context?.previousFoods) {
        queryClient.setQueryData(foodsKeys.lists(), context.previousFoods)
      }
      toast.error('Errore nella creazione dell\'alimento')
    },
    onSuccess: (data) => {
      mutationTracker.track(data.id, 'INSERT')
      toast.success('Alimento aggiunto con successo')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: foodsKeys.lists() })
    },
  })
}
```

Applicare lo stesso pattern a `useUpdateFood`, `useDeleteFood`, `useUpdateFoodStatus`:
- Aggiungere `mutationKey`
- Spostare l'optimistic update da `onSuccess` a `onMutate` dove non già presente
- Aggiungere rollback in `onError`
- Usare `onSettled` per invalidare (al posto di `onSuccess`)

### Step 2.3: Generare UUID client-side per i nuovi alimenti

**File da modificare**: `src/hooks/useFoods.ts` o la pagina che chiama `useCreateFood`

Quando l'utente crea un alimento, generare l'`id` nel client PRIMA di chiamare la mutazione:

```typescript
// Nel componente che chiama createMutation.mutate():
const handleCreateFood = async (formData: FoodFormData) => {
  const foodData: FoodInsert = {
    id: crypto.randomUUID(), // ← UUID generato client-side
    name: formData.name,
    category_id: formData.category_id,
    expiry_date: formData.expiry_date,
    storage_location: formData.storage_location,
    quantity: formData.quantity,
    quantity_unit: formData.quantity_unit,
    notes: formData.notes,
    user_id: user.id,
    list_id: listId, // dal contesto dell'app
    image_url: null, // ← immagini gestite separatamente (vedi Step 2.5)
    status: 'active',
  }
  createMutation.mutate(foodData)
}
```

**Nota su `list_id`**: è già disponibile nel contesto dell'app (dalla query degli alimenti correnti o dallo store auth). Se necessario, salvarlo in sessionStorage come backup.

### Step 2.4: Creare `setMutationDefaults`

**Nuovo file**: `src/lib/mutationDefaults.ts`

Questo file registra le `mutationFn` di default per ogni tipo di mutazione, necessarie per il resume dopo page reload:

```typescript
import type { QueryClient } from '@tanstack/react-query'
import { createFood, updateFood, deleteFood, updateFoodStatus } from './foods'
import { foodMutationKeys } from '../hooks/useFoods'
import { mutationTracker } from '../utils/realtimeHelpers'

export function registerMutationDefaults(queryClient: QueryClient) {
  queryClient.setMutationDefaults(foodMutationKeys.create, {
    mutationFn: async (data) => {
      mutationTracker.track(data.id, 'INSERT')
      return createFood(data)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['foods', 'list'] })
    },
  })

  queryClient.setMutationDefaults(foodMutationKeys.update, {
    mutationFn: async ({ id, data }) => {
      mutationTracker.track(id, 'UPDATE')
      return updateFood(id, data)
    },
    onSettled: (_data, _err, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['foods', 'list'] })
      queryClient.invalidateQueries({ queryKey: ['foods', 'detail', id] })
    },
  })

  queryClient.setMutationDefaults(foodMutationKeys.delete, {
    mutationFn: async (id) => {
      mutationTracker.track(id, 'DELETE')
      return deleteFood(id)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['foods', 'list'] })
    },
  })

  queryClient.setMutationDefaults(foodMutationKeys.updateStatus, {
    mutationFn: async ({ id, status }) => {
      mutationTracker.track(id, 'UPDATE')
      return updateFoodStatus(id, status)
    },
    onSettled: (_data, _err, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['foods', 'list'] })
      queryClient.invalidateQueries({ queryKey: ['foods', 'detail', id] })
    },
  })
}
```

### Step 2.5: Gestione immagini offline

**Approccio pragmatico** (raccomandato per questa fase):

1. **Creazione offline**: l'alimento viene creato SENZA foto (`image_url: null`)
2. **Upload al ritorno online**: dopo che la mutazione viene ripresa e il food esiste su Supabase, l'utente può aggiungere la foto dalla modifica
3. **Nel form**: se offline, disabilitare il pulsante di upload foto con un messaggio "Foto disponibile quando sei online"

**File da modificare**: `src/components/food/ImageUpload.tsx` (o equivalente)
- Controllare `navigator.onLine` o usare il hook `useNetworkStatus()`
- Se offline, mostrare un messaggio informativo e disabilitare l'upload

**Approccio avanzato** (opzionale, implementabile in futuro):
1. Salvare il blob dell'immagine in IndexedDB con chiave `pending-image-{food-id}`
2. Al ritorno online, dopo il resume della mutazione create, leggere il blob da IndexedDB e uploadarlo su Supabase Storage
3. Aggiornare il food con l'`image_url` risultante
4. Eliminare il blob da IndexedDB

### Step 2.6: Aggiornare `src/main.tsx` per registrare i mutation defaults

```typescript
import { registerMutationDefaults } from './lib/mutationDefaults'

// Dopo la creazione del queryClient:
const queryClient = new QueryClient({ ... })
registerMutationDefaults(queryClient)
```

### Step 2.7 (opzionale): Indicatore UI "in sincronizzazione"

**File da modificare**: `src/components/food/FoodCard.tsx` (o componente card equivalente)

Mostrare un piccolo badge/icona sugli alimenti che hanno mutazioni pendenti:

```tsx
// Controllare se ci sono mutazioni pendenti per questo food
const pendingMutations = useIsMutating({
  mutationKey: ['foods'],
  predicate: (mutation) => mutation.state.isPaused,
})

// Nella card, mostrare un indicatore
{pendingMutations > 0 && (
  <span className="text-xs text-amber-600 flex items-center gap-1">
    <CloudOff className="h-3 w-3" /> In attesa di sync
  </span>
)}
```

**Nota**: `useIsMutating` è già disponibile in `@tanstack/react-query`. L'implementazione esatta dipenderà da come le mutazioni sono strutturate — potrebbe servire un controllo più specifico (per food ID).

### Riepilogo file Fase 2

| File | Azione |
|------|--------|
| `src/lib/mutationDefaults.ts` | **NUOVO** — Registrazione mutation defaults per resume |
| `src/hooks/useFoods.ts` | Modificare — Aggiungere mutationKeys, optimistic updates, UUID client-side |
| `src/main.tsx` | Modificare — Registrare mutation defaults |
| `src/lib/foods.ts` | Verificare/adattare — Accettare UUID pre-generato negli insert |
| `src/components/food/ImageUpload.tsx` | Modificare — Disabilitare upload se offline |
| `src/components/food/FoodCard.tsx` | Modificare (opzionale) — Badge "in sincronizzazione" |

**Stima righe di codice Fase 2**: ~150-200 righe nuove/modificate

---

# Aggiornamenti User Guide (dopo entrambe le fasi)

Il contenuto delle guide va aggiornato **dopo la Fase 2** per riflettere le capacità offline complete.

## GuidaPage.tsx — Sezione "Utilizzo Offline" (riga ~329-340)

Sostituire il contenuto della Card `WifiOff` con:

```tsx
<Card>
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <WifiOff className="h-5 w-5 text-gray-600" />
      Utilizzo Offline
    </CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    <div>
      <h3 className="font-medium mb-2">Cosa funziona offline</h3>
      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
        <li>L'app si apre e mostra l'interfaccia</li>
        <li><strong className="text-foreground">Vedere la lista degli alimenti</strong> (dati dall'ultimo accesso)</li>
        <li><strong className="text-foreground">Consultare le scadenze</strong> e i dettagli</li>
        <li><strong className="text-foreground">Cercare e filtrare</strong> gli alimenti</li>
        <li><strong className="text-foreground">Vista calendario</strong></li>
        <li><strong className="text-foreground">Aggiungere alimenti</strong> (senza foto, sincronizzati al ritorno online)</li>
        <li><strong className="text-foreground">Modificare ed eliminare alimenti</strong> (sincronizzati al ritorno online)</li>
      </ul>
    </div>
    <div>
      <h3 className="font-medium mb-2">Cosa NON funziona offline</h3>
      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
        <li>Scansione barcode</li>
        <li>Caricare foto</li>
        <li>Login e registrazione</li>
      </ul>
    </div>
    <div>
      <h3 className="font-medium mb-2">Come funziona</h3>
      <p className="text-sm text-muted-foreground">
        I tuoi dati vengono salvati automaticamente sul dispositivo ogni volta che apri l'app.
        Quando sei offline, puoi consultare e modificare i tuoi alimenti normalmente.
        Le modifiche fatte offline vengono sincronizzate automaticamente quando torni online.
        Un banner arancione ti avvisa quando sei offline.
      </p>
    </div>
  </CardContent>
</Card>
```

## GuidaPage.tsx — Sezione "Installare l'App" (riga ~289-322)

Aggiungere in fondo alla Card, dopo la sezione "Computer (Chrome/Edge)":

```tsx
<div>
  <h3 className="font-medium mb-2">Perché installare l'app?</h3>
  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
    <li>Accesso rapido dalla schermata home</li>
    <li>Si apre a schermo intero (senza barra del browser)</li>
    <li><strong className="text-foreground">I dati restano sul dispositivo</strong> anche quando chiudi l'app</li>
    <li><strong className="text-foreground">Funziona offline</strong>: consulta e gestisci i tuoi alimenti anche senza connessione</li>
    <li><strong className="text-foreground">iPhone:</strong> le notifiche push funzionano solo con l'app installata</li>
  </ul>
</div>
<div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
    Nota per iPhone
  </p>
  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
    Su iPhone, se usi entro dal browser Safari senza installarla, i dati salvati sul dispositivo
    possono essere cancellati automaticamente dopo 7 giorni di inattività. Installando l'app
    sulla schermata Home questo limite non si applica.
  </p>
</div>
```

## QuickGuideDialog.tsx — Item "Installa app" (riga ~62-65)

Aggiornare la description:

```typescript
{
  icon: Download,
  title: 'Installa app',
  description: 'Aggiungi entro alla schermata Home per accesso rapido, uso offline completo e notifiche push (iPhone)',
},
```

## USER_GUIDE.md — Sezione "Utilizzo Offline" (riga ~311-341)

Sostituire con:

```markdown
## Utilizzo Offline

### Cosa Funziona Offline

| Funzionalità | Disponibile Offline |
|--------------|---------------------|
| Aprire l'app | ✅ Sì |
| Vedere la lista alimenti | ✅ Sì (dati dall'ultimo accesso) |
| Consultare scadenze e dettagli | ✅ Sì |
| Cercare e filtrare alimenti | ✅ Sì |
| Vista calendario | ✅ Sì |
| Aggiungere alimenti | ✅ Sì (senza foto, sincronizzati al ritorno online) |
| Modificare/eliminare alimenti | ✅ Sì (sincronizzati al ritorno online) |
| Banner "Sei offline" | ✅ Sì |

### Cosa NON Funziona Offline

| Funzionalità | Disponibile Offline |
|--------------|---------------------|
| Scansione barcode | ❌ No |
| Caricare foto | ❌ No |
| Login/Registrazione | ❌ No |

### Come Funziona

I tuoi dati vengono salvati automaticamente sul dispositivo ogni volta che apri l'app. Quando sei offline, puoi consultare e modificare i tuoi alimenti normalmente. Le modifiche fatte offline vengono **sincronizzate automaticamente** quando torni online. Un **banner arancione** in cima alla pagina avvisa che sei offline.

**Nota**: le foto non possono essere caricate offline. Puoi aggiungere un alimento senza foto e aggiungere la foto successivamente quando sei online.
```

## USER_GUIDE.md — Sezione "Installare l'App (PWA)" (riga ~279-308)

Aggiungere dopo "### Su Computer (Chrome/Edge)":

```markdown
### Vantaggi dell'Installazione

- Accesso rapido dalla schermata home
- Si apre a schermo intero (senza barra del browser)
- Icona dedicata con il logo entro
- **I dati restano sul dispositivo** anche quando chiudi l'app
- **Funziona offline**: consulta e gestisci i tuoi alimenti anche senza connessione
- **Notifiche push** su iPhone (funzionano solo con l'app installata)

### iPhone: differenze tra browser e app installata

| Funzionalità | Safari (browser) | App installata |
|-------------|-----------------|----------------|
| Consultazione dati | ✅ | ✅ |
| Creazione/modifica offline | ✅ | ✅ |
| Dati persistenti | ⚠️ Cancellati dopo 7gg di inattività | ✅ Persistenti |
| Notifiche push | ❌ Non supportate | ✅ Supportate |
| Schermo intero | ❌ Barra browser visibile | ✅ A schermo intero |
```

---

# Rischi e Mitigazioni

| Rischio | Probabilità | Mitigazione |
|---------|-------------|-------------|
| Dati stale mostrati all'utente | Media | `staleTime` 5min + refetch in background. I dati cached sono un punto di partenza, non la verità |
| Cache non pulita al logout | — | Pulizia esplicita in `signOut()` con `del(IDB_CACHE_KEY)` |
| IndexedDB pieno su iOS | Molto bassa | Dataset Entro è piccolo (pochi KB per lista tipica) |
| Eviction su Safari non-PWA | Media | Solo chi non installa e non visita per 7gg. Documentato nella guida utente |
| Conflitto con realtime updates | Bassa | La cache persistita è solo il punto di partenza; Supabase Realtime la sovrascrive immediatamente |
| Performance serializzazione | Molto bassa | Per <200 alimenti, serializzazione <10ms |
| Immagini non disponibili offline | Media | Non sono obiettivo di questa implementazione. Mostrare placeholder se URL firmato scaduto |
| Mutazione offline fallisce al resume | Bassa | `onSettled` invalida le query → refetch dal server = rollback implicito. Mostrare toast di errore |
| `mutationFn` non trovata dopo reload | — | Risolto da `setMutationDefaults()` in `mutationDefaults.ts` |
| Conflitti in liste condivise | Bassa | Last-write-wins. Per Entro i conflitti reali sono rari (un alimento è gestito tipicamente da una persona) |
| Deduplicazione realtime dopo resume | Bassa | `mutationTracker.track()` nei mutation defaults previene duplicati |

---

# Verifica

## Test Fase 1 (persistenza cache)

1. **Persistenza al refresh**:
   - Caricare la dashboard con alimenti
   - Refresh della pagina (F5)
   - I dati devono apparire istantaneamente senza loading spinner

2. **Offline (modalità aereo)**:
   - Caricare la dashboard con dati
   - Attivare modalità aereo
   - Chiudere e riaprire l'app
   - I dati dell'ultimo accesso devono essere visibili
   - Il banner offline deve comparire

3. **Pulizia al logout**:
   - Fare login, caricare dati
   - Fare logout
   - Verificare in DevTools (Application → IndexedDB) che la chiave `entro-react-query-cache` sia stata rimossa
   - Fare login con un altro account → NON deve vedere i dati del vecchio account

4. **iOS Safari PWA**: Installare → usare → forzare chiusura → riaprire → dati visibili immediatamente

5. **Chrome Android**: Stessi test di iOS PWA

6. **Realtime non compromesso**: Con due dispositivi, verificare che le modifiche in tempo reale funzionino ancora

7. **Filtri e ricerca offline**: Verificare che funzionino sui dati cached

## Test Fase 2 (mutazioni offline)

8. **Creazione offline**:
   - Andare offline (modalità aereo)
   - Creare un nuovo alimento (senza foto)
   - L'alimento deve apparire nella lista immediatamente
   - Tornare online → l'alimento deve sincronizzarsi con il server
   - Verificare che esista su Supabase (tramite un altro dispositivo)

9. **Modifica offline**:
   - Andare offline
   - Modificare il nome di un alimento
   - La modifica deve essere visibile immediatamente
   - Tornare online → la modifica deve sincronizzarsi

10. **Eliminazione offline**:
    - Andare offline
    - Eliminare un alimento
    - L'alimento deve scomparire dalla lista
    - Tornare online → l'eliminazione deve sincronizzarsi

11. **Persistenza mutazioni dopo page reload**:
    - Andare offline
    - Creare un alimento
    - Chiudere completamente l'app
    - Riaprire l'app (ancora offline) → l'alimento creato deve essere visibile
    - Tornare online → la mutazione deve partire e sincronizzarsi

12. **Fallimento mutazione**:
    - Creare un alimento offline
    - Mentre offline, eliminare lo stesso alimento dal server (da un altro dispositivo)
    - Tornare online → la modifica fallisce → le query vengono invalidate → i dati si aggiornano dal server

13. **Foto disabilitata offline**:
    - Andare offline
    - Aprire il form di creazione alimento
    - Il pulsante upload foto deve essere disabilitato con messaggio informativo

14. **Badge sincronizzazione** (se implementato):
    - Creare/modificare alimenti offline
    - Le card devono mostrare un indicatore "in attesa di sync"
    - Tornare online → l'indicatore deve scomparire dopo la sincronizzazione

## Verifiche automatiche

- `npm run build` deve compilare senza errori
- `npm run lint` deve passare
- `npm run preview` deve funzionare correttamente

---

# Riepilogo Completo File

| File | Fase | Azione |
|------|------|--------|
| `src/lib/queryPersister.ts` | 1 | **NUOVO** — Persister IndexedDB con idb-keyval |
| `src/main.tsx` | 1+2 | Modificare — Provider, gcTime, persister, mutation defaults |
| `src/lib/auth.ts` | 1 | Modificare — Pulizia IndexedDB al logout |
| `src/lib/mutationDefaults.ts` | 2 | **NUOVO** — Registrazione mutation defaults per resume |
| `src/hooks/useFoods.ts` | 2 | Modificare — mutationKeys, optimistic updates, UUID client-side |
| `src/lib/foods.ts` | 2 | Verificare — Accettare UUID pre-generato |
| `src/components/food/ImageUpload.tsx` | 2 | Modificare — Disabilitare upload se offline |
| `src/components/food/FoodCard.tsx` | 2 | Modificare (opz.) — Badge "in sincronizzazione" |
| `src/pages/GuidaPage.tsx` | 1+2 | Modificare — Sezioni "Offline" e "Installare l'App" |
| `src/components/guide/QuickGuideDialog.tsx` | 1+2 | Modificare — Descrizione "Installa app" |
| `docs/guides/USER_GUIDE.md` | 1+2 | Modificare — Sezioni corrispondenti |

---

# Metriche di Successo

- **Time to First Meaningful Paint**: da ~1-3s (fetch) a **<100ms** (cache hit)
- **Offline usability**: da 0% a **CRUD quasi completo** (tutto tranne foto e barcode)
- **Resilienza su iOS**: eliminato il problema del ricaricamento dopo background kill
- **Bundle size impact**: +~3KB (trascurabile)
- **Dipendenze nuove**: solo 2 pacchetti leggeri, entrambi ben mantenuti

---

*Piano creato: 1 marzo 2026*
*Basato su analisi dell'articolo InfoWorld "The browser is your database: Local-first comes of age"*
