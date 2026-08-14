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

/**
 * Un messaggio che in realtà è un oggetto serializzato.
 *
 * `_getErrorMessage` di `@supabase/auth-js` (v2.98.0,
 * `dist/main/lib/fetch.js`) prova `msg`, `message`, `error_description`,
 * `error` e — se nessuno di quei campi c'è — ripiega su `JSON.stringify(err)`.
 * Quello che arriva qui come *messaggio* può quindi essere un oggetto intero,
 * URL con query e corpo compresi.
 *
 * La guardia è «sembra JSON **e** si parsa»: il solo prefisso non basta,
 * perché un messaggio che comincia per graffa senza essere JSON è normale e
 * buttarlo sarebbe perdere diagnosi per niente.
 */
function looksLikeSerializedObject(message: string): boolean {
  const trimmed = message.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return false
  try {
    JSON.parse(trimmed)
    return true
  } catch {
    return false
  }
}

/**
 * Il messaggio di un errore, qualunque cosa sia arrivata.
 *
 * Non basta prendere `error.message`: l'assunto «il messaggio è testo scritto
 * da qualcuno» non regge (vedi `looksLikeSerializedObject`). Quando il
 * messaggio è un oggetto, di diagnostico resta lo **stato HTTP** — un numero,
 * l'unica parte che non può portarsi dietro URL, header o corpo.
 *
 * E non basta `String()` sul resto: su un array unisce gli elementi, e un
 * oggetto con `toString()` proprio decide da sé cosa stampiamo. Di un valore
 * che non è già testo si dice il tipo e basta.
 */
function messageOf(error: unknown): string {
  if (error instanceof Error) {
    if (!looksLikeSerializedObject(error.message)) return error.message

    const status = (error as { status?: unknown }).status
    return typeof status === 'number'
      ? `[risposta non leggibile, HTTP ${status}]`
      : '[risposta non leggibile]'
  }

  if (typeof error === 'string') return error

  return `[errore non testuale: ${typeof error}]`
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
