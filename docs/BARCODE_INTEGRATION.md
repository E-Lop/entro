# Barcode Integration Guide

## 📷 Overview

La scansione barcode è una killer feature che rende l'inserimento alimenti 10x più veloce. Questa guida copre l'integrazione completa con Open Food Facts per il mercato italiano.

## 🎯 Obiettivi

- ✅ Scansione barcode EAN-13 (standard italiano)
- ✅ Compatibilità iOS e Android
- ✅ Pre-compilazione automatica dati prodotto
- ✅ Fallback graceful per prodotti non trovati
- ✅ Database locale che impara nel tempo

## 🛠️ Stack Tecnologico

### Libreria Scansione

**html5-qrcode** (Consigliata)
```bash
npm install html5-qrcode
```

**Pro**:
- ✅ Zero configurazione per iOS/Android
- ✅ Supporto EAN-13, UPC-A, Code 128, QR
- ✅ API semplice e moderna
- ✅ TypeScript support
- ✅ Attivamente mantenuta

**Alternative considerare**:
- `@ericblade/quagga2`: Più veloce ma setup complesso
- `@zxing/browser`: Ottima per multi-formato

### Database Prodotti

**Open Food Facts API** (GRATUITA)
```typescript
const OPEN_FOOD_FACTS_API = 'https://world.openfoodfacts.org/api/v2'
```

**Pro**:
- ✅ Completamente gratuita
- ✅ Nessuna API key richiesta
- ✅ ~400k prodotti italiani
- ✅ Database collaborativo
- ✅ Include immagini, categorie, nutriscore

**Contro**:
- ⚠️ Qualità dati variabile (crowd-sourced)
- ⚠️ Non tutti i prodotti presenti
- ⚠️ NON include date di scadenza (impossibile)

## 🏗️ Architettura

```
┌─────────────────────────────────────────────┐
│         User taps "Scan Barcode"            │
└───────────────────┬─────────────────────────┘
                    │
                    ↓
┌─────────────────────────────────────────────┐
│      Request Camera Permission              │
│      (MediaDevices API)                     │
└───────────────────┬─────────────────────────┘
                    │
                    ↓
┌─────────────────────────────────────────────┐
│     Initialize html5-qrcode Scanner         │
│     (Continuous frame analysis)             │
└───────────────────┬─────────────────────────┘
                    │
                    ↓ Barcode Detected
┌─────────────────────────────────────────────┐
│         Stop Scanner & Extract Code         │
└───────────────────┬─────────────────────────┘
                    │
         ┌──────────┴──────────┐
         │                     │
         ↓                     ↓
┌──────────────────┐   ┌─────────────────────┐
│  Query Open      │   │  Check Local DB     │
│  Food Facts      │   │  (User's templates) │
└────────┬─────────┘   └──────────┬──────────┘
         │                        │
         └───────────┬────────────┘
                     │
                     ↓
         ┌───────────────────────┐
         │   Product Found?      │
         └───────────────────────┘
                     │
            ┌────────┴────────┐
            │                 │
          YES                NO
            │                 │
            ↓                 ↓
   ┌─────────────────┐  ┌──────────────────┐
   │  Pre-fill Form  │  │  Manual Entry    │
   │  - Name         │  │  + Save Barcode  │
   │  - Category     │  │    for Future    │
   │  - Image        │  └──────────────────┘
   │  - Storage Hint │
   └─────────────────┘
            │
            ↓
   ┌─────────────────┐
   │  User Confirms  │
   │  Expiry Date    │
   └─────────────────┘
```

## 💻 Implementation

### 1. Hook: useBarcodeScanner

