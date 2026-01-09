import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { foodFormSchema, type FoodFormData } from '@/lib/validations/food.schemas'
import { useCategories } from '@/hooks/useFoods'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form'
import type { Food } from '@/lib/foods'

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

  // Setup form with validation
  const form = useForm<FoodFormData>({
    resolver: zodResolver(foodFormSchema),
    defaultValues: {
      name: '',
      category_id: '',
      expiry_date: format(new Date(), 'yyyy-MM-dd'),
      storage_location: 'fridge',
      quantity: null,
      quantity_unit: null,
      notes: null,
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
      })
    }
  }, [mode, initialData, form])

  const handleSubmit = async (data: FoodFormData) => {
    // Convert date to ISO string for database
    const submitData: FoodFormData = {
      ...data,
      expiry_date: new Date(data.expiry_date).toISOString(),
      // Convert empty strings to null
      quantity_unit: data.quantity_unit || null,
      notes: data.notes?.trim() || null,
    }

    await onSubmit(submitData)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
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
                  disabled={isSubmitting}
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
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
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
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
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
                    disabled={isSubmitting}
                    {...field}
                    value={field.value ?? ''}
                    onChange={(e) => {
                      const value = e.target.value
                      field.onChange(value === '' ? null : parseFloat(value))
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
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
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
  )
}
