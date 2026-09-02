import { describe, it, expect } from 'vitest'
import {
  stepForUnit,
  isIntegerUnit,
  minForUnit,
  clampQuantity,
  incrementQuantity,
  canDecrement,
  decrementQuantity,
  formatQuantity,
  DEFAULT_QUANTITY_UNIT,
} from '../quantity'
import type { QuantityUnit } from '@/types/food.types'

describe('quantity — step e tipo per unità', () => {
  it('usa step 1 per le unità intere (pz, confezioni)', () => {
    expect(stepForUnit('pz')).toBe(1)
    expect(stepForUnit('confezioni')).toBe(1)
  })

  it('usa step frazionari per peso/volume (kg/l = 0.1, g/ml = 10)', () => {
    expect(stepForUnit('kg')).toBe(0.1)
    expect(stepForUnit('l')).toBe(0.1)
    expect(stepForUnit('g')).toBe(10)
    expect(stepForUnit('ml')).toBe(10)
  })

  it('senza unità applica il default pz (step 1, intero)', () => {
    expect(stepForUnit(null)).toBe(1)
    expect(isIntegerUnit(null)).toBe(true)
    expect(DEFAULT_QUANTITY_UNIT).toBe('pz')
  })

  it('classifica intere solo pz e confezioni', () => {
    expect(isIntegerUnit('pz')).toBe(true)
    expect(isIntegerUnit('confezioni')).toBe(true)
    expect(isIntegerUnit('kg')).toBe(false)
    expect(isIntegerUnit('g')).toBe(false)
    expect(isIntegerUnit('l')).toBe(false)
    expect(isIntegerUnit('ml')).toBe(false)
  })

  it('il minimo coincide con lo step', () => {
    expect(minForUnit('pz')).toBe(1)
    expect(minForUnit('kg')).toBe(0.1)
    expect(minForUnit('g')).toBe(10)
  })
})

describe('quantity — clamp (business rule: DB richiede > 0)', () => {
  it('null, NaN, zero e negativi vengono portati al minimo', () => {
    expect(clampQuantity(null, 'pz')).toBe(1)
    expect(clampQuantity(undefined, 'pz')).toBe(1)
    expect(clampQuantity(Number.NaN, 'pz')).toBe(1)
    expect(clampQuantity(0, 'pz')).toBe(1)
    expect(clampQuantity(-5, 'pz')).toBe(1)
    expect(clampQuantity(0, 'kg')).toBe(0.1)
  })

  it('arrotonda alla precisione DB (2 decimali)', () => {
    expect(clampQuantity(0.30000000000000004, 'kg')).toBe(0.3)
    expect(clampQuantity(2.005, 'kg')).toBe(2.01)
  })

  it('lascia intatti i valori validi', () => {
    expect(clampQuantity(3, 'pz')).toBe(3)
    expect(clampQuantity(1.5, 'kg')).toBe(1.5)
  })
})

describe('quantity — increment', () => {
  it('da null parte dal minimo dell\'unità (primo + imposta la quantità)', () => {
    expect(incrementQuantity(null, 'pz')).toBe(1)
    expect(incrementQuantity(null, 'kg')).toBe(0.1)
    expect(incrementQuantity(null, null)).toBe(1)
  })

  it('aggiunge uno step senza deriva dei float', () => {
    expect(incrementQuantity(1, 'pz')).toBe(2)
    expect(incrementQuantity(0.1, 'kg')).toBe(0.2)
    expect(incrementQuantity(0.2, 'kg')).toBe(0.3) // no 0.30000000000000004
    expect(incrementQuantity(90, 'g')).toBe(100)
  })
})

describe('quantity — decrement (safeguard distruttivo: mai 0)', () => {
  it('non consente di scendere sotto il minimo', () => {
    expect(canDecrement(1, 'pz')).toBe(false) // 1 - 1 = 0 < min
    expect(canDecrement(0.1, 'kg')).toBe(false)
    expect(canDecrement(null, 'pz')).toBe(false)
  })

  it('consente il decremento quando il risultato resta ≥ minimo', () => {
    expect(canDecrement(2, 'pz')).toBe(true)
    expect(canDecrement(0.2, 'kg')).toBe(true)
  })

  it('decrementa di uno step o lascia invariato se bloccato', () => {
    expect(decrementQuantity(2, 'pz')).toBe(1)
    expect(decrementQuantity(1, 'pz')).toBe(1) // bloccato al minimo
    expect(decrementQuantity(0.3, 'kg')).toBe(0.2)
    expect(decrementQuantity(null, 'pz')).toBeNull()
  })
})

describe('quantity — formato', () => {
  it('rende "valore unità" e "—" per quantità mancante', () => {
    expect(formatQuantity(null, 'pz')).toBe('—')
    expect(formatQuantity(1, 'pz')).toBe('1 pz')
    expect(formatQuantity(2, 'confezioni')).toBe('2 confezioni')
    expect(formatQuantity(0.1, 'kg')).toBe('0.1 kg')
    expect(formatQuantity(1, null)).toBe('1 pz')
  })

  // Il difetto visto in produzione sulle card («Petto di pollo (1 confezioni)»)
  // si chiude qui, e il test non asserisce «la stringa è quella»: asserisce che
  // 1 e 2 della stessa unità producono forme **diverse**. Con la sola stringa
  // attesa sarebbe verde anche il codice che concatena e basta — è così che «1
  // confezioni» è sopravvissuto a una suite intera (entro-mobile#43).
  it("accorda col numero l'unica unità che varia", () => {
    expect(formatQuantity(1, 'confezioni')).toBe('1 confezione')
    expect(formatQuantity(2, 'confezioni')).toBe('2 confezioni')

    // La regola, non le due stringhe: stessa unità, parola diversa.
    const [, aUno] = formatQuantity(1, 'confezioni').split(' ')
    const [, aDue] = formatQuantity(2, 'confezioni').split(' ')
    expect(aUno).not.toBe(aDue)
  })

  // Le altre cinque sono simboli: `kg` resta `kg` a qualsiasi numero, e
  // pluralizzarli sarebbe il difetto opposto.
  it.each(['pz', 'kg', 'g', 'l', 'ml'] as QuantityUnit[])(
    '«%s» è un simbolo e non cambia fra 1 e 2',
    (unita) => {
      expect(formatQuantity(1, unita)).toBe(`1 ${unita}`)
      expect(formatQuantity(2, unita)).toBe(`2 ${unita}`)
    }
  )
})