```typescript
// hooks/useBarcodeScanner.ts
import { Html5Qrcode } from 'html5-qrcode'
import { useState, useEffect, useCallback } from 'react'

interface BarcodeScannerConfig {
  fps?: number
  qrbox?: number
  aspectRatio?: number
}

export function useBarcodeScanner(config?: BarcodeScannerConfig) {
  const [scanner, setScanner] = useState<Html5Qrcode | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Detect platform
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
  
  const requestPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      })
      
      // Stop immediately, just checking permission
      stream.getTracks().forEach(track => track.stop())
      setHasPermission(true)
      setError(null)
      return true
    } catch (err) {
      console.error('Camera permission denied:', err)
      setHasPermission(false)
      setError('Permesso fotocamera negato')
      return false
    }
  }, [])

  const startScanning = useCallback(async (
    onSuccess: (barcode: string) => void,
    onError?: (error: string) => void
  ) => {
    if (!hasPermission) {
      const granted = await requestPermission()
      if (!granted) {
        onError?.('Permesso fotocamera necessario')
        return
      }
    }

    try {
      const html5QrCode = new Html5Qrcode('barcode-reader')
      
      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: config?.fps || (isIOS ? 10 : 15),
          qrbox: config?.qrbox || (isIOS ? 200 : 250),
          aspectRatio: config?.aspectRatio || 1.0,
        },
        (decodedText, decodedResult) => {
          console.log('Barcode detected:', decodedText)
          onSuccess(decodedText)
          stopScanning()
        },
        (errorMessage) => {
          // Silent fail during continuous scanning
          // Only log if it's not just "NotFoundException"
          if (!errorMessage.includes('NotFoundException')) {
            console.warn('Scan error:', errorMessage)
          }
        }
      )
      
      setScanner(html5QrCode)
      setIsScanning(true)
      setError(null)
    } catch (err) {
      console.error('Error starting scanner:', err)
      setError('Impossibile avviare la fotocamera')
      onError?.('Impossibile avviare la fotocamera')
    }
  }, [hasPermission, isIOS, config, requestPermission])

  const stopScanning = useCallback(async () => {
    if (scanner) {
      try {
        await scanner.stop()
        scanner.clear()
      } catch (err) {
        console.error('Error stopping scanner:', err)
      }
      setScanner(null)
      setIsScanning(false)
    }
  }, [scanner])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanning()
    }
  }, [stopScanning])

  return {
    startScanning,
    stopScanning,
    requestPermission,
    isScanning,
    hasPermission,
    error,
    isIOS
  }
}
```

### 2. Service: Open Food Facts Client

```typescript
// lib/openFoodFacts.ts
interface OpenFoodFactsProduct {
  code: string
  product_name: string
  product_name_it?: string
  brands?: string
  categories_tags?: string[]
  image_url?: string
  image_small_url?: string
  nutriments?: Record<string, number>
  nutriscore_grade?: string
}

interface OpenFoodFactsResponse {
  status: 0 | 1
  product?: OpenFoodFactsProduct
}

export class OpenFoodFactsClient {
  private baseURL = 'https://world.openfoodfacts.org/api/v2'
  
  async getProductByBarcode(barcode: string): Promise<OpenFoodFactsProduct | null> {
    try {
      const response = await fetch(`${this.baseURL}/product/${barcode}.json`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data: OpenFoodFactsResponse = await response.json()
      
      if (data.status === 1 && data.product) {
        return data.product
      }
      
      return null
    } catch (error) {
      console.error('Error fetching product:', error)
      throw error
    }
  }
  
  async searchProducts(query: string, page = 1): Promise<OpenFoodFactsProduct[]> {
    try {
      const response = await fetch(
        `${this.baseURL}/search?search_terms=${encodeURIComponent(query)}&page=${page}&json=true`
      )
      
      const data = await response.json()
      return data.products || []
    } catch (error) {
      console.error('Error searching products:', error)
      return []
    }
  }
}

export const openFoodFacts = new OpenFoodFactsClient()
```

### 3. Category Mapping Service

```typescript
// lib/category-mapping.ts

export const CATEGORY_KEYWORDS = {
  dairy: ['latte', 'yogurt', 'formaggio', 'burro', 'panna', 'ricotta', 'mascarpone'],
  meat: ['carne', 'pollo', 'manzo', 'maiale', 'salame', 'prosciutto', 'salsiccia'],
  fish: ['pesce', 'tonno', 'salmone', 'merluzzo', 'gambero', 'cozze', 'vongole'],
  fruits: ['frutta', 'mela', 'banana', 'arancia', 'pera', 'uva', 'fragola'],
  vegetables: ['verdura', 'insalata', 'pomodoro', 'carota', 'zucchina', 'melanzana'],
  bakery: ['pane', 'pasta', 'biscotti', 'fette', 'grissini', 'crackers'],
  beverages: ['acqua', 'succo', 'bevanda', 'bibita', 'tè', 'caffè'],
  frozen: ['surgelato', 'gelato', 'ghiacciolo'],
  condiments: ['olio', 'aceto', 'sale', 'pepe', 'sugo', 'salsa', 'maionese'],
} as const

export const CATEGORY_SHELF_LIFE = {
  dairy: { days: 7, storage: 'fridge' as const },
  meat: { days: 3, storage: 'fridge' as const },
  fish: { days: 2, storage: 'fridge' as const },
  fruits: { days: 5, storage: 'fridge' as const },
  vegetables: { days: 7, storage: 'fridge' as const },
  bakery: { days: 3, storage: 'pantry' as const },
  beverages: { days: 180, storage: 'pantry' as const },
  frozen: { days: 90, storage: 'freezer' as const },
  condiments: { days: 365, storage: 'pantry' as const },
} as const

export function inferCategory(productCategories: string[]): string {
  const categoriesText = productCategories.join(' ').toLowerCase()
  
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => categoriesText.includes(kw))) {
      return category
    }
  }
  
  return 'other'
}

export function getCategoryDefaults(category: string) {
  return CATEGORY_SHELF_LIFE[category as keyof typeof CATEGORY_SHELF_LIFE] || {
    days: 7,
    storage: 'pantry' as const
  }
}

export function mapOpenFoodFactsToFood(product: OpenFoodFactsProduct) {
  const categories = product.categories_tags || []
  const category = inferCategory(categories)
  const defaults = getCategoryDefaults(category)
  
  return {
    name: product.product_name_it || product.product_name,
    brand: product.brands,
    category,
    image: product.image_url,
    suggestedStorage: defaults.storage,
    suggestedExpiryDays: defaults.days,
    barcode: product.code,
  }
}
```

