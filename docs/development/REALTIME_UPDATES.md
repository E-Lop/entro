# Piano Implementazione Real-Time Updates - PWA Entro

> **Per Claude Code**: Questo documento contiene il piano completo per implementare real-time updates nella PWA usando Supabase Realtime. Il piano è stato validato con la documentazione ufficiale di React 19, Supabase v2, React Query v5, e verificato per compatibilità con lo stack esistente (Netlify, PWA, Service Worker). Segui l'approccio incrementale: Fase 1 (Foods) → Fase 2 (Membership) → Fase 4 (Performance).

---

## Obiettivo
Implementare aggiornamenti in tempo reale per tutta l'applicazione usando Supabase Realtime, in modo che quando l'Utente A condivide una lista con l'Utente B e l'Utente B aggiunge/modifica qualcosa, l'Utente A veda i cambiamenti senza dover fare refresh manuale.

## Architettura Scelta

### Pattern: Custom Hooks + Supabase Realtime Channels
- **Supabase Realtime** con WebSocket-based change data capture (CDC)
- **Custom React hooks** per ogni entità (useRealtimeFoods, useRealtimeListMembers, useRealtimeLists)
- **Integrazione con React Query** tramite aggiornamento diretto della cache + invalidazione come fallback
- **Subscriptions filtrate** per `list_id` per rispettare RLS e limitare eventi

### Vantaggi
- Già integrato nello stack (supabase client configurato)
- Rispetta automaticamente le RLS policies
- Auto-reconnection nativa
- Nessuna infrastruttura aggiuntiva necessaria

---

## Entità da Sincronizzare (Priorità)

### Priority 1 - Core (Implementazione Immediata)
1. **`foods`** - Alimenti (INSERT, UPDATE, DELETE)
2. **`list_members`** - Membri della lista (INSERT, DELETE per join/leave)
3. **`lists`** - Metadati lista (UPDATE per nome lista)

### Priority 2 - Opzionale (Fase Successiva)
4. **`invites`** - Stato inviti (UPDATE per accepted/expired)
5. **`categories`** - Saltare (dati statici, raramente cambiano)

---

## Strategia di Subscription

### Filtri di Sicurezza
Tutte le subscriptions devono filtrare per `list_id` dell'utente per:
- Rispettare le RLS policies
- Evitare ricezione eventi non autorizzati
- Ridurre overhead di banda

```typescript
// Esempio filtro Postgres
filter: `list_id=eq.${userListId}`
```

### Struttura Channels
- **1 channel per tabella per lista**
- Massimo 3-4 channels per utente
- Naming: `{table}-{listId}` (es. `foods-uuid-123`)

---

## Integrazione React Query

### Approccio Ibrido (Validato con React Query v5 docs)
1. **INSERT/UPDATE** → Aggiornamento diretto cache con `queryClient.setQueriesData()` (immutabile)
2. **DELETE** → Rimozione diretta dalla cache (no filtri Supabase per DELETE events)
3. **Fallback** → Invalidazione con `queryClient.invalidateQueries()` se cache update fallisce

**⚠️ IMPORTANTE**: React Query v5 richiede aggiornamenti immutabili - creare nuovi array/oggetti, non modificare in place

### Deduplicazione Eventi
Per evitare aggiornamenti duplicati (mutation locale + evento realtime):
- Tracciare le mutazioni recenti in una `Map<string, timestamp>`
- Finestra di deduplicazione: 2 secondi
- Skippare eventi realtime se corrispondono a mutazioni recenti

```typescript
const recentMutations = new Map<string, number>()
const DEDUP_WINDOW = 2000 // 2 secondi
```

---

## Lifecycle delle Subscriptions

### Dove Subscribere
- **Component mount** nei componenti top-level (DashboardPage, AppLayout)
- **NON in provider globale** (troppo rigido)
- **NON in componenti individuali** (troppe subscriptions)

### Cleanup
- `useEffect` return cleanup function per unsubscribe
- `channel.unsubscribe()` + `supabase.removeChannel(channel)`
- Cleanup automatico su unmount del componente

### Riconnessione
- Supabase gestisce auto-reconnection
- Su reconnect: invalidare queries per recuperare eventi persi
- Monitorare status via `channel.on('system', ...)`

