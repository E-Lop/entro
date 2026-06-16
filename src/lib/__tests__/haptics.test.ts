// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'

// Mock web-haptics so constructing an instance has no DOM/audio side effects;
// the spy lets us assert the preset is forwarded when (and only when) it should.
const { triggerSpy } = vi.hoisted(() => ({ triggerSpy: vi.fn() }))
vi.mock('web-haptics', () => ({
  WebHaptics: class {
    trigger = triggerSpy
  },
}))

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36'

// Minimal in-memory localStorage so the module's preference lookup works while
// `navigator` is stubbed (the stub detaches jsdom's own storage binding).
function makeLocalStorage(): Storage {
  const store = new Map<string, string>()
  return {
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    setItem: (k, v) => void store.set(k, String(v)),
    removeItem: (k) => void store.delete(k),
    clear: () => store.clear(),
    key: (i) => [...store.keys()][i] ?? null,
    get length() {
      return store.size
    },
  } as Storage
}

// Reload the module with a fresh navigator + storage so the module-level
// support/enabled caches start clean for each case.
async function loadHaptics(nav: Partial<Navigator>) {
  vi.resetModules()
  vi.stubGlobal('navigator', nav)
  vi.stubGlobal('localStorage', makeLocalStorage())
  return import('../haptics')
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('rilevamento supporto haptic', () => {
  it('è supportato quando navigator.vibrate è una funzione (Android)', async () => {
    const h = await loadHaptics({ vibrate: vi.fn(), userAgent: ANDROID_UA } as Partial<Navigator>)
    expect(h.isHapticsSupported()).toBe(true)
  })

  it('NON è supportato su iPhone (WebKit non espone la Vibration API)', async () => {
    const h = await loadHaptics({ userAgent: IPHONE_UA } as Partial<Navigator>)
    expect(h.isHapticsSupported()).toBe(false)
  })

  it('NON è supportato su desktop senza Vibration API', async () => {
    const h = await loadHaptics({ userAgent: 'Mozilla/5.0 (Macintosh)' } as Partial<Navigator>)
    expect(h.isHapticsSupported()).toBe(false)
  })
})

describe('preferenza haptic', () => {
  it('è abilitato di default quando non c\'è una preferenza salvata', async () => {
    const h = await loadHaptics({ vibrate: vi.fn() } as Partial<Navigator>)
    expect(h.isHapticsEnabled()).toBe(true)
  })

  it('è false dove non supportato, a prescindere dalla preferenza', async () => {
    const h = await loadHaptics({ userAgent: IPHONE_UA } as Partial<Navigator>)
    expect(h.isHapticsEnabled()).toBe(false)
  })
})

describe('triggerHaptic', () => {
  it('è un no-op dove non supportato (es. iPhone)', async () => {
    const h = await loadHaptics({ userAgent: IPHONE_UA } as Partial<Navigator>)
    h.triggerHaptic('success')
    expect(triggerSpy).not.toHaveBeenCalled()
  })

  it('inoltra il preset alla libreria quando supportato e abilitato', async () => {
    const h = await loadHaptics({ vibrate: vi.fn() } as Partial<Navigator>)
    h.triggerHaptic('nudge')
    expect(triggerSpy).toHaveBeenCalledWith('nudge')
  })
})
