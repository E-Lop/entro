/**
 * Chi è dentro non manda richieste da anonimo (#229, gemella di
 * entro-mobile#259).
 *
 * Il client è quello **vero**: il difetto sta in due comportamenti di
 * supabase-js e auth-js messi insieme, e un mock li avrebbe riscritti a mano.
 * Finto è solo `fetch`, cioè la rete.
 */
import { createClient } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSessionBoundFetch } from '../sessionBoundFetch'
import { isHeldBackRequest } from '../heldBackRequests'

const URL = 'https://probe.supabase.co'
const PUBLIC_KEY = 'public-key-for-tests'
const STORAGE_KEY = 'sb-probe-auth-token'

/** Un JWT ben formato, con dentro niente: la firma non la guarda nessuno qui. */
function token(expiresAt: number): string {
  const part = (value: object) =>
    btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${part({ alg: 'HS256', typ: 'JWT' })}.${part({ sub: 'user-a', exp: expiresAt })}.signature`
}

function storedSession(expiresAt: number) {
  return JSON.stringify({
    access_token: token(expiresAt),
    refresh_token: 'refresh-a',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: expiresAt,
    user: { id: 'user-a', aud: 'authenticated', email: 'a@example.test' },
  })
}

function memoryStorage(session: string | null) {
  const items = new Map<string, string>()
  if (session) items.set(STORAGE_KEY, session)
  return {
    getItem: async (key: string) => items.get(key) ?? null,
    setItem: async (key: string, value: string) => void items.set(key, value),
    removeItem: async (key: string) => void items.delete(key),
  }
}

type Call = { target: string; authorization: string | null }

/**
 * La rete: il rinnovo del token risponde come dice `refresh`, i dati come un
 * server vero risponde a un anonimo.
 */
function network(refresh: 'unreachable' | 'rejected') {
  const calls: Call[] = []
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const target = String(input)
    calls.push({ target, authorization: new Headers(init?.headers).get('Authorization') })

    if (target.includes('/auth/v1/token')) {
      if (refresh === 'unreachable') throw new TypeError('Failed to fetch')
      return new Response(
        JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid Refresh Token' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    return new Response(
      JSON.stringify({ code: '42501', message: 'permission denied for table foods' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )
  }) as typeof fetch
  return { calls, fetchImpl }
}

function client(fetchImpl: typeof fetch, session: string | null) {
  return createClient(URL, PUBLIC_KEY, {
    auth: {
      storage: memoryStorage(session),
      storageKey: STORAGE_KEY,
      autoRefreshToken: false,
      persistSession: true,
      detectSessionInUrl: false,
    },
    global: { fetch: fetchImpl },
  })
}

/**
 * auth-js ritenta il rinnovo per una trentina di secondi, e con una sessione
 * scaduta lo fa due volte: all'avvio del client e alla lettura.
 */
async function settle<T>(pending: PromiseLike<T>): Promise<T> {
  // A passi: un giro di rinnovo programmato dopo un anticipo solo non
  // scatterebbe mai, e la lettura resterebbe appesa.
  let done = false
  const result = Promise.resolve(pending).finally(() => {
    done = true
  })
  for (let step = 0; step < 30 && !done; step++) await vi.advanceTimersByTimeAsync(10_000)
  return result
}

const alreadyExpired = () => Math.floor(Date.now() / 1000) - 3600
const stillValid = () => Math.floor(Date.now() / 1000) + 3600
const dataCalls = (calls: Call[]) => calls.filter((call) => call.target.includes('/rest/v1/'))
const readFoods = (c: ReturnType<typeof client>) => c.from('foods').select('*')

describe('chi è dentro non manda richieste da anonimo', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('senza la regola, a rinnovo fallito la lettura parte con la chiave pubblica', async () => {
    // È il difetto, fissato qui perché il giorno in cui la libreria cambia
    // comportamento questo test cade e la regola si può togliere.
    const { calls, fetchImpl } = network('unreachable')

    const result = await settle(readFoods(client(fetchImpl, storedSession(alreadyExpired()))))

    expect(dataCalls(calls)).toEqual([
      expect.objectContaining({ authorization: `Bearer ${PUBLIC_KEY}` }),
    ])
    expect(result.status).toBe(401)
  })

  it('token scaduto e rete assente: nessuna lettura parte, e fallisce come una rete assente', async () => {
    const { calls, fetchImpl } = network('unreachable')
    const bound = createSessionBoundFetch({ publicKey: PUBLIC_KEY, hasUser: () => true, fetchImpl })

    const result = await settle(readFoods(client(bound, storedSession(alreadyExpired()))))

    expect(dataCalls(calls)).toEqual([])
    expect(calls.some((call) => call.target.includes('/auth/v1/token'))).toBe(true)
    // postgrest-js trasforma un `fetch` che lancia in un errore con status 0.
    expect(result.status).toBe(0)
    expect(result.data).toBeNull()
  })

  it('il rinnovo passa anche se porta la chiave pubblica: è da lì che il token torna', async () => {
    const { calls, fetchImpl } = network('rejected')
    const bound = createSessionBoundFetch({ publicKey: PUBLIC_KEY, hasUser: () => true, fetchImpl })

    await settle(readFoods(client(bound, storedSession(alreadyExpired()))))

    expect(calls.filter((call) => call.target.includes('/auth/v1/token'))).toHaveLength(1)
    expect(dataCalls(calls)).toEqual([])
  })

  it('con un token valido la lettura parte, col token dell’utente', async () => {
    const { calls, fetchImpl } = network('unreachable')
    const expiresAt = stillValid()
    const bound = createSessionBoundFetch({ publicKey: PUBLIC_KEY, hasUser: () => true, fetchImpl })

    await settle(readFoods(client(bound, storedSession(expiresAt))))

    expect(dataCalls(calls)).toEqual([
      expect.objectContaining({ authorization: `Bearer ${token(expiresAt)}` }),
    ])
  })

  it('chi non è dentro manda richieste da anonimo come prima: accesso, registrazione, invito', async () => {
    // Prima dell'accesso l'anonimo è l'unico modo di parlare col server.
    const { calls, fetchImpl } = network('unreachable')
    const bound = createSessionBoundFetch({ publicKey: PUBLIC_KEY, hasUser: () => false, fetchImpl })

    await settle(readFoods(client(bound, null)))

    expect(dataCalls(calls)).toEqual([
      expect.objectContaining({ authorization: `Bearer ${PUBLIC_KEY}` }),
    ])
  })
})

describe('riconoscere una richiesta trattenuta', () => {
  it('riconosce l’errore della regola, e non un errore di rete qualunque', async () => {
    const bound = createSessionBoundFetch({
      publicKey: PUBLIC_KEY,
      hasUser: () => true,
      fetchImpl: (async () => new Response('{}')) as typeof fetch,
    })

    const held = await bound(`${URL}/rest/v1/foods`, {
      headers: { Authorization: `Bearer ${PUBLIC_KEY}` },
    }).catch((error: unknown) => error)

    expect(isHeldBackRequest(held)).toBe(true)
    expect(isHeldBackRequest(new TypeError('Failed to fetch'))).toBe(false)
    expect(isHeldBackRequest(new Error('Request held back: no session token available'))).toBe(false)
    expect(isHeldBackRequest(null)).toBe(false)
  })

  it('riconosce l’errore anche quando arriva avvolto da postgrest-js', () => {
    // postgrest-js mette il messaggio del `fetch` fallito nel suo errore.
    expect(
      isHeldBackRequest({ message: 'TypeError: Request held back: no session token available', code: '' }),
    ).toBe(true)
  })
})