### 4. Component: Barcode Scanner Modal

```typescript
// components/barcode/BarcodeScannerModal.tsx
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner'
import { openFoodFacts } from '@/lib/openFoodFacts'
import { mapOpenFoodFactsToFood } from '@/lib/category-mapping'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Camera, AlertCircle, Loader2 } from 'lucide-react'

interface BarcodeScannerModalProps {
  isOpen: boolean
  onClose: () => void
  onProductFound: (productData: any) => void
}

export function BarcodeScannerModal({
  isOpen,
  onClose,
  onProductFound
}: BarcodeScannerModalProps) {
  const [loading, setLoading] = useState(false)
  const {
    startScanning,
    stopScanning,
    requestPermission,
    isScanning,
    hasPermission,
    error,
    isIOS
  } = useBarcodeScanner()

  useEffect(() => {
    if (isOpen && hasPermission === null) {
      requestPermission()
    }
  }, [isOpen, hasPermission, requestPermission])

  const handleScan = async (barcode: string) => {
    setLoading(true)
    
    try {
      // 1. Query Open Food Facts
      const product = await openFoodFacts.getProductByBarcode(barcode)
      
      if (product) {
        // 2. Map to our food structure
        const foodData = mapOpenFoodFactsToFood(product)
        
        // 3. Pre-fill form
        onProductFound(foodData)
        onClose()
      } else {
        // Product not found - allow manual entry but save barcode
        toast.info('Prodotto non trovato. Inserisci i dati manualmente.')
        onProductFound({ barcode })
        onClose()
      }
    } catch (error) {
      console.error('Error processing barcode:', error)
      toast.error('Errore nel recupero dati prodotto')
    } finally {
      setLoading(false)
    }
  }

  const handleStartScan = () => {
    startScanning(handleScan, (error) => {
      toast.error(error)
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Scansiona Codice a Barre</DialogTitle>
        </DialogHeader>
        
        {hasPermission === null && (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="ml-3">Controllo permessi fotocamera...</p>
          </div>
        )}
        
        {hasPermission === false && (
          <PermissionDeniedMessage isIOS={isIOS} />
        )}
        
        {hasPermission === true && !isScanning && (
          <div className="space-y-4">
            <div className="flex items-center justify-center p-8">
              <Camera className="h-16 w-16 text-gray-400" />
            </div>
            <Button 
              onClick={handleStartScan}
              className="w-full"
              size="lg"
            >
              <Camera className="mr-2 h-5 w-5" />
              Avvia Scansione
            </Button>
          </div>
        )}
        
        {isScanning && (
          <div className="space-y-4">
            <div 
              id="barcode-reader" 
              className="w-full rounded-lg overflow-hidden"
              style={{ minHeight: isIOS ? '400px' : '300px' }}
            />
            
            <div className="text-center text-sm text-gray-600">
              {isIOS 
                ? "Inquadra il codice a barre nella cornice"
                : "Avvicina il barcode alla fotocamera"
              }
            </div>
            
            {loading && (
              <div className="flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                <span>Recupero dati prodotto...</span>
              </div>
            )}
            
            <Button 
              onClick={() => {
                stopScanning()
                onClose()
              }}
              variant="outline"
              className="w-full"
            >
              Annulla
            </Button>
          </div>
        )}
        
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </DialogContent>
    </Dialog>
  )
}

function PermissionDeniedMessage({ isIOS }: { isIOS: boolean }) {
  return (
    <Alert>
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className="space-y-3">
        <p className="font-medium">
          Permesso fotocamera necessario
        </p>
        <p className="text-sm">
          Per scansionare i barcode, abilita l'accesso alla fotocamera.
        </p>
        
        {isIOS ? (
          <div className="text-sm space-y-2">
            <p className="font-medium">Su iPhone:</p>
            <ol className="list-decimal ml-5 space-y-1">
              <li>Vai in Impostazioni</li>
              <li>Scorri fino a Safari</li>
              <li>Tocca "Fotocamera"</li>
              <li>Seleziona "Chiedi" o "Consenti"</li>
            </ol>
            <p className="text-xs text-gray-500 mt-2">
              Poi ricarica questa pagina
            </p>
          </div>
        ) : (
          <div className="text-sm space-y-2">
            <p className="font-medium">Su Android:</p>
            <ol className="list-decimal ml-5 space-y-1">
              <li>Tocca l'icona del lucchetto nella barra indirizzi</li>
              <li>Tocca "Autorizzazioni"</li>
              <li>Abilita "Fotocamera"</li>
            </ol>
          </div>
        )}
      </AlertDescription>
    </Alert>
  )
}
```

