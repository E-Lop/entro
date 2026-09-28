import { defineConfig } from 'vitest/config'
import base from './vitest.config'

/**
 * `npm run smoke:local`: la suite di smoke sul Supabase locale, con le
 * sentinelle create dagli helper E2E (#187). È il comando che gira in CI.
 */
export default defineConfig({
  resolve: base.resolve,
  test: {
    include: ['tests/smoke-local/local.run.ts'],
    environment: 'node',
    testTimeout: 180_000,
  },
})
