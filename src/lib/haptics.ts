import { WebHaptics } from 'web-haptics'

type PresetName = 'success' | 'warning' | 'error' | 'light' | 'medium' | 'heavy' | 'soft' | 'rigid' | 'selection' | 'nudge' | 'buzz'

const STORAGE_KEY = 'entro_haptics_enabled'

let instance: WebHaptics | null = null
let enabledCache: boolean | null = null

/**
 * Check if haptic feedback can work on this device.
 * - Android/desktop: navigator.vibrate exists
 * - iOS Safari 17.4+: no vibrate API, but web-haptics uses a hidden
 *   <input type="checkbox" switch> workaround for native haptic feedback
 */
function canHaptics(): boolean {
  if (typeof navigator === 'undefined') return false
  // Android / standard Vibration API
  if (typeof navigator.vibrate === 'function') return true
  // iOS Safari: no vibrate, but the checkbox switch workaround works
  const ua = navigator.userAgent
  if (/iPad|iPhone/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    return true
  }
  return false
}

let supportedCache: boolean | null = null

export function isHapticsSupported(): boolean {
  supportedCache ??= canHaptics()
  return supportedCache
}

function getInstance(): WebHaptics | null {
  if (!isHapticsSupported()) return null
  instance ??= new WebHaptics({ debug: false, showSwitch: false })
  return instance
}

export function isHapticsEnabled(): boolean {
  if (!isHapticsSupported()) return false
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
