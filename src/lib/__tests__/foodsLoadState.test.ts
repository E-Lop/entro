import { describe, expect, it } from 'vitest'
import { foodsLoadState } from '../foodsLoadState'

/**
 * Cosa mostra la dashboard, dallo stato della query degli alimenti (#181).
 *
 * Fino alla v1.15 la dashboard guardava solo `data` e `isLoading`: una lettura
 * fallita diventava `[]` e quindi «Nessun alimento ancora». Dal 25 al 27 set
 * 2026 è successo a tutti per ~41 ore, e nessuno ha visto un errore (#179).
 */
describe('foodsLoadState', () => {
  const food = [{ id: 'f1' }]

  it('senza dati e con la lettura in corso: caricamento', () => {
    expect(foodsLoadState({ data: undefined, isError: false, fetchStatus: 'fetching' })).toBe('loading')
  })

  it('senza dati e con la lettura fallita: alimenti non disponibili', () => {
    expect(foodsLoadState({ data: undefined, isError: true, fetchStatus: 'idle' })).toBe('unavailable')
  })

  // Offline React Query non fallisce: mette la lettura in pausa. Senza dati
  // in cache non c'è niente da mostrare, e non è una dispensa vuota.
  it('senza dati e con la lettura in pausa, cioè offline: alimenti non disponibili', () => {
    expect(foodsLoadState({ data: undefined, isError: false, fetchStatus: 'paused' })).toBe('unavailable')
  })

  it('con i dati e un aggiornamento fallito: la lista resta, con un avviso', () => {
    expect(foodsLoadState({ data: food, isError: true, fetchStatus: 'idle' })).toBe('refresh-failed')
  })

  it('con i dati e la lettura riuscita: pronto, anche se sono zero alimenti', () => {
    expect(foodsLoadState({ data: food, isError: false, fetchStatus: 'idle' })).toBe('ready')
    expect(foodsLoadState({ data: [], isError: false, fetchStatus: 'idle' })).toBe('ready')
  })

  it('con i dati e una rilettura in corso o in pausa: pronto', () => {
    expect(foodsLoadState({ data: food, isError: false, fetchStatus: 'fetching' })).toBe('ready')
    expect(foodsLoadState({ data: food, isError: false, fetchStatus: 'paused' })).toBe('ready')
  })
})
