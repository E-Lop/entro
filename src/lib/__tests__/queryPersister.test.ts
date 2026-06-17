// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'

// Reload the module with a fresh navigator each case so feature detection
// reflects the stubbed StorageManager.
async function loadPersister() {
  vi.resetModules()
  return import('../queryPersister')
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('requestPersistentStorage', () => {
  it('ritorna false quando StorageManager.persist non esiste (es. browser vecchio)', async () => {
    vi.stubGlobal('navigator', {} as Partial<Navigator>)
    const { requestPersistentStorage } = await loadPersister()
    expect(await requestPersistentStorage()).toBe(false)
  })

  it('ritorna false quando navigator.storage esiste ma senza persist()', async () => {
    vi.stubGlobal('navigator', { storage: {} } as unknown as Navigator)
    const { requestPersistentStorage } = await loadPersister()
    expect(await requestPersistentStorage()).toBe(false)
  })

  it('ritorna true quando il browser concede la persistenza', async () => {
    const persist = vi.fn().mockResolvedValue(true)
    vi.stubGlobal('navigator', { storage: { persist } } as unknown as Navigator)
    const { requestPersistentStorage } = await loadPersister()
    expect(await requestPersistentStorage()).toBe(true)
    expect(persist).toHaveBeenCalledOnce()
  })

  it('ritorna false quando il browser nega (es. iOS Safari non installato)', async () => {
    vi.stubGlobal('navigator', {
      storage: { persist: vi.fn().mockResolvedValue(false) },
    } as unknown as Navigator)
    const { requestPersistentStorage } = await loadPersister()
    expect(await requestPersistentStorage()).toBe(false)
  })

  it('non lancia se persist() rifiuta: ritorna false', async () => {
    vi.stubGlobal('navigator', {
      storage: { persist: vi.fn().mockRejectedValue(new Error('boom')) },
    } as unknown as Navigator)
    const { requestPersistentStorage } = await loadPersister()
    expect(await requestPersistentStorage()).toBe(false)
  })
})
