/**
 * Open Food Facts API Service
 * Documentation: https://openfoodfacts.github.io/openfoodfacts-server/api/
 */

import type {
  OpenFoodFactsResponse,
  OpenFoodFactsProduct,
  MappedProductData,
  CategoryMapping,
} from '@/types/openfoodfacts.types'

const OFF_API_BASE = 'https://world.openfoodfacts.org/api/v2'

/**
 * Category mappings from Open Food Facts to our Italian categories
 * Maps OFF category tags to Italian category names and storage suggestions
 */
const CATEGORY_MAPPINGS: CategoryMapping[] = [
  {
    offTags: ['dairies', 'milk', 'cheese', 'yogurt', 'latte', 'formaggio', 'yogurt', 'latticini'],
    categoryNameIt: 'Latticini',
    storageLocation: 'fridge',
    shelfLifeDays: 7,
  },
  {
    offTags: ['meats', 'chicken', 'beef', 'pork', 'carne', 'pollo', 'manzo', 'maiale'],
    categoryNameIt: 'Carni',
    storageLocation: 'fridge',
    shelfLifeDays: 3,
  },
  {
    offTags: ['fish', 'seafood', 'pesce', 'frutti di mare', 'salmone', 'tonno'],
    categoryNameIt: 'Pesce',
    storageLocation: 'fridge',
    shelfLifeDays: 2,
  },
  {
    offTags: ['fruits', 'fruit', 'frutta', 'mela', 'banana', 'arancia'],
    categoryNameIt: 'Frutta',
    storageLocation: 'fridge',
    shelfLifeDays: 7,
  },
  {
    offTags: ['vegetables', 'verdure', 'insalata', 'pomodoro', 'carota', 'spinaci'],
    categoryNameIt: 'Verdure',
    storageLocation: 'fridge',
    shelfLifeDays: 5,
  },
  {
    offTags: ['cereals', 'bread', 'pasta', 'rice', 'cereali', 'pane', 'pasta', 'riso'],
    categoryNameIt: 'Cereali e derivati',
    storageLocation: 'pantry',
    shelfLifeDays: 30,
  },
  {
    offTags: ['beverages', 'drinks', 'bevande', 'succo', 'bibita', 'acqua', 'water', 'juice'],
    categoryNameIt: 'Bevande',
    storageLocation: 'fridge',
    shelfLifeDays: 14,
  },
  {
    offTags: ['sweets', 'desserts', 'chocolate', 'dolci', 'cioccolato', 'biscotti', 'cookies'],
    categoryNameIt: 'Dolci',
    storageLocation: 'pantry',
    shelfLifeDays: 60,
  },
  {
    offTags: ['condiments', 'sauces', 'oils', 'condimenti', 'salse', 'olio', 'aceto'],
    categoryNameIt: 'Condimenti',
    storageLocation: 'pantry',
    shelfLifeDays: 90,
  },
  {
    offTags: ['frozen', 'surgelati', 'gelato', 'ice cream'],
    categoryNameIt: 'Surgelati',
    storageLocation: 'freezer',
    shelfLifeDays: 90,
  },
]

/**
 * Fetch product data from Open Food Facts by barcode
 */
export async function fetchProductByBarcode(
  barcode: string
): Promise<{ data: OpenFoodFactsProduct | null; error: Error | null }> {
  try {
    // Clean barcode (remove spaces, dashes)
    const cleanBarcode = barcode.replace(/[\s-]/g, '')

    if (!cleanBarcode || cleanBarcode.length < 8) {
      throw new Error('Barcode non valido')
    }

    const response = await fetch(`${OFF_API_BASE}/product/${cleanBarcode}`)

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data: OpenFoodFactsResponse = await response.json()

    // Check if product was found
    if (data.status !== 1 || !data.product) {
      return {
        data: null,
        error: new Error('Prodotto non trovato nel database Open Food Facts'),
      }
    }

    return {
      data: data.product,
      error: null,
    }
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Errore nella ricerca del prodotto'),
    }
  }
}

/**
 * Map Open Food Facts product to our app's product data structure
 * Returns suggested values for form pre-filling
 */
