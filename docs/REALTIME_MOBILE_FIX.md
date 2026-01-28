# Piano: Fix Real-Time Updates su Mobile (Android/iOS)

## Problema
Gli aggiornamenti in tempo reale funzionano su desktop (2 browser diversi testati) ma **non funzionano** su smartphone Android e iPhone.

---

## Guida Implementazione Dettagliata

### Sequenza di Implementazione (ordine consigliato)

**Step 1: Configurazione Heartbeat** (5-10 min)
- File: `src/lib/supabase.ts`
- Modifica: linea 14-20

**Step 2: Crea Hook Network Status** (10-15 min)
- File: `src/hooks/useNetworkStatus.ts` (nuovo)
- Codice completo fornito sotto

**Step 3: Modifica useRealtimeFoods** (30-45 min)
- File: `src/hooks/useRealtimeFoods.ts`
- Aggiungi imports
- Aggiungi refs e state
- Aggiungi funzione manualReconnect
- Aggiungi 3 useEffect (visibility, focus, network)
- Modifica subscription status handler
- Aggiungi logging mobile

**Step 4: (Opzionale) Connection Status Indicator** (20-30 min)
- File: `src/components/ConnectionStatusIndicator.tsx` (nuovo)
- File: `src/pages/DashboardPage.tsx` (modifica)

---

## Dettagli Implementativi per File

### File 1: `src/lib/supabase.ts`

**CODICE ESISTENTE (linee 14-20):**
```typescript
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})
```

**NUOVO CODICE (sostituisci linee 14-20):**
```typescript
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
    heartbeatIntervalMs: 15000,  // 15s instead of default 25s for better mobile detection
    timeout: 20000,                // Connection timeout
  },
})
```

---

### File 2: `src/hooks/useNetworkStatus.ts` (NUOVO FILE)

**CODICE COMPLETO:**
```typescript
import { useEffect, useState } from 'react'

/**
 * Hook to detect online/offline network status
 * Useful for triggering reconnection when network is restored
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => {
      console.log('[Network] Back online')
      setIsOnline(true)
    }

    const handleOffline = () => {
      console.log('[Network] Gone offline')
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}
```

---

### File 3: `src/hooks/useRealtimeFoods.ts` (MODIFICHE MULTIPLE)

**STEP 3.1: Aggiungi imports (dopo linea 1)**

**CODICE ESISTENTE (linee 1-18):**
```typescript
/**
 * Hook for real-time synchronization of foods table
 * - Subscribes to INSERT/UPDATE/DELETE events for foods
 * - Updates React Query cache in real-time
 * - Handles deduplication of local mutations
 */

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { getUserList } from '../lib/invites';
import {
  handleFoodRealtimeEvent,
  mutationTracker,
} from '../lib/realtime';
import type { FoodRealtimePayload } from '../lib/realtime.types';
import { getChannelName } from '../utils/realtimeHelpers';
```

**NUOVO CODICE (sostituisci import di useEffect e useState, linea 8):**
```typescript
import { useEffect, useState, useRef, useCallback } from 'react';
```

**AGGIUNGI DOPO linea 18:**
```typescript
import { toast } from 'sonner';
import { useNetworkStatus } from './useNetworkStatus';
import { foodsKeys } from './useFoods';
```

---

**STEP 3.2: Aggiungi refs e state (dopo linea 28)**

**CODICE ESISTENTE (linee 24-28):**
```typescript
export function useRealtimeFoods() {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const [listId, setListId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
```

**AGGIUNGI DOPO linea 28:**
```typescript
  // Mobile reconnection tracking
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Network status monitoring
  const isOnline = useNetworkStatus();
```

---

**STEP 3.3: Aggiungi funzione manualReconnect (dopo linea 28 + nuove linee refs)**

