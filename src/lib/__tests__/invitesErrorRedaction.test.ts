/**
 * Il messaggio del server non arriva a schermo dagli inviti.
 *
 * Sorella di `foodsErrorRedaction.test.ts`, per l'altro file condiviso. Qui i
 * percorsi che arrivano davvero all'utente sono **quattro**, e non passano
 * tutti da un toast:
 *
 * | Componente                  | Funzione                      |
 * |-----------------------------|-------------------------------|
 * | `InviteDialog`              | `createInvite`                |
 * | `AcceptInviteFlowDialog`    | `validateInvite`              |
 * | `AcceptInviteDialog`        | `acceptInviteWithConfirmation`|
 * | `LeaveListDialog`           | `leaveSharedList`             |
 *
 * Le altre funzioni alimentano `authStore` e `AppLayout`, e sono coperte qui
 * perché stanno nello stesso file e nulla impedisce che domani finiscano a
 * schermo anche loro.
 *
 * Due sorgenti di testo straniero, non una:
 * - il messaggio del **server** (Postgres via `error.message`, oppure il campo
 *   `error` che una Edge Function restituisce nel corpo);
 * - le stringhe **inglesi scritte da noi** (`Unknown error`, `Not authenticated`,
 *   `Failed to create invite`), che non sono una fuga ma producono lo stesso
 *   effetto per chi legge.
 *
 * Resta fuori di proposito `row.error_message`, che le nostre RPC restituiscono
 * come prosa già destinata all'utente: è materia della #101, dove si decide se
 * debba diventare un codice.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

/** Come lo direbbe Postgres. */
const DB_MESSAGE = 'permission denied for table list_members'
/** Come lo direbbe una Edge Function nel corpo della risposta. */
const FUNCTION_MESSAGE = 'JWT expired at 1755000000'

const DB_ERROR = { message: DB_MESSAGE, code: '42501', details: null, hint: null }

const { mockAuth, mockFrom, mockRpc, setResult } = vi.hoisted(() => {
  let result: unknown = { data: null, error: null }

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
    mockAuth: { getSession: vi.fn(), getUser: vi.fn() },
    mockFrom: vi.fn(() => builder),
    // `rpc` restituisce il builder incatenabile, non una promessa:
    // `createPersonalList` chiama `supabase.rpc(...).single()`, e un oggetto
    // semplice la farebbe fallire con un TypeError **prima** del punto che si
    // vuole provare — verde su codice vecchio e nuovo insieme, cioè nessuna
    // prova. Il builder è comunque `then`-abile, quindi le chiamate che fanno
    // `await supabase.rpc(...)` continuano a funzionare.
    mockRpc: vi.fn(() => builder),
    setResult: (value: unknown) => {
      result = value
    },
  }
})

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: mockAuth, from: mockFrom, rpc: mockRpc },
}))

import {
  createInvite,
  validateInvite,
  registerPendingInvite,
  acceptInvite,
  acceptInviteByEmail,
  getUserList,
  getListMembers,
  createPersonalList,
  acceptInviteWithConfirmation,
  leaveSharedList,
} from '@/lib/invites'

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.getSession.mockResolvedValue({
    data: { session: { access_token: 'token', user: { id: 'user-1' } } },
  })
  mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  setResult({ data: null, error: DB_ERROR })

  // Ogni Edge Function risponde con un errore del server nel corpo.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: false,
      json: async () => ({ error: FUNCTION_MESSAGE }),
    }))
  )
})

const cases: [string, () => Promise<{ error: Error | null }>][] = [
  ['createInvite', () => createInvite('list-1')],
  ['validateInvite', () => validateInvite('ABC123')],
  ['registerPendingInvite', () => registerPendingInvite('ABC123', 'a@b.it')],
  ['acceptInvite', () => acceptInvite('ABC123')],
  ['acceptInviteByEmail', () => acceptInviteByEmail()],
  ['getUserList', () => getUserList()],
  ['getListMembers', () => getListMembers('list-1')],
  ['createPersonalList', () => createPersonalList()],
  ['acceptInviteWithConfirmation', () => acceptInviteWithConfirmation('ABC123')],
  ['leaveSharedList', () => leaveSharedList()],
]

describe('il messaggio del server non arriva a schermo dagli inviti', () => {
  it.each(cases)('%s non espone il testo del server', async (_name, call) => {
    const { error } = await call()

    expect(error).toBeInstanceOf(Error)
    expect(error!.message).not.toContain(DB_MESSAGE)
    expect(error!.message).not.toContain(FUNCTION_MESSAGE)
    expect(error!.message).not.toMatch(/permission denied|for table|JWT/i)
  })

  it.each(cases)('%s parla italiano', async (_name, call) => {
    const { error } = await call()

    // Le stringhe inglesi scritte da noi non sono una fuga, ma per chi legge
    // sono indistinguibili da una.
    expect(error!.message).not.toMatch(
      /Unknown error|Not authenticated|Failed to|List not found|No data returned/i
    )
  })
})
