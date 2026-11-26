/**
 * Chiede a GitHub di avviare un workflow di smoke su `main` (#286).
 *
 * Lo `schedule` di GitHub non faceva partire i giri contro la produzione: in 22
 * ore 2 orari su 22, nessun giornaliero, e la community lo segnala da agosto
 * 2026. Li avviano le Netlify Scheduled Function in `netlify/functions/`, con
 * questa chiamata a «Create a workflow dispatch event».
 *
 * Una chiamata per turno e nessun nuovo tentativo: se fallisce, il giro non
 * parte e lo segnala Healthchecks, che avvisa quando un segnale manca. Un ciclo
 * di tentativi consumerebbe le invocazioni del piano di Netlify, e superarle
 * mette in pausa tutti i siti dell'account.
 *
 * Il token è un fine-grained PAT sul solo `E-Lop/entro`, con il solo permesso
 * *Actions: write*, e scade dopo un anno: quando scade GitHub risponde 401, e il
 * log della funzione lo dice. Non si stampa mai, e non entra nei messaggi
 * d'errore: il messaggio di un errore di rete o il corpo di una risposta
 * potrebbero contenerlo, quindi non si riportano.
 */

/** La variabile d'ambiente di Netlify che contiene il token. */
export const TOKEN_VARIABLE = 'SMOKE_DISPATCH_TOKEN'

const REPOSITORY = 'E-Lop/entro'
const REF = 'main'
/** La funzione pianificata ha 30 secondi in tutto. */
const REQUEST_TIMEOUT_MS = 10_000

export async function dispatchWorkflow(workflow: string): Promise<void> {
  const token = process.env[TOKEN_VARIABLE]
  if (!token) {
    const message = `Avvio di ${workflow} non chiesto: manca la variabile d'ambiente ${TOKEN_VARIABLE}.`
    console.error(message)
    throw new Error(message)
  }

  let response: Response
  try {
    response = await fetch(`https://api.github.com/repos/${REPOSITORY}/actions/workflows/${workflow}/dispatches`, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'entro-smoke-dispatch',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ ref: REF }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (error) {
    // Solo il tipo dell'errore: il messaggio non si riporta (vedi sopra).
    const kind = error instanceof Error ? error.name : typeof error
    const message = `Avvio di ${workflow} fallito: GitHub non ha risposto (${kind}).`
    console.error(message)
    throw new Error(message)
  }

  if (!response.ok) {
    const hint = response.status === 401 ? ' Il token è scaduto o revocato: va rinnovato (CONTRIBUTING.md, «Smoke in produzione»).' : ''
    const message = `Avvio di ${workflow} fallito: GitHub ha risposto ${response.status}.${hint}`
    console.error(message)
    throw new Error(message)
  }

  console.log(`Avvio di ${workflow} su ${REF} chiesto a GitHub (${response.status}).`)
}
