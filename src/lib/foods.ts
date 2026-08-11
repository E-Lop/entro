import { supabase } from './supabase'
import type { Database } from './supabase'
import { deleteFoodImage } from './storage'
import { isPendingUrl, deletePendingImage } from './pendingImages'
import { EXPIRY_SOON_DAYS } from './expiry'

/**
 * Foods Service Layer - Wrapper functions around Supabase Foods API
 */

// Type aliases from Database types
export type Food = Database['public']['Tables']['foods']['Row']
export type FoodInsert = Database['public']['Tables']['foods']['Insert']
export type FoodUpdate = Database['public']['Tables']['foods']['Update']
export type Category = Database['public']['Tables']['categories']['Row']

export interface FoodResponse {
  food: Food | null
  error: Error | null
}

export interface FoodsResponse {
  foods: Food[]
  error: Error | null
}

export interface CategoriesResponse {
  categories: Category[]
  error: Error | null
}

/**
 * Filter parameters for getFoods query
 */
export interface FilterParams {
  category_id?: string
  storage_location?: 'fridge' | 'freezer' | 'pantry'
  /** Filtro sulla scadenza, derivata dalla data. Da non confondere con
   *  `Food['status']`, che è l'esito scelto dall'utente. */
  expiry?: 'all' | 'not_expired' | 'expiring_soon' | 'expired'
  search?: string
  sortBy?: 'expiry_date' | 'name' | 'created_at' | 'category_id'
  sortOrder?: 'asc' | 'desc'
}

/**
 * Fetch all categories
 */
export async function getCategories(): Promise<CategoriesResponse> {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true })

    if (error) {
      throw new Error(error.message)
    }

    return {
      categories: data || [],
      error: null,
    }
  } catch (error) {
    return {
      categories: [],
      error: error instanceof Error ? error : new Error('Errore nel caricamento delle categorie'),
    }
  }
}

/**
 * Fetch all foods for the current user (filtered by RLS)
 * Supports filtering, searching, and sorting
 */
export async function getFoods(filters?: FilterParams): Promise<FoodsResponse> {
  try {
    // Start building the query
    let query = supabase
      .from('foods')
      .select('*')
      .is('deleted_at', null) // Exclude soft-deleted items

    // Apply category filter
    if (filters?.category_id) {
      query = query.eq('category_id', filters.category_id)
    }

    // Apply storage location filter
    if (filters?.storage_location) {
      query = query.eq('storage_location', filters.storage_location)
    }

    // Apply search filter (case-insensitive partial match)
    if (filters?.search && filters.search.trim()) {
      query = query.ilike('name', `%${filters.search.trim()}%`)
    }

    // Apply expiry filter based on expiry date
    if (filters?.expiry && filters.expiry !== 'all') {
      const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD format

      if (filters.expiry === 'expired') {
        // Expiry date is in the past
        query = query.lt('expiry_date', today)
      } else if (filters.expiry === 'expiring_soon') {
        // Expiry date is within the "in scadenza" window (see EXPIRY_SOON_DAYS in @/lib/expiry)
        const soonCutoff = new Date()
        soonCutoff.setDate(soonCutoff.getDate() + EXPIRY_SOON_DAYS)
        const futureDate = soonCutoff.toISOString().split('T')[0]
        query = query.gte('expiry_date', today).lte('expiry_date', futureDate)
      } else if (filters.expiry === 'not_expired') {
        // Expiry date is in the future (not expired)
        query = query.gte('expiry_date', today)
      }
    }

    // Apply sorting
    const sortBy = filters?.sortBy || 'expiry_date'
    const sortOrder = filters?.sortOrder || 'asc'
    query = query.order(sortBy, { ascending: sortOrder === 'asc' })

    const { data, error } = await query

    if (error) {
      throw new Error(error.message)
    }

    return {
      foods: data || [],
      error: null,
    }
  } catch (error) {
    return {
      foods: [],
      error: error instanceof Error ? error : new Error('Errore nel caricamento degli alimenti'),
    }
  }
}

