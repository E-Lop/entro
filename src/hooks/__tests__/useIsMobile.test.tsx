// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'

// Fake MediaQueryList controllabile: jsdom non implementa window.matchMedia.
function createMatchMedia(initialMatches: boolean) {
  let matches = initialMatches
  const handlers = new Set<(e: { matches: boolean }) => void>()
  return {
    media: '(max-width: 767px)',
    get matches() {
      return matches
    },
    addEventListener: vi.fn((_type: string, h: (e: { matches: boolean }) => void) => {
      handlers.add(h)
    }),
    removeEventListener: vi.fn((_type: string, h: (e: { matches: boolean }) => void) => {
      handlers.delete(h)
    }),
    // Helper di test: simula un cambio di viewport
    emit(next: boolean) {
      matches = next
      handlers.forEach((h) => h({ matches }))
    },
    handlerCount() {
      return handlers.size
    },
  }
}

let mql: ReturnType<typeof createMatchMedia>

function setTouch(enabled: boolean) {
  if (enabled) {
    ;(window as unknown as { ontouchstart: unknown }).ontouchstart = null
  } else {
    delete (window as unknown as { ontouchstart?: unknown }).ontouchstart
  }
}

function useMatchMedia(matches: boolean, touch: boolean) {
  setTouch(touch)
  mql = createMatchMedia(matches)
  window.matchMedia = vi.fn(() => mql as unknown as MediaQueryList)
}

// Import dinamico: resetModules() in beforeEach garantisce singleton fresco.
async function loadHook() {
  const mod = await import('../useIsMobile')
  return mod.useIsMobile
}

function renderProbes(useIsMobile: () => boolean, count = 1) {
  function Probe({ id }: { id: string }) {
    const m = useIsMobile()
    return <span data-testid={id}>{m ? 'mobile' : 'desktop'}</span>
  }
  return render(
    <>
      {Array.from({ length: count }, (_, i) => (
        <Probe key={i} id={String.fromCharCode(97 + i)} />
      ))}
    </>
  )
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  cleanup()
  setTouch(false)
  vi.restoreAllMocks()
})

describe('useIsMobile', () => {
  it('è true solo con touch screen E viewport ≤ 767px', async () => {
    useMatchMedia(true, true)
    renderProbes(await loadHook())
    expect(screen.getByTestId('a').textContent).toBe('mobile')
  })

  it('è false su touch screen ma viewport desktop (matchMedia non match)', async () => {
    useMatchMedia(false, true)
    renderProbes(await loadHook())
    expect(screen.getByTestId('a').textContent).toBe('desktop')
  })

  it('è false su viewport stretto ma senza touch (desktop ridotto)', async () => {
    useMatchMedia(true, false)
    renderProbes(await loadHook())
    expect(screen.getByTestId('a').textContent).toBe('desktop')
  })

  it('reagisce ai cambi di viewport (change event)', async () => {
    useMatchMedia(false, true)
    renderProbes(await loadHook())
    expect(screen.getByTestId('a').textContent).toBe('desktop')

    act(() => mql.emit(true))
    expect(screen.getByTestId('a').textContent).toBe('mobile')
  })

  it('monta una sola sottoscrizione anche con N consumer (fix listener per-card)', async () => {
    useMatchMedia(true, true)
    renderProbes(await loadHook(), 3)

    // Un solo matchMedia e un solo listener `change` per 3 consumer
    expect(window.matchMedia).toHaveBeenCalledTimes(1)
    expect(mql.addEventListener).toHaveBeenCalledTimes(1)
    expect(mql.handlerCount()).toBe(1)
  })

  it('rimuove la sottoscrizione quando l’ultimo consumer viene smontato', async () => {
    useMatchMedia(true, true)
    const { unmount } = renderProbes(await loadHook(), 2)
    expect(mql.handlerCount()).toBe(1)

    unmount()
    expect(mql.handlerCount()).toBe(0)
    expect(mql.removeEventListener).toHaveBeenCalledTimes(1)
  })
})
