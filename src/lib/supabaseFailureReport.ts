/**
 * Il `fetch` del client Supabase, con una regola in più: **ogni richiesta
 * fallita diventa una segnalazione** (#192).
 *
 * Copia di `entro-mobile/src/shared/lib/supabaseFailureReport.ts`
 * (entro-mobile#199): il codice è lo stesso, e lo tiene uguale
 * `supabaseFailureReportParity.family.test.ts`.
 *
 * Senza `throwOnError()` supabase-js non lancia: restituisce `{ error }`, e un
 * 404 di PostgREST per tutti gli utenti non lascia traccia in nessuno
 * strumento (#179, 41 ore). Il `fetch` del client è l'unico punto da cui
 * passano tabelle, RPC, auth e storage senza toccare ogni chiamata.
 *
 * Cosa parte lo decide questo file, e **solo** `code`, `status` e il nome
 * dell'operazione (decisione del 2 ott 2026): `message`, `details` e `hint`
 * possono contenere identificativi e valori delle righe (doc PostgREST,
 * «Errors»: `details` riporta la riga che fallisce), e la query string di
 * PostgREST *è* la query, con i valori dei filtri. Il titolo è nostro e fisso
 * per servizio.
 *
 * Il file non importa niente: chi lo usa passa `report`, perché web e nativo
 * mandano a Sentry con SDK diversi.
 *
 * Fuori da qui restano gli errori che auth-js produce senza fare una
 * richiesta, come la sessione mancante: non sono risposte del server.
 */

export interface SupabaseFailure {
  /** Fisso per servizio: è ciò che Sentry mostra come titolo. */
  title: string
  /** Verbo e risorsa, mai i parametri: `GET rest/foods`, `POST rpc/join_list_via_invite`. */
  operation: string
  /** Il codice del server (`42501`, `PGRST202`, `invalid_credentials`), o vuoto. */
  code: string
  /** Lo status HTTP, o 0 se la richiesta non è arrivata al server. */
  status: number
}

interface FailureReportingFetchOptions {
  /** L'URL del progetto: le operazioni si leggono dal percorso che lo segue. */
  supabaseUrl: string
  /** Chi riceve la segnalazione. Un suo errore non arriva mai all'app. */
  report: (failure: SupabaseFailure) => void
  /** Il `fetch` vero. Si passa nei test, e per comporre con altre regole. */
  fetchImpl?: typeof fetch
}

const SERVICE_PATH = /^\/(rest|auth|storage|functions)\/v1\/?(.*)$/

/**
 * I segmenti dei percorsi di storage-js (sorgente installata, 2.111.0) che
 * precedono il bucket. Il primo segmento che non è fra questi è il bucket, e
 * ciò che lo segue è il percorso del file: resta fuori.
 */
const STORAGE_KEYWORDS = new Set([
  'object',
  'sign',
  'upload',
  'public',
  'authenticated',
  'list',
  'list-v2',
  'move',
  'copy',
  'info',
  'render',
  'image',
  'bucket',
])

/** La forma di un codice di PostgREST, di auth o dello storage. Il resto è testo. */
const CODE_SHAPE = /^[A-Za-z0-9_.-]{1,64}$/

/**
 * Le ripetizioni di postgrest-js (sorgente installata, 2.111.0, `executeWithRetry`;
 * changelog Supabase 45071): GET, HEAD e OPTIONS, a rete assente — non a
 * richiesta annullata — o su 503 e 520, al massimo tre volte, dopo 1, 2 e 4
 * secondi o dopo `Retry-After`, e ogni ripetizione porta `X-Retry-Count`. Un
 * risultato è uno, i tentativi fino a quattro: si segnala solo l'ultimo.
 *
 * Che una ripetizione arrivi non si può sapere: le ripetizioni ci sono dalla
 * 2.102, entro ha la 2.98, e una lettura può chiedere `.retry(false)`. Un
 * fallimento che potrebbe ripetersi resta quindi **in attesa** per il tempo
 * della ripetizione più `RETRY_GRACE_MS`: se la ripetizione arriva l'attesa
 * cade, altrimenti la segnalazione parte.
 */
const RETRIED_METHODS = ['GET', 'HEAD', 'OPTIONS']
const RETRIED_STATUSES = [503, 520]
const MAX_RETRIES = 3
const RETRY_GRACE_MS = 2_000

function targetOf(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url
}

function methodOf(input: Parameters<typeof fetch>[0], init: Parameters<typeof fetch>[1]): string {
  const method = init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET')
  return method.toUpperCase()
}

/** Il percorso dopo l'URL del progetto, senza query string né frammento. */
function pathOf(target: string, supabaseUrl: string): string {
  const withoutQuery = target.split('#')[0].split('?')[0]
  const base = supabaseUrl.replace(/\/+$/, '')
  return withoutQuery.startsWith(base) ? withoutQuery.slice(base.length) : ''
}

