import { onlineManager } from '@tanstack/react-query'
import { isAuthRetryableFetchError, type AuthChangeEvent } from '@supabase/supabase-js'
import { userIsInside } from './sessionBoundFetch'

/**
 * Cosa fa l'app di una richiesta trattenuta da `sessionBoundFetch` (#229).
 *
 * La richiesta non parte perché il token è scaduto e il rinnovo non arriva al
 * server: per chi la manda è una rete assente. Per React Query invece non lo
 * è, perché mette in pausa letture e scritture solo quando `onlineManager` dice
 * offline (`retryer.ts` di `@tanstack/query-core` 5.90.20, righe 103-106), e
 * una scrittura fallita non si ritenta (`retry` vale 0 per le mutazioni,
 * `mutation.ts:199`). Senza altro, una scrittura in quello stato si annullava
 * con «Non è stato possibile salvare».
 *
 * Deciso il 16 ott 2026 sulla #229: alla prima richiesta trattenuta React Query
 * passa offline, e torna online al primo rinnovo riuscito. Le scritture
 * ritentano solo per questo errore (`queryClient.ts`), quindi il tentativo
 * dopo va in pausa: si salva alla ricarica, perché si salvano le mutazioni in
 * pausa (`hydration.ts:123`), e riparte in ordine col token. Il banner offline
 * non cambia: guarda il browser (`useNetworkStatus`), non React Query.
 */

/** Il messaggio con cui `sessionBoundFetch` rifiuta una richiesta. */
const HELD_BACK = 'Request held back: no session token available'

/**
 * Se l'errore viene da una richiesta trattenuta, in una delle tre forme in cui
 * arriva: il `TypeError` di `fetch`; l'oggetto di postgrest-js, che ne copia
 * il messaggio con il nome davanti (`PostgrestBuilder.ts`); l'errore di
 * storage-js, che tiene l'originale in `originalError` (`common/fetch.ts`).
 */
export function isHeldBackRequest(error: unknown): boolean {
  if (error instanceof TypeError) return error.message === HELD_BACK
  if (typeof error !== 'object' || error === null) return false
  if ('originalError' in error) return isHeldBackRequest(error.originalError)
  return 'message' in error && error.message === `TypeError: ${HELD_BACK}`
}

/**
 * La sessione che manca perché il rinnovo non è arrivato al server, con un
 * utente dentro, è una richiesta trattenuta e non un'uscita.
 *
 * Serve alle scritture che leggono la sessione prima di mandare qualcosa
 * (`createFood`, `updateFood`, `softDeleteFood`, la cartella di una foto in
 * coda): lì la richiesta non arriva nemmeno a `sessionBoundFetch`. A rinnovo
 * fallito per rete auth-js non toglie la sessione e risponde `session: null`
 * con un `AuthRetryableFetchError` (`GoTrueClient`, `_callRefreshToken` e
 * `__loadSession`, 2.98.0): finora diventava «Utente non autenticato», e la
 * scrittura si annullava. Misurato il 16 ott 2026 nell'E2E della #229.
 *
 * Restituisce l'errore da lanciare, o `null` se la sessione manca per un altro
 * motivo.
 */
export function heldBackSessionError(authError: unknown): TypeError | null {
  if (!isAuthRetryableFetchError(authError) || !userIsInside()) return null
  holdUntilTokenRefreshed()
  return new TypeError(HELD_BACK)
}

let holding = false
/** Quale pausa è in corso: un controllo risponde solo per la sua. */
let holdGeneration = 0

let sessionIsBack: () => Promise<boolean> = async () => false

/**
 * Come si chiede se la sessione è tornata. Lo dichiara il client, che qui non
 * si può importare: è lui a importare questo modulo.
 */
export function declareSessionCheck(check: () => Promise<boolean>): void {
  sessionIsBack = check
}

/**
 * Una richiesta è stata trattenuta: React Query si comporta come offline.
 *
 * Il rinnovo può essere già riuscito mentre questa richiesta falliva: una
 * lettura della sessione cominciata durante un giro fallito ne riceve l'esito
 * anche se il giro dopo è andato bene. Allora l'ultimo `TOKEN_REFRESHED` è già
 * passato, e la pausa resterebbe per sempre. Misurato il 16 ott 2026
 * nell'E2E della #229. Per questo alla pausa si chiede subito se la sessione è
 * tornata.
 */
export function holdUntilTokenRefreshed(): void {
  if (holding) return
  holding = true
  const generation = ++holdGeneration
  onlineManager.setOnline(false)
  sessionIsBack().then(
    (back) => {
      // Un controllo nato da una pausa già tolta non tocca quella dopo
      // (segnalato da CodeRabbit sulla PR #238).
      if (back && generation === holdGeneration) release()
    },
    () => {},
  )
}

function release(): void {
  if (!holding) return
  holding = false
  // Come `onlineManager`, che «assumes an active network connection»: offline
  // solo se il browser lo dice. Senza `navigator` (Node 20, dove gira la CI)
  // non lo dice nessuno.
  onlineManager.setOnline(typeof navigator === 'undefined' || navigator.onLine !== false)
}

/**
 * Il token è tornato, o non c'è più nessuno dentro: React Query torna allo
 * stato della rete del browser, e le scritture in pausa ripartono.
 */
export function releaseOnAuthEvent(event: AuthChangeEvent): void {
  if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN' || event === 'SIGNED_OUT') release()
}

/** Il `fetch` che trattiene, avvolto: alla prima trattenuta mette in pausa. */
export function pausingOnHeldBack(boundFetch: typeof fetch): typeof fetch {
  return async (input, init) => {
    try {
      return await boundFetch(input, init)
    } catch (error) {
      if (isHeldBackRequest(error)) holdUntilTokenRefreshed()
      throw error
    }
  }
}
