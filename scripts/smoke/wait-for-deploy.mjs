#!/usr/bin/env node
/**
 * Aspetta che il sito serva il commit appena spinto su `main` (#190).
 *
 * Netlify non manda a GitHub un evento di deploy di produzione: il workflow
 * dopo il push interroga `/version.json` (scritto dalla build, vedi
 * `scripts/versionFile.ts`) finché lo SHA non è quello atteso, per dieci
 * minuti al massimo. Poi la suite di smoke guarda il sito nuovo.
 *
 * Il log è pubblico. Di ogni tentativo si stampa solo l'esito, una di quattro
 * frasi scritte qui: mai il corpo servito, nemmeno lo SHA diverso.
 *
 * Uso: SMOKE_SITE_URL=https://entroapp.it EXPECTED_SHA=<sha> \
 *      node scripts/smoke/wait-for-deploy.mjs [--timeout-seconds 600] [--interval-seconds 15]
 */
import { pathToFileURL } from 'node:url'

const OUTCOMES = {
  expected: 'SHA atteso',
  different: 'SHA diverso',
  invalid: 'risposta non valida',
  unreachable: 'sito non raggiungibile',
}

const REQUEST_TIMEOUT_MS = 10_000

/** L'esito di una richiesta: una delle frasi di `OUTCOMES`, mai un'eccezione. */
async function check(url, expectedSha, fetchImpl) {
  let response
  try {
    response = await fetchImpl(url, { cache: 'no-store', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
  } catch {
    return OUTCOMES.unreachable
  }
  if (!response.ok) return OUTCOMES.invalid
  let body
  try {
    body = await response.json()
  } catch {
    return OUTCOMES.invalid
  }
  if (typeof body?.sha !== 'string') return OUTCOMES.invalid
  return body.sha === expectedSha ? OUTCOMES.expected : OUTCOMES.different
}

/**
 * Interroga `url` finché serve `expectedSha`, o finché non passano `timeoutMs`.
 * Restituisce `{ ok, attempts, outcome }`, dove `outcome` è l'esito dell'ultimo
 * tentativo. Non lancia: un sito irraggiungibile è un esito come gli altri.
 */
export async function waitForSha({
  url,
  expectedSha,
  timeoutMs,
  intervalMs,
  fetchImpl = fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = Date.now,
  onAttempt = () => {},
}) {
  const deadline = now() + timeoutMs
  for (let attempts = 1; ; attempts++) {
    const outcome = await check(url, expectedSha, fetchImpl)
    onAttempt(attempts, outcome)
    if (outcome === OUTCOMES.expected) return { ok: true, attempts, outcome }
    const left = deadline - now()
    if (left <= 0) return { ok: false, attempts, outcome }
    await sleep(Math.min(intervalMs, left))
  }
}

function option(args, name, fallback) {
  const at = args.indexOf(name)
  return at === -1 ? fallback : Number(args[at + 1])
}

async function main(args) {
  const origin = process.env.SMOKE_SITE_URL
  const expectedSha = process.env.EXPECTED_SHA
  for (const [name, value] of [['SMOKE_SITE_URL', origin], ['EXPECTED_SHA', expectedSha]]) {
    if (!value) {
      console.log(`::error::variabile d'ambiente mancante: ${name}`)
      return 1
    }
  }
  const timeoutSeconds = option(args, '--timeout-seconds', 600)
  const url = new URL('/version.json', origin).href

  console.log(`Aspetto che ${url} serva ${expectedSha.slice(0, 7)}, per ${timeoutSeconds} s al massimo.`)
  const result = await waitForSha({
    url,
    expectedSha,
    timeoutMs: timeoutSeconds * 1000,
    intervalMs: option(args, '--interval-seconds', 15) * 1000,
    onAttempt: (attempt, outcome) => console.log(`tentativo ${attempt}: ${outcome}`),
  })
  if (result.ok) {
    console.log(`Il sito serve il commit atteso dopo ${result.attempts} tentativi.`)
    return 0
  }
  console.log(
    `::error::In ${timeoutSeconds} s il sito non ha servito il commit atteso. Ultimo esito: ${result.outcome}. ` +
      'Il deploy di Netlify è fallito, è ancora in coda, o un push più recente lo ha sostituito.'
  )
  return 1
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main(process.argv.slice(2))
}