export function mapProductToFormData(
  product: OpenFoodFactsProduct,
  availableCategories: Array<{ id: string; name_it: string }>
): MappedProductData {
  // Get product name (prefer Italian, fallback to generic)
  const name = product.product_name_it || product.product_name || 'Prodotto sconosciuto'

  // Extract category suggestion
  const categoryMapping = detectCategoryFromProduct(product)

  // Find matching category ID from our database
  const matchedCategory = availableCategories.find(
    cat => cat.name_it.toLowerCase() === categoryMapping.categoryNameIt.toLowerCase()
  )

  // Parse quantity if available
  const { quantity, quantityUnit } = parseQuantity(product.quantity)

  // Build mapped data
  const mappedData: MappedProductData = {
    name: formatProductName(name, product.brands),
    suggestedCategory: categoryMapping.categoryNameIt,
    storage_location: categoryMapping.storageLocation,
    image_url: product.image_front_small_url || product.image_front_url || product.image_url,
  }

  // Add category_id if found
  if (matchedCategory) {
    mappedData.category_id = matchedCategory.id
  }

  // Add quantity if parsed
  if (quantity) {
    mappedData.quantity = quantity
    mappedData.quantity_unit = quantityUnit
  }

  // Add notes with brands and categories info
  const notes: string[] = []
  if (product.brands) {
    notes.push(`Marca: ${product.brands}`)
  }
  if (product.categories && !matchedCategory) {
    notes.push(`Categorie OFF: ${product.categories}`)
  }
  if (notes.length > 0) {
    mappedData.notes = notes.join('\n')
  }

  return mappedData
}

/**
 * Detect category from product data using keyword matching
 */
function detectCategoryFromProduct(product: OpenFoodFactsProduct): CategoryMapping {
  const searchText = [
    product.product_name_it || '',
    product.product_name || '',
    product.categories || '',
    ...(product.categories_tags || []),
  ]
    .join(' ')
    .toLowerCase()

  // Try to match category based on keywords
  for (const mapping of CATEGORY_MAPPINGS) {
    for (const tag of mapping.offTags) {
      if (searchText.includes(tag.toLowerCase())) {
        return mapping
      }
    }
  }

  // Default fallback category
  return {
    offTags: [],
    categoryNameIt: 'Altro',
    storageLocation: 'pantry',
  }
}

/**
 * Format product name with brand if available
 */
function formatProductName(name: string, brands?: string): string {
  if (!brands) return name

  // If brand is not already in the name, prepend it
  const lowerName = name.toLowerCase()
  const brandsList = brands.split(',').map(b => b.trim())

  const hasBrand = brandsList.some(brand => lowerName.includes(brand.toLowerCase()))

  if (!hasBrand && brandsList[0]) {
    return `${brandsList[0]} ${name}`
  }

  return name
}

/**
 * Parse quantity string to number and unit
 */
function parseQuantity(quantityString?: string): {
  quantity: number | undefined
  quantityUnit: 'pz' | 'kg' | 'g' | 'l' | 'ml' | undefined
} {
  if (!quantityString) {
    return { quantity: undefined, quantityUnit: undefined }
  }

  const cleaned = quantityString.toLowerCase().trim()

  // Match patterns like "1.5l", "500g", "250 ml"
  const match = cleaned.match(/^(\d+\.?\d*)\s*(kg|g|l|ml|pz)?/)

  if (!match) {
    return { quantity: undefined, quantityUnit: undefined }
  }

  const quantity = parseFloat(match[1])
  let unit = match[2] as 'kg' | 'g' | 'l' | 'ml' | 'pz' | undefined

  // Map common units
  if (cleaned.includes('kg') || cleaned.includes('kilo')) {
    unit = 'kg'
  } else if (cleaned.includes('gram') || cleaned.includes('g')) {
    unit = 'g'
  } else if (cleaned.includes('lit') || cleaned.includes('l')) {
    unit = 'l'
  } else if (cleaned.includes('ml')) {
    unit = 'ml'
  }

  return { quantity: isNaN(quantity) ? undefined : quantity, quantityUnit: unit }
}

/**
 * Calculate suggested expiry date based on category
 */
export function suggestExpiryDate(categoryNameIt: string): Date {
  const mapping = CATEGORY_MAPPINGS.find(
    m => m.categoryNameIt.toLowerCase() === categoryNameIt.toLowerCase()
  )

  const daysToAdd = mapping?.shelfLifeDays || 14 // Default 2 weeks

  const expiryDate = new Date()
  expiryDate.setDate(expiryDate.getDate() + daysToAdd)

  return expiryDate
}
