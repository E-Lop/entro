/**
 * Le scritture ritentano solo una richiesta trattenuta (#229).
 *
 * Il tentativo dopo va in pausa, perché `heldBackRequests` ha messo React
 * Query offline: è così che la scrittura resta in coda invece di annullarsi.
 * Ogni altro errore resta com'era, cioè senza tentativi (il default delle
 * mutazioni è 0, `mutation.ts:199` di `@tanstack/query-core`).
 */
import { describe, expect, it } from 'vitest'
import { queryClient } from '../queryClient'

const retry = queryClient.getDefaultOptions().mutations?.retry as (
  failureCount: number,
  error: unknown,
) => boolean

describe('le scritture e i tentativi', () => {
  it('una richiesta trattenuta si ritenta, anche più volte', () => {
    const heldBack = { message: 'TypeError: Request held back: no session token available', code: '' }
    expect(retry(0, heldBack)).toBe(true)
    expect(retry(5, heldBack)).toBe(true)
  })

  it('un rifiuto del server o un errore di rete qualunque no, come prima', () => {
    expect(retry(0, { message: 'permission denied for table foods', code: '42501' })).toBe(false)
    expect(retry(0, { message: 'TypeError: Failed to fetch', code: '' })).toBe(false)
    expect(retry(0, new Error('Nessun dato restituito'))).toBe(false)
  })
})