---

## Gestione Performance

### Evitare Troppe Subscriptions
- **Table-level** con filtri Postgres (NON row-level)
- Massimo 3-4 channels totali per utente
- Unsubscribe quando si naviga via

### Batching Updates
- Debounce invalidation per operazioni bulk (500ms)
- Throttle updates ad alta frequenza (max 1 per 100ms per entity)

### Memory Management
- Cleanup Map di deduplicazione con TTL
- Limit history eventi realtime
- Rimuovere channels su unmount

---

## User Experience (Preferenze Utente Confermate)

### Notifiche ✅
- **DELETE** → Toast "X è stato eliminato da un altro utente"
- **INSERT** → Solo highlight visivo sul nuovo item (NO toast)
- **UPDATE** → Solo highlight visivo sull'item modificato (NO toast)
- **Membership** → Toast "Un nuovo membro si è unito alla lista"

**Rationale**: Toast solo per azioni critiche (delete, membership changes), highlight visivo per update non distruttivi.

### Conflitti di Modifica ✅
Se l'utente sta modificando un food e arriva un UPDATE remoto:
1. Mostrare warning toast con messaggio chiaro
2. Messaggio: "Questo alimento è stato modificato da un altro utente"
3. Action button: "Ricarica" → chiude dialog e refetch data
4. Permettere comunque di continuare a modificare (last-write-wins se utente ignora)

**Rationale**: Informare l'utente ma non bloccare completamente il workflow.

### Indicatori Visivi
- **Animazione fade-in** per nuovi items
- **Ring blu + pulse** (2 secondi) per items aggiornati remotamente
- **NO badge** "Nuovo" per mantenere UI pulita

---

## Struttura File

### Nuovi File da Creare

```
/src/hooks/
  - useRealtimeFoods.ts          # Subscription foods table
  - useRealtimeListMembers.ts    # Subscription list_members table
  - useRealtimeLists.ts          # Subscription lists table
  - useRealtimeSync.ts           # Utilities condivise

/src/lib/
  - realtime.ts                  # Event handlers e cache updaters
  - realtime.types.ts            # TypeScript types per payloads

/src/utils/
  - realtimeHelpers.ts           # Deduplication, throttling
```

### File da Modificare

```
/src/hooks/useFoods.ts
  - Aggiungere tracking mutazioni per deduplicazione
  - Esportare helper per cache updates

/src/pages/DashboardPage.tsx
  - Chiamare useRealtimeFoods()
  - Chiamare useRealtimeListMembers()
  - Chiamare useRealtimeLists()

/src/components/foods/FoodCard.tsx
  - Aggiungere supporto per prop isRemoteUpdate
  - Styling per highlight blu + pulse animation

/src/components/foods/FoodForm.tsx
  - Aggiungere subscription per conflitti durante edit
  - Mostrare warning se item modificato remotamente
```

---

## Piano Implementazione (Approccio Incrementale Confermato)

### ✅ FASE 1: Foods Realtime (Priorità Alta)
Implementare e testare completamente la sincronizzazione foods prima di procedere.

#### Step 1: Setup Base Realtime Infrastructure
**File: `/src/lib/realtime.ts`**
- Creare helper functions per cache updates
- `handleFoodRealtimeEvent()` - gestisce INSERT/UPDATE/DELETE
- `handleListMemberEvent()` - gestisce JOIN/LEAVE
- `handleListEvent()` - gestisce UPDATE metadata
- Logica deduplicazione eventi

**File: `/src/lib/realtime.types.ts`**
- Types per Supabase Realtime payloads
- `RealtimePayload<T>`, `RealtimeEvent`, etc.

**File: `/src/utils/realtimeHelpers.ts`**
- `RecentMutationsTracker` class
- Throttle e debounce utilities
- Channel naming helpers

#### Step 2: Implementare useRealtimeFoods Hook
**File: `/src/hooks/useRealtimeFoods.ts`**
1. Ottenere `listId` dell'utente corrente da `list_members`
2. Creare channel `foods-${listId}`
3. Subscribe con filtro `list_id=eq.${listId}`
4. Gestire eventi INSERT/UPDATE/DELETE
5. Aggiornare cache React Query
6. Cleanup su unmount

