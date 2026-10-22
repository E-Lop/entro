/**
 * Sentry sulla PWA (#192): ogni richiesta fallita a Supabase diventa un
 * evento, con il solo `code`, lo `status` e l'operazione.
 *
 * **Spento finché manca `VITE_SENTRY_DSN`**, e manca in produzione finché
 * l'informativa non nomina Sentry fra le terze parti. Senza la variabile l'SDK
 * non si carica nemmeno: arriva con un `import()` in un chunk suo, e nessuna
 * richiesta parte verso Sentry.
 *
 * Cosa entra nella segnalazione lo decide `supabaseFailureReport.ts`, uguale su
 * entro-mobile. Qui si decide come arriva a Sentry, e che nient'altro della
 * richiesta ci arrivi.
 *
 * Il chunk dell'SDK resta anche fuori dalla precache del service worker
 * (`vite.config.ts`): senza DSN nessuno lo scarica.
 */
import type { BrowserOptions } from '@sentry/react'
import type { SupabaseFailure } from './supabaseFailureReport'

type SentrySdk = typeof import('./sentrySdk')

/** Le segnalazioni che arrivano prima che l'SDK sia caricato aspettano qui. */
const MAX_WAITING = 20

let sdk: SentrySdk | null = null
let starting = false
const waiting: SupabaseFailure[] = []

/**
 * Il nome di una richiesta fallita a Supabase. È il `type` che Sentry mostra
 * accanto al titolo, e distingue questi eventi dalle eccezioni dell'app.
 */
class SupabaseRequestError extends Error {
  name = 'SupabaseRequestError'
}

function send(sentry: SentrySdk, { title, operation, code, status }: SupabaseFailure): void {
  sentry.withScope((scope) => {
    scope.setTags({ code: code === '' ? 'none' : code, status: String(status), operation })
    scope.setFingerprint(['supabase', operation, code === '' ? String(status) : code])
    sentry.captureException(new SupabaseRequestError(title))
  })
}

/**
 * Manda a Sentry una richiesta fallita a Supabase. Lo stesso codice sulla
 * stessa operazione è un gruppo solo; un fallimento senza codice, come la rete
 * assente, si raggruppa per status. Senza DSN non fa niente.
 */
export function reportSupabaseFailure(failure: SupabaseFailure): void {
  if (sdk) send(sdk, failure)
  else if (starting && waiting.length < MAX_WAITING) waiting.push(failure)
}

/**
 * La rotta `/join/:code` di `App.tsx` porta il codice d'invito nel percorso, e
 * chi ha il codice entra nella lista: è una credenziale. Senza badare alle
 * maiuscole, come il router (`caseSensitive` è falso di default).
 */
const INVITE_CODE_IN_PATH = /\/join\/[^/]+/i

/**
 * Un percorso dello storage fino al bucket, come per l'operazione in
 * `supabaseFailureReport.ts`. Il resto è `<utente>/<istante>-<nome del file>`
 * (`storage.ts`): l'id dell'utente e il nome scelto sul telefono.
 */
const STORAGE_OBJECT_PATH =
  /(\/storage\/v1\/(?:(?:object|render|image|sign|upload|public|authenticated|info|list)\/)*[^/]+)\/.+$/

/**
 * Un URL che si può mandare: senza query string né frammento (per PostgREST la
 * query string è la query, con i valori; nel reset della password il frammento
 * porta i token), senza il codice d'invito e senza il percorso dei file.
 */
function scrubbedUrl(url: string): string {
  return url
    .split('#')[0]
    .split('?')[0]
    .replace(INVITE_CODE_IN_PATH, '/join/:code')
    .replace(STORAGE_OBJECT_PATH, '$1/:path')
}

/**
 * Le opzioni di `Sentry.init`. Separate da `initSentry()` perché i test le
 * passino all'SDK vero con un transport di prova.
 */
