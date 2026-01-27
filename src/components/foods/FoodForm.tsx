import { useEffect, useState, useRef, lazy, Suspense } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { foodFormSchema, type FoodFormData } from '@/lib/validations/food.schemas'
import { useCategories } from '@/hooks/useFoods'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form'
import { ImageUpload } from './ImageUpload'
import { fetchProductByBarcode, mapProductToFormData } from '@/lib/openfoodfacts'
import type { Food } from '@/lib/foods'
import { ScanLine, Loader2, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

// Lazy load BarcodeScanner (heavy: includes ZXing library)
const BarcodeScanner = lazy(() => import('../barcode/BarcodeScanner').then(m => ({ default: m.BarcodeScanner })))

interface FoodFormProps {
  mode: 'create' | 'edit'
  initialData?: Food
  onSubmit: (data: FoodFormData) => Promise<void>
  onCancel?: () => void
  isSubmitting?: boolean
}

/**
 * FoodForm Component - Form for creating and editing food items
 */
export function FoodForm({ mode, initialData, onSubmit, onCancel, isSubmitting = false }: FoodFormProps) {
  const { data: categories = [], isLoading: categoriesLoading } = useCategories()

  // Barcode scanner state
  const [scannerOpen, setScannerOpen] = useState(false)
  const [isLoadingProduct, setIsLoadingProduct] = useState(false)
  const [productError, setProductError] = useState<string | null>(null)

  // Conflict detection state
  const [hasRemoteUpdate, setHasRemoteUpdate] = useState(false)

  // Prevent double submit (additional protection beyond isSubmitting)
  const isSubmittingRef = useRef(false)

  // Setup form with validation
  const form = useForm<FoodFormData>({
    resolver: zodResolver(foodFormSchema),
    defaultValues: {
      name: '',
      category_id: '',
      expiry_date: '', // User must set expiry date manually
      storage_location: 'fridge',
      quantity: null,
      quantity_unit: null,
      notes: null,
      image_url: null,
    },
  })

  // Populate form with initial data for edit mode
  useEffect(() => {
    if (mode === 'edit' && initialData) {
      form.reset({
        name: initialData.name,
        category_id: initialData.category_id,
        expiry_date: format(new Date(initialData.expiry_date), 'yyyy-MM-dd'),
        storage_location: initialData.storage_location,
        quantity: initialData.quantity,
        quantity_unit: initialData.quantity_unit,
        notes: initialData.notes,
        image_url: initialData.image_url,
      })
    }
  }, [mode, initialData, form])

  // Conflict detection: subscribe to this food's updates during edit
  useEffect(() => {
    if (mode !== 'edit' || !initialData?.id) {
      return
    }

    const foodId = initialData.id // Capture in closure
    let channel: RealtimeChannel | null = null
    let mounted = true

    async function setupConflictDetection() {
      try {
        // Create a unique channel for this specific food
        const channelName = `food-edit-${foodId}`

        // Remove any existing channel with this name
        const existingChannel = supabase.getChannels().find((ch) => ch.topic === channelName)
        if (existingChannel) {
          await existingChannel.unsubscribe()
          supabase.removeChannel(existingChannel)
        }

        channel = supabase.channel(channelName)

        channel
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'foods',
              filter: `id=eq.${foodId}`,
            },
            (payload) => {
              if (!mounted) return

              console.log('[FoodForm] Detected UPDATE event for food:', payload)

              // Check if this is a very recent update (likely from this form submission)
              // If commit_timestamp is within last 2 seconds, it's probably our own update
              const commitTime = new Date(payload.commit_timestamp).getTime()
              const now = Date.now()
              const ageMs = now - commitTime

              if (ageMs < 2000) {
                console.log('[FoodForm] Ignoring recent UPDATE (likely our own):', ageMs, 'ms old')
                return
              }

              console.log('[FoodForm] Remote update detected from another user')

              // Show warning toast
              setHasRemoteUpdate(true)
              toast.warning(
                'Questo alimento è stato modificato da un altro utente',
                {
                  duration: Infinity, // Keep until dismissed
                  action: {
                    label: 'Ricarica',
                    onClick: () => {
                      // Close dialog to force refetch
                      if (onCancel) {
                        onCancel()
                      }
                    },
                  },
                },
              )
            },
          )
          .subscribe((status) => {
            if (!mounted) return
            console.log('[FoodForm] Conflict detection channel status:', status)
          })
      } catch (err) {
        console.error('[FoodForm] Error setting up conflict detection:', err)
      }
    }

    setupConflictDetection()

    return () => {
      mounted = false
      if (channel) {
        channel.unsubscribe()
        supabase.removeChannel(channel)
      }
    }
  }, [mode, initialData?.id, onCancel])

  // Handle barcode scan success
  const handleBarcodeScanned = async (barcode: string) => {
    setIsLoadingProduct(true)
    setProductError(null)

    try {
      // Fetch product from Open Food Facts
      const { data: product, error } = await fetchProductByBarcode(barcode)

      if (error || !product) {
        setProductError(error?.message || 'Prodotto non trovato')
        setIsLoadingProduct(false) // MUST set false before return
        return
      }

      // Map product data to form format
      const mappedData = mapProductToFormData(product, categories)

      // Pre-fill form with product data
      form.setValue('name', mappedData.name)

      if (mappedData.category_id) {
        form.setValue('category_id', mappedData.category_id)
      }

      if (mappedData.storage_location) {
        form.setValue('storage_location', mappedData.storage_location)
      }

      // DO NOT auto-fill expiry date - user should set it manually
      // Shelf-life suggestions vary too much by product condition

      if (mappedData.quantity !== undefined) {
        form.setValue('quantity', mappedData.quantity)
      }

      if (mappedData.quantity_unit) {
        form.setValue('quantity_unit', mappedData.quantity_unit as 'pz' | 'kg' | 'g' | 'l' | 'ml' | 'confezioni')
      }

      if (mappedData.notes) {
        form.setValue('notes', mappedData.notes)
      }

      // Note: We don't auto-set image_url from OFF as it would require downloading
      // User can still upload their own image

      setIsLoadingProduct(false)
    } catch (err) {
      console.error('Error loading product:', err)
      setProductError('Errore durante il caricamento dei dati del prodotto')
      setIsLoadingProduct(false)
    }
  }

  const handleSubmit = async (data: FoodFormData) => {
    // Prevent double submit
    if (isSubmittingRef.current) {
      console.warn('Submit already in progress, ignoring duplicate submit')
      return
    }

    try {
      isSubmittingRef.current = true

      // Convert date to ISO string for database
      const submitData: FoodFormData = {
        ...data,
        expiry_date: new Date(data.expiry_date).toISOString(),
        // Convert empty strings to null
        quantity_unit: data.quantity_unit || null,
        notes: data.notes?.trim() || null,
      }

      await onSubmit(submitData)
    } finally {
      isSubmittingRef.current = false
    }
  }

  return (
    <>
      {/* Barcode Scanner Modal - Lazy loaded */}
      {scannerOpen && (
        <Suspense fallback={<div>Caricamento scanner...</div>}>
          <BarcodeScanner
            open={scannerOpen}
            onOpenChange={setScannerOpen}
            onScanSuccess={handleBarcodeScanned}
          />
        </Suspense>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          {/* Conflict Warning Banner */}
          {hasRemoteUpdate && (
            <div className="flex items-start gap-3 p-4 rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-800">
              <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-orange-900 dark:text-orange-200">
                  Alimento modificato remotamente
                </p>
                <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                  Questo alimento è stato modificato da un altro utente mentre lo stavi modificando.
                  Puoi continuare a modificarlo (last-write-wins) o ricaricare per vedere le ultime modifiche.
                </p>
              </div>
            </div>
          )}

          {/* Barcode Scanner Button - Only in create mode */}
          {mode === 'create' && (
            <div className="pb-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setScannerOpen(true)}
                disabled={isSubmitting || isLoadingProduct}
                className="w-full"
                aria-label="Apri scanner barcode per compilare automaticamente i dati"
              >
                {isLoadingProduct ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    Caricamento dati prodotto...
                  </>
                ) : (
                  <>
                    <ScanLine className="mr-2 h-4 w-4" aria-hidden="true" />
                    Scansiona Barcode
                  </>
                )}
              </Button>
              {productError && (
                <p className="text-sm text-destructive mt-2" role="alert">
                  {productError}
                </p>
              )}
            </div>
          )}

          {/* Name Field */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome *</FormLabel>
                <FormControl>
                  <Input
                    placeholder="es. Latte intero"
                    disabled={isSubmitting || isLoadingProduct}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

        {/* Category Field */}
        <FormField
          control={form.control}
          name="category_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Categoria *</FormLabel>
              <FormControl>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                  disabled={isSubmitting || categoriesLoading}
                  {...field}
                >
                  <option value="">Seleziona una categoria</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name_it}
                    </option>
                  ))}
                </select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Storage Location Field */}
        <FormField
          control={form.control}
          name="storage_location"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Posizione *</FormLabel>
              <FormControl>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                  disabled={isSubmitting}
                  {...field}
                >
                  <option value="fridge">Frigo</option>
                  <option value="freezer">Freezer</option>
                  <option value="pantry">Dispensa</option>
                </select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Expiry Date Field */}
        <FormField
          control={form.control}
          name="expiry_date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Data di scadenza *</FormLabel>
              <FormControl>
                <Input
                  type="date"
                  min={format(new Date(), 'yyyy-MM-dd')}
                  disabled={isSubmitting}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Quantity Fields */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quantità</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="1"
                    min="0"
                    step="0.01"
                    disabled={isSubmitting}
                    {...field}
                    value={field.value ?? ''}
                    onKeyDown={(e) => {
                      // Prevent minus sign and 'e' (scientific notation)
                      if (e.key === '-' || e.key === 'e' || e.key === 'E') {
                        e.preventDefault()
                      }
                    }}
                    onChange={(e) => {
                      const value = e.target.value
                      if (value === '') {
                        field.onChange(null)
                        return
                      }
                      const numValue = parseFloat(value)
                      // Prevent negative values from arrows or paste
                      if (!isNaN(numValue) && numValue >= 0) {
                        field.onChange(numValue)
                      } else if (numValue < 0) {
                        // Reset to 0 if negative
                        field.onChange(0)
                      }
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="quantity_unit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unità</FormLabel>
                <FormControl>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                    disabled={isSubmitting}
                    value={field.value || ''}
                    onChange={(e) => {
                      const value = e.target.value
                      field.onChange(value === '' ? null : value)
                    }}
                  >
                    <option value="">Nessuna</option>
                    <option value="pz">pz (pezzi)</option>
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="l">l (litri)</option>
                    <option value="ml">ml</option>
                    <option value="confezioni">confezioni</option>
                  </select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Image Upload Field */}
        <FormField
          control={form.control}
          name="image_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Immagine (opzionale)</FormLabel>
              <FormControl>
                <ImageUpload
                  value={field.value}
                  onChange={field.onChange}
                  disabled={isSubmitting}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Notes Field */}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Note</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Aggiungi eventuali note..."
                  disabled={isSubmitting}
                  rows={3}
                  {...field}
                  value={field.value ?? ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Form Actions */}
        <div className="flex gap-3 pt-4">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
              className="flex-1"
            >
              Annulla
            </Button>
          )}
          <Button
            type="submit"
            disabled={isSubmitting}
            className="flex-1"
          >
            {isSubmitting
              ? mode === 'create'
                ? 'Creazione in corso...'
                : 'Salvataggio in corso...'
              : mode === 'create'
              ? 'Aggiungi alimento'
              : 'Salva modifiche'}
          </Button>
        </div>
      </form>
    </Form>
    </>
  )
}
