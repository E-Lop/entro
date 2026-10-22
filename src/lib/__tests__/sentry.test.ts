/**
 * Cosa arriva a Sentry dalla PWA (#192).
 *
 * Il test guarda l'**evento serializzato**: l'SDK è quello vero, con le opzioni
 * di `initSentry()`, e un transport di prova raccoglie gli envelope che
 * partirebbero. Il client supabase-js è vero anche lui.
 *
 * La rete di sicurezza (`httpClientIntegration`) strumenta `fetch` solo se è
 * nativo (`supportsNativeFetch()` di `@sentry/core`): nel browser lo è, sotto
 * Node no. Il `fetch` globale qui è quindi un finto che **si dichiara nativo**,
 * come quello del browser; nel browser vero lo prova la verifica a mano della
 * PR, dalla scheda Rete.
 */
import { createClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

/** Testo riconoscibile: se compare in un envelope, è uscito qualcosa di troppo. */
const LEAK = 'TRACCIA-RICONOSCIBILE'

const SUPABASE_URL = 'https://progetto.supabase.co'
const DSN = 'https://chiave@sentry.example/1'

/** Le parti dell'evento che i test leggono. */
interface SentEvent {
  tags: Record<string, string>
  fingerprint?: string[]
  exception: { values: { type: string; value: string }[] }
  request: { url: string }
}

type Envelope = [unknown, [{ type: string }, SentEvent][]]

const envelopes: Envelope[] = []

function events(): SentEvent[] {
  return envelopes.flatMap(([, items]) =>
    items.filter(([header]) => header.type === 'event').map(([, payload]) => payload),
  )
}

/** Risponde come PostgREST che rifiuta, o come un servizio esterno che non trova. */
async function server(input: RequestInfo | URL): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (url.startsWith(SUPABASE_URL)) {
    return new Response(
      JSON.stringify({ code: '42501', message: `permission denied ${LEAK}`, details: LEAK, hint: LEAK }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    )
  }
  return new Response(LEAK, { status: 404, headers: { 'X-Response-Probe': LEAK, 'Set-Cookie': `sessione=${LEAK}` } })
}

/** Un `fetch` che per Sentry è nativo, come quello del browser. */
function nativeLooking(impl: typeof server): typeof fetch {
  const fetch = (input: RequestInfo | URL) => impl(input)
  Object.defineProperty(fetch, 'toString', { value: () => 'function fetch() { [native code] }' })
  return fetch as typeof globalThis.fetch
}

const originalFetch = globalThis.fetch
let sentryModule: typeof import('../sentry')

/**
 * Silenzia la console. Si crea **prima** di `initSentry`: l'SDK avvolge la
 * `console.error` che trova, e dopo `console.error` è il suo involucro, non
 * lo spy.
 */
let consoleError: ReturnType<typeof vi.spyOn>

class NoSocket {}

/** Il client della PWA: la segnalazione davanti al `fetch` globale. */
async function appClient() {
  const { createFailureReportingFetch } = await import('../supabaseFailureReport')
  return createClient(SUPABASE_URL, 'chiave-pubblica', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: createFailureReportingFetch({
        supabaseUrl: SUPABASE_URL,
        report: sentryModule.reportSupabaseFailure,
      }),
    },
    // La CI ha Node 20, senza `WebSocket` nativo: realtime-js lo cercherebbe
    // già alla creazione del client.
    realtime: { transport: NoSocket as never },
  })
}

async function sent(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
  const Sentry = await import('@sentry/react')
  await Sentry.flush(2000)
}

