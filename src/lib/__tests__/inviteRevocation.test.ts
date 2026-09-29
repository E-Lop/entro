import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * I propri inviti attivi e la loro revoca (#194).
 *
 * La lettura filtra per chi l'ha creato, stato pending e scadenza futura. La
 * revoca è una DELETE su invites, che la policy consente solo al creatore: una
 * DELETE filtrata dalla policy non è un errore, tocca zero righe, e il client
 * lo deve dire invece di annunciare una revoca che non è avvenuta.
 */

const { mockAuth, mockFrom, calls, response } = vi.hoisted(() => {
  const calls: { method: string; args: unknown[] }[] = []
  // Ciò con cui risolve la query: lo decide ogni test.
  const response: { value: { data: unknown; error: unknown } } = { value: { data: null, error: null } }

  // Un builder che registra ogni chiamata e, atteso, risolve con `response`.
  const builder: Record<string, unknown> = {
    then: (resolve: (v: unknown) => unknown) => resolve(response.value),
  }
  for (const method of ['select', 'eq', 'gt', 'order', 'delete']) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args })
      return builder
    }
  }

  const mockFrom = vi.fn((table: string) => {
    calls.push({ method: 'from', args: [table] })
    return builder
  })
  const mockAuth = { getSession: vi.fn() }
  return { mockAuth, mockFrom, calls, response }
})

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: mockAuth, from: mockFrom },
}))

import { getMyActiveInvites, revokeInvite } from '../invites'

function resolveWith(value: { data: unknown; error: unknown }) {
  response.value = value
}

beforeEach(() => {
  calls.length = 0
  mockFrom.mockClear()
  response.value = { data: null, error: null }
  mockAuth.getSession.mockResolvedValue({
    data: { session: { user: { id: 'user-a' }, access_token: 't' } },
    error: null,
  })
})

describe('getMyActiveInvites', () => {
  it('legge solo i propri inviti pending non scaduti, dal più vicino alla scadenza', async () => {
    resolveWith({
      data: [{ id: 'i1', short_code: 'ABC123', created_at: '2026-09-25T10:00:00Z', expires_at: '2026-10-02T10:00:00Z' }],
      error: null,
    })

    const { invites, error } = await getMyActiveInvites()

    expect(error).toBeNull()
    expect(invites).toEqual([
      { id: 'i1', short_code: 'ABC123', created_at: '2026-09-25T10:00:00Z', expires_at: '2026-10-02T10:00:00Z' },
    ])
    // Il codice da solo non si riconosce: il dialogo mostra anche quando è stato creato.
    expect(calls).toContainEqual({ method: 'select', args: ['id, short_code, created_at, expires_at'] })
    expect(calls).toContainEqual({ method: 'from', args: ['invites'] })
    expect(calls).toContainEqual({ method: 'eq', args: ['created_by', 'user-a'] })
    expect(calls).toContainEqual({ method: 'eq', args: ['status', 'pending'] })
    expect(calls.some((c) => c.method === 'gt' && c.args[0] === 'expires_at')).toBe(true)
    expect(calls).toContainEqual({ method: 'order', args: ['expires_at', { ascending: true }] })
  })

  it('senza sessione non legge niente', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null })

    const { invites, error } = await getMyActiveInvites()

    expect(invites).toEqual([])
    expect(error?.message).toBe('Sessione scaduta. Accedi di nuovo.')
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('un errore del server diventa una frase italiana, senza il testo di Postgres', async () => {
    resolveWith({ data: null, error: { message: 'permission denied for table invites', code: '42501' } })

    const { invites, error } = await getMyActiveInvites()

    expect(invites).toEqual([])
    expect(error?.message).toBe('Non è stato possibile caricare i tuoi inviti. Riprova.')
  })
})

describe('revokeInvite', () => {
  it('cancella l\'invito con quell\'id e chiede indietro la riga', async () => {
    resolveWith({ data: [{ id: 'i1' }], error: null })

    const result = await revokeInvite('i1')

    expect(result).toEqual({ success: true, error: null })
    expect(calls).toContainEqual({ method: 'delete', args: [] })
    expect(calls).toContainEqual({ method: 'eq', args: ['id', 'i1'] })
    expect(calls).toContainEqual({ method: 'select', args: ['id'] })
  })

  it('zero righe cancellate non è una revoca riuscita', async () => {
    resolveWith({ data: [], error: null })

    const result = await revokeInvite('i1')

    expect(result.success).toBe(false)
    expect(result.error?.message).toBe('Invito non trovato: forse è già stato revocato.')
  })

  it('un errore del server diventa una frase italiana, senza il testo di Postgres', async () => {
    resolveWith({ data: null, error: { message: 'permission denied for table invites', code: '42501' } })

    const result = await revokeInvite('i1')

    expect(result.success).toBe(false)
    expect(result.error?.message).toBe('Non è stato possibile revocare l\'invito. Riprova.')
  })
})