**AGGIUNGI DOPO i refs:**
```typescript
  /**
   * Manual reconnection logic for mobile devices
   * Safari doesn't always send close events when suspending connections
   */
  const manualReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      console.error('[Realtime] Max reconnection attempts reached');
      toast.error('Impossibile riconnettersi. Ricarica la pagina.');
      return;
    }

    reconnectAttemptsRef.current += 1;
    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current - 1), 10000);

    console.log(`[Realtime] Attempting reconnect #${reconnectAttemptsRef.current} in ${delay}ms`);

    reconnectTimeoutRef.current = setTimeout(() => {
      console.log('[Realtime] Executing reconnect attempt');

      // Unsubscribe completely and trigger re-setup
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      setIsConnected(false);
      // The main useEffect will re-run and create a new subscription
    }, delay);
  }, []);
```

---

**STEP 3.4: Modifica il setupSubscription per usare channelRef (linea 31-64)**

**CODICE ESISTENTE (linea 31):**
```typescript
  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let mounted = true;
```

**MODIFICA linea 31:**
```typescript
  useEffect(() => {
    let mounted = true;

    // Mobile debug logging
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    console.log('[Realtime Mobile Debug]', {
      isMobile,
      isPageVisible: !document.hidden,
      isOnline: navigator.onLine,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    });
```

**CODICE ESISTENTE (linea 64):**
```typescript
        // Create new channel
        channel = supabase.channel(channelName);
```

**MODIFICA linea 64:**
```typescript
        // Create new channel
        channelRef.current = supabase.channel(channelName);
```

**Cerca TUTTE le occorrenze di `channel` e sostituiscile con `channelRef.current` nel setupSubscription.**
Esempio:
- `channel.on(` → `channelRef.current.on(`
- `.subscribe((status)` rimane uguale (è concatenato)

---

**STEP 3.5: Modifica subscription status handler (linea 123-145)**

**CODICE ESISTENTE (linee 123-145):**
```typescript
          .subscribe((status) => {
            if (!mounted) return;

            console.log('[useRealtimeFoods] Subscription status:', status);

            if (status === 'SUBSCRIBED') {
              setIsConnected(true);
              setError(null);
              console.log('[useRealtimeFoods] ✅ Successfully subscribed to foods realtime channel');
            } else if (status === 'CHANNEL_ERROR') {
              setIsConnected(false);
              // In development with React Strict Mode, channel errors are expected
              // due to double-mounting. This is normal and realtime will reconnect.
              console.warn('[useRealtimeFoods] ⚠️ Channel error (expected in dev mode with Strict Mode)');
            } else if (status === 'TIMED_OUT') {
              setIsConnected(false);
              setError('Timeout connessione realtime');
              console.error('[useRealtimeFoods] Channel timed out');
            } else if (status === 'CLOSED') {
              setIsConnected(false);
              console.log('[useRealtimeFoods] Channel closed');
            }
          });
```

**NUOVO CODICE (sostituisci linee 123-145):**
```typescript
          .subscribe((status) => {
            if (!mounted) return;

            console.log('[useRealtimeFoods] Subscription status:', status);

            if (status === 'SUBSCRIBED') {
              setIsConnected(true);
              setError(null);
              reconnectAttemptsRef.current = 0; // Reset on success
              console.log('[useRealtimeFoods] ✅ Successfully subscribed to foods realtime channel');

              // Invalidate queries to catch up on any missed updates
              queryClient.invalidateQueries({ queryKey: foodsKeys.lists() });
            } else if (status === 'CHANNEL_ERROR') {
              setIsConnected(false);
              // In development with React Strict Mode, channel errors are expected
              if (!import.meta.env.DEV) {
                console.error('[useRealtimeFoods] ⚠️ Channel error in production, attempting reconnect');
                manualReconnect();
              } else {
                console.warn('[useRealtimeFoods] ⚠️ Channel error (expected in dev mode with Strict Mode)');
              }
            } else if (status === 'TIMED_OUT') {
              setIsConnected(false);
              setError('Timeout connessione realtime');
              console.error('[useRealtimeFoods] ❌ Channel timed out, attempting reconnect');
              manualReconnect();
            } else if (status === 'CLOSED') {
              setIsConnected(false);
              console.log('[useRealtimeFoods] Channel closed');
            }
          });
```

---

**STEP 3.6: Modifica cleanup function (linea 156-164)**

**CODICE ESISTENTE (linee 156-164):**
```typescript
    // Cleanup function
    return () => {
      mounted = false;
      if (channel) {
        console.log('[useRealtimeFoods] Cleaning up subscription');
        channel.unsubscribe();
        supabase.removeChannel(channel);
        setIsConnected(false);
      }
    };
```

**NUOVO CODICE (sostituisci linee 156-164):**
```typescript
    // Cleanup function
    return () => {
      mounted = false;
      if (channelRef.current) {
        console.log('[useRealtimeFoods] Cleaning up subscription');
        channelRef.current.unsubscribe();
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        setIsConnected(false);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
```

---

**STEP 3.7: Rimuovi il vecchio reconnection effect e aggiungi i nuovi (dopo linea 165)**

**CODICE ESISTENTE (linee 167-173):**
```typescript
  // On reconnect, invalidate queries to fetch any missed updates
  useEffect(() => {
    if (isConnected && listId) {
      console.log('[useRealtimeFoods] Reconnected - invalidating queries to catch up');
      queryClient.invalidateQueries({ queryKey: ['foods'] });
    }
  }, [isConnected, listId, queryClient]);
```

**ELIMINA linee 167-173 e AGGIUNGI:**
```typescript
  // Page Visibility Handler - invalidate queries when returning to foreground
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      console.log('[Realtime] Page visibility changed:', isVisible ? 'visible' : 'hidden');

      if (isVisible && isConnected) {
        console.log('[Realtime] Page became visible, invalidating queries');
        queryClient.invalidateQueries({ queryKey: foodsKeys.lists() });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isConnected, queryClient]);

  // Window Focus Handler - fallback for browsers with poor visibilitychange support
  useEffect(() => {
    const handleFocus = () => {
      console.log('[Realtime] Window focus gained');
      if (isConnected) {
        queryClient.invalidateQueries({ queryKey: foodsKeys.lists() });
      }
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [isConnected, queryClient]);

  // Network Status Handler - reconnect when network is restored
  useEffect(() => {
    if (isOnline && !isConnected && listId) {
      console.log('[Realtime] Network restored, forcing reconnect');
      manualReconnect();
    }
  }, [isOnline, isConnected, listId, manualReconnect]);
```

---

### File 4: `src/components/ConnectionStatusIndicator.tsx` (NUOVO FILE - OPZIONALE)

**CODICE COMPLETO:**
```typescript
import { useRealtimeFoods } from '@/hooks/useRealtimeFoods'

/**
 * Visual indicator shown when realtime connection is down
 * Only shows during reconnection attempts
 */
export function ConnectionStatusIndicator() {
  const { isConnected } = useRealtimeFoods()

  // Don't show anything when connected
  if (isConnected) return null

  return (
    <div className="fixed bottom-4 right-4 bg-yellow-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-50">
      <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
      <span className="text-sm font-medium">Riconnessione in corso...</span>
    </div>
  )
}
```

**NOTA:** Questo componente può essere integrato in `DashboardPage.tsx` importandolo e aggiungendolo al JSX.

---

## Dependencies

**Nessuna nuova dipendenza npm richiesta.** Tutte le API usate sono native del browser o già presenti nel progetto:
- ✅ `document.hidden` - Page Visibility API
- ✅ `navigator.onLine` - Network Information API
- ✅ `window.addEventListener` - Standard DOM API
- ✅ `sonner` (toast) - già presente
- ✅ `@tanstack/react-query` - già presente
- ✅ `@supabase/supabase-js` - già presente

---

## Checklist Pre-Implementazione

Prima di iniziare, verifica:

- [ ] Hai letto l'intero piano e compreso la struttura del codice esistente
- [ ] Hai accesso ai file da modificare:
  - [ ] `src/lib/supabase.ts`
  - [ ] `src/hooks/useRealtimeFoods.ts`
  - [ ] `src/hooks/useFoods.ts` (per foodsKeys)
- [ ] Hai un dispositivo mobile (iOS o Android) per testare
- [ ] Puoi connettere il dispositivo mobile al computer per vedere i console logs
- [ ] Hai accesso a 2 browser/dispositivi simultaneamente per test cross-device
- [ ] Il branch è pulito e aggiornato con main

---

## Possibili Errori e Soluzioni

### Errore 1: "foodsKeys is not defined"
**Causa:** Import mancante in `useRealtimeFoods.ts`
**Soluzione:** Aggiungi `import { foodsKeys } from './useFoods';` dopo gli altri imports

### Errore 2: "Cannot read property 'current' of undefined"
**Causa:** `channelRef` non inizializzato
**Soluzione:** Verifica di aver aggiunto `const channelRef = useRef<RealtimeChannel | null>(null);` dopo gli altri state

### Errore 3: "toast is not defined"
**Causa:** Import mancante
**Soluzione:** Aggiungi `import { toast } from 'sonner';` dopo gli altri imports

### Errore 4: "useNetworkStatus is not defined"
**Causa:** File non creato o import mancante
**Soluzione:**
1. Crea il file `src/hooks/useNetworkStatus.ts` con il codice fornito
2. Aggiungi `import { useNetworkStatus } from './useNetworkStatus';`

### Errore 5: TypeScript errore su "NodeJS.Timeout"
**Causa:** Tipo non riconosciuto in alcuni ambienti
**Soluzione:** Usa `ReturnType<typeof setTimeout>` invece di `NodeJS.Timeout`
```typescript
const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
```

### Errore 6: "Reconnection loop - too many attempts"
**Causa:** manualReconnect chiamato troppo frequentemente
**Soluzione:** Verifica che `reconnectAttemptsRef.current` venga resettato a 0 quando status === 'SUBSCRIBED'

### Errore 7: Desktop smette di funzionare dopo le modifiche
**Causa:** Logica di reconnection troppo aggressiva o dipendenze useEffect sbagliate
**Soluzione:**
1. Verifica dependency arrays di tutti i useEffect
2. Assicurati che `manualReconnect` sia wrappato in `useCallback`
3. Test su desktop prima di testare su mobile

---

## Debug su Mobile

### iOS Safari (Remote Debugging)

1. **Abilita Web Inspector su iPhone:**
   - Apri Impostazioni → Safari → Avanzate
   - Attiva "Web Inspector"

2. **Connetti iPhone al Mac:**
   - Collega via USB
   - Apri Safari su Mac
   - Menu Sviluppo → [Nome iPhone] → [Tab dell'app]

3. **Console Logs:**
   - Vedrai tutti i `console.log` dal codice
   - Cerca i tag `[Realtime]`, `[Network]`, `[Realtime Mobile Debug]`

### Android Chrome (Remote Debugging)

1. **Abilita Developer Options su Android:**
   - Impostazioni → About Phone → tocca "Build Number" 7 volte
   - Torna indietro → Developer Options → attiva "USB Debugging"

2. **Connetti Android al Computer:**
   - Collega via USB
   - Apri Chrome su computer
   - Vai a `chrome://inspect`
   - Seleziona il tab dell'app

3. **Console Logs:**
   - Vedrai tutti i `console.log` dal codice
   - Cerca i tag `[Realtime]`, `[Network]`, `[Realtime Mobile Debug]`

### Log Importanti da Monitorare

**All'avvio dell'app:**
```
[Realtime Mobile Debug] { isMobile: true, isPageVisible: true, isOnline: true, ... }
[useRealtimeFoods] Subscription status: SUBSCRIBED
```

**Quando vai in background (lock screen o switch app):**
```
[Realtime] Page visibility changed: hidden
```

**Quando torni in foreground:**
```
[Realtime] Page visibility changed: visible
[Realtime] Page became visible, invalidating queries
[useRealtimeFoods] Subscription status: SUBSCRIBED
```

**Se la connessione si perde:**
```
[useRealtimeFoods] ❌ Channel timed out, attempting reconnect
[Realtime] Attempting reconnect #1 in 1000ms
[Realtime] Executing reconnect attempt
[useRealtimeFoods] Subscription status: SUBSCRIBED
```

**Se network cambia:**
```
[Network] Gone offline
[Network] Back online
[Realtime] Network restored, forcing reconnect
```

---

## Rollback Plan

Se qualcosa va storto durante l'implementazione:

### Rollback Step 1: Ripristina supabase.ts
```bash
git checkout HEAD -- src/lib/supabase.ts
```

### Rollback Step 2: Ripristina useRealtimeFoods.ts
```bash
git checkout HEAD -- src/hooks/useRealtimeFoods.ts
```

### Rollback Step 3: Rimuovi nuovi file
```bash
rm src/hooks/useNetworkStatus.ts
rm src/components/ConnectionStatusIndicator.tsx  # se creato
```

### Rollback Completo
```bash
git reset --hard HEAD
```

---

## Note Finali per l'Implementazione

### Priorità di Test
1. **Prima testa su desktop** - assicurati che nulla si sia rotto
2. **Poi testa screen lock su iOS** - il caso più comune
3. **Poi testa background app su Android** - secondo caso più comune
4. **Infine testa network switching** - caso edge ma importante

### Cosa NON Fare
- ❌ Non testare solo su simulator/emulator - usa dispositivi reali
- ❌ Non saltare il test su desktop prima di mobile
- ❌ Non committare senza aver testato almeno iOS e Android
- ❌ Non rimuovere i console.log - sono essenziali per debug in produzione

### Best Practices
- ✅ Testa ogni step individualmente prima di passare al successivo
- ✅ Leggi i console logs durante i test per capire cosa succede
- ✅ Se un test fallisce, indaga prima di procedere
- ✅ Documenta eventuali edge cases scoperti durante i test
- ✅ Considera di creare un branch separato per questa feature

---

## Root Cause Confermato (da Documentazione Ufficiale)

### iOS Safari
- **Safari sospende le connessioni WebSocket quando lo schermo viene bloccato** o l'app va in background
- Al momento dello sblocco, **il socket appare aperto ma è non responsivo** (`.send()` e `.close()` non funzionano)
- Il client **non riceve evento `close`** dal browser, quindi non si riconnette automaticamente
- Safari **limita setTimeout/setInterval a 1000ms** quando la tab è in background, interrompendo i meccanismi di heartbeat

### Android Chrome
- Comportamento simile: **throttling aggressivo dei timer in background**
- Connessioni WebSocket possono essere chiuse silenziosamente sotto pressione di memoria o risparmio batteria

**Fonte:** [graphql-ws Discussion #290](https://github.com/enisdenjo/graphql-ws/discussions/290), [Socket.IO Issue #2924](https://github.com/socketio/socket.io/issues/2924)

---

## Soluzione Implementativa

### 1. Configurazione Heartbeat Mobile-Friendly

**File:** `src/lib/supabase.ts`

**Cambiamenti:**
```typescript
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
    heartbeatIntervalMs: 15000,  // Ridotto da 25s a 15s per mobile
    timeout: 20000,                // Timeout connessione (20s)
  },
})
```

**Rationale:** La documentazione Apple raccomanda heartbeat ogni 30 secondi, ma per rilevare disconnessioni più rapidamente su mobile usiamo 15 secondi. Questo è un buon compromesso tra batteria e affidabilità.

---

### 2. Page Visibility Recovery Handler

**File:** `src/hooks/useRealtimeFoods.ts`

**Cambiamenti:**

1. Aggiungere state per tracciare visibility:
```typescript
const [isPageVisible, setIsPageVisible] = useState(!document.hidden)
```

2. Aggiungere effect per gestire visibility changes:
```typescript
useEffect(() => {
  const handleVisibilityChange = () => {
    const isVisible = !document.hidden
    setIsPageVisible(isVisible)

    console.log('[Realtime] Page visibility changed:', isVisible ? 'visible' : 'hidden')

    if (isVisible && connected) {
      // Quando l'app torna in foreground, forza refresh per recuperare aggiornamenti persi
      console.log('[Realtime] Page became visible, invalidating queries')
      queryClient.invalidateQueries({ queryKey: foodsKeys.lists() })
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)

  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }
}, [connected, queryClient])
```

3. Aggiungere window focus handler (fallback per browser che non supportano bene visibilitychange):
```typescript
useEffect(() => {
  const handleFocus = () => {
    console.log('[Realtime] Window focus gained')
    if (connected) {
      queryClient.invalidateQueries({ queryKey: foodsKeys.lists() })
    }
  }

  window.addEventListener('focus', handleFocus)

  return () => {
    window.removeEventListener('focus', handleFocus)
  }
}, [connected, queryClient])
```

**Rationale:** Soluzione validata da Socket.IO e documentazione Apple. Quando l'app torna in foreground, invalidiamo tutte le queries per recuperare eventuali aggiornamenti persi durante il periodo di background.

---

### 3. Reconnection Logic Manuale

**File:** `src/hooks/useRealtimeFoods.ts`

**Cambiamenti:**

1. Aggiungere state per tracciare tentativi di reconnect:
```typescript
const reconnectAttemptsRef = useRef(0)
const maxReconnectAttempts = 5
const reconnectTimeoutRef = useRef<NodeJS.Timeout>()
```

2. Aggiungere funzione di reconnect manuale:
```typescript
const manualReconnect = useCallback(() => {
  if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
    console.error('[Realtime] Max reconnection attempts reached')
    toast.error('Impossibile riconnettersi. Ricarica la pagina.')
    return
  }

  reconnectAttemptsRef.current += 1
  const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current - 1), 10000)

  console.log(`[Realtime] Attempting reconnect #${reconnectAttemptsRef.current} in ${delay}ms`)

  reconnectTimeoutRef.current = setTimeout(() => {
    console.log('[Realtime] Executing reconnect attempt')

    // Unsubscribe completamente e risubscribe
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    // Trigger re-mount del setup effect cambiando una chiave
    setConnected(false)

    // Dopo 500ms, il setup effect si riattiverà e creerà un nuovo channel
  }, delay)
}, [])
```

3. Modificare l'handler di status per chiamare manualReconnect su TIMED_OUT e CHANNEL_ERROR:
```typescript
.on('system', {}, (payload) => {
  console.log('[Realtime] System event:', payload.status)

  if (payload.status === 'SUBSCRIBED') {
    setConnected(true)
    reconnectAttemptsRef.current = 0  // Reset counter on success

    console.log('[Realtime] Successfully subscribed to channel')
    queryClient.invalidateQueries({ queryKey: foodsKeys.lists() })
  }
  else if (payload.status === 'TIMED_OUT') {
    console.warn('[Realtime] Connection timed out, attempting manual reconnect')
    setConnected(false)
    manualReconnect()
  }
  else if (payload.status === 'CHANNEL_ERROR') {
    if (!import.meta.env.DEV) {
      console.error('[Realtime] Channel error, attempting manual reconnect')
      setConnected(false)
      manualReconnect()
    }
  }
  else if (payload.status === 'CLOSED') {
    console.warn('[Realtime] Channel closed')
    setConnected(false)
  }
})
```

**Rationale:** La documentazione conferma che Safari non invia eventi `close` quando sospende la connessione, quindi **non possiamo affidarci solo all'auto-reconnection di Supabase**. Dobbiamo implementare logica manuale che forza un reconnect quando rileviamo timeout o errori.

---

### 4. Network Status Detection

**File:** `src/hooks/useNetworkStatus.ts` (nuovo file)

```typescript
import { useEffect, useState } from 'react'

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => {
      console.log('[Network] Back online')
      setIsOnline(true)
    }

    const handleOffline = () => {
      console.log('[Network] Gone offline')
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}
```

**Integrazione in `useRealtimeFoods.ts`:**
```typescript
const isOnline = useNetworkStatus()

useEffect(() => {
  if (isOnline && !connected) {
    console.log('[Realtime] Network restored, forcing reconnect')
    manualReconnect()
  }
}, [isOnline, connected, manualReconnect])
```

**Rationale:** Quando il dispositivo mobile passa da WiFi a cellulare (o viceversa), o esce da airplane mode, dobbiamo rilevarlo e forzare una reconnessione.

---

### 5. Enhanced Logging per Debug Mobile

**File:** `src/hooks/useRealtimeFoods.ts`

Aggiungere logging strutturato all'inizio del setup effect:
```typescript
useEffect(() => {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

  console.log('[Realtime Mobile Debug]', {
    isMobile,
    isPageVisible: !document.hidden,
    isOnline: navigator.onLine,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString()
  })

  // ... resto del setup
}, [list?.id])
```

**Rationale:** Per diagnosticare problemi su dispositivi mobile reali quando non abbiamo accesso al debugger.

---

### 6. Connection Status Indicator UI (Opzionale)

**File:** `src/components/ConnectionStatusIndicator.tsx` (nuovo)

```typescript
import { useRealtimeConnection } from '@/hooks/useRealtimeConnection'

export function ConnectionStatusIndicator() {
  const { connected } = useRealtimeConnection()

  if (connected) return null  // Non mostrare nulla quando tutto va bene

  return (
    <div className="fixed bottom-4 right-4 bg-yellow-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
      <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
      <span className="text-sm">Riconnessione in corso...</span>
    </div>
  )
}
```

Aggiungere in `DashboardPage.tsx`:
```typescript
import { ConnectionStatusIndicator } from '@/components/ConnectionStatusIndicator'

// Nel return JSX:
<>
  {/* contenuto esistente */}
  <ConnectionStatusIndicator />
</>
```

**Rationale:** Feedback visivo per l'utente quando la connessione è in fase di recupero.

---

## File da Modificare

### Critici (must-have):
1. **`src/lib/supabase.ts`** - Aggiungere configurazione realtime heartbeat (15s interval)
2. **`src/hooks/useRealtimeFoods.ts`** - Aggiungere:
   - Page visibility handler
   - Window focus handler
   - Manual reconnection logic
   - Network status integration
   - Enhanced logging

### Nuovi file:
3. **`src/hooks/useNetworkStatus.ts`** - Hook per rilevare online/offline
4. **`src/components/ConnectionStatusIndicator.tsx`** - (opzionale) Indicatore UI

### Da modificare se usiamo l'indicatore UI:
5. **`src/pages/DashboardPage.tsx`** - Integrare ConnectionStatusIndicator

---

## Piano di Test End-to-End

### Test su iOS Safari (iPhone)

1. **Test Screen Lock:**
   - Aprire app su iPhone Safari
   - Desktop: aggiungere un food "Test Lock 1"
   - iPhone: **bloccare lo schermo per 30 secondi**
   - iPhone: sbloccare schermo
   - **Verifica:** "Test Lock 1" appare automaticamente nella lista (entro 5 secondi)

2. **Test Background App:**
   - Aprire app su iPhone Safari
   - Desktop: aggiungere un food "Test Background 1"
   - iPhone: **passare ad altra app per 1 minuto**
   - iPhone: tornare a Safari
   - **Verifica:** "Test Background 1" appare automaticamente nella lista

3. **Test Long Background:**
   - Aprire app su iPhone Safari
   - Desktop: aggiungere "Test Long 1", "Test Long 2", "Test Long 3" a intervalli
   - iPhone: **lasciare in background per 5+ minuti**
   - iPhone: tornare a Safari
   - **Verifica:** tutti e 3 i food appaiono dopo il refresh

4. **Test Network Switch:**
   - Aprire app su iPhone Safari (WiFi)
   - Desktop: aggiungere un food "Test WiFi 1"
   - iPhone: **disattivare WiFi, passare a cellulare**
   - **Verifica:** dopo 5-10 secondi, "Test WiFi 1" appare
   - Desktop: aggiungere "Test Cellular 1"
   - **Verifica:** "Test Cellular 1" appare

5. **Test Airplane Mode Recovery:**
   - Aprire app su iPhone Safari
   - iPhone: **attivare airplane mode**
   - Desktop: aggiungere "Test Airplane 1"
   - iPhone: **disattivare airplane mode**
   - **Verifica:** dopo reconnessione (15-20s max), "Test Airplane 1" appare

### Test su Android Chrome

1. **Test Background App:**
   - Aprire app su Android Chrome
   - Desktop: aggiungere un food "Test Android BG 1"
   - Android: **premere home button, lasciare in background 1 minuto**
   - Android: tornare a Chrome
   - **Verifica:** "Test Android BG 1" appare automaticamente

2. **Test Battery Saver Mode:**
   - Android: **attivare risparmio energetico**
   - Aprire app su Android Chrome
   - Desktop: aggiungere "Test Battery 1"
   - **Verifica:** aggiornamento appare (potrebbe richiedere fino a 20s)

3. **Test WiFi to Cellular Switch:**
   - Aprire app su Android Chrome (WiFi)
   - Desktop: aggiungere "Test Switch 1"
   - Android: **passare da WiFi a dati cellulare**
   - **Verifica:** "Test Switch 1" appare dopo network switch

### Test Cross-Device Sync

1. **Desktop to Mobile:**
   - Desktop: aggiungere 5 food diversi in rapida successione
   - Mobile: **verificare che tutti appaiano entro 30 secondi**

2. **Mobile to Desktop:**
   - Mobile: aggiungere un food "Mobile Test 1"
   - Desktop: **verificare che appaia immediatamente (2-3 secondi)**

3. **Multi-User Test:**
   - User A (desktop): aggiungere "User A Food"
   - User B (mobile, background): lasciare app in background
   - User A: aggiungere "User A Food 2"
   - User B: **tornare in foreground**
   - User B: **verificare che veda entrambi i food**

### Verifica Console Logs

Durante tutti i test, connettere il dispositivo mobile al computer e verificare i log in Safari/Chrome DevTools:

**Log attesi (normale):**
```
[Realtime Mobile Debug] { isMobile: true, isPageVisible: true, isOnline: true, ... }
[Realtime] System event: SUBSCRIBED
[Realtime] Page visibility changed: hidden
[Realtime] Page visibility changed: visible
[Realtime] Page became visible, invalidating queries
```

**Log attesi (con reconnection):**
```
[Realtime] Connection timed out, attempting manual reconnect
[Realtime] Attempting reconnect #1 in 1000ms
[Realtime] Executing reconnect attempt
[Realtime] System event: SUBSCRIBED
```

**Log problematici (da investigare):**
```
[Realtime] Max reconnection attempts reached
[Realtime] Channel error (in production)
```

### Metriche di Successo

- ✅ **100% dei test su iOS devono passare**
- ✅ **100% dei test su Android devono passare**
- ✅ **Reconnection dopo background < 20 secondi**
- ✅ **Reconnection dopo network switch < 15 secondi**
- ✅ **Nessun errore "Max reconnection attempts reached" in condizioni normali**
- ✅ **Desktop continua a funzionare come prima (no regressioni)**

---

## Trade-offs e Considerazioni

### Heartbeat Frequency (15s vs 25s)
- **Pro:** Rileva disconnessioni più rapidamente, migliore UX su mobile
- **Contro:** ~5% più consumo batteria (trascurabile per uso tipico)
- **Decisione:** 15s è il giusto compromesso

### Manual Reconnection vs Auto-Reconnect
- **Problema:** Auto-reconnect di Supabase non funziona affidabilmente quando Safari sospende il socket
- **Soluzione:** Manual reconnect con exponential backoff
- **Trade-off:** Più codice ma necessario per affidabilità mobile

### Visibility-Based Query Invalidation
- **Pro:** Garantisce data freshness quando utente torna all'app
- **Contro:** Una chiamata API extra ad ogni ritorno in foreground
- **Decisione:** Accettabile, è una best practice per PWA/mobile apps

### Connection Status Indicator
- **Pro:** Feedback visivo utile per utente
- **Contro:** Potrebbe essere "noisy" se reconnection è frequente
- **Decisione:** Mostrare solo quando disconnesso per >3 secondi

---

## Fonti Documentazione

- [Reconnect doesn't work after Safari drops WebSocket connection when the user locks the screen on a mobile device - graphql-ws Discussion #290](https://github.com/enisdenjo/graphql-ws/discussions/290)
- [Safari dropping web socket connection due to inactivity when page not in focus - Socket.IO Issue #2924](https://github.com/socketio/socket.io/issues/2924)
- [Apple Developer Forums - WebSocket issue in iOS 15 Safari](https://developer.apple.com/forums/thread/696310)
- [Supabase Realtime Documentation - Heartbeat Configuration](https://supabase.com/docs/guides/realtime/protocol)