describe('senza VITE_SENTRY_DSN', () => {
  it('l’SDK non si carica e una segnalazione non va da nessuna parte', async () => {
    vi.resetModules()
    const { initSentry, reportSupabaseFailure } = await import('../sentry')
    const load = vi.fn()

    await initSentry({ dsn: undefined, load })
    reportSupabaseFailure({ title: 'Supabase rest request failed', operation: 'GET rest/foods', code: '', status: 0 })

    expect(load).not.toHaveBeenCalled()
  })

  it('il modulo non importa l’SDK: lo carica solo `initSentry`, con `import()`', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const source = readFileSync(join(__dirname, '..', 'sentry.ts'), 'utf8')

    expect(source).not.toMatch(/^import (?!type)[^\n]*['"](@sentry\/|\.\/sentrySdk)/m)
    expect(source).toContain("import('./sentrySdk')")
  })
})

describe('con VITE_SENTRY_DSN', () => {
  beforeAll(async () => {
    globalThis.fetch = nativeLooking(server)
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.resetModules()
    sentryModule = await import('../sentry')
    // Una segnalazione che arriva mentre l'SDK si carica aspetta, e parte dopo.
    const starting = sentryModule.initSentry({
      dsn: DSN,
      supabaseUrl: SUPABASE_URL,
      overrides: {
        transport: () => ({
          send: async (envelope: unknown) => {
            envelopes.push(envelope as Envelope)
            return {}
          },
          flush: async () => true,
        }),
      },
    })
    sentryModule.reportSupabaseFailure({
      title: 'Supabase auth request failed',
      operation: 'POST auth/token',
      code: 'over_request_rate_limit',
      status: 429,
    })
    await starting
  })

  afterAll(async () => {
    const Sentry = await import('@sentry/react')
    await Sentry.close()
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('la segnalazione arrivata mentre l’SDK si caricava parte dopo', async () => {
    await sent()

    expect(events().map((event) => event.tags.operation)).toEqual(['POST auth/token'])
  })

  describe('una lettura che Supabase rifiuta', () => {
    beforeEach(async () => {
      await sent()
      envelopes.length = 0
      const Sentry = await import('@sentry/react')
      Sentry.getCurrentScope().clearBreadcrumbs()
    })

    it('è un evento solo, con i tag code, status e operazione, anche se la rete di sicurezza vede la stessa risposta', async () => {
      await (await appClient()).from('foods').select('*').eq('id', LEAK)
      await sent()

      expect(events()).toHaveLength(1)
      expect(events()[0].tags).toMatchObject({ code: '42501', status: '403', operation: 'GET rest/foods' })
      expect(events()[0].exception.values[0]).toMatchObject({
        type: 'SupabaseRequestError',
        value: 'Supabase rest request failed',
      })
      expect(events()[0].fingerprint).toEqual(['supabase', 'GET rest/foods', '42501'])
    })

    it('non porta messaggio, dettagli, suggerimento né query string, in nessun punto dell’envelope', async () => {
      await (await appClient()).from('foods').select('*').eq('id', LEAK)
      await sent()

      expect(events()).toHaveLength(1)
      expect(JSON.stringify(envelopes)).not.toContain(LEAK)
    })

    it('non porta il messaggio che l’app ha scritto in console con `logError`', async () => {
      const { logError } = await import('../safeLog')
      const client = await appClient()

      const { error } = await client.auth.signInWithPassword({ email: 'persona@example.com', password: 'segreta' })
      logError('Accesso rifiutato', error)
      await client.rpc('join_list_via_invite')
      await sent()

      expect(consoleError).toHaveBeenCalledWith('Accesso rifiutato', expect.stringContaining(LEAK))
      expect(events().length).toBeGreaterThanOrEqual(2)
      expect(JSON.stringify(envelopes)).not.toContain(LEAK)
    })
  })

  describe('una richiesta fuori da Supabase che fallisce', () => {
    beforeEach(async () => {
      await sent()
      envelopes.length = 0
    })

    it('la raccoglie la rete di sicurezza, con l’URL senza query string', async () => {
      // Header della richiesta e della risposta: dalla v11, senza
      // `dataCollection`, l'SDK li raccoglierebbe tutti.
      await fetch(`https://world.openfoodfacts.org/api/v2/product/123?fields=${LEAK}`, {
        headers: { 'X-Request-Probe': LEAK },
      })
      await sent()

      expect(events()).toHaveLength(1)
      expect(events()[0].request.url).toBe('https://world.openfoodfacts.org/api/v2/product/123')
      expect(JSON.stringify(envelopes)).not.toContain(LEAK)
    })
  })
})
