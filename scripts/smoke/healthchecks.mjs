#!/usr/bin/env node
/**
 * Avvolge un giro pianificato della suite di smoke nei segnali a Healthchecks
 * (#190): inizio, poi successo o fallimento, ed esce col codice del giro.
 *
 * Healthchecks avvisa quando un segnale non arriva in tempo. È così che si
 * viene a sapere anche di un giro che **non parte**: la funzione di Netlify
 * che non lo avvia (#286), GitHub che non fa partire la corsa chiesta, un
 * workflow spento, le Actions sospese. Un giro che parte e si pianta manda l'inizio e non la
 * fine, e anche quello diventa un avviso.
 *
 * L'indirizzo del controllo sta in `HEALTHCHECKS_URL` ed è un secret: chi lo
 * conosce può mandare segnali. Non si stampa mai. Un Healthchecks che non
 * risponde non cambia l'esito del giro: il segnale mancato diventa a sua volta
 * un avviso, dall'altra parte.
 *
 * Uso: HEALTHCHECKS_URL=<indirizzo> node scripts/smoke/healthchecks.mjs '<comando>'
 */
import { spawn } from 'node:child_process'

const ATTEMPTS = 3
const REQUEST_TIMEOUT_MS = 10_000

const SIGNALS = {
  start: { path: '/start', label: "d'inizio" },
  success: { path: '', label: 'di successo' },
  fail: { path: '/fail', label: 'di fallimento' },
}

async function ping(baseUrl, signal) {
  const { path, label } = SIGNALS[signal]
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const response = await fetch(`${baseUrl}${path}`, { method: 'POST', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
      if (response.ok) {
        console.log(`Healthchecks: segnale ${label} inviato.`)
        return
      }
    } catch {
      // Rete o tempo scaduto: si riprova. L'errore conterrebbe l'indirizzo.
    }
  }
  console.log(`::warning::Healthchecks: segnale ${label} non arrivato dopo ${ATTEMPTS} tentativi.`)
}

function run(command) {
  return new Promise((resolve) => {
    const child = spawn(command, { shell: true, stdio: 'inherit' })
    child.on('close', (code) => resolve(code ?? 1))
    child.on('error', () => resolve(1))
  })
}

async function main(command) {
  // Senza barra finale: `/start` e `/fail` si aggiungono in coda.
  const baseUrl = (process.env.HEALTHCHECKS_URL ?? '').replace(/\/+$/, '')
  if (!baseUrl) {
    console.log("::error::variabile d'ambiente mancante: HEALTHCHECKS_URL")
    return 1
  }
  if (!command) {
    console.log('::error::manca il comando del giro')
    return 1
  }

  await ping(baseUrl, 'start')
  const code = await run(command)
  await ping(baseUrl, code === 0 ? 'success' : 'fail')
  return code
}

process.exitCode = await main(process.argv[2])
