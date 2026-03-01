import { supabase } from './supabase'
import type { Database } from './supabase'
import { deleteFoodImage } from './storage'

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
  status?: 'all' | 'active' | 'expired' | 'expiring_soon'
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

    // Apply status filter based on expiry date
    if (filters?.status && filters.status !== 'all') {
      const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD format

      if (filters.status === 'expired') {
        // Expiry date is in the past
        query = query.lt('expiry_date', today)
      } else if (filters.status === 'expiring_soon') {
        // Expiry date is within the next 7 days
        const sevenDaysFromNow = new Date()
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)
        const futureDate = sevenDaysFromNow.toISOString().split('T')[0]
        query = query.gte('expiry_date', today).lte('expiry_date', futureDate)
      } else if (filters.status === 'active') {
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
 * Delete a food item (hard delete)
 * For soft delete, use updateFood with deleted_at timestamp
 * Also deletes associated image from storage if exists
 */
export async function deleteFood(id: string): Promise<{ error: Error | null }> {
  try {
    const { data: { session }, error: authError } = await supabase.auth.getSession()

    if (authError || !session?.user) {
      throw new Error('Utente non autenticato')
    }

    const user = session.user

    // First, get the food to check if it has an image
    const { data: food, error: fetchError } = await supabase
      .from('foods')
      .select('image_url')
      .eq('id', id)
      .single()

    if (fetchError) {
      throw new Error(fetchError.message)
    }

    // Delete image from storage if exists
    if (food?.image_url) {
      try {
        await deleteFoodImage(food.image_url, user.id)
      } catch (imageError) {
        console.warn('Failed to delete image, continuing with food deletion:', imageError)
        // Continue with food deletion even if image deletion fails
      }
    }

    // Delete food from database
    const { error } = await supabase
      .from('foods')
      .delete()
      .eq('id', id)

    if (error) {
      throw new Error(error.message)
    }

    return { error: null }
  } catch (error) {
    return {
      error: error instanceof Error ? error : new Error('Errore nell\'eliminazione dell\'alimento'),
    }
  }
}

/**
 * Soft delete a food item by setting deleted_at timestamp
 */
export async function softDeleteFood(id: string): Promise<FoodResponse> {
  try {
    const { data, error } = await supabase
      .from('foods')
      .update({ deleted_at: new Date().toISOString() })
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
