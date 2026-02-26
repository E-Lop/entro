/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_APP_URL: string
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
