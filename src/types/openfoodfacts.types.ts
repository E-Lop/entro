/**
 * Open Food Facts API Types
 * Documentation: https://openfoodfacts.github.io/openfoodfacts-server/api/
 */

/**
 * Main product response from Open Food Facts API
 */
export interface OpenFoodFactsProduct {
  code: string
  product_name?: string
  product_name_it?: string
  brands?: string
  categories?: string
  categories_tags?: string[]
  image_url?: string
  image_front_url?: string
  image_front_small_url?: string
  quantity?: string
  packaging?: string
  expiration_date?: string
  serving_quantity?: string
  nutriments?: {
    energy?: number
    fat?: number
    carbohydrates?: number
    proteins?: number
    salt?: number
    [key: string]: number | undefined
  }
}

/**
 * API response wrapper
 */
export interface OpenFoodFactsResponse {
  status: number
  status_verbose: string
  code: string
  product?: OpenFoodFactsProduct
}

/**
 * Mapped product data for our app
 */
export interface MappedProductData {
  name: string
  category_id?: string
  suggestedCategory?: string
  storage_location?: 'fridge' | 'freezer' | 'pantry'
  quantity?: number
  quantity_unit?: string
  image_url?: string
  notes?: string
}

/**
 * Category mapping from OFF to our categories
 */
export interface CategoryMapping {
  offTags: string[]
  categoryNameIt: string
  storageLocation: 'fridge' | 'freezer' | 'pantry'
  shelfLifeDays?: number
}
