/**
 * Cosa mostra la dashboard, dallo stato della query degli alimenti (#181).
 *
 * - `loading`: nessun dato, lettura in corso.
 * - `unavailable`: nessun dato da mostrare, perché la lettura è fallita dopo
 *   i tentativi di React Query, oppure è in pausa perché si è offline. Non è
 *   una dispensa vuota, e non va detto che lo sia.
 * - `refresh-failed`: i dati ci sono (da una lettura precedente o dalla cache
 *   persistita) ma l'ultimo aggiornamento è fallito. La lista resta.
 * - `ready`: i dati ci sono. Zero alimenti qui è una dispensa davvero vuota.
 */
export type FoodsLoadState = 'loading' | 'unavailable' | 'refresh-failed' | 'ready'

export interface FoodsQueryState {
  data: unknown
  isError: boolean
  fetchStatus: 'fetching' | 'paused' | 'idle'
}

export function foodsLoadState({ data, isError, fetchStatus }: FoodsQueryState): FoodsLoadState {
  if (data === undefined) {
    if (isError || fetchStatus === 'paused') return 'unavailable'
    return 'loading'
  }
  return isError ? 'refresh-failed' : 'ready'
}
