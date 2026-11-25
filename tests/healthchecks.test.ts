/**
 * I segnali a Healthchecks dei giri pianificati (#190).
 *
 * `scripts/smoke/healthchecks.mjs` avvolge il comando del giro: manda il
 * segnale d'inizio, lo esegue, poi manda quello di successo o di fallimento ed
 * esce col codice del comando. Healthchecks avvisa anche quando un segnale non
 * arriva: un giro che non parte non manda l'inizio, uno che si pianta non manda
 * la fine.
 *
 * Si prova contro un Healthchecks finto in locale. L'indirizzo del controllo è
 * un secret, perché chi lo conosce può mandare segnali: non deve mai finire nel
 * log, che in questo repo è pubblico.
 */
import { spawn } from 'node:child_process'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { LOCAL_ANON_KEY } from './e2e/helpers/localSupabase'
import { LOCAL_SENTINELS } from './smoke-local/sentinels'

const ROOT = join(__dirname, '..')
const SCRIPT = join(ROOT, 'scripts/smoke/healthchecks.mjs')
/** La parte segreta dell'indirizzo di un controllo. */
const CHECK_UUID = '5f6e7d8c-1a2b-4c3d-9e8f-0a1b2c3d4e5f'

let server: Server | undefined
let received: string[] = []

afterEach(async () => {
  await new Promise((resolve) => (server ? server.close(resolve) : resolve(undefined)))
  server = undefined
  received = []
})

/** Un Healthchecks finto: registra i percorsi dei segnali, in ordine. */
async function fakeHealthchecks(): Promise<string> {
  server = createServer((req, res) => {
    received.push(req.url ?? '')
    res.writeHead(200, { 'content-type': 'text/plain' })
    res.end('OK')
  })
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve))
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}/ping/${CHECK_UUID}`
}

function run(command: string, env: Record<string, string>): Promise<{ status: number | null; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [SCRIPT, command], {
      cwd: ROOT,
      env: { ...process.env, CI: '', FORCE_COLOR: '0', ...env },
    })
    let output = ''
    child.stdout.on('data', (chunk) => (output += chunk))
    child.stderr.on('data', (chunk) => (output += chunk))
    child.on('close', (status) => resolve({ status, output }))
  })
}

function expectNoUrl(output: string, url: string): void {
  expect(output).not.toContain(CHECK_UUID)
  expect(output).not.toContain(url)
}

describe('segnali a Healthchecks', () => {
  it('un giro riuscito manda inizio e successo, ed esce 0', async () => {
    const url = await fakeHealthchecks()
    const result = await run('node -e "process.exit(0)"', { HEALTHCHECKS_URL: url })

    expect(result.status).toBe(0)
    expect(received).toEqual([`/ping/${CHECK_UUID}/start`, `/ping/${CHECK_UUID}`])
    expectNoUrl(result.output, url)
  })

  it('un giro fallito manda inizio e fallimento, ed esce col codice del comando', async () => {
    const url = await fakeHealthchecks()
    const result = await run('node -e "process.exit(3)"', { HEALTHCHECKS_URL: url })

    expect(result.status).toBe(3)
    expect(received).toEqual([`/ping/${CHECK_UUID}/start`, `/ping/${CHECK_UUID}/fail`])
    expectNoUrl(result.output, url)
  })

  it("il segnale d'inizio parte prima del comando", async () => {
    const url = await fakeHealthchecks()
    // Il comando chiede un percorso suo al server finto: deve arrivare dopo `start`.
    const port = new URL(url).port
    const result = await run(`node -e "fetch('http://127.0.0.1:${port}/comando').then(() => process.exit(0))"`, {
      HEALTHCHECKS_URL: url,
    })

    expect(result.status).toBe(0)
    expect(received).toEqual([`/ping/${CHECK_UUID}/start`, '/comando', `/ping/${CHECK_UUID}`])
  })

  it('con Healthchecks irraggiungibile il giro corre lo stesso, e il codice resta quello del comando', async () => {
    const url = await fakeHealthchecks()
    await new Promise((resolve) => server!.close(resolve))
    server = undefined

    const result = await run('node -e "process.exit(2)"', { HEALTHCHECKS_URL: url })

    expect(result.status).toBe(2)
    expect(result.output).toContain('non arrivato')
    expectNoUrl(result.output, url)
  })

  it('senza HEALTHCHECKS_URL si ferma prima del comando e lo dice', async () => {
    const result = await run('node -e "console.log(\'eseguito\')"', { HEALTHCHECKS_URL: '' })

    expect(result.status).toBe(1)
    expect(result.output).toContain('HEALTHCHECKS_URL')
    expect(result.output).not.toContain('eseguito')
  })
})

describe('il log di una corsa rossa', () => {
  /**
   * Il giro vero, rosso per credenziali sbagliate, contro il Supabase locale:
   * rosso sia con lo stack acceso (credenziali rifiutate) sia senza
   * (connessione rifiutata), come in `smokeOutput.test.ts`. È il comando dei
   * giri dopo il deploy e del giro orario, avvolto come nei giri pianificati.
   */
  it('non contiene valori del database, credenziali né l’indirizzo del controllo', async () => {
    const url = await fakeHealthchecks()
    const wrongPassword = 'PasswordSbagliata!190'
    const result = await run('npm run smoke:restore && SMOKE_LEVELS=a,b,c npm run smoke', {
      HEALTHCHECKS_URL: url,
      SMOKE_SUPABASE_URL: 'http://127.0.0.1:54321',
      SMOKE_SUPABASE_ANON_KEY: LOCAL_ANON_KEY,
      SMOKE_A_EMAIL: LOCAL_SENTINELS.a.email,
      SMOKE_A_PASSWORD: wrongPassword,
      SMOKE_B_EMAIL: LOCAL_SENTINELS.b.email,
      SMOKE_B_PASSWORD: wrongPassword,
    })

    expect(result.status).not.toBe(0)
    expect(received).toEqual([`/ping/${CHECK_UUID}/start`, `/ping/${CHECK_UUID}/fail`])
    // Una corsa che non ha stampato niente passerebbe i controlli sotto.
    expect(result.output).toContain('accesso di A non riuscito')
    expectNoUrl(result.output, url)
    expect(result.output).not.toMatch(/eyJ[\w-]+\.[\w-]+/)
    for (const value of [LOCAL_SENTINELS.a.email, LOCAL_SENTINELS.b.email, wrongPassword, LOCAL_ANON_KEY, '127.0.0.1:54321']) {
      expect(result.output).not.toContain(value)
    }
  }, 120_000)
})
