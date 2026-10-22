/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_APP_URL: string
  readonly VITE_VAPID_PUBLIC_KEY: string
  /** Assente in produzione finché l'informativa non nomina Sentry (#192). */
  readonly VITE_SENTRY_DSN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Torch/flashlight support (Chrome Android, Safari 17+)
interface MediaTrackCapabilities {
  torch?: boolean
}
interface MediaTrackConstraintSet {
  torch?: ConstrainBoolean
}
interface MediaTrackSettings {
  torch?: boolean
}
