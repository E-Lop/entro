import { createClient } from '@supabase/supabase-js'

// Supabase client configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env.local file.'
  )
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})

// Database types (will be generated later with Supabase CLI)
export type Database = {
  public: {
    Tables: {
      foods: {
        Row: {
          id: string
          user_id: string
          name: string
          quantity: number | null
          quantity_unit: 'pz' | 'kg' | 'g' | 'l' | 'ml' | 'confezioni' | null
          expiry_date: string
          category_id: string
          storage_location: 'fridge' | 'freezer' | 'pantry'
          image_url: string | null
          barcode: string | null
          notes: string | null
          status: 'active' | 'consumed' | 'expired' | 'wasted'
          consumed_at: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['foods']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['foods']['Insert']>
      }
      categories: {
        Row: {
          id: string
          name: string
          name_it: string
          icon: string
          color: string
          default_storage: 'fridge' | 'freezer' | 'pantry'
          average_shelf_life_days: number
          created_at: string
        }
      }
    }
  }
}
