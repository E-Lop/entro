import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { announceWriteError, getWriteErrorAnnouncement, subscribeWriteErrorAnnouncement } from '../writeErrorAnnouncer'

/**
 * L'annuncio degli errori di scrittura (#121). La regione con `role="alert"`
 * esiste già vuota, e l'annuncio è un cambio di contenuto: MDN avverte che un
 * elemento creato già pieno spesso non viene letto. Per lo stesso motivo lo
 * stesso messaggio ripetuto passa prima dal vuoto.
 */
describe('writeErrorAnnouncer', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('parte vuoto', () => {
    expect(getWriteErrorAnnouncement()).toBe('')
  })

  it('svuota, poi scrive il messaggio: il contenuto cambia anche se il messaggio è lo stesso di prima', () => {
    const seen: string[] = []
    const unsubscribe = subscribeWriteErrorAnnouncement(() => seen.push(getWriteErrorAnnouncement()))

    announceWriteError('Non è stato possibile salvare l\'alimento. Riprova.')
    vi.runAllTimers()
    announceWriteError('Non è stato possibile salvare l\'alimento. Riprova.')
    vi.runAllTimers()
    unsubscribe()

    expect(seen).toEqual([
      '',
      'Non è stato possibile salvare l\'alimento. Riprova.',
      '',
      'Non è stato possibile salvare l\'alimento. Riprova.',
    ])
  })
})
