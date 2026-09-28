import { defineConfig } from 'vitest/config'
import { smokeTestOptions } from '../vitestOptions'

/** La fixture che prova il reporter della suite di smoke (#187). */
export default defineConfig({
  test: smokeTestOptions(['tests/smoke/fixtures/leaky.smoke.ts']),
})
