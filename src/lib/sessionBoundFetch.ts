/**
 * Il `fetch` del client Supabase, con una regola in più: **chi è dentro non
 * manda richieste da anonimo** (#229).
 *
 * Gemello di `entro-mobile/src/lib/sessionBoundFetch.ts` (entro-mobile#259): il
 * codice è lo stesso, i commenti no, e lo controlla
 * `sessionBoundFetchParity.family.test.ts`.
 *
 * Il difetto che chiude sta in due comportamenti della libreria, letti nella
 * sorgente installata (2.98.0) e non nostri:
 *
 * - auth-js: se il token d'accesso è scaduto e il rinnovo fallisce, la lettura
 *   della sessione restituisce `session: null` (`GoTrueClient`, `__loadSession`);
 * - supabase-js: senza un token di sessione mette nell'`Authorization` la
 *   chiave pubblica (`fetchWithAuth`: `realToken ?? supabaseKey`).
 *
 * Insieme: tornando a una scheda rimasta in background più di un'ora, con la
 * rete che non arriva al server, la rilettura della lista partiva da anonimo e
 * il server rispondeva 401. Riprodotto il 16 ott 2026
 * (`tests/e2e/expired-token-no-anonymous-requests.spec.ts`).
 *
 * La richiesta **non parte**: fallisce qui come fallisce un `fetch` senza rete,
 * e `postgrest-js` la restituisce con `status` 0. Cosa ne fa l'app (la coda
 * delle scritture) sta in `heldBackRequests.ts`.
 *
 * Le richieste a `/auth/v1/` passano sempre: è da lì che il token si rinnova,
 * e portano la chiave pubblica per costruzione.
 */

const AUTH_PATH = '/auth/v1/'

interface SessionBoundFetchOptions {
  /** La chiave pubblica del progetto: è ciò che la libreria usa come ripiego. */
  publicKey: string
  /** Vero quando per l'app c'è un utente dentro. */
  hasUser: () => boolean
  /** Il `fetch` vero. Si passa nei test. */
  fetchImpl?: typeof fetch
}

let signedInCheck: () => boolean = () => false

/**
 * Chi sa se c'è un utente dentro lo dichiara qui. È lo store di
 * autenticazione, e non il client: il client non può importare lo store, che
 * a sua volta lo importa.
 *
 * Conta ciò che sa **l'app**, non la libreria: a rinnovo fallito auth-js dice
 * che la sessione non c'è, ed è proprio la risposta di cui non ci si fida.
 */
export function declareSignedInCheck(check: () => boolean): void {
  signedInCheck = check
}

export function userIsInside(): boolean {
  return signedInCheck()
}

function targetOf(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url
}

function carriesNoUserToken(
  init: Parameters<typeof fetch>[1],
  publicKey: string
): boolean {
  const authorization = new Headers(init?.headers).get('Authorization')
  return authorization === null || authorization === `Bearer ${publicKey}`
}

export function createSessionBoundFetch({
  publicKey,
  hasUser,
  fetchImpl,
}: SessionBoundFetchOptions): typeof fetch {
  return async (input, init) => {
    const send = fetchImpl ?? fetch

    if (
      hasUser() &&
      !targetOf(input).includes(AUTH_PATH) &&
      carriesNoUserToken(init, publicKey)
    ) {
      // `TypeError` è ciò che lancia `fetch` quando la rete non c'è: chi sta
      // sopra lo tratta già come «la richiesta non è arrivata al server».
      throw new TypeError('Request held back: no session token available')
    }

    return send(input, init)
  }
}
