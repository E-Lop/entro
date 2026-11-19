import { defineConfig } from 'vitest/config'
import base from './vitest.config'

/**
 * `npm run smoke:local`: la suite di smoke sul Supabase locale, con le
 * sentinelle create dagli helper E2E (#187). È il comando che gira in CI.
 *
 * Con `SMOKE_LOCAL_RUN=browser` (`npm run smoke:browser:local`) lancia invece
 * la suite nel browser (#191). In CI è un passo a sé, dopo l'installazione di
 * Chromium: la suite API gira prima dei passi apt di Playwright (#250).
 */
const RUN = process.env.SMOKE_LOCAL_RUN === 'browser' ? 'browser' : 'local'

export default defineConfig({
  resolve: base.resolve,
  test: {
    include: [`tests/smoke-local/${RUN}.run.ts`],
    environment: 'node',
    testTimeout: 180_000,
  },
})
