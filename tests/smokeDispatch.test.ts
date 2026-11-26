/**
 * Chi avvia i giri pianificati contro la produzione (#286).
 *
 * Lo `schedule` di GitHub non faceva partire i giri: in 22 ore 2 orari su 22,
 * nessun giornaliero. Li avviano due Netlify Scheduled Function, che chiedono
 * a GitHub un `workflow_dispatch` su `main` e non fanno altro. Se la chiamata
 * fallisce la funzione fallisce, senza riprovare in ciclo: il giro mancato lo
 * segnala Healthchecks.
 *
 * Il token sta in una variabile d'ambiente di Netlify e il repo è pubblico: non
 * deve mai finire nel log né nel messaggio d'errore.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import hourly, { config as hourlyConfig } from '../netlify/functions/smoke-hourly-dispatch.mts'
import daily, { config as dailyConfig } from '../netlify/functions/smoke-daily-dispatch.mts'
import { dispatchWorkflow, TOKEN_VARIABLE } from '../netlify/lib/dispatchWorkflow'

/** Un token riconoscibile: se compare in un log o in un errore, il test lo vede. */
const TOKEN = 'github_pat_TEST_TOKEN_must_never_be_logged_0123456789'

let fetchMock: ReturnType<typeof vi.fn>
let logged: string[]

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv(TOKEN_VARIABLE, TOKEN)
  logged = []
  const record = (...args: unknown[]) => {
    logged.push(args.map(String).join(' '))
  }
  vi.spyOn(console, 'log').mockImplementation(record)
  vi.spyOn(console, 'error').mockImplementation(record)
  vi.spyOn(console, 'warn').mockImplementation(record)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

/** Esegue la chiamata e restituisce l'errore, se c'è. */
async function settle(promise: Promise<unknown>): Promise<Error | undefined> {
  try {
    await promise
    return undefined
  } catch (error) {
    return error as Error
  }
}

function expectNoToken(error: Error | undefined): void {
  for (const line of logged) expect(line).not.toContain(TOKEN)
  if (error) {
    expect(error.message).not.toContain(TOKEN)
    expect(String(error.stack)).not.toContain(TOKEN)
  }
}

describe('gli orari', () => {
  it('il giro orario parte al minuto 17 di ogni ora, in UTC', () => {
    expect(hourlyConfig.schedule).toBe('17 * * * *')
  })

  it('il giro giornaliero parte alle 05:43 UTC', () => {
    expect(dailyConfig.schedule).toBe('43 5 * * *')
  })

  it('il giro giornaliero sta lontano dalla mezzanotte di Roma: ripristino e controllo nello stesso giorno', () => {
    const [, hour] = dailyConfig.schedule.match(/^\d+ (\d+) \* \* \*$/) ?? []
    // Roma è UTC+1 o UTC+2: fra le 3 e le 20 UTC la mezzanotte è lontana ore.
    expect(Number(hour)).toBeGreaterThanOrEqual(3)
    expect(Number(hour)).toBeLessThanOrEqual(20)
  })
})

describe('le due funzioni', () => {
  it.each([
    ['orario', hourly, 'smoke-hourly.yml'],
    ['giornaliero', daily, 'smoke-daily.yml'],
  ])('il giro %s chiede a GitHub di avviare il suo workflow su main', async (_name, handler, workflow) => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))

    await handler()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`https://api.github.com/repos/E-Lop/entro/actions/workflows/${workflow}/dispatches`)
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({ ref: 'main' })
    const headers = new Headers(init.headers)
    expect(headers.get('authorization')).toBe(`Bearer ${TOKEN}`)
    expect(headers.get('accept')).toBe('application/vnd.github+json')
    expect(headers.get('user-agent')).toBeTruthy()
    expectNoToken(undefined)
  })
})

describe('dispatchWorkflow', () => {
  it('accetta anche il 200 con i dettagli della corsa', async () => {
    fetchMock.mockResolvedValue(Response.json({ workflow_run_id: 1 }, { status: 200 }))

    const error = await settle(dispatchWorkflow('smoke-hourly.yml'))

    expect(error).toBeUndefined()
    expect(logged.join('\n')).toContain('smoke-hourly.yml')
  })

  it('senza token fallisce e non chiama GitHub', async () => {
    vi.stubEnv(TOKEN_VARIABLE, '')

    const error = await settle(dispatchWorkflow('smoke-hourly.yml'))

    expect(error).toBeInstanceOf(Error)
    expect(error!.message).toContain(TOKEN_VARIABLE)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([401, 404, 500])('con un %i fallisce, e il log dice codice e workflow ma non il token', async (status) => {
    fetchMock.mockResolvedValue(
      Response.json({ message: `echo ${TOKEN}` }, { status }),
    )

    const error = await settle(dispatchWorkflow('smoke-daily.yml'))

    expect(error).toBeInstanceOf(Error)
    expect(error!.message).toContain(String(status))
    expect(error!.message).toContain('smoke-daily.yml')
    const log = logged.join('\n')
    expect(log).toContain(String(status))
    expect(log).toContain('smoke-daily.yml')
    expectNoToken(error)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('con la rete che cade fallisce una volta sola, senza riprovare e senza il token', async () => {
    fetchMock.mockRejectedValue(new TypeError(`fetch failed for Bearer ${TOKEN}`))

    const error = await settle(dispatchWorkflow('smoke-hourly.yml'))

    expect(error).toBeInstanceOf(Error)
    expect(error!.message).toContain('smoke-hourly.yml')
    expectNoToken(error)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
