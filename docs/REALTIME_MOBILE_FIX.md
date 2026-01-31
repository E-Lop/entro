# Piano: Fix Real-Time Updates su Mobile (Android/iOS)

## Problema
Gli aggiornamenti in tempo reale funzionano su desktop (2 browser diversi testati) ma **non funzionano** su smartphone Android e iPhone.

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

## Soluzione Implementata

### 1. Configurazione Heartbeat Mobile-Friendly

**File:** `src/lib/supabase.ts`

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

### 2. Network Status Hook

**File:** `src/hooks/useNetworkStatus.ts` (nuovo)

Hook per rilevare online/offline con Page Visibility API.

### 3. Mobile Recovery in useRealtimeFoods

**File:** `src/hooks/useRealtimeFoods.ts`

- `useRef` per `channelRef` e `reconnectTimeoutRef`
- `useNetworkStatus` hook
- `manualReconnect` con exponential backoff (max 5 tentativi)
- 3 useEffect per:
  - Page visibility change → invalidate queries
  - Window focus → invalidate queries (fallback)
  - Network status → force reconnect
- Subscribe status handler modificato per chiamare `manualReconnect` su TIMED_OUT e CHANNEL_ERROR
- Mobile debug logging

---

## Criteri di Accettazione

### Funzionalità Core
- [ ] Gli aggiornamenti real-time funzionano su iOS Safari (iPhone)
- [ ] Gli aggiornamenti real-time funzionano su Android Chrome
- [ ] Nessuna regressione su desktop (Chrome, Firefox, Safari)

### Test Screen Lock (iOS)
- [ ] Blocco schermo 30s → aggiornamenti ricevuti allo sblocco (entro 5s)
- [ ] Background app 1 min → aggiornamenti recuperati al ritorno
- [ ] Background app 5+ min → query invalidate e dati aggiornati

### Test Network Switch
- [ ] WiFi → Cellulare: reconnessione automatica (entro 15s)
- [ ] Airplane mode on/off: reconnessione automatica (entro 20s)

### Test Android
- [ ] Background 1 min → aggiornamenti recuperati
- [ ] Battery saver mode → aggiornamenti funzionano (entro 20s)

### Performance
- [ ] Reconnection dopo background < 20 secondi
- [ ] Reconnection dopo network switch < 15 secondi
- [ ] Nessun errore "Max reconnection attempts" in condizioni normali
- [ ] Max 5 tentativi di reconnessione con exponential backoff

### Logging
- [ ] Log `[Realtime Mobile Debug]` all'avvio con info device
- [ ] Log visibility change (visible/hidden)
- [ ] Log network status (online/offline)
- [ ] Log tentativi di reconnessione con numero e delay

---

## File Coinvolti

| File | Azione |
|------|--------|
| `src/lib/supabase.ts` | Modifica (heartbeat config) |
| `src/hooks/useRealtimeFoods.ts` | Modifica (recovery logic) |
| `src/hooks/useNetworkStatus.ts` | Nuovo |

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
```

### Rollback Completo
```bash
git reset --hard HEAD
```

---

## Fonti Documentazione

- [Reconnect doesn't work after Safari drops WebSocket connection when the user locks the screen on a mobile device - graphql-ws Discussion #290](https://github.com/enisdenjo/graphql-ws/discussions/290)
- [Safari dropping web socket connection due to inactivity when page not in focus - Socket.IO Issue #2924](https://github.com/socketio/socket.io/issues/2924)
- [Apple Developer Forums - WebSocket issue in iOS 15 Safari](https://developer.apple.com/forums/thread/696310)
- [Supabase Realtime Documentation - Heartbeat Configuration](https://supabase.com/docs/guides/realtime/protocol)
