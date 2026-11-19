/**
 * La suite di smoke nel browser (#191): ciò che si prova senza un browser.
 *
 * - Il reporter non stampa niente che venga dalla pagina: la suite girerà
 *   contro entroapp.it, e i log di Actions di questo repo sono pubblici.
 * - Le etichette attese sono quelle delle card, nel giorno del ripristino.
 * - La config non lascia artefatti e, senza `SMOKE_SITE_URL`, non riusa un dev
 *   server già acceso: quello di questo repo, col `.env.local`, parla con la
 *   produzione.
 *
 * Che la suite vera diventi rossa quando deve (data spostata, PostgREST
 * spento) si prova con lo stack acceso: la PR #191 riporta come.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TestCase, TestError, TestResult } from '@playwright/test/reporter'
import { EXPIRY_LABELS } from '@/lib/expiryLabels'
import { LOCAL_SUPABASE_URL } from './e2e/helpers/localSupabase'
import { expectedLabel } from './smoke-browser/expectedLabels'
import SmokeBrowserReporter, { category } from './smoke-browser/reporter'
import { LEAKY_EMAIL, LEAKY_JWT, LEAKY_SIGNED_URL } from './smoke/fixtures/leakyValues'
import { KNOWN_FOODS } from './smoke/knownFoods'

/** Il testo di una card di produzione, come lo riporterebbe un `expect` di Playwright. */
const CARD_TEXT = 'Mozzarella di bufala'

const LEAKY_ERROR: TestError = {
  message: `Error: expect(locator).toHaveText(expected)\nExpected: "Scade oggi"\nReceived: "${CARD_TEXT} 3 giorni"\nCall log: ${LEAKY_SIGNED_URL} ${LEAKY_EMAIL}`,
  stack: `Error: expect(locator).toHaveText(expected)\n    at ${LEAKY_JWT}`,
}

function smokeFailure(categoryText: string): TestError {
  return { message: categoryText, stack: `SmokeFailure: ${categoryText}\n    at dashboard.smoke.ts:1:1` }
}

describe('category', () => {
  it.each<[string, TestError | undefined, string]>([
    ['una SmokeFailure', smokeFailure('card nota mancante: x'), 'card nota mancante: x'],
    [
      'una SmokeFailure col nome nel messaggio',
      { message: 'SmokeFailure: etichetta inattesa: y', stack: 'SmokeFailure: etichetta inattesa: y\n    at z' },
      'etichetta inattesa: y',
    ],
    ['un expect di Playwright con il testo della pagina', LEAKY_ERROR, 'errore non classificato'],
    ['un errore senza stack', { message: 'accesso di A non riuscito' }, 'errore non classificato'],
    ['una SmokeFailure senza messaggio', { message: '', stack: 'SmokeFailure: \n    at z' }, 'errore non classificato'],
    ['nessun errore', undefined, 'errore non classificato'],
  ])('%s', (_, error, expected) => {
    expect(category(error)).toBe(expected)
  })
})

describe('SmokeBrowserReporter', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function testCase(title: string): TestCase {
    return { titlePath: () => ['', 'chromium', 'dashboard.smoke.ts', title] } as unknown as TestCase
  }

  function result(status: TestResult['status'], errors: TestError[] = []): TestResult {
    return { status, errors } as unknown as TestResult
  }

  it('stampa titoli e categorie, e niente del testo della pagina', () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const reporter = new SmokeBrowserReporter()

    reporter.onTestEnd(testCase('passa'), result('passed'))
    reporter.onTestEnd(testCase('categoria'), result('failed', [smokeFailure('etichetta inattesa: id')]))
    reporter.onTestEnd(testCase('trapela'), result('failed', [LEAKY_ERROR]))
    reporter.onTestEnd(testCase('scade'), result('timedOut', [LEAKY_ERROR]))
    reporter.onError(LEAKY_ERROR)
    reporter.onEnd({ status: 'failed' } as Parameters<SmokeBrowserReporter['onEnd']>[0])

    const output = write.mock.calls.map(([chunk]) => String(chunk)).join('')
    expect(output).toContain('✓ dashboard.smoke.ts › passa')
    expect(output).toContain('✗ dashboard.smoke.ts › categoria — etichetta inattesa: id')
    expect(output).toContain('✗ dashboard.smoke.ts › trapela — errore non classificato')
    expect(output).toContain('✗ dashboard.smoke.ts › scade — errore non classificato')
    expect(output).toContain('✗ errore fuori dai test — errore non classificato')
    expect(output).toContain('1 passati, 4 falliti (failed)')
    for (const leaked of [CARD_TEXT, LEAKY_JWT, LEAKY_SIGNED_URL, LEAKY_EMAIL, 'Received', 'Call log']) {
      expect(output).not.toContain(leaked)
    }
  })

  it('stampa da sé, così Playwright non aggiunge il suo output', () => {
    expect(new SmokeBrowserReporter().printsToStdio()).toBe(true)
  })
})

describe('expectedLabel', () => {
  it('nel giorno del ripristino le cinque card dicono Scaduto, Scade oggi e i giorni che mancano', () => {
    expect(KNOWN_FOODS.map(expectedLabel)).toEqual(['Scaduto', 'Scade oggi', '2 giorni', '7 giorni', '8 giorni'])
  })

  it('il controllo decisivo è «Scade oggi», la parola del bundle', () => {
    const today = KNOWN_FOODS.find((food) => food.expectedStatus === 'expires_today')
    expect(today && expectedLabel(today)).toBe(EXPIRY_LABELS.expires_today)
  })
})

describe('playwright.smoke.config.ts', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  async function loadConfig(targetUrl: string | undefined) {
    vi.resetModules()
    vi.stubEnv('SMOKE_SITE_URL', targetUrl)
    return (await import('../playwright.smoke.config')).default
  }

  it.each([undefined, 'https://entroapp.it'])('non lascia tracce, video né scatti (SMOKE_SITE_URL=%s)', async (targetUrl) => {
    const config = await loadConfig(targetUrl)
    expect(config.use).toMatchObject({ trace: 'off', video: 'off', screenshot: 'off', timezoneId: 'Europe/Rome' })
    expect(config.retries).toBe(0)
    // Le otto attese da 20 s dello spec: se il test scadesse prima, il suo
    // errore prenderebbe il posto della categoria.
    expect(config.timeout).toBeGreaterThan(8 * 20_000)
  })

  it('senza SMOKE_SITE_URL avvia un dev server suo, sul Supabase locale, senza riusarne uno acceso', async () => {
    const config = await loadConfig(undefined)
    const webServer = config.webServer as { reuseExistingServer: boolean; env: Record<string, string>; url: string }
    expect(webServer.reuseExistingServer).toBe(false)
    expect(webServer.env.VITE_SUPABASE_URL).toBe(LOCAL_SUPABASE_URL)
    expect(config.use?.baseURL).toBe(webServer.url)
    expect(webServer.url).not.toContain(':5173')
  })

  it('con SMOKE_SITE_URL guarda quel sito e non avvia niente', async () => {
    const config = await loadConfig('https://entroapp.it')
    expect(config.use?.baseURL).toBe('https://entroapp.it')
    expect(config.webServer).toBeUndefined()
  })
})
