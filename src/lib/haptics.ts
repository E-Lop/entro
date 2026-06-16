import { WebHaptics } from 'web-haptics'

type PresetName = 'success' | 'warning' | 'error' | 'light' | 'medium' | 'heavy' | 'soft' | 'rigid' | 'selection' | 'nudge' | 'buzz'

const STORAGE_KEY = 'entro_haptics_enabled'

let instance: WebHaptics | null = null
let enabledCache: boolean | null = null

/**
 * Check if haptic feedback can actually fire on this device.
 *
 * Only the standard Vibration API (`navigator.vibrate`) delivers reliable,
 * programmatic haptics — that means Android (Chrome/Firefox/Edge). iOS/WebKit
 * does NOT implement `navigator.vibrate`, and the `<input type="checkbox" switch>`
 * trick only vibrates on a real user toggle of the control, never on a
 * programmatic `trigger()`. So we report support strictly where the Vibration
 * API exists; everywhere else (e.g. iPhone, Safari) the "Feedback aptico"
 * setting stays hidden instead of promising feedback we can't deliver.
 */
function canHaptics(): boolean {
  if (typeof navigator === 'undefined') return false
  return typeof navigator.vibrate === 'function'
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
