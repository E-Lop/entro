/**
 * Il guardiano delle etichette dei luoghi: il codice deve dire quello che dice
 * il bundle.
 *
 * Gemello di `expiryLabels.test.ts`, su un'altra pagina di `core/`. La
 * differenza rispetto a quella fetta vale la pena nominarla: lì le parole erano
 * copiate a mano da un client all'altro; qui erano copiate **dal bundle**, e
 * correttamente. Il difetto non era la divergenza ma la sua invisibilità — la
 * fonte era prosa, e nessun test può leggere la prosa.
 *
 * Le regole del gioco stanno in `bundleDiFamiglia.ts`, in particolare che
 * l'assenza del bundle è un **errore** e non un motivo per saltare.
 */
import { describe, expect, it } from 'vitest'
import { etichetteDellaPagina } from './bundleDiFamiglia'
import { storageLocationEnum } from '@/lib/validations/food.schemas'
import { STORAGE_LABELS } from '@/lib/storageLabels'

const PAGINA = 'storage-and-units'

describe('le etichette dei luoghi dicono quello che dice il bundle', () => {
  it('la tabella del bundle copre esattamente il vocabolario di `StorageLocation`', () => {
    const bundle = etichetteDellaPagina(PAGINA)

    // Il confronto è con l'enum Zod, allineato al `CHECK` del database. Ne
    // segue una catena intera: DDL → enum → bundle → codice, e ogni anello ha
    // il suo test. Un luogo nuovo nel database non può arrivare a schermo
    // senza parola.
    expect([...bundle.keys()].sort()).toEqual([...storageLocationEnum.options].sort())
  })

  it.each(storageLocationEnum.options)('«%s» ha l’etichetta che il bundle dichiara', (luogo) => {
    const atteso = etichetteDellaPagina(PAGINA).get(luogo)

    // Qui, a differenza degli stati di scadenza, non esiste il caso
    // *conteggio*: ogni luogo ha una parola fissa. Se il bundle smettesse di
    // darla, è un difetto del bundle e va detto invece che tollerato.
    expect(atteso).not.toBeNull()
    expect(STORAGE_LABELS[luogo]).toBe(atteso)
  })

  it('il codice non dichiara etichette che il bundle non conosce', () => {
    expect(Object.keys(STORAGE_LABELS).sort()).toEqual(
      [...etichetteDellaPagina(PAGINA).keys()].sort()
    )
  })
})
