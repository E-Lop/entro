/**
 * La suite di smoke nel browser sul Supabase **locale**, com'è in CI (#191):
 * crea le sentinelle se mancano, rimette i dati noti, poi guarda la
 * dashboard di A in un dev server puntato allo stack locale.
 *
 * È il giro che in produzione fanno `npm run smoke:restore` e
 * `npm run smoke:browser`, con le credenziali delle sentinelle locali.
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

/** Un processo figlio con l'output suo, stampato dal suo reporter. */
function run(args: string[], env: Record<string, string>): number | null {
  // Senza `SMOKE_SITE_URL` la config del browser avvia il dev server locale:
  // una variabile rimasta nella shell lo manderebbe su un altro sito.
  const inherited = { ...process.env }
  delete inherited.SMOKE_SITE_URL
  return spawnSync(process.execPath, args, { cwd: ROOT, env: { ...inherited, ...SMOKE_ENV, ...env }, stdio: 'inherit' })
    .status
}

it('crea le sentinelle A e B, se mancano', async () => {
  for (const sentinel of [LOCAL_SENTINELS.a, LOCAL_SENTINELS.b]) {
    if (!(await findUserByEmail(sentinel.email))) await createE2EUser(sentinel.email, sentinel.password)
  }
})

it('ripristino, poi la dashboard di A nel browser', () => {
  // In fila: senza il ripristino di oggi le etichette attese non valgono.
  expect(
    run(['node_modules/vitest/vitest.mjs', 'run', '--config', 'vitest.smoke.config.ts'], { SMOKE_RUN: 'restore' }),
    'ripristino'
  ).toBe(0)
  expect(
    run(['node_modules/@playwright/test/cli.js', 'test', '--config', 'playwright.smoke.config.ts'], {}),
    'dashboard nel browser'
  ).toBe(0)
})
