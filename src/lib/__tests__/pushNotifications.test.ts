// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'

// isIOS() needs only `navigator`; mock the supabase client so importing the
// module doesn't construct a real client (isIOS doesn't touch supabase).
vi.mock('../supabase', () => ({ supabase: {} }))

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
// iPadOS Safari reports the SAME "Macintosh" userAgent as a desktop Mac —
// only the presence of touch points distinguishes the two.
const MAC_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'

async function loadModule(nav: Partial<Navigator>) {
  vi.resetModules()
  vi.stubGlobal('navigator', nav)
  return import('../pushNotifications')
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('isIOS', () => {
  it('riconosce iPadOS che si presenta come Macintosh (touch presente) senza usare navigator.platform', async () => {
    const m = await loadModule({ userAgent: MAC_UA, maxTouchPoints: 5 } as Partial<Navigator>)
    expect(m.isIOS()).toBe(true)
  })

  it('riconosce iPhone dallo userAgent', async () => {
    const m = await loadModule({ userAgent: IPHONE_UA, maxTouchPoints: 5 } as Partial<Navigator>)
    expect(m.isIOS()).toBe(true)
  })

  it('NON considera iOS un Mac desktop reale (stesso UA Macintosh, ma nessun touch)', async () => {
    const m = await loadModule({ userAgent: MAC_UA, maxTouchPoints: 0 } as Partial<Navigator>)
    expect(m.isIOS()).toBe(false)
  })
})
