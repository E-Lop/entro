/**
 * Log che non si porta dietro segreti.
 *
 * Il problema non è che qualcuno stampi un token di proposito: è che
 * `console.error('contesto:', error)` stampa anche le **proprietà**
 * dell'errore, e i client Supabase ci attaccano i dati della risposta —
 * inclusa la sessione che stavano tentando di rinnovare. Passare l'oggetto
 * alla console è il modo in cui i segreti escono di rimbalzo.
 *
 * Da qui passa un messaggio e basta, ripulito.
 */

/**
 * Tre segmenti base64url separati da punto, col prefisso che ogni JWT ha per
 * costruzione: il primo segmento codifica `{"alg"…`, che in base64url comincia
 * sempre per `eyJ`.
 *
 * Il prefisso non è pedanteria. Senza, il pattern colpisce anche gli host a
 * tre etichette e `<ref>.functions.supabase.co` finisce redatto: un log che
 * cancella a caso smette di servire a diagnosticare, che è l'unico motivo per
 * cui esiste.
 */
const JWT_PATTERN = /eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g

/** Toglie da un testo le stringhe che hanno la forma di un JWT. */
export function redactSecrets(text: string): string {
  return text.replace(JWT_PATTERN, '[token rimosso]')
}

/**
 * Un URL ridotto a quello che serve per capire *dove* si era: origine e
 * percorso.
 *
 * Query e frammento vengono buttati interi invece che ripuliti, perché è lì
 * che Supabase mette i parametri di sessione dopo un magic link, e il
 * `refresh_token` — a differenza dell'access token — non è un JWT: è opaco,
 * non ha una forma riconoscibile, e nessun pattern lo intercetterebbe.
 */
export function redactUrl(href: string): string {
  try {
    const url = new URL(href)
    return `${url.origin}${url.pathname}`
  } catch {
    return '[url non valido]'
  }
}

/** Il messaggio di un errore, qualunque cosa sia arrivata. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Logga un errore mostrando il solo messaggio, ripulito.
 *
 * Le proprietà dell'errore non vengono stampate: è deliberato, ed è tutto il
 * punto di questo modulo.
 */
export function logError(context: string, error: unknown): void {
  // L'unico secondo argomento consentito in tutto `src/`: qui è già una
  // stringa ripulita, non l'oggetto errore. È il punto d'uscita che la regola
  // `no-restricted-syntax` esiste per rendere obbligatorio.
  // eslint-disable-next-line no-restricted-syntax
  console.error(context, redactSecrets(messageOf(error)))
}

/** Come `logError`, per le condizioni che non sono errori. */
export function logWarn(context: string, error: unknown): void {
  // Stringa già ripulita, come in `logError`.
  // eslint-disable-next-line no-restricted-syntax
  console.warn(context, redactSecrets(messageOf(error)))
}
