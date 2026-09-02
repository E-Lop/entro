/**
 * Il guardiano delle forme leggibili delle unità: il codice deve dire quello
 * che dice il bundle.
 *
 * Terzo della serie dopo `expiryLabels.test.ts` e `storageLabels.test.ts`, su
 * una tabella diversa della stessa pagina di `core/`. Qui la tabella ha **due**
 * colonne di parole invece di una, perché una sola unità del vocabolario è un
 * sostantivo e le altre cinque sono simboli invariabili: è quella differenza
 * che il difetto entro-mobile#43 rendeva visibile come «1 confezioni», visto in
 * produzione su questa PWA prima ancora che sull'app.
 *
 * Le regole del gioco stanno in `bundleDiFamiglia.ts`, in particolare che
 * l'assenza del bundle è un **errore** e non un motivo per saltare.
 */
import { describe, expect, it } from 'vitest'
import { formeDelleUnita } from './bundleDiFamiglia'
import { quantityUnitEnum } from '@/lib/validations/food.schemas'
import { UNIT_FORMS, unitLabel } from '@/lib/unitLabels'

const PAGINA = 'storage-and-units'

describe('le forme delle unità dicono quello che dice il bundle', () => {
  it('la tabella del bundle copre esattamente il vocabolario di `QuantityUnit`', () => {
    const bundle = formeDelleUnita(PAGINA)

    // Stessa catena delle etichette dei luoghi: DDL → enum Zod → bundle →
    // codice, con un test per anello. Un'unità nuova nel `CHECK` non può
    // arrivare a schermo senza le sue due forme.
    expect([...bundle.keys()].sort()).toEqual([...quantityUnitEnum.options].sort())
  })

  it.each(quantityUnitEnum.options)('«%s» ha le forme che il bundle dichiara', (unita) => {
    expect(UNIT_FORMS[unita]).toEqual(formeDelleUnita(PAGINA).get(unita))
  })

  it('il codice non dichiara unità che il bundle non conosce', () => {
    expect(Object.keys(UNIT_FORMS).sort()).toEqual([...formeDelleUnita(PAGINA).keys()].sort())
  })

  it('una sola unità varia col numero, e il bundle lo dice', () => {
    // Non è pignoleria sul contenuto della tabella: è la ragione per cui qui
    // non serve un motore di plurali. Cinque simboli invariabili e un
    // sostantivo. Se un giorno ne variasse un'altra, questa riga fallisce e chi
    // legge scopre che l'assunzione va rivista, invece di ereditarla.
    const variabili = [...formeDelleUnita(PAGINA)].filter(([, f]) => f.one !== f.other).map(([u]) => u)

    expect(variabili).toEqual(['confezioni'])
  })
})

describe('la forma senza numero', () => {
  it("cita la generica — cioè il plurale — perché non c'è niente con cui accordarsi", () => {
    expect(unitLabel(null, 'confezioni')).toBe('confezioni')
    expect(unitLabel(undefined, 'pz')).toBe('pz')
  })
})