### 5. Integration nel Food Form

```typescript
// components/foods/FoodForm.tsx
export function FoodForm({ initialData, onSubmit }: FoodFormProps) {
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false)
  const [formData, setFormData] = useState(initialData || {})

  const handleProductFound = (productData: any) => {
    // Pre-fill form with product data
    setFormData({
      ...formData,
      name: productData.name || '',
      category_id: productData.category || '',
      storage_location: productData.suggestedStorage || 'pantry',
      image_url: productData.image || null,
      barcode: productData.barcode || null,
      // User still needs to enter expiry date
      expiry_date: addDays(new Date(), productData.suggestedExpiryDays || 7)
    })
    
    toast.success('Prodotto riconosciuto! Conferma i dati.')
  }

  return (
    <>
      <form onSubmit={handleSubmit}>
        {/* Barcode scan button */}
        <Button
          type="button"
          onClick={() => setShowBarcodeScanner(true)}
          variant="outline"
          className="w-full mb-4"
        >
          <Camera className="mr-2 h-4 w-4" />
          Scansiona Codice a Barre
        </Button>

        {/* Rest of form fields... */}
        <Input
          name="name"
          label="Nome Alimento"
          value={formData.name}
          onChange={handleChange}
          required
        />
        
        {/* ... other fields */}
      </form>

      <BarcodeScannerModal
        isOpen={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onProductFound={handleProductFound}
      />
    </>
  )
}
```

## 📱 Platform Compatibility

### iOS (Safari)
✅ Funziona perfettamente con iOS 11+
✅ Richiede HTTPS (o localhost per dev)
⚠️ FPS ottimale: 10 (performance)
⚠️ Torch/flash limitato (iOS 15+, sperimentale)

### Android (Chrome, Firefox, Samsung Internet)
✅ Funziona su Android 5+
✅ Supporto completo barcode scanner
✅ FPS ottimale: 15
✅ Torch/flash supportato

### Supported Barcode Formats
- ✅ EAN-13 (standard Italia/Europa)
- ✅ EAN-8
- ✅ UPC-A (USA)
- ✅ UPC-E
- ✅ Code 128
- ✅ QR Code

## 🎯 Testing

### Test su Device Reali

```bash
# Development server with HTTPS
npm run dev -- --host --https

# Ottieni l'IP locale
ipconfig getifaddr en0  # macOS
# o
ip addr show  # Linux

# Accedi da mobile
https://192.168.1.x:5173
```

### Test Barcodes

Usa questi prodotti comuni per testare:
- **Latte**: 8000400160908
- **Pasta Barilla**: 8076809513890
- **Coca Cola**: 5449000000996
- **Nutella**: 8000500037560

## 🐛 Common Issues & Solutions

### Issue 1: Camera non si avvia
```typescript
// Solution: Check HTTPS
if (window.location.protocol !== 'https:' && 
    window.location.hostname !== 'localhost') {
  console.error('HTTPS required for camera access')
}
```

### Issue 2: Prodotto non trovato
```typescript
// Solution: Fallback a database locale
const product = await openFoodFacts.getProductByBarcode(barcode)
if (!product) {
  const localProduct = await getLocalProductTemplate(barcode)
  // Or allow manual entry
}
```

### Issue 3: Performance lenta
```typescript
// Solution: Reduce FPS
const config = {
  fps: isIOS ? 10 : 15,  // Lower FPS on iOS
  qrbox: 200  // Smaller scan area = faster
}
```

## 📊 Analytics

Track barcode usage:
```typescript
// When barcode detected
analytics.track('barcode_scanned', {
  barcode,
  productFound: !!product,
  source: 'manual_scan'
})

// When product auto-filled
analytics.track('product_autofilled', {
  category: product.category,
  hasImage: !!product.image
})
```

## 🚀 Future Enhancements

1. **OCR per Date**
   - Integrate Tesseract.js
   - Scan printed expiry dates
   - Auto-parse DD/MM/YYYY patterns

2. **Local Database**
   - Build user-contributed product DB
   - Machine learning per durate medie
   - Seasonal adjustments

3. **Bulk Scanning**
   - Scan multiple products in sequence
   - Quick review before saving

4. **Custom Barcodes**
   - Generate QR codes for bulk items
   - Print labels for storage containers

---

**Next**: Vedi [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) per lo schema database completo.
