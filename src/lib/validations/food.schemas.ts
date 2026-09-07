import { z } from 'zod'

/**
 * Il vocabolario delle tre colonne `text` + `CHECK` della tabella `foods`.
 *
 * Questi enum sono la **fonte unica lato TypeScript**: `types/food.types.ts` li
 * riesporta e `lib/supabase.overrides.ts` li usa per restringere le righe che
 * il generatore di tipi consegna come `string`. Non ridichiarare queste liste
 * altrove — il compilatore non se ne accorgerebbe.
 *
 * Il vincolo vero resta il `CHECK` in Postgres, che è l'unico punto a rifiutare
 * davvero una scrittura, anche da un client che non è questo. Che le due liste
 * restino uguali lo tiene fermo `lib/__tests__/foodVocabulary.test.ts`.
 */

export const storageLocationEnum = z.enum(['fridge', 'freezer', 'pantry'])

export const quantityUnitEnum = z.enum(['pz', 'kg', 'g', 'l', 'ml', 'confezioni'])

/**
 * `expired` è **deprecato**: resta nella lista perché il CHECK lo ammette e
 * perché esistono righe che lo portano, ma non va usato in flussi nuovi — la
 * scadenza si deriva dalla data, non si dichiara. Vedi `core/food-lifecycle.md`
 * nel bundle condiviso.
 *
 * La nota vive qui e non su un tipo derivato perché ogni derivazione la
 * perderebbe: `FoodOutcome` in `lib/foods.ts` lo esclude proprio per questo.
 */
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
    }, 'Data non valida'),
  // Una data **nel passato è valida**, e non è una dimenticanza: il ciclo di
  // vita del bundle tratta «scaduto» come uno stato normale, derivato dalla
  // data e non dichiarato, quindi lo schema non ha titolo per rifiutarlo.
  // Il divieto che stava qui rendeva impossibile anche solo correggere il
  // nome di un alimento già scaduto — la modifica rivalidava tutto il form e
  // falliva su un campo che l'utente non aveva toccato.
  // Deciso il 4 set 2026 sulla spec nativa; tolto da entrambi i client nella
  // stessa finestra (entro#118 e entro-mobile#99), perché due copie che
  // divergono in silenzio sono il difetto che il guardiano di parità esiste
  // per impedire.
  storage_location: storageLocationEnum,
  // La colonna è `numeric(10,2)` con `check (quantity > 0)`. Il minimo non è
  // quindi «maggiore di zero» sul valore digitato, ma 0.01: il più piccolo
  // valore positivo che la colonna sa memorizzare. Un 0.004 passerebbe un
  // controllo `> 0` e diventerebbe 0.00 alla scrittura, dove il CHECK scatta.
  // `null` resta valido e significa «quantità non tracciata».
  quantity: z
    .number()
    .min(0.01, 'La quantità deve essere maggiore di zero')
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
