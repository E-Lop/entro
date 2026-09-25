import { defineConfig } from 'vitest/config'
import base from './vitest.config'

/**
 * I guardiani di famiglia (#149): i test che confrontano entro con i repo
 * affiancati `entro-family` ed `entro-mobile`. Sono privati, quindi questi
 * test non stanno in `npm test`, che deve passare in un clone nuovo.
 *
 * Un test entra qui **per nome**: `*.family.test.ts`. Senza la sorgente
 * affiancata falliscono, di proposito, con un messaggio che dice cosa manca;
 * non diventano test saltati. `familyTestsBoundary.test.ts`, nella suite
 * normale, fa fallire un test che legge i repo affiancati senza quel nome.
 */
// Spread e non `mergeConfig`: `mergeConfig` concatena gli array, e l'`exclude`
// della config base (che toglie proprio `*.family.test.*`) svuoterebbe questa.
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: ['src/**/*.family.test.{ts,tsx}'],
    exclude: ['tests/e2e/**', '**/node_modules/**', '**/dist/**'],
  },
})
