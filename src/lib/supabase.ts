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

// Database types (updated for shared lists feature)
export type Database = {
  public: {
    Tables: {
      foods: {
        Row: {
          id: string
          user_id: string
          list_id: string | null // Added for shared lists
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
      lists: {
        Row: {
          id: string
          name: string
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['lists']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['lists']['Insert']>
      }
      list_members: {
        Row: {
          id: string
          list_id: string
          user_id: string
          joined_at: string
        }
        Insert: Omit<Database['public']['Tables']['list_members']['Row'], 'id' | 'joined_at'>
        Update: Partial<Database['public']['Tables']['list_members']['Insert']>
      }
      invites: {
        Row: {
          id: string
          list_id: string
          email: string
          token: string
          created_by: string
          status: 'pending' | 'accepted' | 'expired'
          created_at: string
          expires_at: string
          accepted_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['invites']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['invites']['Insert']>
      }
    }
  }
}
