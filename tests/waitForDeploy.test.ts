/**
 * L'attesa del deploy (#190): dopo un push su `main` il workflow interroga
 * `/version.json` sul sito finché lo SHA non è quello del push, per non più di
 * dieci minuti. Netlify non manda a GitHub un evento di deploy di produzione.
 *
 * La funzione si prova senza rete e senza attese vere: `fetch`, `sleep` e
 * l'orologio sono iniettati. La CLI si prova contro un sito finto in locale,
 * perché il suo log è pubblico e il contenuto del sito non ci deve finire.
 */
import { spawn } from 'node:child_process'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
// @ts-expect-error -- lo script è JavaScript senza dichiarazioni, come weekly-audit.mjs
import { waitForSha } from '../scripts/smoke/wait-for-deploy.mjs'
import { LEAKY_EMAIL, LEAKY_JWT } from './smoke/fixtures/leakyValues'

const SCRIPT = join(__dirname, '../scripts/smoke/wait-for-deploy.mjs')
const EXPECTED = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const PREVIOUS = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const URL = 'https://sito.example.test/version.json'
/** Il nome della variabile con l'indirizzo del sito. */
const ORIGIN_VARIABLE = 'SMOKE_SITE_URL'

interface Outcome {
  ok: boolean
  attempts: number
  outcome: string
}

/** Un orologio finto: `sleep` lo porta avanti, nessuna attesa vera. */
function fakeClock() {
  let elapsed = 0
  return {
    now: () => elapsed,
    sleep: async (ms: number) => {
      elapsed += ms
    },
    get elapsed() {
      return elapsed
    },
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

async function wait(fetchImpl: (url: string) => Promise<Response>, clock = fakeClock()): Promise<Outcome & { elapsed: number }> {
  const result: Outcome = await waitForSha({
    url: URL,
    expectedSha: EXPECTED,
    timeoutMs: 600_000,
    intervalMs: 15_000,
    fetchImpl,
    sleep: clock.sleep,
    now: clock.now,
  })
  return { ...result, elapsed: clock.elapsed }
}

describe('waitForSha', () => {
  it('SHA giusto al terzo tentativo: riuscita, dopo due attese', async () => {
    let calls = 0
    const result = await wait(async () => json({ sha: ++calls === 3 ? EXPECTED : PREVIOUS }))

    expect(result).toMatchObject({ ok: true, attempts: 3, outcome: 'SHA atteso' })
    expect(result.elapsed).toBe(30_000)
  })

  it('SHA mai giusto: fallimento allo scadere dei dieci minuti, non prima e non molto dopo', async () => {
    const result = await wait(async () => json({ sha: PREVIOUS }))

    expect(result).toMatchObject({ ok: false, outcome: 'SHA diverso' })
    expect(result.elapsed).toBeGreaterThanOrEqual(600_000)
    expect(result.elapsed).toBeLessThan(600_000 + 15_000)
    expect(result.attempts).toBe(41)
  })

  it('sito irraggiungibile: fallimento, non eccezione', async () => {
    const result = wait(async () => {
      throw new TypeError('fetch failed')
    })

    await expect(result).resolves.toMatchObject({ ok: false, outcome: 'sito non raggiungibile' })
  })

  it('un sito che torna raggiungibile durante il deploy non fa fallire', async () => {
    let calls = 0
    const result = await wait(async () => {
      if (++calls < 3) throw new TypeError('fetch failed')
      return json({ sha: EXPECTED })
    })

    expect(result).toMatchObject({ ok: true, attempts: 3 })
  })

  it.each<[string, () => Response]>([
    ['un 404, cioè un deploy senza il file', () => new Response('<html>pagina</html>', { status: 404 })],
    ['un corpo che non è JSON', () => new Response('<!doctype html>', { status: 200 })],
    ['un JSON senza sha', () => json({ version: 1 })],
  ])('%s: risposta non valida, fino allo scadere', async (_, response) => {
    const result = await wait(async () => response())

    expect(result).toMatchObject({ ok: false, outcome: 'risposta non valida' })
  })

  it('chiede il file senza cache, e ogni richiesta ha un suo limite di tempo', async () => {
    const requests: RequestInit[] = []
    await wait(async (_url: string, init?: RequestInit) => {
      requests.push(init ?? {})
      return json({ sha: EXPECTED })
    })

    expect(requests[0].cache).toBe('no-store')
    expect(requests[0].signal).toBeInstanceOf(AbortSignal)
  })
})

describe('la CLI', () => {
  let server: Server | undefined

  afterEach(async () => {
    await new Promise((resolve) => (server ? server.close(resolve) : resolve(undefined)))
    server = undefined
  })

  /** Un sito finto che serve sempre lo stesso corpo. */
  async function fakeOrigin(body: string, status = 200): Promise<string> {
    server = createServer((_req, res) => {
      res.writeHead(status, { 'content-type': 'application/json' })
      res.end(body)
    })
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve))
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  }

  /** La CLI con l'indirizzo del sito e lo SHA atteso, ciascuno assente se `undefined`. */
  function run(origin: string | undefined, expectedSha: string | undefined): Promise<{ status: number | null; output: string }> {
    // Una variabile rimasta nella shell coprirebbe il caso «mancante».
    const env = { ...process.env }
    delete env[ORIGIN_VARIABLE]
    delete env.EXPECTED_SHA
    if (origin) env[ORIGIN_VARIABLE] = origin
    if (expectedSha) env.EXPECTED_SHA = expectedSha
    return new Promise((resolve) => {
      const child = spawn(process.execPath, [SCRIPT, '--timeout-seconds', '1', '--interval-seconds', '0.2'], { env })
      let output = ''
      child.stdout.on('data', (chunk) => (output += chunk))
      child.stderr.on('data', (chunk) => (output += chunk))
      child.on('close', (status) => resolve({ status, output }))
    })
  }

  it('esce 0 quando il sito serve lo SHA atteso', async () => {
    const url = await fakeOrigin(JSON.stringify({ sha: EXPECTED }))
    const result = await run(url, EXPECTED)

    expect(result.status).toBe(0)
    expect(result.output).toContain('SHA atteso')
  })

  it('esce 1 allo scadere, e non stampa niente di ciò che il sito ha servito', async () => {
    const url = await fakeOrigin(JSON.stringify({ sha: PREVIOUS, note: `${LEAKY_EMAIL} ${LEAKY_JWT}` }))
    const result = await run(url, EXPECTED)

    expect(result.status).toBe(1)
    expect(result.output).toContain('SHA diverso')
    for (const leaked of [PREVIOUS, LEAKY_EMAIL, LEAKY_JWT]) expect(result.output).not.toContain(leaked)
  })

  it('esce 1, senza eccezione, quando il sito non risponde', async () => {
    const url = await fakeOrigin('')
    await new Promise((resolve) => server!.close(resolve))
    server = undefined
    const result = await run(url, EXPECTED)

    expect(result.status).toBe(1)
    expect(result.output).toContain('sito non raggiungibile')
    expect(result.output).not.toMatch(/at .*\.mjs:\d+/)
  })

  it.each<[string, string | undefined, string | undefined]>([
    [ORIGIN_VARIABLE, undefined, EXPECTED],
    ['EXPECTED_SHA', 'http://127.0.0.1:9', undefined],
  ])('senza %s si ferma e lo dice', async (name, origin, expectedSha) => {
    const result = await run(origin, expectedSha)

    expect(result.status).toBe(1)
    expect(result.output).toContain(name)
  })
})