function storageResource(segments: string[]): string {
  const kept: string[] = []
  for (const segment of segments) {
    kept.push(segment)
    if (!STORAGE_KEYWORDS.has(segment)) break
  }
  return kept.join('/')
}

function describeRequest(path: string, method: string): Pick<SupabaseFailure, 'title' | 'operation'> {
  const match = SERVICE_PATH.exec(path)
  if (!match) return { title: 'Supabase request failed', operation: method }

  const [, service, rest] = match
  const segments = rest.split('/').filter((segment) => segment !== '')

  if (service === 'rest' && segments[0] === 'rpc') {
    return {
      title: 'Supabase rpc request failed',
      operation: `${method} rpc/${segments[1] ?? ''}`,
    }
  }

  const resource =
    service === 'storage' ? storageResource(segments) : segments.slice(0, 1).join('/')

  return {
    title: `Supabase ${service} request failed`,
    operation: resource === '' ? `${method} ${service}` : `${method} ${service}/${resource}`,
  }
}

/**
 * Il codice dal corpo della risposta: `code` per PostgREST, per lo storage e
 * per auth dalla versione 2024-01-01 delle API; `error_code` per auth prima di
 * quella (auth-js 2.111.0, `handleError`, sorgente installata).
 */
function codeOf(body: unknown): string {
  if (typeof body !== 'object' || body === null) return ''
  const { code, error_code: errorCode } = body as { code?: unknown; error_code?: unknown }
  const candidate = typeof code === 'string' ? code : errorCode
  return typeof candidate === 'string' && CODE_SHAPE.test(candidate) ? candidate : ''
}

async function codeOfResponse(response: Response): Promise<string> {
  try {
    return codeOf(await response.clone().json())
  } catch {
    return ''
  }
}

function isAbort(error: unknown): boolean {
  const { name, code } = (error ?? {}) as { name?: unknown; code?: unknown }
  return name === 'AbortError' || code === 'ABORT_ERR'
}

function retriesOf(init: Parameters<typeof fetch>[1]): number {
  return Number(new Headers(init?.headers).get('X-Retry-Count') ?? '0')
}

/** Vero se postgrest-js può ripetere questa richiesta: allora il risultato forse non è questo. */
function mayBeRetried(path: string, method: string, retries: number, failedWith: number): boolean {
  if (!path.startsWith('/rest/v1/') || !RETRIED_METHODS.includes(method)) return false
  return retries < MAX_RETRIES && (failedWith === 0 || RETRIED_STATUSES.includes(failedWith))
}

/** Quanto aspetta postgrest-js prima della ripetizione, come in `executeWithRetry`. */
function retryDelayOf(retries: number, response?: Response): number {
  const retryAfter = response?.headers.get('Retry-After') ?? null
  if (retryAfter !== null) return Math.max(0, parseInt(retryAfter, 10) || 0) * 1000
  return Math.min(1000 * 2 ** retries, 30_000)
}

function safely(report: (failure: SupabaseFailure) => void, failure: SupabaseFailure): void {
  try {
    report(failure)
  } catch {
    // Una segnalazione persa costa meno di una richiesta dell'app che fallisce
    // per colpa di chi doveva solo guardarla.
  }
}

export function createFailureReportingFetch({
  supabaseUrl,
  report,
  fetchImpl,
}: FailureReportingFetchOptions): typeof fetch {
  // I fallimenti in attesa di ripetizione, per verbo e URL: la ripetizione
  // di postgrest-js rifà la stessa richiesta.
  const awaitingRetry = new Map<string, ReturnType<typeof setTimeout>>()

  return async (input, init) => {
    const send = fetchImpl ?? fetch
    const target = targetOf(input)
    const path = pathOf(target, supabaseUrl)
    const method = methodOf(input, init)
    const described = describeRequest(path, method)
    const key = `${method} ${target}`
    const retries = retriesOf(init)

    // La ripetizione è arrivata: il fallimento di prima non è il risultato.
    if (retries > 0) {
      clearTimeout(awaitingRetry.get(key))
      awaitingRetry.delete(key)
    }

    const settle = (failure: SupabaseFailure, response?: Response): void => {
      if (!mayBeRetried(path, method, retries, failure.status)) {
        safely(report, failure)
        return
      }
      const timer = setTimeout(() => {
        awaitingRetry.delete(key)
        safely(report, failure)
      }, retryDelayOf(retries, response) + RETRY_GRACE_MS)
      awaitingRetry.set(key, timer)
    }

    let response: Response
    try {
      response = await send(input, init)
    } catch (error) {
      const failure = { ...described, code: '', status: 0 }
      if (isAbort(error)) safely(report, failure)
      else settle(failure)
      throw error
    }

    if (response.status >= 400) {
      // Non si aspetta: la risposta torna all'app subito, e il corpo si legge
      // da una copia.
      const failed = response
      void codeOfResponse(failed).then((code) =>
        settle({ ...described, code, status: failed.status }, failed)
      )
    }

    return response
  }
}