**Integrare in: `/src/pages/DashboardPage.tsx`**
- Chiamare `useRealtimeFoods()` dopo gli altri hooks

---

### ✅ FASE 2: Membership Realtime (Priorità Alta)
Dopo aver validato foods realtime, aggiungere notifiche membership.

#### Step 3: Implementare useRealtimeListMembers Hook
**File: `/src/hooks/useRealtimeListMembers.ts`**
1. Subscribe a `list_members` con filtro `list_id=eq.${listId}`
2. Gestire eventi INSERT (nuovo membro) → toast + force refetch
3. Gestire eventi DELETE (membro lascia) → toast + refetch
4. Se current user viene rimosso → redirect + clear cache

**Integrare in: `/src/pages/DashboardPage.tsx`**
- Chiamare `useRealtimeListMembers()`

---

### ⏸️ FASE 3: Lists Metadata Realtime (Priorità Bassa - Opzionale)
Da implementare solo se necessario dopo Fase 1 e 2.

#### Step 4: Implementare useRealtimeLists Hook (OPZIONALE)
**File: `/src/hooks/useRealtimeLists.ts`**
1. Subscribe a `lists` con filtro `id=eq.${listId}`
2. Gestire UPDATE eventi (nome lista cambiato)
3. Aggiornare header UI in AppLayout

**Integrare in: `/src/components/layout/AppLayout.tsx`**
- Chiamare `useRealtimeLists()`

**Nota**: Questa feature ha priorità bassa secondo le preferenze utente.

#### Step 5: Aggiornare Mutation Hooks
**File: `/src/hooks/useFoods.ts`**
- In `useCreateFood()`: registrare mutation nella Map di deduplicazione
- In `useUpdateFood()`: registrare mutation
- In `useDeleteFood()`: registrare mutation
- Esportare mutation tracker per uso in realtime handlers

#### Step 6: UI per Indicatori Visivi
**File: `/src/components/foods/FoodCard.tsx`**
- Aggiungere prop `isRemoteUpdate?: boolean`
- Styling condizionale con `ring-2 ring-blue-500 animate-pulse`
- Transizione automatica dopo 2 secondi

**File: `/src/types/food.types.ts`**
- Estendere tipo `Food` con `isRemoteUpdate?: boolean` (solo client-side)

#### Step 7: Gestione Conflitti Edit
**File: `/src/components/foods/FoodForm.tsx`**
- Subscribe a singolo food durante edit: `food-detail-${foodId}`
- Se arriva UPDATE mentre dialog aperto:
  - Mostrare warning toast
  - Disabilitare submit button
  - Action "Ricarica" per chiudere e refetch

#### Step 8: Monitoring e Debug
**Opzionale: Console logging per development**
- Log eventi realtime ricevuti
- Log cache updates
- Log deduplicazione skip

**Opzionale: Status indicator**
- Mostrare stato connessione WebSocket in UI
- Icona verde = connected, rossa = disconnected

---

## Testing Plan

### Test Manuale con Due Utenti
1. **Setup**: User A crea lista e invita User B
2. **Test Foods INSERT**: User B aggiunge alimento → User A vede apparire immediatamente
3. **Test Foods UPDATE**: User A modifica scadenza → User B vede cambio in tempo reale
4. **Test Foods DELETE**: User B elimina alimento → User A vede toast + item scompare
5. **Test Membership**: User A invita User C → User B vede nuovo membro (se implementato)
6. **Test Conflict**: User A apre edit dialog, User B modifica stesso food → User A vede warning

### Test Edge Cases
1. **Network drop**: Disconnettere WiFi, riconnettere → verificare auto-reconnect + refetch
2. **Rapid mutations**: User A fa 10 aggiunte veloci → verificare batching/throttling
3. **Concurrent edits**: Entrambi modificano stesso food simultaneamente → verificare conflict handling
4. **User leave list**: User A rimuove User B → User B deve vedere redirect

### Verificare Performance
1. Aprire DevTools → Network → verificare WebSocket connection
2. Verificare che ci siano max 3-4 channels attivi
3. Controllare che non ci siano memory leaks (subscription cleanup)
4. Testare con 20+ foods nella lista per load testing