export function sentryOptions(sentry: SentrySdk, dsn: string, supabaseUrl: string): BrowserOptions {
  return {
    dsn,

    // Dalla v11 un `dataCollection` assente raccoglie tutto: header, cookie,
    // corpi delle richieste, query string, dati dell'utente (doc Sentry,
    // «Migrate from 10.x to 11.x», «Data Collection»). Qui niente di tutto
    // questo: un evento è il codice dell'errore, non la richiesta.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
    },

    integrations: [
      // La rete di sicurezza per ciò che non passa da `supabaseFailureReport.ts`,
      // come Open Food Facts: ogni risposta da 400 a 599 (il default
      // dell'integrazione è solo 500–599).
      sentry.httpClientIntegration({ failedRequestStatusCodes: [[400, 599]] }),
    ],

    beforeSend(event) {
      // Le richieste a Supabase le segnala già `supabaseFailureReport.ts`, con
      // il codice: quelle della rete di sicurezza si scartano, così un
      // fallimento è un evento solo. Qui e non in `failedRequestTargets`,
      // che confronta `response.url` (`integrations/httpclient.js`): vuoto in
      // una risposta costruita a mano, diverso dopo un redirect. L'URL della
      // richiesta è quello che abbiamo chiesto.
      const caughtByHttpClient = event.exception?.values?.some((value) =>
        value.mechanism?.type?.startsWith('auto.http.client'),
      )
      if (caughtByHttpClient && supabaseUrl !== '' && event.request?.url?.startsWith(supabaseUrl)) {
        return null
      }

      // L'evento della rete di sicurezza porta l'URL della richiesta intero
      // (`@sentry/browser`, `integrations/httpclient.js`, sorgente installata),
      // gli altri quello della pagina, che dalla v11 perde la query ma non il
      // percorso.
      if (event.request?.url) event.request.url = scrubbedUrl(event.request.url)
      if (event.request) delete event.request.query_string
      return event
    },

    // Le richieste HTTP finiscono nei breadcrumb da sole, con l'URL intero
    // (doc Sentry, «Breadcrumbs»), e i breadcrumb viaggiano con ogni evento.
    // Quelli della console restano fuori: `logError` scrive il messaggio
    // degli errori, e quello di auth o di PostgREST è il testo del server che
    // la #192 tiene lontano dagli eventi.
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.category === 'console') return null
      const data = breadcrumb.data
      if (data) {
        if (typeof data.url === 'string') data.url = scrubbedUrl(data.url)
        if (typeof data.from === 'string') data.from = scrubbedUrl(data.from)
        if (typeof data.to === 'string') data.to = scrubbedUrl(data.to)
        delete data['http.query']
        delete data['http.fragment']
      }
      return breadcrumb
    },
  }
}

interface InitSentryOptions {
  dsn?: string
  supabaseUrl?: string
  /** Come si carica l'SDK. Si passa nei test. */
  load?: () => Promise<SentrySdk>
  /** Opzioni in più per `Sentry.init`: nei test, il transport di prova. */
  overrides?: Partial<BrowserOptions>
}

/**
 * Accende Sentry se c'è il DSN. Senza, ritorna subito e l'SDK resta fuori
 * dal bundle scaricato.
 */
export async function initSentry({
  dsn = import.meta.env.VITE_SENTRY_DSN,
  supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '',
  load = () => import('./sentrySdk'),
  overrides = {},
}: InitSentryOptions = {}): Promise<void> {
  if (!dsn || sdk || starting) return

  starting = true
  try {
    const sentry = await load()
    sentry.init({ ...sentryOptions(sentry, dsn, supabaseUrl), ...overrides })
    sdk = sentry
    for (const failure of waiting) send(sentry, failure)
  } catch {
    // Il chunk non è in precache: offline al primo avvio non arriva, e Sentry
    // resta spento fino al prossimo. L'app non se ne deve accorgere.
  } finally {
    starting = false
    waiting.length = 0
  }
}