/**
 * Fetch a single food item by ID
 */
export async function getFoodById(id: string): Promise<FoodResponse> {
  try {
    const { data, error } = await supabase
      .from('foods')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (error) {
      throw new Error(error.message)
    }

    return {
      food: data,
      error: null,
    }
  } catch (error) {
    return {
      food: null,
      error: error instanceof Error ? error : new Error('Errore nel caricamento dell\'alimento'),
    }
  }
}

/**
 * Create a new food item.
 * Accepts an optional pre-generated `id` for offline/optimistic inserts.
 */
export async function createFood(
  foodData: FoodInsert,
  preGeneratedId?: string,
): Promise<FoodResponse> {
  try {
    // Use getSession() (local cache) instead of getUser() (network call)
    // so the function works when resumed from offline mutation queue
    const { data: { session }, error: authError } = await supabase.auth.getSession()

    if (authError || !session?.user) {
      throw new Error('Utente non autenticato')
    }

    const user = session.user

    // Get user's list ID (for shared lists feature)
    let listId: string | null = null
    try {
      const { data: listMemberData } = await supabase
        .from('list_members')
        .select('list_id')
        .eq('user_id', user.id)
        .single()

      listId = listMemberData?.list_id || null
    } catch {
      // If user has no list yet (shouldn't happen with auto-creation trigger),
      // continue with list_id = null (personal food)
      console.warn('No list found for user, creating personal food')
    }

    const { data, error } = await supabase
      .from('foods')
      .insert({
        ...foodData,
        ...(preGeneratedId ? { id: preGeneratedId } : {}),
        user_id: user.id,
        list_id: listId,
      })
      .select()
      .single()

    if (error) {
      throw new Error(error.message)
    }

    return {
      food: data,
      error: null,
    }
  } catch (error) {
    return {
      food: null,
      error: error instanceof Error ? error : new Error('Errore nella creazione dell\'alimento'),
    }
  }
}

/**
 * Update an existing food item
 * If image_url is being changed/removed, deletes the old image from storage
 */
export async function updateFood(id: string, foodData: FoodUpdate): Promise<FoodResponse> {
  try {
    const { data: { session }, error: authError } = await supabase.auth.getSession()

    if (authError || !session?.user) {
      throw new Error('Utente non autenticato')
    }

    const user = session.user

    // If image_url is being updated, get the old image to delete it
    if ('image_url' in foodData) {
      const { data: oldFood, error: fetchError } = await supabase
        .from('foods')
        .select('image_url')
        .eq('id', id)
        .single()

      // Only try to delete old image if fetch succeeded
      if (!fetchError && oldFood?.image_url && oldFood.image_url !== foodData.image_url) {
        try {
          await deleteFoodImage(oldFood.image_url, user.id)
        } catch (imageError) {
          console.warn('Failed to delete old image, continuing with update:', imageError)
          // Continue with update even if image deletion fails
        }
      }
    }

    const { data, error } = await supabase
      .from('foods')
      .update(foodData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw new Error(error.message)
    }

    return {
      food: data,
      error: null,
    }
  } catch (error) {
    return {
      food: null,
      error: error instanceof Error ? error : new Error('Errore nell\'aggiornamento dell\'alimento'),
    }
  }
}

/**
 * Butta via l'immagine di un alimento, ovunque si trovi.
 *
 * Un'immagine ancora in coda (`pending://`) non è mai arrivata su Storage: sta
 * in IndexedDB e va tolta da lì. Il fallimento non è un motivo per fermarsi —
 * l'utente ha chiesto di togliere l'alimento, e un blob rimasto indietro è un
 * problema di spazio, non una ragione per disobbedire.
 */
