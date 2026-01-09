import { User as SupabaseUser } from '@supabase/supabase-js'

export type User = SupabaseUser

export interface AuthState {
  user: User | null
  loading: boolean
  error: string | null
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface SignUpCredentials extends LoginCredentials {
  confirmPassword?: string
}
