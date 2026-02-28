import { createClient } from '@supabase/supabase-js'

// Supabase client configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env.local file.'
  )
}

/**
 * Create Supabase client with auth configuration
 *
 * SECURITY NOTE - detectSessionInUrl: true
 * This setting allows Supabase to automatically extract authentication tokens from URLs.
 * It is REQUIRED for:
 * - Password reset flows (user clicks email link with #access_token=...)
 * - Magic link authentication (passwordless login)
 * - OAuth provider redirects
 *
 * IMPORTANT: This means users can be automatically logged in if they:
 * - Click a password reset link (even in incognito mode)
 * - Access a URL with an active auth token in the fragment
 * - Are redirected from an OAuth provider
 *
 * This is NORMAL and EXPECTED behavior. If you see unexpected auto-login:
 * 1. Check if there's a #access_token= in the URL
 * 2. Check browser DevTools → Application → Local Storage for auth tokens
 * 3. Verify the auth event type in authStore logging
 *
 * DO NOT disable this unless you want to break password reset functionality.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true, // Required for password reset and magic links
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
    heartbeatIntervalMs: 15000, // 15s instead of default 25s for better mobile detection
    timeout: 20000, // Connection timeout
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
      push_subscriptions: {
        Row: {
          id: string
          user_id: string
          endpoint: string
          p256dh: string
          auth_key: string
          user_agent: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['push_subscriptions']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['push_subscriptions']['Insert']>
      }
      notification_preferences: {
        Row: {
          id: string
          user_id: string
          enabled: boolean
          expiry_intervals: number[]
          quiet_hours_enabled: boolean
          quiet_hours_start: number
          quiet_hours_end: number
          max_notifications_per_day: number
          timezone: string
          last_notification_sent_at: string | null
          notifications_sent_today: number
          notifications_sent_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['notification_preferences']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['notification_preferences']['Insert']>
      }
    }
  }
}
