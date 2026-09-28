/**
 * La suite di smoke non stampa niente che venga dal server (#187).
 *
 * Girerà anche in produzione, e i log di Actions di questo repo sono pubblici
 * per 90 giorni. Il reporter stampa il nome del test e una categoria scritta nel
 * codice; mai `error.message`, diff, valori letti, URL o token.
 *
 * Due corse figlie, tutte e due rosse di proposito:
 * - la suite vera con le password sbagliate, contro il Supabase locale: rossa
 *   sia con lo stack acceso (credenziali rifiutate) sia senza, come nel job
 *   `test` della CI (connessione rifiutata);
 * - una fixture che lancia errori pieni di JWT, URL firmati ed email, fallisce
 *   con un diff, li scrive in console e lascia una promise rifiutata. Senza di
 *   lei il test non morderebbe: con la password sbagliata il server non
 *   restituisce niente di segreto.
 */
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LOCAL_ANON_KEY, LOCAL_SUPABASE_URL } from './e2e/helpers/localSupabase'
import { LEAKY_EMAIL, LEAKY_JWT, LEAKY_SIGNED_URL } from './smoke/fixtures/leakyValues'
import { LOCAL_SENTINELS } from './smoke-local/sentinels'

const ROOT = join(__dirname, '..')
const WRONG_PASSWORD = 'PasswordSbagliata!187'

function runVitest(config: string, env: Record<string, string>): { status: number | null; output: string } {
  const run = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--config', config], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, ...env, CI: '', FORCE_COLOR: '0' },
    timeout: 60_000,
  })
  return { status: run.status, output: `${run.stdout}\n${run.stderr}` }
}

/** Ciò che non deve mai comparire: forme generiche e i valori precisi di questa corsa. */
function leaks(output: string, values: string[]): string[] {
  const found: string[] = []
  if (/eyJ[\w-]+\.[\w-]+/.test(output)) found.push('JWT')
  if (/token=/.test(output)) found.push('token di URL firmato')
  for (const host of ['127.0.0.1:54321', 'localhost:54321']) if (output.includes(host)) found.push(`host ${host}`)
  for (const value of values) if (output.includes(value)) found.push(`valore: ${value.slice(0, 12)}…`)
  return found
}

describe('output della suite di smoke', () => {
  it('la suite vera, rossa per credenziali sbagliate, non stampa host né email', () => {
    const env = {
      SMOKE_SUPABASE_URL: LOCAL_SUPABASE_URL,
      SMOKE_SUPABASE_ANON_KEY: LOCAL_ANON_KEY,
      SMOKE_A_EMAIL: LOCAL_SENTINELS.a.email,
      SMOKE_A_PASSWORD: WRONG_PASSWORD,
      SMOKE_B_EMAIL: LOCAL_SENTINELS.b.email,
      SMOKE_B_PASSWORD: WRONG_PASSWORD,
    }
    const restore = runVitest('vitest.smoke.config.ts', { ...env, SMOKE_RUN: 'restore' })
    const levels = runVitest('vitest.smoke.config.ts', { ...env, SMOKE_LEVELS: 'a,b,c' })

    for (const run of [restore, levels]) {
      expect(run.status).not.toBe(0)
      // Una corsa che non ha stampato niente passerebbe il controllo sotto.
      expect(run.output).toContain('accesso di A non riuscito')
      expect(leaks(run.output, [LOCAL_SENTINELS.a.email, LOCAL_SENTINELS.b.email, WRONG_PASSWORD, LOCAL_ANON_KEY])).toEqual([])
    }
  }, 120_000)

  it('una fixture che fa trapelare tutto, in ogni modo, non trapela', () => {
    const run = runVitest('tests/smoke/fixtures/vitest.leaky.config.ts', {})

    expect(run.status).not.toBe(0)
    expect(run.output).toContain('errore non classificato')
    expect(run.output).toContain('categoria scritta nel codice')
    expect(leaks(run.output, [LEAKY_EMAIL, LEAKY_JWT, LEAKY_SIGNED_URL])).toEqual([])
  }, 60_000)
})