async function discardFoodImage(imageUrl: string | null | undefined, userId: string): Promise<void> {
  if (!imageUrl) return

  try {
    if (isPendingUrl(imageUrl)) {
      await deletePendingImage(imageUrl)
    } else {
      await deleteFoodImage(imageUrl, userId)
    }
  } catch {
    // Solo il contesto, senza l'oggetto errore: passarlo alla console ne
    // stamperebbe le proprietà (vedi #79). Diventerà `logError` da @/lib/safeLog
    // quando la #83 sarà mergiata, e allora il messaggio tornerà utile.
    console.warn('Immagine non cancellata, l\'alimento viene tolto comunque')
  }
}

/**
 * L'esito di un alimento tolto dalla lista, quando l'utente lo dichiara.
 *
 * Scritto a mano e non derivato da `Food['status']`, che nei tipi generati è
 * `string | null` e quindi non vincola niente: il vocabolario vero sta nel
 * check constraint della tabella `foods` (`active`/`consumed`/`expired`/
 * `wasted`). Qui restano solo i due valori che una persona può *scegliere* —
 * `expired` si ricava dalla data e non è un esito che qualcuno dichiara.
 */
export type FoodOutcome = 'consumed' | 'wasted'

/**
 * Toglie un alimento dalla lista registrandone l'esito, in una sola scrittura.
 *
 * `deleted_at` risponde a «lo traccio ancora?», `status` a «com'è finita?»:
 * sono due assi indipendenti, e `getFoods` filtra solo sul primo. Stanno nella
 * stessa UPDATE perché separarli lascerebbe uno stato intermedio in cui
 * l'esito è registrato ma l'alimento è ancora in lista — e offline due voci in
 * coda che si possono separare per davvero.
 *
 * `outcome` omesso significa «toglilo e basta»: è l'errore di inserimento, e
 * deve restare senza esito. Sporcare la metrica anti-spreco con gli errori la
 * rende inutile quanto lasciarla vuota.
 *
 * L'immagine invece viene cancellata davvero: è un blob pesante, non serve a
 * nessuna metrica, e tenerlo farebbe crescere lo Storage a ogni eliminazione.
 * È l'unica parte irreversibile — la riga si può ripristinare, la foto no.
 */
export async function softDeleteFood(id: string, outcome?: FoodOutcome): Promise<FoodResponse> {
  try {
    const { data: { session }, error: authError } = await supabase.auth.getSession()

    if (authError || !session?.user) {
      throw new Error('Utente non autenticato')
    }

    const { data: existing } = await supabase
      .from('foods')
      .select('image_url')
      .eq('id', id)
      .single()

    await discardFoodImage(existing?.image_url, session.user.id)

    // Un solo istante per tutta la scrittura: è un evento unico, e `consumed_at`
    // non deve risultare successivo al `deleted_at` della stessa UPDATE.
    const now = new Date().toISOString()

    const updateData: FoodUpdate = {
      deleted_at: now,
      image_url: null,
    }

    if (outcome) {
      updateData.status = outcome
      if (outcome === 'consumed') {
        updateData.consumed_at = now
      }
    }

    const { data, error } = await supabase
      .from('foods')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw new Error(error.message)
    }

    return {
      food: data,
      error: null,
    }
  } catch (error) {
    return {
      food: null,
      error: error instanceof Error ? error : new Error('Errore nell\'eliminazione dell\'alimento'),
    }
  }
}

/**
 * Update food status (consumed, expired, wasted)
 */
export async function updateFoodStatus(
  id: string,
  status: Food['status']
): Promise<FoodResponse> {
  try {
    const updateData: FoodUpdate = { status }

    // If marking as consumed, set consumed_at timestamp
    if (status === 'consumed') {
      updateData.consumed_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('foods')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw new Error(error.message)
    }

    return {
      food: data,
      error: null,
    }
  } catch (error) {
    return {
      food: null,
      error: error instanceof Error ? error : new Error('Errore nell\'aggiornamento dello stato'),
    }
  }
}
