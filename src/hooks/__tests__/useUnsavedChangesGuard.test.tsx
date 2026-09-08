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
  let aggiunti: string[]
  let tolti: string[]

  beforeEach(() => {
    aggiunti = []
    tolti = []
    vi.spyOn(window, 'addEventListener').mockImplementation(((tipo: string) => {
      aggiunti.push(tipo)
    }) as typeof window.addEventListener)
    vi.spyOn(window, 'removeEventListener').mockImplementation(((tipo: string) => {
      tolti.push(tipo)
    }) as typeof window.removeEventListener)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('a form pulito lascia passare la chiusura, senza chiedere niente', () => {
    const chiudi = vi.fn()
    const { result } = renderHook(() => useUnsavedChangesGuard(false))

    act(() => result.current.intercetta(chiudi)(false))

    expect(chiudi).toHaveBeenCalledTimes(1)
    expect(result.current.isConfirmOpen).toBe(false)
  })

  it('a form sporco trattiene la chiusura e apre la conferma', () => {
    const chiudi = vi.fn()
    const { result } = renderHook(() => useUnsavedChangesGuard(true))

    act(() => result.current.intercetta(chiudi)(false))

    expect(chiudi).not.toHaveBeenCalled()
    expect(result.current.isConfirmOpen).toBe(true)
  })

  it('non intercetta l’apertura: la guardia riguarda solo l’uscita', () => {
    const chiudi = vi.fn()
    const { result } = renderHook(() => useUnsavedChangesGuard(true))

    act(() => result.current.intercetta(chiudi)(true))

    expect(result.current.isConfirmOpen).toBe(false)
    expect(chiudi).not.toHaveBeenCalled()
  })

  it('«Scarta» esegue la chiusura trattenuta e chiude la conferma', () => {
    const chiudi = vi.fn()
    const { result } = renderHook(() => useUnsavedChangesGuard(true))

    act(() => result.current.intercetta(chiudi)(false))
    act(() => result.current.scarta())

    expect(chiudi).toHaveBeenCalledTimes(1)
    expect(result.current.isConfirmOpen).toBe(false)
  })

  it('«Annulla» non chiude niente e riporta al form', () => {
    const chiudi = vi.fn()
    const { result } = renderHook(() => useUnsavedChangesGuard(true))

    act(() => result.current.intercetta(chiudi)(false))
    act(() => result.current.annulla())

    expect(chiudi).not.toHaveBeenCalled()
    expect(result.current.isConfirmOpen).toBe(false)
  })

  it('registra `beforeunload` solo a form sporco', () => {
    const { rerender, unmount } = renderHook(
      ({ sporco }) => useUnsavedChangesGuard(sporco),
      { initialProps: { sporco: false } }
    )
    expect(aggiunti).not.toContain('beforeunload')

    rerender({ sporco: true })
    expect(aggiunti).toContain('beforeunload')

    // E lo toglie appena il form torna pulito: il bfcache non deve restare
    // disabilitato per un form che non ha più niente da perdere.
    rerender({ sporco: false })
    expect(tolti).toContain('beforeunload')

    unmount()
  })

  it('`intercetta` non cambia identità mentre si digita', () => {
    // Altrimenti `Dialog` riceverebbe una prop nuova a ogni carattere.
    const { result, rerender } = renderHook(
      ({ sporco }) => useUnsavedChangesGuard(sporco),
      { initialProps: { sporco: false } }
    )
    const prima = result.current.intercetta

    rerender({ sporco: true })

    expect(result.current.intercetta).toBe(prima)
  })

  it('legge lo stato sporco **corrente**, non quello di quando è stata creata', () => {
    // È il rovescio del test sopra: se `intercetta` non cambia identità, deve
    // comunque vedere il valore aggiornato, o resterebbe ferma a «pulito».
    const chiudi = vi.fn()
    const { result, rerender } = renderHook(
      ({ sporco }) => useUnsavedChangesGuard(sporco),
      { initialProps: { sporco: false } }
    )
    const intercetta = result.current.intercetta

    rerender({ sporco: true })
    act(() => intercetta(chiudi)(false))

    expect(chiudi).not.toHaveBeenCalled()
    expect(result.current.isConfirmOpen).toBe(true)
  })
})
