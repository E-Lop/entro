// @vitest-environment jsdom
/**
 * La guardia sulle modifiche non salvate, nelle due cose che si rompono in
 * silenzio.
 *
 * La prima è **quando** trattiene: a form pulito deve lasciar passare, o
 * chiuderebbe con una domanda ogni dialogo appena aperto. La seconda è il
 * `beforeunload`, che dev'esserci **solo** quando serve: un listener sempre
 * registrato disabilita il bfcache del browser, cioè rallenta ogni navigazione
 * indietro per proteggere un caso quasi mai vero. È il genere di costo che non
 * si vede provando la funzione, perché la funzione funziona lo stesso.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'

import { useUnsavedChangesGuard } from '../useUnsavedChangesGuard'

describe('useUnsavedChangesGuard', () => {
  let added: string[]
  let removed: string[]

  beforeEach(() => {
    added = []
    removed = []
    vi.spyOn(window, 'addEventListener').mockImplementation(((kind: string) => {
      added.push(kind)
    }) as typeof window.addEventListener)
    vi.spyOn(window, 'removeEventListener').mockImplementation(((kind: string) => {
      removed.push(kind)
    }) as typeof window.removeEventListener)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('a form pulito lascia passare la chiusura, senza chiedere niente', () => {
    const close = vi.fn()
    const { result } = renderHook(() => useUnsavedChangesGuard(false))

    act(() => result.current.intercept(close)(false))

    expect(close).toHaveBeenCalledTimes(1)
    expect(result.current.isConfirmOpen).toBe(false)
  })

  it('a form sporco trattiene la chiusura e apre la conferma', () => {
    const close = vi.fn()
    const { result } = renderHook(() => useUnsavedChangesGuard(true))

    act(() => result.current.intercept(close)(false))

    expect(close).not.toHaveBeenCalled()
    expect(result.current.isConfirmOpen).toBe(true)
  })

  it('non intercetta l’apertura: la guardia riguarda solo l’uscita', () => {
    const close = vi.fn()
    const { result } = renderHook(() => useUnsavedChangesGuard(true))

    act(() => result.current.intercept(close)(true))

    expect(result.current.isConfirmOpen).toBe(false)
    expect(close).not.toHaveBeenCalled()
  })

  it('«Scarta» esegue la chiusura trattenuta e chiude la conferma', () => {
    const close = vi.fn()
    const { result } = renderHook(() => useUnsavedChangesGuard(true))

    act(() => result.current.intercept(close)(false))
    act(() => result.current.discard())

    expect(close).toHaveBeenCalledTimes(1)
    expect(result.current.isConfirmOpen).toBe(false)
  })

  it('«Annulla» non chiude niente e riporta al form', () => {
    const close = vi.fn()
    const { result } = renderHook(() => useUnsavedChangesGuard(true))

    act(() => result.current.intercept(close)(false))
    act(() => result.current.cancel())

    expect(close).not.toHaveBeenCalled()
    expect(result.current.isConfirmOpen).toBe(false)
  })

  it('registra `beforeunload` solo a form sporco', () => {
    const { rerender, unmount } = renderHook(
      ({ dirty }) => useUnsavedChangesGuard(dirty),
      { initialProps: { dirty: false } }
    )
    expect(added).not.toContain('beforeunload')

    rerender({ dirty: true })
    expect(added).toContain('beforeunload')

    // E lo toglie appena il form torna pulito: il bfcache non deve restare
    // disabilitato per un form che non ha più niente da perdere.
    rerender({ dirty: false })
    expect(removed).toContain('beforeunload')

    unmount()
  })

  it('`intercetta` non cambia identità mentre si digita', () => {
    // Altrimenti `Dialog` riceverebbe una prop nuova a ogni carattere.
    const { result, rerender } = renderHook(
      ({ dirty }) => useUnsavedChangesGuard(dirty),
      { initialProps: { dirty: false } }
    )
    const prima = result.current.intercept

    rerender({ dirty: true })

    expect(result.current.intercept).toBe(prima)
  })

  it('legge lo stato sporco **corrente**, non quello di quando è stata creata', () => {
    // È il rovescio del test sopra: se `intercetta` non cambia identità, deve
    // comunque vedere il valore aggiornato, o resterebbe ferma a «pulito».
    const close = vi.fn()
    const { result, rerender } = renderHook(
      ({ dirty }) => useUnsavedChangesGuard(dirty),
      { initialProps: { dirty: false } }
    )
    const intercept = result.current.intercept

    rerender({ dirty: true })
    act(() => intercept(close)(false))

    expect(close).not.toHaveBeenCalled()
    expect(result.current.isConfirmOpen).toBe(true)
  })
})
