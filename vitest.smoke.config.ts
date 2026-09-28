import { defineConfig } from 'vitest/config'
import base from './vitest.config'
import { smokeTestOptions } from './tests/smoke/vitestOptions'

/**
 * La suite di smoke API (#187), fuori da `npm test`.
 *
 * - `npm run smoke:restore` rimette i dati noti delle sentinelle A e B;
 * - `npm run smoke` lancia i livelli scelti da `SMOKE_LEVELS`, per esempio `a`
 *   oppure `a,b,c`: (a) lettura, (b) scritture reversibili, (c) inviti.
 *
 * Il resto della configurazione viene dall'ambiente: `SMOKE_SUPABASE_URL`,
 * `SMOKE_SUPABASE_ANON_KEY`, `SMOKE_A_EMAIL`, `SMOKE_A_PASSWORD`,
 * `SMOKE_B_EMAIL`, `SMOKE_B_PASSWORD`. In locale li imposta
 * `npm run smoke:local`.
 */
const LEVELS = ['a', 'b', 'c']

function include(): string[] {
  if (process.env.SMOKE_RUN === 'restore') return ['tests/smoke/restore.smoke.ts']

  const levels = (process.env.SMOKE_LEVELS ?? '').split(',').map((level) => level.trim()).filter(Boolean)
  if (levels.length === 0) {
    throw new Error('SMOKE_LEVELS mancante: per esempio «a» oppure «a,b,c».')
  }
  const unknown = levels.filter((level) => !LEVELS.includes(level))
  if (unknown.length > 0) {
    throw new Error(`SMOKE_LEVELS: livelli sconosciuti ${unknown.join(', ')}; quelli validi sono a, b, c.`)
  }
  return levels.map((level) => `tests/smoke/level-${level}.smoke.ts`)
}

export default defineConfig({
  resolve: base.resolve,
  test: smokeTestOptions(include()),
})
