import { createClient } from '@supabase/supabase-js'
import type { Database } from './supabase.types'

export type { Database } from './supabase.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env.local file.'
  )
}

/**
 * Create Supabase client with auth configuration.
 *
 * `detectSessionInUrl: true` is required for password reset, magic link and
 * OAuth redirects because Supabase reads auth tokens from URL fragments.
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
    heartbeatIntervalMs: 15000,
    timeout: 20000,
  },
})
