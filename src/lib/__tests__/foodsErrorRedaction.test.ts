/**
 * Il messaggio del database non arriva a schermo.
 *
 * `useFoods` mostra `error.message` in un toast (creazione, aggiornamento,
 * eliminazione, stato). Finché le funzioni di `foods.ts` rilanciano
 * `new Error(error.message)`, quel toast stampa il messaggio di Postgres:
 * in inglese, col nome della tabella dentro, e potenzialmente con un
 * identificativo. La stessa decisione è già applicata su entro-mobile (#23),
 * dove il dettaglio tecnico resta in `cause`.
 *
 * Questi test guardano il *contratto d'errore* delle funzioni, non la resa:
 * ciò che l'utente legge è `message`, ciò che serve a diagnosticare è `cause`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

/** Un messaggio di Postgres realistico: inglese, con il nome della tabella. */
const DB_MESSAGE = 'new row violates row-level security policy for table "foods"'
const DB_ERROR = { message: DB_MESSAGE, code: '42501', details: null, hint: null }

const { mockAuth, mockFrom, setResult } = vi.hoisted(() => {
  let result: unknown = { data: null, error: null }

  /** Builder incatenabile: ogni metodo torna se stesso, e l'attesa risolve il risultato. */
  const builder: Record<string, unknown> = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'then') {
          return (onOk: (v: unknown) => unknown, onErr: (e: unknown) => unknown) =>
            Promise.resolve(result).then(onOk, onErr)
        }
        if (prop === 'single' || prop === 'maybeSingle') {
          return () => Promise.resolve(result)
        }
        return () => builder
      },
    }
  )

  return {
    mockAuth: { getSession: vi.fn() },
    mockFrom: vi.fn(() => builder),
    setResult: (value: unknown) => {
      result = value
    },
  }
})

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: mockAuth, from: mockFrom },
}))

vi.mock('@/lib/storage', () => ({
  deleteFoodImage: vi.fn(),
}))

vi.mock('@/lib/pendingImages', () => ({
  isPendingUrl: () => false,
  deletePendingImage: vi.fn(),
}))

import {
  getCategories,
  getFoods,
  getFoodById,
  updateFood,
  softDeleteFood,
  updateFoodStatus,
} from '@/lib/foods'

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.getSession.mockResolvedValue({
    data: { session: { user: { id: 'user-1' } } },
    error: null,
  })
  setResult({ data: null, error: DB_ERROR })
})

/**
 * Ogni voce è una funzione che, con il database che rifiuta, deve tornare un
 * errore leggibile da un utente italiano e conservare l'originale in `cause`.
 */
const casi: [string, () => Promise<{ error: Error | null }>][] = [
  ['getCategories', () => getCategories()],
  ['getFoods', () => getFoods()],
  ['getFoodById', () => getFoodById('food-1')],
  ['updateFood', () => updateFood('food-1', { name: 'Latte' })],
  ['softDeleteFood', () => softDeleteFood('food-1', 'consumed')],
  ['updateFoodStatus', () => updateFoodStatus('food-1', 'consumed')],
]

describe('il messaggio del database non arriva a schermo', () => {
  it.each(casi)('%s non mette il messaggio di Postgres in error.message', async (_nome, chiama) => {
    const { error } = await chiama()

    expect(error).toBeInstanceOf(Error)
    expect(error!.message).not.toContain(DB_MESSAGE)
    // Le due spie che rendono riconoscibile un messaggio del database anche se
    // il testo cambia: il nome della tabella e il gergo della policy.
    expect(error!.message).not.toMatch(/row-level security|violates|for table/i)
  })

  it.each(casi)('%s conserva l\'errore originale in error.cause', async (_nome, chiama) => {
    const { error } = await chiama()

    expect(error!.cause).toBe(DB_ERROR)
  })
})
