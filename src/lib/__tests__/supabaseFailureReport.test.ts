/**
 * Il `fetch` che segnala le richieste fallite (#192), con il client
 * supabase-js **installato qui** e un `fetch` finto.
 *
 * Il comportamento del modulo lo provano i test di entro-mobile, sul codice
 * che `supabaseFailureReportParity.family.test.ts` tiene uguale. Qui si prova
 * ciò che dipende dalla libreria di questo repo: postgrest-js 2.98 non ripete
 * le letture (le ripetizioni sono arrivate con la 2.102), e una lettura fallita
 * deve arrivare lo stesso, allo scadere dell'attesa.
 */
import { createClient } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFailureReportingFetch, type SupabaseFailure } from '../supabaseFailureReport'

const SUPABASE_URL = 'https://progetto.supabase.co'

/** Testo riconoscibile: se compare in una segnalazione, è uscito qualcosa di troppo. */
const LEAK = 'TRACCIA-RICONOSCIBILE'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

class NoSocket {}

function clientWith(statuses: number[]) {
  const reports: SupabaseFailure[] = []
  let calls = 0
  const fake = (async () => {
    const status = statuses[Math.min(calls, statuses.length - 1)]
    calls += 1
    if (status === 0) throw new TypeError(`Failed to fetch ${LEAK}`)
    if (status < 400) return jsonResponse(status, [])
    return jsonResponse(status, { code: status === 403 ? '42501' : 'PGRST002', message: LEAK, details: LEAK, hint: LEAK })
  }) as typeof fetch
  const client = createClient(SUPABASE_URL, 'chiave-pubblica', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: createFailureReportingFetch({
        supabaseUrl: SUPABASE_URL,
        report: (failure) => reports.push(failure),
        fetchImpl: fake,
      }),
    },
    // La CI ha Node 20, senza `WebSocket` nativo: realtime-js lo cercherebbe
    // già alla creazione del client.
    realtime: { transport: NoSocket as never },
  })
  return { client, reports, calls: () => calls }
}

// Solo i timer delle attese: il corpo di una `Response` di Node si legge da uno
// stream che passa da `nextTick` e `setImmediate`.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
})
afterEach(() => {
  vi.useRealTimers()
})

describe('con postgrest-js 2.98, che non ripete', () => {
  it('una lettura rifiutata si segnala subito, con code, status e operazione', async () => {
    const { client, reports } = clientWith([403])

    await client.from('foods').select('*').eq('id', LEAK)
    await vi.advanceTimersByTimeAsync(0)

    expect(reports).toEqual([
      { title: 'Supabase rest request failed', operation: 'GET rest/foods', code: '42501', status: 403 },
    ])
    expect(JSON.stringify(reports)).not.toContain(LEAK)
  })

  it.each([
    ['a rete assente', 0, ''],
    ['con un 503', 503, 'PGRST002'],
  ])('una lettura fallita %s è un tentativo solo, e si segnala allo scadere dell’attesa', async (_case, status, code) => {
    const { client, reports, calls } = clientWith([status])

    const { error } = await client.from('foods').select('*')
    await vi.advanceTimersByTimeAsync(0)

    expect(error).not.toBeNull()
    expect(calls()).toBe(1)
    expect(reports).toEqual([])

    await vi.advanceTimersByTimeAsync(40_000)

    expect(reports).toEqual([
      { title: 'Supabase rest request failed', operation: 'GET rest/foods', code, status },
    ])
  })

  it('una scrittura a rete assente si segnala subito', async () => {
    const { client, reports } = clientWith([0])

    await client.from('foods').insert({ name: LEAK })
    await vi.advanceTimersByTimeAsync(0)

    expect(reports).toEqual([
      { title: 'Supabase rest request failed', operation: 'POST rest/foods', code: '', status: 0 },
    ])
  })

  it('una lettura riuscita non segnala niente', async () => {
    const { client, reports } = clientWith([200])

    const { error } = await client.from('foods').select('*')
    await vi.advanceTimersByTimeAsync(40_000)

    expect(error).toBeNull()
    expect(reports).toEqual([])
  })
})
