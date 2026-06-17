import { WebHaptics } from 'web-haptics'

type PresetName = 'success' | 'warning' | 'error' | 'light' | 'medium' | 'heavy' | 'soft' | 'rigid' | 'selection' | 'nudge' | 'buzz'

const STORAGE_KEY = 'entro_haptics_enabled'

let instance: WebHaptics | null = null
let enabledCache: boolean | null = null

/**
 * Check if haptic feedback can actually fire on this device.
 *
 * Only the standard Vibration API (`navigator.vibrate`) delivers reliable,
 * programmatic haptics. Per MDN browser-compat data (verified 2026-06-17,
 * `api.Navigator.vibrate`) that means Chromium-based Android — Chrome, Edge,
 * Opera, Samsung Internet. Gaps the bare `typeof` check below cannot see:
 *   - iOS/WebKit (every iOS browser) never implements it.
 *   - Firefox desktop removed `navigator.vibrate` in v129 → reads as
 *     unsupported here, correctly.
 *   - Firefox Android still EXPOSES `navigator.vibrate` but the engine no-ops
 *     it (disabled for abuse, bugzil.la/1653318): it returns `true` yet nothing
 *     vibrates. So on Firefox Android this gate reports "supported" and the
 *     "Feedback aptico" setting shows, but triggers stay silent. Accepted: the
 *     failure is harmless and UA-sniffing Firefox is more fragile than the gap.
 *
 * The `<input type="checkbox" switch>` trick in `web-haptics` only vibrates on a
 * real user toggle, never on a programmatic `trigger()`, so it buys nothing. We
 * report support strictly where the Vibration API exists; on iOS/Safari the
 * "Feedback aptico" setting stays hidden instead of promising feedback we can't
 * deliver.
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
