import { z } from 'zod'

// Storage location enum
export const storageLocationEnum = z.enum(['fridge', 'freezer', 'pantry'])

// Quantity unit enum (must match database constraint)
export const quantityUnitEnum = z.enum(['pz', 'kg', 'g', 'l', 'ml', 'confezioni'])

// Status enum
export const statusEnum = z.enum(['active', 'consumed', 'expired', 'wasted'])

// Food form schema for create/edit operations
export const foodFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Nome richiesto')
    .max(100, 'Il nome non può superare 100 caratteri'),
  category_id: z
    .string()
    .min(1, 'Categoria richiesta'),
  expiry_date: z
    .string()
    .min(1, 'Data di scadenza richiesta')
    .refine((date) => {
      // Validate ISO date format
      const parsed = new Date(date)
      return !isNaN(parsed.getTime())
    }, 'Data non valida')
    .refine((date) => {
      // Ensure date is not in the past (allow today)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const selectedDate = new Date(date)
      selectedDate.setHours(0, 0, 0, 0)
      return selectedDate >= today
    }, 'La data di scadenza non può essere nel passato'),
  storage_location: storageLocationEnum,
  quantity: z
    .number()
    .min(0, 'La quantità non può essere negativa')
    .nullable()
    .optional(),
  quantity_unit: quantityUnitEnum.nullable().optional(),
  notes: z
    .string()
    .max(500, 'Le note non possono superare 500 caratteri')
    .nullable()
    .optional(),
  image_url: z
    .union([
      z.string().min(1, 'Path immagine non valido'),
      z.instanceof(File),
    ])
    .nullable()
    .optional(),
})

// Export inferred TypeScript types
export type FoodFormData = z.infer<typeof foodFormSchema>
export type StorageLocation = z.infer<typeof storageLocationEnum>
export type QuantityUnit = z.infer<typeof quantityUnitEnum>
export type FoodStatus = z.infer<typeof statusEnum>
