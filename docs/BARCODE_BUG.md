# Barcode Scanner Bug - Analisi Completa

**Data**: 12 Gennaio 2026
**Progetto**: Entro (Food Expiry Tracker)
**Problema**: Loop infinito di callback dopo scansione barcode

---

## Contesto

Implementazione barcode scanner per app React+TypeScript che usa:
- Supabase per database
- Vite come bundler
- Deployment su Netlify
- Target: iOS Safari + Android Chrome (mobile web)
- API: Open Food Facts per dati prodotti

---

## Storia delle Implementazioni

### Tentativo 1: html5-qrcode Library
**Commit iniziale**: Implementazione con `html5-qrcode@2.3.8`

**Implementazione**:
```typescript
import { Html5Qrcode } from 'html5-qrcode'

const html5QrCode = new Html5Qrcode(elementId)
await html5QrCode.start(
  { facingMode: "environment" },
  config,
  onScanSuccess,
  onScanError
)
```

**Risultato**:
- ❌ **iPhone**: Schermata bianca dopo permesso camera
- ❌ **Android**: Schermata bianca dopo permesso camera
- Console error: `IndexSizeError: The index is not in the allowed range`

**Tentativi di fix**:
1. Cambio qrbox da fisso `{width: 250, height: 250}` a dinamico
2. Enforce minimo 50px (`Math.max(50, calculatedSize)`)
3. Fallback quando `listVideoInputDevices()` fallisce

