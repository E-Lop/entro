// Core types for food items

/**
 * Il vocabolario non si ridichiara qui: la fonte unica lato TypeScript sono
 * gli enum Zod di `validations/food.schemas.ts`, che sono anche l'unica delle
 * definizioni a validare qualcosa a runtime. Il vincolo vero resta il `CHECK`
 * in Postgres, l'unico punto che rifiuta una scrittura sbagliata.
 */
import type {
  StorageLocation,
  FoodStatus,
  QuantityUnit,
} from '@/lib/validations/food.schemas'

export type { StorageLocation, FoodStatus, QuantityUnit }

export interface Food {
  id: string
  user_id: string
  list_id: string | null // Added for shared lists
  name: string
  quantity: number | null
  quantity_unit: QuantityUnit | null
  expiry_date: string // ISO date string
  category_id: string
  storage_location: StorageLocation
  image_url: string | null
  barcode: string | null
  notes: string | null
  status: FoodStatus
  consumed_at: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null

  // Relations (when joined)
  category?: Category
}

export interface Category {
  id: string
  name: string
  name_it: string
  icon: string
  color: string
  default_storage: StorageLocation
  average_shelf_life_days: number
  created_at: string
}

export interface FoodFormData {
  name: string
  quantity?: number
  quantity_unit?: QuantityUnit
  expiry_date: Date
  category_id: string
  storage_location: StorageLocation
  image?: File
  barcode?: string
  notes?: string
}

export interface FoodFilters {
  categories: string[]
  storageLocations: StorageLocation[]
  searchQuery: string
  sortBy: 'expiry_date' | 'name' | 'created_at'
  sortOrder: 'asc' | 'desc'
}

export type ExpiryStatus = 'expired' | 'expires_today' | 'expires_soon' | 'expires_this_week' | 'fresh'

export interface FoodWithExpiry extends Food {
  days_until_expiry: number
  expiry_status: ExpiryStatus
}

// Client-side metadata for realtime updates
export interface FoodWithRealtimeMetadata extends Food {
  isRemoteUpdate?: boolean
  remoteUpdateTimestamp?: number
}
