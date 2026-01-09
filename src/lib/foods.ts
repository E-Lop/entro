import { supabase } from './supabase'
import type { Database } from './supabase'

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
 * Includes category information via join
 */
export async function getFoods(): Promise<FoodsResponse> {
  try {
    const { data, error } = await supabase
      .from('foods')
      .select('*')
      .is('deleted_at', null) // Exclude soft-deleted items
      .order('expiry_date', { ascending: true })

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
 * Create a new food item
 */
export async function createFood(foodData: FoodInsert): Promise<FoodResponse> {
  try {
    // Get current user ID
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      throw new Error('Utente non autenticato')
    }

    const { data, error } = await supabase
      .from('foods')
      .insert({
        ...foodData,
        user_id: user.id,
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
 */
export async function updateFood(id: string, foodData: FoodUpdate): Promise<FoodResponse> {
  try {
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
 */
export async function deleteFood(id: string): Promise<{ error: Error | null }> {
  try {
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