**Outcome**: ❌ Problema irrisolvibile. Ricerca su GitHub issues mostra problemi noti non risolti su iOS Safari (#890, #974, #484)

**Decisione**: Switch a libreria diversa

---

### Tentativo 2: @zxing/browser Library
**Commit**: Switch da html5-qrcode a `@zxing/browser@0.1.5`

**Implementazione**:
```typescript
import { BrowserMultiFormatReader } from '@zxing/browser'

const reader = new BrowserMultiFormatReader()
await reader.decodeFromVideoDevice(
  selectedDeviceId,
  videoElement,
  (result, error) => {
    if (result) {
      const barcode = result.getText()
      onScanSuccess(barcode)
    }
  }
)
```

**Architettura**:
- Hook: `useBarcodeScanner.ts`
- Component: `BarcodeScanner.tsx` (modal con native `<video>`)
- Integration: `FoodForm.tsx`

**Risultato iniziale**:
- ✅ **Android**: Camera funziona, scan funziona
- ⚠️ **iPhone**: Camera funziona dopo fix fallback deviceId
- ❌ **Entrambi**: Loop infinito di callbacks

---

## Problemi Incontrati con ZXing

### Problema 1: Infinite Loading Loop
**Sintomo**: Button "Scansiona Barcode" alterna tra testo normale e spinner infinitamente

**Root Cause**: `isLoadingProduct` non resettato su early return in error case

**Fix**: src/components/foods/FoodForm.tsx:78-79
```typescript
if (error || !product) {
  setProductError(error?.message || 'Prodotto non trovato')
  setIsLoadingProduct(false) // AGGIUNTO
  return
}
```

**Outcome**: ✅ Risolto

---

### Problema 2: Unwanted Date Pre-fill
**Sintomo**: Campo data scadenza sempre precompilato con data odierna

**Root Cause**: `defaultValues.expiry_date: format(new Date(), 'yyyy-MM-dd')`

**Fix**: Cambiato a stringa vuota `expiry_date: ''`

**Outcome**: ✅ Risolto

---

### Problema 3: Scanner Continues After Scan
**Sintomo**: Scanner continua a scansionare dopo primo successo

**Tentativi di Fix**:
1. Aggiunto `hasScannedRef` flag per bloccare elaborazione multipla
2. Stop immediato video stream in callback
3. Rimosso delay 800ms prima di chiudere modal
4. Aggiunto `isClosingRef` guard contro restart

**Outcome**: ⚠️ Parzialmente migliorato ma problema persiste

---

### Problema 4: CALLBACK SPAM (CRITICO - ONGOING)

#### Sintomi
- Console mostra "Barcode scanned: XXX" 47+ volte dopo singola scansione
- Conteggio continua a crescere: 73, 81, 110+
- ❌ **CRITICO**: Continua ANCHE DOPO chiusura modal
- ❌ **CRITICO**: Continua ANCHE DOPO ritorno a dashboard
- Form fields lampeggiano continuamente
- Log "Starting ZXing scanner..." appare multiple volte

#### Tentativi di Fix

**Fix 1: Debounce basato su timestamp**
```typescript
const now = Date.now()
const timeSinceLastScan = now - lastScanTimeRef.current
if (timeSinceLastScan < 500 && lastScanTimeRef.current > 0) {
  return // Ignora callback duplicato
}
```
**Outcome**: ❌ FALLITO - Callback spam persiste

**Fix 2: Distruzione istanza reader**
```typescript
// Nel callback dopo primo scan:
readerRef.current = null  // Distrugge istanza
console.log('ZXing reader instance destroyed')
```
**Outcome**: ❌ FALLITO - Callback spam persiste

#### Console Logs dal Latest Test (12 Gen 2026, 14:33)

Immagine 1 (prima del scan):
```
Starting ZXing scanner...
Available cameras: -1
Using camera: - undefined
Starting ZXing scanner...
Available cameras: -1
Using camera: - undefined
```
→ Scanner si avvia più volte PRIMA ancora del scan!

Immagine 2 (dopo scan):
```
Barcode scanned: - "8003170026520"
ZXing reader instance destroyed
Barcode scanned: - "8003170026520"
ZXing reader instance destroyed
... (pattern si ripete molte volte)
```
→ Callback viene chiamato decine di volte ANCHE DOPO distruzione istanza!

---

## Analisi del Problema Attuale

### Osservazioni Chiave

1. **Scanner si avvia più volte**: "Starting ZXing scanner..." appare 2 volte anche PRIMA del scan
2. **Callback queue non stoppabile**: Distruggere `readerRef.current = null` NON ferma i callbacks già in queue
3. **Lifecycle issue**: Il problema suggerisce che:
   - O il componente si re-monta multiple volte
   - O `startScanning()` viene chiamato più volte
   - O ZXing ha una queue interna che non viene fermata

### Codice Attuale Problematico

`useBarcodeScanner.ts` linee 86-122:
```typescript
await reader.decodeFromVideoDevice(
  selectedDeviceId,
  videoElement,
  (result, error) => {
    if (result && !hasScannedRef.current) {
      hasScannedRef.current = true
      const barcode = result.getText()
      console.log('Barcode scanned:', barcode)

      // Distruzione istanza - NON FUNZIONA
      readerRef.current = null

      // Stop video stream
      // ... codice stop stream ...

      onScanSuccess?.(barcode)
    }
  }
)
```

### Possibili Root Causes

1. **ZXing's decodeFromVideoDevice() non ha modo di essere stoppato**
   - Non c'è un metodo `stop()` documentato
   - Il callback è asincrono e continua anche dopo distruzione istanza
   - La queue interna di frame processing continua

2. **React re-render triggers restart**
   - `useEffect` in BarcodeScanner.tsx potrebbe triggerare restart
   - Dependencies array potrebbe causare re-mount

3. **Video stream non fermato correttamente**
   - Tracks non vengono effettivamente stoppati
   - Browser continua a processare frames

---

## Cosa Funziona

✅ Accesso camera su iOS (con fallback undefined deviceId)
✅ Accesso camera su Android
✅ Riconoscimento barcode (ZXing legge correttamente EAN-13)
✅ Integrazione Open Food Facts API
✅ Pre-fill form con dati prodotto
✅ Category mapping OFF → categorie italiane
✅ Modal UI/UX design

---

## Cosa NON Funziona

❌ Stop callback dopo primo scan
❌ Prevent callback spam
❌ Cleanup dopo chiusura modal
❌ Prevent restart automatico scanner
❌ Destroy reader instance in modo efficace

---

## Impact

**Severity**: 🔴 CRITICAL BLOCKER

**User Experience**:
- Form fields continuano ad aggiornarsi dopo scan
- Performance degrada (100+ callbacks)
- Impossibile usare feature in produzione
- Potrebbero esserci memory leaks

**Business Impact**:
- Phase 2 del progetto bloccata
- Feature barcode scanner inutilizzabile
- Necessario trovare soluzione alternativa

---

## Ricerca Soluzioni (12 Gen 2026)

### Documentazione Ufficiale ZXing

**Fonte**: [GitHub zxing-js/browser](https://github.com/zxing-js/browser), [npm @zxing/browser](https://www.npmjs.com/package/@zxing/browser)

#### PROBLEMA PRINCIPALE IDENTIFICATO ❗
Il metodo `decodeFromVideoDevice()` **restituisce un oggetto `controls`** con metodo `stop()` che NON STAVAMO SALVANDO!

```typescript
// ❌ SBAGLIATO (nostro codice attuale)
await reader.decodeFromVideoDevice(deviceId, videoElement, callback)

// ✅ CORRETTO
const controls = await reader.decodeFromVideoDevice(deviceId, videoElement, callback)
// Poi chiamare: controls.stop()
```

#### Configurazione per Prevenire Callback Spam

```typescript
const codeReader = new BrowserMultiFormatReader(hints, {
  delayBetweenScanSuccess: 2000,  // Delay dopo scan riuscito (ms)
  delayBetweenScanAttempts: 600,  // Delay tra tentativi (ms)
});
```

#### Metodo Alternativo: decodeOnceFromVideoDevice

```typescript
// Stoppa AUTOMATICAMENTE dopo primo scan
await codeReader.decodeOnceFromVideoDevice(deviceId, videoElement)
  .then(result => {
    // Handle result
    // Scanner già stoppato automaticamente
  })
```

### Issue GitHub Rilevanti

**Issue #19**: [How correct stop video in react hook](https://github.com/zxing-js/browser/issues/19)

**Problema discusso**: Scanner continua dopo unmount componente

**Soluzioni proposte**:

1. **mountedRef Pattern** (per evitare callback dopo unmount):
```typescript
const mountedRef = useRef(true);

useEffect(() => {
  mountedRef.current = true;

  codeReader.decodeFromVideoDevice(undefined, video.current,
    (result, error, controls) => {
      if (!mountedRef.current) {
        controls.stop();
        return;
      }
      // handle result
    }
  );

  return () => {
    mountedRef.current = false;
  };
});
```

2. **Doppio stop per Safari compatibility**:
```typescript
// Stop video tracks + scanner controls
streamRef.current.getVideoTracks().forEach(track => track.stop());
qrScannerControls.current.stop();
```

**Issue #21**: [How to stop the reader and turn off the camera](https://github.com/zxing-js/browser/issues/21)

**Soluzione ufficiale**:
```typescript
// Salvare controls al return
this.controls = await codeReader.decodeFromVideoDevice(...)

// Fermare quando necessario
this.controls.stop()

// Per cleanup completo
BrowserCodeReader.releaseAllStreams()
BrowserCodeReader.cleanVideoSource(videoElement)
```

### Alternative Libraries (Valutazione)

**Fonte**: [Best barcode scanners 2025](https://dev.to/patty-1984/2025-the-best-barcode-scanners-for-your-app-30hk), [QuaggaJS](https://serratus.github.io/quaggaJS/)

1. **QuaggaJS** - Funziona su tutti browser moderni, incluso mobile
2. **STRICH SDK** - SDK commerciale per web app
3. **react-qr-barcode-scanner** - Wrapper React (v2.1.20)
4. **ML Kit** (via Capacitor) - Richiede native wrapper

**Conclusione alternatives**: ZXing rimane la scelta migliore SE usato correttamente

---

## Root Cause Identificato

### Il Vero Problema

**Non stavamo salvando né usando i `controls` restituiti da `decodeFromVideoDevice()`**

```typescript
// ❌ Il nostro codice in useBarcodeScanner.ts linea 86
await reader.decodeFromVideoDevice(
  selectedDeviceId,
  videoElement,
  (result, error) => { ... }  // ← Mai ricevuto/usato il parametro controls!
)
```

**Conseguenze**:
1. Impossibile chiamare `controls.stop()`
2. La callback queue di ZXing continua indefinitamente
3. Distruggere `readerRef.current = null` non ferma la queue già avviata
4. Video stream stop non ferma la processing queue di ZXing

### Perché Debounce Non Ha Funzionato

Il debounce blocca solo l'ELABORAZIONE dei callback, ma non ferma ZXing dal CONTINUARE A CHIAMARE la callback function. La queue interna continua a processare frames.

### Perché Distruzione Istanza Non Ha Funzionato

Impostare `readerRef.current = null` distrugge il nostro riferimento ma NON ferma il processo asincrono di ZXing già in esecuzione. I callback già in queue continuano.

---

## Prossimi Passi

1. ✅ Documentare problema (questo file)
2. ✅ Ricerca documentazione ufficiale ZXing
3. ✅ Ricerca issue simili su GitHub / Stack Overflow (2026)
4. ⏳ Implementare fix corretto:
   - Salvare `controls` da `decodeFromVideoDevice()`
   - Chiamare `controls.stop()` dopo primo scan
   - Aggiungere configurazione delays
   - Implementare mountedRef pattern
   - Cleanup con `BrowserCodeReader.releaseAllStreams()`
5. ⏳ Test su iOS e Android

---

## Files Coinvolti

- `src/hooks/useBarcodeScanner.ts` - Hook principale
- `src/components/barcode/BarcodeScanner.tsx` - Modal component
- `src/components/foods/FoodForm.tsx` - Integration point
- `src/lib/openfoodfacts.ts` - API client
- `src/types/openfoodfacts.types.ts` - Type definitions

---

## Commit History Rilevanti

1. Initial html5-qrcode implementation
2. Switch to @zxing/browser
3. `753632a` - Fix infinite loading loop
4. `b706b6d` - Remove date pre-fill
5. `2c2a596` - Add camera fallback for iOS
6. `8aa1a81` - Add 500ms debounce (FAILED)
7. `9e82dbd` - Destroy reader instance (FAILED)

---

## Piano di Soluzione

### Approccio 1: Fix Completo con controls.stop() (RACCOMANDATO)

**Complessità**: Media
**Affidabilità**: Alta
**Compatibilità**: iOS + Android

#### Changes Required in `useBarcodeScanner.ts`:

1. **Aggiungere controlsRef**:
```typescript
const controlsRef = useRef<IScannerControls | null>(null)
const mountedRef = useRef<boolean>(true)
```

2. **Salvare controls da decodeFromVideoDevice**:
```typescript
const controls = await reader.decodeFromVideoDevice(
  selectedDeviceId,
  videoElement,
  (result, error, controls) => {  // ← Ricevere controls qui
    if (!mountedRef.current) {
      controls.stop()
      return
    }

    if (result && !hasScannedRef.current) {
      hasScannedRef.current = true

      // STOP IMMEDIATELY
      controls.stop()

      // Then handle result
      const barcode = result.getText()
      // ... rest of logic
    }
  }
)

// Save controls reference for external stop
controlsRef.current = controls
```

3. **Configurare reader con delays**:
```typescript
readerRef.current = new BrowserMultiFormatReader(undefined, {
  delayBetweenScanSuccess: 2000,
  delayBetweenScanAttempts: 600,
})
```

4. **Cleanup completo in stopScanning**:
```typescript
const stopScanning = useCallback(async () => {
  try {
    // Stop scanner controls
    if (controlsRef.current) {
      controlsRef.current.stop()
      controlsRef.current = null
    }

    // Stop video stream
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach(track => track.stop())
      videoRef.current.srcObject = null
    }

    // Release all ZXing streams
    BrowserCodeReader.releaseAllStreams()

    // Clean video element
    if (videoRef.current) {
      BrowserCodeReader.cleanVideoSource(videoRef.current)
    }

    setState('idle')
  } catch (err) {
    console.error('Error stopping scanner:', err)
  }
}, [])
```

5. **Cleanup su unmount**:
```typescript
useEffect(() => {
  mountedRef.current = true

  return () => {
    mountedRef.current = false
    stopScanning()
  }
}, [stopScanning])
```

#### Vantaggi:
- ✅ Usa API ufficiale ZXing correttamente
- ✅ Controllo completo su quando fermare
- ✅ Delay configurabili per performance
- ✅ mountedRef previene callback dopo unmount
- ✅ Cleanup completo di tutte le risorse

#### Svantaggi:
- Richiede modifiche a più punti nel codice

---

### Approccio 2: Switch a decodeOnceFromVideoDevice (ALTERNATIVA SEMPLICE)

**Complessità**: Bassa
**Affidabilità**: Media
**Compatibilità**: iOS + Android

#### Changes Required:

Sostituire `decodeFromVideoDevice` con `decodeOnceFromVideoDevice`:

```typescript
try {
  const result = await reader.decodeOnceFromVideoDevice(
    selectedDeviceId,
    videoElement
  )

  if (result) {
    const barcode = result.getText()
    // Scanner già stoppato automaticamente
    setState('success')
    onScanSuccess?.(barcode)
  }
} catch (err) {
  if (err instanceof NotFoundException) {
    // Nessun barcode trovato, retry
    if (mountedRef.current) {
      // Recursive retry
    }
  } else {
    setState('error')
  }
}
```

#### Vantaggi:
- ✅ Molto più semplice
- ✅ Auto-stop dopo primo scan
- ✅ Meno codice da mantenere

#### Svantaggi:
- ❌ Meno controllo su scanning process
- ❌ Difficile implementare retry logic
- ❌ No real-time feedback durante scan

---

### Raccomandazione Finale

**APPROCCIO 1** è la soluzione corretta e completa.

**Motivi**:
1. Usa l'API come previsto dalla documentazione
2. Risolve il root cause (mancanza di controls.stop())
3. Fornisce controllo completo
4. Aggiunge configurazione delays per ottimizzare performance
5. Implementa best practices da GitHub issues #19 e #21

**Stima implementazione**: 30-45 minuti
**Risk level**: Basso (soluzione documentata e testata da community)

---

## Sources / References

- [ZXing Browser GitHub](https://github.com/zxing-js/browser)
- [ZXing Browser NPM](https://www.npmjs.com/package/@zxing/browser)
- [Issue #19: How to stop video in React hook](https://github.com/zxing-js/browser/issues/19)
- [Issue #21: How to stop the reader and turn off camera](https://github.com/zxing-js/browser/issues/21)
- [Best Barcode Scanners 2025](https://dev.to/patty-1984/2025-the-best-barcode-scanners-for-your-app-30hk)
- [QuaggaJS Documentation](https://serratus.github.io/quaggaJS/)

---

_Documento creato per analisi sistematica del bug prima di pianificare soluzione_
_Analisi completata: 12 Gennaio 2026_
