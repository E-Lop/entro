import { useEffect, useState, useRef, lazy, Suspense, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  foodFormSchema,
  storageLocationEnum,
  quantityUnitEnum,
  type FoodFormData,
} from '@/lib/validations/food.schemas'
import { useCategories } from '@/hooks/useFoods'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form'
import { ImageUpload } from './ImageUpload'
import { fetchProductByBarcode, mapProductToFormData } from '@/lib/openfoodfacts'
import { storageLocationForCategory } from '@/lib/foodDefaults'
import type { Food } from '@/lib/foods'
import { ScanLine, Loader2, AlertTriangle, ChevronDown, ChevronUp, ClipboardList, ImagePlus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { mutationTracker } from '@/lib/realtime'
import { logError } from '@/lib/safeLog'

// Lazy load BarcodeScanner (heavy: includes ZXing library)
const BarcodeScanner = lazy(() => import('../barcode/BarcodeScanner').then(m => ({ default: m.BarcodeScanner })))

const MAIN_SECTION_FIELDS = ['name', 'category_id', 'storage_location', 'expiry_date'] as const

/**
 * Get submit button text based on form mode and submission state
 */
function getSubmitButtonText(mode: 'create' | 'edit', isSubmitting: boolean): string {
  if (isSubmitting) {
    return mode === 'create' ? 'Creazione in corso...' : 'Salvataggio in corso...'
  }
  return mode === 'create' ? 'Aggiungi alimento' : 'Salva modifiche'
}

/**
 * CollapsibleSection — accordion panel that animates open/closed via
 * `grid-template-rows: 0fr → 1fr` (layout-safe: no animating of `height`).
 *
 * `hidden` (display:none) is applied only once the collapse transition ends, so
 * the panel animates out before it leaves the layout (dropping the form's
 * `space-y` gap) and the tab order / a11y tree. `inert` covers the brief window
 * while it is collapsing-but-still-visible. The `hidden` flag starts matching
 * `open`, so the first render is correct without a transition (jsdom, the test
 * environment, never fires `transitionend`).
 */
function CollapsibleSection({ id, open, children }: { id: string; open: boolean; children: ReactNode }) {
  const [hidden, setHidden] = useState(!open)

  useEffect(() => {
    if (open) setHidden(false) // reveal an opening section immediately
  }, [open])

  return (
    <div
      id={id}
      data-testid={id}
      inert={!open || undefined}
      onTransitionEnd={(e) => {
        if (e.propertyName === 'grid-template-rows' && !open) setHidden(true)
      }}
      className={cn(
        'grid transition-[grid-template-rows] duration-200 ease-[var(--ease-out-quart)] motion-reduce:transition-none',
        open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        hidden && 'hidden'
      )}
    >
      <div className="overflow-hidden">
        <div className="space-y-4">{children}</div>
      </div>
    </div>
  )
}

interface FoodFormProps {
  mode: 'create' | 'edit'
  initialData?: Food
  /**
   * Il secondo argomento è il **barcode**, che non è un campo del form: non lo
   * digita nessuno, arriva dallo scanner o dalla riga che si sta modificando.
   * Sta fuori da `FoodFormData` — e quindi fuori dallo schema Zod — perché lo
   * schema descrive ciò che l'utente compila e valida.
   */
  onSubmit: (data: FoodFormData, barcode: string | null) => Promise<void>
  onCancel?: () => void
  isSubmitting?: boolean
  /**
   * Riporta a chi monta il dialogo se ci sono modifiche non salvate.
   *
   * Il form non può difendersi da solo: le tre uscite — Esc, click fuori e la X
   * di `ui/dialog.tsx` — le governa il `Dialog`, che gli sta **sopra**. Quindi
   * il form dice cosa sa (`isDirty` di react-hook-form, che torna falso da sé
   * se l'utente rimette tutto com'era) e la decisione la prende chi può
   * fermare la chiusura. Vedi `useUnsavedChangesGuard`.
   */
  onDirtyChange?: (isDirty: boolean) => void
}

/**
 * FoodForm Component - Form for creating and editing food items
 */
export function FoodForm({ mode, initialData, onSubmit, onCancel, isSubmitting = false, onDirtyChange }: FoodFormProps) {
  const { data: categories = [], isLoading: categoriesLoading } = useCategories()

  // Accordion state: which section is open ('main' = food data, 'details' = optional extras)
  const [openSection, setOpenSection] = useState<'main' | 'details'>('main')

  // Barcode scanner state
  const [scannerOpen, setScannerOpen] = useState(false)
  const [isLoadingProduct, setIsLoadingProduct] = useState(false)
  const [productError, setProductError] = useState<string | null>(null)

  // Conflict detection state
  const [hasRemoteUpdate, setHasRemoteUpdate] = useState(false)

  // Prevent double submit (additional protection beyond isSubmitting)
  const isSubmittingRef = useRef(false)

  // Keep latest onCancel in a ref so the realtime subscription effect below does
  // not re-subscribe on every parent render (callers pass inline arrows).
  const onCancelRef = useRef(onCancel)
  useEffect(() => {
    onCancelRef.current = onCancel
  }, [onCancel])

  /**
   * Se l'utente ha toccato il selettore del luogo, almeno una volta.
   *
   * Non basta `dirtyFields.storage_location` di react-hook-form: quello dice
   * «il valore è diverso dal predefinito», e chi sceglie a mano proprio il
   * luogo che la categoria avrebbe proposto ha comunque deciso. Un ref e non
   * uno stato perché nessuna resa dipende da questo valore.
   */
  const storageTouchedRef = useRef(false)

  /**
   * L'ultimo barcode scansionato, o quello che la riga già portava in modifica.
   *
   * Fino al 7 set 2026 il codice si perdeva: lo scanner compilava i campi da
   * Open Food Facts e poi `useFoodFormDialog` scriveva `barcode: null` fisso,
   * quindi la colonna — che esiste e ha un indice — restava vuota per ogni
   * riga mai creata. In modifica si parte dal valore esistente, o salvare
   * senza riscansionare lo cancellerebbe.
   */
  const scannedBarcodeRef = useRef<string | null>(
    mode === 'edit' ? (initialData?.barcode ?? null) : null
  )

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

  /**
   * Riporta lo stato sporco a chi monta il dialogo.
   *
   * `formState.isDirty` va **letto** dentro il render perché react-hook-form
   * sottoscrive i campi di `formState` che qualcuno legge: leggerlo solo dentro
   * l'effetto lo lascerebbe fermo al valore iniziale (`Proxy` di
   * `formState`, documentato). Da qui la costante, che è la lettura.
   */
  const { isDirty } = form.formState

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  // Populate form with initial data for edit mode
  useEffect(() => {
    if (mode === 'edit' && initialData) {
      form.reset({
        name: initialData.name,
        category_id: initialData.category_id,
        expiry_date: format(new Date(initialData.expiry_date), 'yyyy-MM-dd'),
        // Narrow the DB text columns at runtime instead of casting blindly:
        // values are constrained by CHECK, so parse only fails on real corruption.
        storage_location: storageLocationEnum.parse(initialData.storage_location),
        quantity: initialData.quantity,
        quantity_unit: quantityUnitEnum.nullable().parse(initialData.quantity_unit),
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
            () => {
              if (!mounted) return

              // Skip if this was a local mutation
              if (mutationTracker.wasRecentlyMutated(foodId, 'UPDATE')) {
                return
              }

              // Remote update detected - show warning
              setHasRemoteUpdate(true)
              toast.warning(
                'Questo alimento è stato modificato da un altro utente',
                {
                  duration: Infinity, // Keep until dismissed
                  action: {
                    label: 'Ricarica',
                    onClick: () => {
                      // Close dialog to force refetch
                      onCancelRef.current?.()
                    },
                  },
                },
              )
            },
          )
          .subscribe(() => {
            // Channel subscribed for conflict detection
          })
      } catch (err) {
        logError('[FoodForm] Error setting up conflict detection:', err)
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
  }, [mode, initialData?.id])

  // Handle barcode scan success
  const handleBarcodeScanned = async (barcode: string) => {
    // Si registra **prima** della chiamata a Open Food Facts, e di proposito:
    // un prodotto sconosciuto al catalogo ha comunque un codice, e quel codice
    // è il dato che l'utente ha raccolto. Registrarlo solo in caso di successo
    // farebbe perdere proprio i casi in cui serve di più.
    scannedBarcodeRef.current = barcode
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
        form.setValue('quantity_unit', mappedData.quantity_unit)
      }

      if (mappedData.notes) {
        form.setValue('notes', mappedData.notes)
      }

      // Note: We don't auto-set image_url from OFF as it would require downloading
      // User can still upload their own image

      setIsLoadingProduct(false)
    } catch (err) {
      logError('Error loading product:', err)
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

      const submitData: FoodFormData = {
        ...data,
        // `expiry_date` si invia **così com'è**, `yyyy-MM-dd`, che è già il
        // formato del valore di un `<input type="date">` e quello della
        // colonna `date`. La conversione che stava qui — `new Date(x)
        // .toISOString()` — produceva un datetime ISO in UTC e non poteva che
        // perdere informazione.
        //
        // ⚠️ Misurato il 7 set 2026, perché entro#117 lo dava per rotto e non
        // lo era: `new Date('2026-09-04')` dà `2026-09-04T00:00:00.000Z` in
        // Europe/Rome, Pacific/Kiritimati e America/Los_Angeles — una stringa
        // di sola data è UTC **per specifica**, quindi il fuso del browser non
        // la sposta — e Postgres tronca il letterale senza convertirlo. Lo
        // slittamento di un giorno descritto nella issue **non avveniva**.
        // Resta corretto toglierla: qualunque `Date` o stringa con ora che
        // arrivasse qui domani slitterebbe davvero, e la conversione non dava
        // niente in cambio del rischio.
        expiry_date: data.expiry_date,
        // Convert empty strings to null
        quantity_unit: data.quantity_unit || null,
        notes: data.notes?.trim() || null,
      }

      await onSubmit(submitData, scannedBarcodeRef.current)
    } finally {
      isSubmittingRef.current = false
    }
  }

  return (
    <>
      {/* Barcode Scanner Modal - Lazy loaded */}
      {scannerOpen && (
        <Suspense
          fallback={
            <div
              className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground"
              role="status"
              aria-live="polite"
            >
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              Caricamento scanner...
            </div>
          }
        >
          <BarcodeScanner
            open={scannerOpen}
            onOpenChange={setScannerOpen}
            onScanSuccess={handleBarcodeScanned}
          />
        </Suspense>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit, (errors) => {
          // Auto-open main section if it contains fields with validation errors
          if (MAIN_SECTION_FIELDS.some(f => f in errors)) {
            setOpenSection('main')
          }
        })} className="space-y-4">
          {/* Conflict Warning Banner */}
          {hasRemoteUpdate && (
            <div className="flex items-start gap-3 p-4 rounded-lg border border-warning/30 bg-warning/10" role="alert">
              <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1">
                <p className="text-sm font-medium text-warning">
                  Alimento modificato remotamente
                </p>
                <p className="text-sm text-foreground/90 mt-1">
                  Questo alimento è stato modificato da un altro utente mentre lo stavi modificando.
                  Puoi continuare a modificarlo (last-write-wins) o ricaricare per vedere le ultime modifiche.
                </p>
              </div>
            </div>
          )}

          {/* === ACCORDION SECTION: Dati alimento === */}
          <button
            type="button"
            onClick={() => setOpenSection('main')}
            className={cn(
              'flex w-full items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md p-2 -mx-2',
              openSection !== 'main' && 'bg-muted/50'
            )}
            aria-expanded={openSection === 'main'}
            aria-controls="section-main"
          >
            <ClipboardList className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <span className="font-semibold text-sm text-foreground">Dati alimento</span>
            {openSection === 'main' ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground ml-auto" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto" aria-hidden="true" />
            )}
          </button>

          <CollapsibleSection id="section-main" open={openSection === 'main'}>
            {/* Barcode Scanner Button - Only in create mode */}
            {mode === 'create' && (
              <div className="pb-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setScannerOpen(true)}
                  disabled={isSubmitting || isLoadingProduct}
                  className="h-11 w-full bg-primary/10 dark:bg-primary/15"
                >
                  {isLoadingProduct ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
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
                      className="h-11"
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
                      className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                      disabled={isSubmitting || categoriesLoading}
                      {...field}
                      onChange={(e) => {
                        field.onChange(e)
                        // La categoria pre-compila il **luogo**, e non la data:
                        // vedi `foodDefaults.ts` per il perché.
                        const category = categories.find((c) => c.id === e.target.value)
                        // `default_storage` arriva come `string` dai tipi
                        // generati: si restringe a runtime, come già fa il
                        // `reset` in modifica. Qui però `safeParse` e non
                        // `parse`: una categoria corrotta in tabella non deve
                        // far esplodere il form mentre l'utente lo compila —
                        // al massimo resta senza suggerimento, che è il
                        // comportamento che c'era prima di questa modifica.
                        const parsed = category
                          ? storageLocationEnum.safeParse(category.default_storage)
                          : undefined
                        const next = storageLocationForCategory(parsed?.success ? { default_storage: parsed.data } : undefined, {
                          current: form.getValues('storage_location'),
                          touched: storageTouchedRef.current,
                          isCreate: mode === 'create',
                        })
                        if (next) form.setValue('storage_location', next)
                      }}
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
                      className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                      disabled={isSubmitting}
                      {...field}
                      onChange={(e) => {
                        storageTouchedRef.current = true
                        field.onChange(e)
                      }}
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
                      className="h-11"
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
                        className="h-11"
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
                        className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
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
          </CollapsibleSection>

          {/* === ACCORDION SECTION: Dettagli aggiuntivi === */}
          <button
            type="button"
            onClick={() => setOpenSection('details')}
            className={cn(
              'flex w-full items-center gap-2 text-left border-t pt-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md px-2 pb-2 -mx-2',
              openSection !== 'details' && 'bg-muted/50'
            )}
            aria-expanded={openSection === 'details'}
            aria-controls="section-details"
          >
            <ImagePlus className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <span className="font-semibold text-sm text-foreground">Dettagli aggiuntivi</span>
            <span className="text-xs text-muted-foreground">(foto, note)</span>
            {openSection === 'details' ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground ml-auto" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto" aria-hidden="true" />
            )}
          </button>

          <CollapsibleSection id="section-details" open={openSection === 'details'}>
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
          </CollapsibleSection>

          {/* Form Actions - Always visible outside accordion sections */}
          <div className="flex gap-3 pt-4 border-t">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isSubmitting}
                className="h-11 flex-1"
              >
                Annulla
              </Button>
            )}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-11 flex-1"
            >
              {getSubmitButtonText(mode, isSubmitting)}
            </Button>
          </div>
      </form>
    </Form>
    </>
  )
}
