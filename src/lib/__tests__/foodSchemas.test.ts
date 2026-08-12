/**
 * Vincoli di `foodFormSchema` sulla quantità.
 *
 * La colonna è `numeric(10,2)` con `check (quantity > 0)`: la validazione client
 * deve rifiutare tutto ciò che il database rifiuterebbe, altrimenti il form
 * passa e la scrittura fallisce. Regola nel bundle condiviso,
 * `core/storage-and-units.md`.
 */
import { describe, it, expect } from 'vitest'
import { foodFormSchema } from '@/lib/validations/food.schemas'

/** Payload valido a cui sostituire il solo campo sotto esame. */
function payload(over: Record<string, unknown> = {}) {
  const domani = new Date()
  domani.setDate(domani.getDate() + 1)
  return {
    name: 'Yogurt greco',
    category_id: 'c1',
    expiry_date: domani.toISOString().slice(0, 10),
    storage_location: 'fridge' as const,
    ...over,
  }
}

function erroreQuantita(over: Record<string, unknown>): string | undefined {
  const result = foodFormSchema.safeParse(payload(over))
  if (result.success) return undefined
  return result.error.issues.find((i) => i.path[0] === 'quantity')?.message
}

describe('foodFormSchema — quantità', () => {
  it('accetta una quantità positiva', () => {
    expect(foodFormSchema.safeParse(payload({ quantity: 2 })).success).toBe(true)
  })

  it('accetta l\'assenza di quantità: `null` significa "non tracciata"', () => {
    expect(foodFormSchema.safeParse(payload({ quantity: null })).success).toBe(true)
  })

  it('accetta il campo omesso', () => {
    expect(foodFormSchema.safeParse(payload()).success).toBe(true)
  })

  it('rifiuta una quantità negativa', () => {
    expect(erroreQuantita({ quantity: -1 })).toBeTruthy()
  })

  it('rifiuta lo zero, che il database non accetta', () => {
    // `check (quantity > 0)`: zero non è "nessuna quantità", è una contraddizione
    // — se non ne hai più, l'alimento va togliersi dalla lista.
    expect(erroreQuantita({ quantity: 0 })).toBeTruthy()
  })

  it('rifiuta un positivo che si arrotonda a zero alla precisione della colonna', () => {
    // 0,004 supererebbe un controllo `> 0` fatto sul valore digitato, ma la
    // colonna `numeric(10,2)` lo memorizza come 0.00 e il CHECK scatta lì.
    expect(erroreQuantita({ quantity: 0.004 })).toBeTruthy()
  })

  it('accetta il più piccolo valore che la colonna può memorizzare', () => {
    expect(foodFormSchema.safeParse(payload({ quantity: 0.01 })).success).toBe(true)
  })
})
