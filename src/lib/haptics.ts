import { WebHaptics } from 'web-haptics'

type PresetName = 'success' | 'warning' | 'error' | 'light' | 'medium' | 'heavy' | 'soft' | 'rigid' | 'selection' | 'nudge' | 'buzz'

const STORAGE_KEY = 'entro_haptics_enabled'

let instance: WebHaptics | null = null
let enabledCache: boolean | null = null

function getInstance(): WebHaptics | null {
  if (!WebHaptics.isSupported) return null
  instance ??= new WebHaptics({ debug: false, showSwitch: false })
  return instance
}

export function isHapticsEnabled(): boolean {
  if (!WebHaptics.isSupported) return false
  if (enabledCache !== null) return enabledCache
  const stored = localStorage.getItem(STORAGE_KEY)
  enabledCache = stored === null ? true : stored === 'true'
  return enabledCache
}

export function setHapticsEnabled(enabled: boolean): void {
  localStorage.setItem(STORAGE_KEY, String(enabled))
  enabledCache = enabled
}

export function triggerHaptic(preset: PresetName): void {
  if (!isHapticsEnabled()) return
  getInstance()?.trigger(preset)
}

export function isHapticsSupported(): boolean {
  return WebHaptics.isSupported
}
