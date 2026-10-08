import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Togliere un membro da una lista condivisa (#196).
 *
 * Il server decide chi può togliere, e risponde con codici: la frase la
 * sceglie il client, e il testo del server non arriva mai a schermo. L'avviso
 * per chi è stato tolto è una riga che il client legge una volta e cancella.
 */

const { mockRpc, mockFrom, calls, rpcResponse, tableResponse } = vi.hoisted(() => {
  const calls: { method: string; args: unknown[] }[] = []
  const rpcResponse: { value: { data: unknown; error: unknown } } = { value: { data: null, error: null } }
  const tableResponse: { value: { data: unknown; error: unknown } } = { value: { data: null, error: null } }

  const builder: Record<string, unknown> = {
    then: (resolve: (v: unknown) => unknown) => resolve(tableResponse.value),
  }
  for (const method of ['select', 'delete', 'eq', 'maybeSingle']) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args })
      return builder
    }
  }

  const mockFrom = vi.fn((table: string) => {
    calls.push({ method: 'from', args: [table] })
    return builder
  })
  const mockRpc = vi.fn(async (name: string, args?: unknown) => {
    calls.push({ method: 'rpc', args: args === undefined ? [name] : [name, args] })
    return rpcResponse.value
  })
  return { mockRpc, mockFrom, calls, rpcResponse, tableResponse }
})

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: mockRpc, from: mockFrom },
}))

import { getRemovableMembers, peekRemovalNotice, removeListMember, takeRemovalNotice } from '../invites'

beforeEach(() => {
  calls.length = 0
  mockRpc.mockClear()
  mockFrom.mockClear()
  rpcResponse.value = { data: null, error: null }
  tableResponse.value = { data: null, error: null }
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('getRemovableMembers', () => {
  it('chiede al server chi si può togliere, e ne tiene id e nome', async () => {
    rpcResponse.value = {
      data: [
        { user_id: 'u-b', display_name: 'Bruno Bianchi', joined_at: '2026-02-01T00:00:00Z' },
        { user_id: 'u-c', display_name: 'c@example.test', joined_at: null },
      ],
      error: null,
    }

    const { members, error } = await getRemovableMembers()

    expect(error).toBeNull()
    expect(members).toEqual([
      { userId: 'u-b', displayName: 'Bruno Bianchi' },
      { userId: 'u-c', displayName: 'c@example.test' },
    ])
    expect(calls).toContainEqual({ method: 'rpc', args: ['list_members_for_removal'] })
  })

  it('a chi non può togliere il server risponde zero righe: nessun membro, nessun errore', async () => {
    rpcResponse.value = { data: [], error: null }

    expect(await getRemovableMembers()).toEqual({ members: [], error: null })
  })

  it('un errore del server diventa una frase italiana, senza il testo di Postgres', async () => {
    rpcResponse.value = { data: null, error: { message: 'permission denied for function', code: '42501' } }

    const { members, error } = await getRemovableMembers()

    expect(members).toEqual([])
    expect(error?.message).toBe('Non è stato possibile caricare i membri della lista. Riprova.')
  })
})

describe('removeListMember', () => {
  it('chiama la RPC con l’utente da togliere', async () => {
    rpcResponse.value = { data: [{ success: true, error_message: null }], error: null }

    expect(await removeListMember('u-b')).toEqual({ success: true, error: null })
    expect(calls).toContainEqual({ method: 'rpc', args: ['remove_list_member', { p_user_id: 'u-b' }] })
  })

  it.each([
    ['not_authenticated', 'Sessione scaduta. Accedi di nuovo.'],
    ['not_authorized', 'Non puoi togliere membri da questa lista.'],
    ['not_a_member', 'Questa persona non fa più parte della lista.'],
    ['cannot_remove_self', 'Per uscire dalla lista usa «Abbandona lista condivisa».'],
    ['unexpected', 'Non è stato possibile togliere il membro. Riprova.'],
    ['un codice che non conosco', 'Non è stato possibile togliere il membro. Riprova.'],
  ])('il rifiuto %s diventa una frase', async (code, sentence) => {
    rpcResponse.value = { data: [{ success: false, error_message: code }], error: null }

    const result = await removeListMember('u-b')

    expect(result.success).toBe(false)
    expect(result.error?.message).toBe(sentence)
  })

  it('un errore del server non arriva a schermo', async () => {
    rpcResponse.value = { data: null, error: { message: 'deadlock detected', code: '40P01' } }

    const result = await removeListMember('u-b')

    expect(result.error?.message).toBe('Non è stato possibile togliere il membro. Riprova.')
  })
})

describe('takeRemovalNotice', () => {
  it('cancella l’avviso chiedendolo indietro, in un’istruzione sola: fra due schede lo riceve una', async () => {
    tableResponse.value = { data: [{ list_id: 'lista-di-prima' }], error: null }

    expect(await takeRemovalNotice('u-b', 'lista-di-oggi')).toBe(true)
    expect(calls.map((c) => c.method)).toEqual(['from', 'delete', 'eq', 'select'])
    expect(calls).toContainEqual({ method: 'from', args: ['list_removal_notices'] })
    // Una DELETE senza condizione il server la rifiuta.
    expect(calls).toContainEqual({ method: 'eq', args: ['user_id', 'u-b'] })
  })

  it('senza avviso non c’è niente da mostrare', async () => {
    tableResponse.value = { data: [], error: null }

    expect(await takeRemovalNotice('u-b', 'lista-di-oggi')).toBe(false)
  })

  it('chi nel frattempo è rientrato nella stessa lista non viene avvisato, e l’avviso sparisce lo stesso', async () => {
    tableResponse.value = { data: [{ list_id: 'lista-di-oggi' }], error: null }

    expect(await takeRemovalNotice('u-b', 'lista-di-oggi')).toBe(false)
    expect(calls.some((c) => c.method === 'delete')).toBe(true)
  })

  it('se il server non risponde non mostra niente e non solleva', async () => {
    tableResponse.value = { data: null, error: { message: 'boom' } }

    expect(await takeRemovalNotice('u-b', 'lista-di-oggi')).toBe(false)
  })
})

describe('peekRemovalNotice', () => {
  it('legge l’avviso senza cancellarlo', async () => {
    tableResponse.value = { data: { list_id: 'lista-di-prima' }, error: null }

    expect(await peekRemovalNotice()).toEqual({ listId: 'lista-di-prima' })
    expect(calls.some((c) => c.method === 'delete')).toBe(false)
  })

  it('senza avviso, o se la lettura fallisce, risponde null', async () => {
    tableResponse.value = { data: null, error: null }
    expect(await peekRemovalNotice()).toBeNull()

    tableResponse.value = { data: null, error: { message: 'boom' } }
    expect(await peekRemovalNotice()).toBeNull()
  })
})