---

## Validazione Stack Completo

✅ **Piano validato con documentazione ufficiale 2025/2026 + verifica compatibilità infrastruttura:**

### Compatibilità Infrastruttura Esistente

**✅ Netlify Hosting + Supabase Realtime**
- WebSocket connections vanno **direttamente dal browser client a Supabase**
- Netlify static hosting NON interferisce con WebSocket (no proxy)
- Supabase Realtime usa `wss://[project].supabase.co/realtime/v1/websocket`
- [Source: Netlify + Supabase Integration](https://docs.netlify.com/extend/install-and-use/setup-guides/supabase-integration/)

**✅ Service Worker PWA + WebSocket**
- Service Worker intercetta solo HTTP/HTTPS requests
- WebSocket `wss://` protocol **bypassa automaticamente** il service worker
- vite-plugin-pwa config verificata: NO caching per Supabase API endpoints
- [Source: Vite PWA Guide](https://vite-pwa-org.netlify.app/guide/)

**✅ vite.config.ts Verificato**
- `registerType: 'autoUpdate'` - compatibile con realtime
- `runtimeCaching` solo per fonts e immagini (NO API calls cached)
- `navigateFallbackDenylist: [/^\/api/]` - esclude API routes
- **Nessuna modifica richiesta alla configurazione PWA**

---

## Validazione Documentazione Ufficiale

✅ **Piano validato con documentazione ufficiale 2025/2026:**

### Sources
- [Supabase Realtime - Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)
- [Supabase - Subscribing to Database Changes](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes)
- [React 19 - useEffect Reference](https://react.dev/reference/react/useEffect)
- [React - You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
- [TanStack Query v5 - Optimistic Updates](https://tanstack.com/query/v5/docs/react/guides/optimistic-updates)
- [TanStack Query - QueryClient Reference](https://tanstack.com/query/latest/docs/reference/QueryClient)

### Versioni & Stack Verificati
- **React**: 19.0.0 ✅
- **@supabase/supabase-js**: 2.90.1 ✅ (include Supabase Realtime)
- **@tanstack/react-query**: 5.90.16 ✅
- **vite-plugin-pwa**: 1.2.0 ✅ (compatibile con WebSocket)
- **Netlify Hosting**: Static ✅ (WebSocket passthrough funziona)
- **PWA Service Worker**: Workbox ✅ (non intercetta wss://)

### Pattern Confermati
1. ✅ `postgres_changes` con filtri `eq` operator (Supabase v2)
2. ✅ useEffect per WebSocket sync (React 19 external system)
3. ✅ Cleanup con return function (React 19 best practice)
4. ✅ `setQueryData()` / `setQueriesData()` per cache updates (React Query v5)
5. ✅ Immutabilità richiesta in React Query v5
6. ✅ WebSocket bypassa Service Worker (wss:// protocol)
7. ✅ Netlify static hosting compatibile con Supabase Realtime
8. ⚠️ DELETE events non supportano filtri Postgres (limitazione CDC)

---

## Considerazioni Finali

### Pitfall da Evitare
1. ❌ Non filtrare subscription per list_id → leak di dati
2. ❌ Dimenticare cleanup → memory leak
3. ❌ Troppe toast notifications → UX rumorosa
4. ❌ Non deduplicare → doppi aggiornamenti
5. ❌ Subscribe prima che user abbia list_id → errori

### Best Practices
1. ✅ Sempre usare filtri Postgres nelle subscriptions
2. ✅ Cleanup con `useEffect` return function
3. ✅ Deduplicare eventi con timestamp window
4. ✅ Invalidare queries su reconnect
5. ✅ Toast solo per azioni critiche (delete, membership)
6. ✅ Indicatori visivi per updates non critici

### Trade-offs Accettati
- **Last Write Wins** per conflitti (semplice, adatto a food inventory)
- **No versioning** (non serve per questo use case)
- **No presence indicators** (non critico, implementabile dopo se desiderato)

---

## Stima Effort (Approccio Incrementale)

### ✅ Fase 1: Core Realtime (Foods) - PRIORITÀ ALTA
- Setup infrastructure: ~2-3 ore
- useRealtimeFoods hook: ~2 ore
- Deduplication logic: ~1 ora
- Visual indicators (highlight): ~1.5 ore
- Integration DashboardPage: ~0.5 ore
- Conflict handling in FoodForm: ~1.5 ore
- Testing manuale completo: ~2 ore
- **Totale Fase 1: ~10-11 ore**

### ✅ Fase 2: Membership Notifications - PRIORITÀ ALTA
- useRealtimeListMembers hook: ~1.5 ore
- Toast notifications: ~0.5 ore
- Integration + refetch logic: ~1 ora
- Testing membership flow: ~1 ora
- **Totale Fase 2: ~4 ore**

### ⏸️ Fase 3: Lists Metadata - OPZIONALE
- useRealtimeLists hook: ~1 ora
- Integration AppLayout: ~0.5 ore
- Testing: ~0.5 ore
- **Totale Fase 3: ~2 ore** (da valutare se necessario)

### Fase 4: Performance + Edge Cases
- Performance optimization: ~1.5 ore
- Network reconnection handling: ~1 ora
- Edge cases testing: ~2 ore
- **Totale Fase 4: ~4.5 ore**

---

**TOTAL ESTIMATE (Fase 1 + 2 + 4): ~18-20 ore**
**Con Fase 3 opzionale: ~20-22 ore**

---

## Piano di Rollout Raccomandato

1. **Week 1**: Implementare Fase 1 (Foods realtime) + testing completo
2. **Week 1-2**: Deploy Fase 1 in produzione, monitorare per 2-3 giorni
3. **Week 2**: Se stabile, implementare Fase 2 (Membership) + testing
4. **Week 2-3**: Deploy Fase 2, monitorare
5. **Week 3+**: Performance optimization (Fase 4) se necessario
6. **Future**: Valutare Fase 3 (Lists metadata) se richiesto dagli utenti

---

## File Critici

### Da Creare (Fase 1 - Foods)
- `/src/hooks/useRealtimeFoods.ts` - Core subscription foods con deduplication
- `/src/lib/realtime.ts` - Event handlers per cache updates immutabili
- `/src/lib/realtime.types.ts` - TypeScript types per Realtime payloads
- `/src/utils/realtimeHelpers.ts` - RecentMutationsTracker class

### Da Creare (Fase 2 - Membership)
- `/src/hooks/useRealtimeListMembers.ts` - Subscription list_members

### Da Modificare (Fase 1)
- `/src/hooks/useFoods.ts` - Aggiungere mutation tracking in onMutate
- `/src/pages/DashboardPage.tsx` - Chiamare useRealtimeFoods()
- `/src/components/foods/FoodCard.tsx` - Aggiungere isRemoteUpdate prop + styling
- `/src/components/foods/FoodForm.tsx` - Aggiungere conflict detection subscription
- `/src/types/food.types.ts` - Estendere Food type con isRemoteUpdate (client-only)

### Da Modificare (Fase 2)
- `/src/pages/DashboardPage.tsx` - Aggiungere useRealtimeListMembers()
- `/src/components/layout/AppLayout.tsx` - Opzionale: mostrare count membri aggiornato

---

## Note per Implementazione

### Ordine Consigliato
1. Iniziare con `/src/lib/realtime.types.ts` per definire i types
2. Implementare `/src/utils/realtimeHelpers.ts` per utilities
3. Creare `/src/lib/realtime.ts` con event handlers
4. Implementare `/src/hooks/useRealtimeFoods.ts`
5. Modificare `/src/hooks/useFoods.ts` per deduplication
6. Aggiornare UI components (FoodCard, FoodForm)
7. Integrare in DashboardPage
8. Testing completo prima di procedere con Fase 2

### Debugging Tips
- Usare `console.log` per tracciare eventi realtime in development
- Monitorare tab Network in DevTools per WebSocket connection
- Verificare che channels siano creati con nomi corretti
- Controllare che filtri Postgres siano applicati correttamente
- Testare cleanup aprendo/chiudendo dialog e verificando memory

---

**Piano creato**: 2026-01-27
**Validato con**: React 19.0.0, Supabase v2.90.1, React Query v5.90.16
**Compatibilità verificata**: Netlify, PWA, Service Worker, vite-plugin-pwa
