/**
 * La suite di smoke sul Supabase **locale**, com'è in CI (#187): crea le
 * sentinelle A e B se mancano, poi ripristino, livelli a, b e c, di nuovo
 * ripristino.
 *
 * Le sentinelle le creano gli helper E2E, che hanno la guardia della #186: la
 * suite non vede mai una chiave `service_role`, questo file sì, e solo in
 * locale. Le corse della suite sono processi figli con il loro reporter.
 */
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { LOCAL_ANON_KEY, LOCAL_SUPABASE_URL } from '../e2e/helpers/localSupabase'
import { createE2EUser, findUserByEmail } from '../e2e/helpers/supabase'
import { LOCAL_SENTINELS } from './sentinels'

const ROOT = join(__dirname, '..', '..')

const SMOKE_ENV = {
  SMOKE_SUPABASE_URL: LOCAL_SUPABASE_URL,
  SMOKE_SUPABASE_ANON_KEY: LOCAL_ANON_KEY,
  SMOKE_A_EMAIL: LOCAL_SENTINELS.a.email,
  SMOKE_A_PASSWORD: LOCAL_SENTINELS.a.password,
  SMOKE_B_EMAIL: LOCAL_SENTINELS.b.email,
  SMOKE_B_PASSWORD: LOCAL_SENTINELS.b.password,
}

/** Una corsa della suite; l'output è il suo, stampato dal suo reporter. */
function smoke(env: Record<string, string>): number | null {
  const run = spawnSync(
    process.execPath,
    ['node_modules/vitest/vitest.mjs', 'run', '--config', 'vitest.smoke.config.ts'],
    { cwd: ROOT, env: { ...process.env, ...SMOKE_ENV, ...env }, stdio: 'inherit' }
  )
  return run.status
}

it('crea le sentinelle A e B, se mancano', async () => {
  for (const sentinel of [LOCAL_SENTINELS.a, LOCAL_SENTINELS.b]) {
    if (!(await findUserByEmail(sentinel.email))) await createE2EUser(sentinel.email, sentinel.password)
  }
})

it('ripristino, livelli a, b e c, ripristino', () => {
  // In fila e fermandosi al primo rosso: un livello dopo un ripristino fallito
  // misurerebbe lo stato sbagliato.
  expect(smoke({ SMOKE_RUN: 'restore' }), 'ripristino').toBe(0)
  expect(smoke({ SMOKE_LEVELS: 'a,b,c' }), 'livelli a, b, c').toBe(0)
  expect(smoke({ SMOKE_RUN: 'restore' }), 'ripristino finale').toBe(0)
})
