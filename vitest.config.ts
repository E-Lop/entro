import { defineConfig } from 'vitest/config'
import path from 'path'

const nodeMajor = Number(process.versions.node.split('.')[0])

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // `foodSchemaParity.test.ts` carica lo schema gemello di entro-mobile, che
      // è un file **fuori** da questo progetto e risolverebbe `zod` sul proprio
      // `node_modules` (4.4.3 là, 4.3.5 qui all'11 set 2026). Il confronto
      // misurerebbe allora anche lo scarto fra le due versioni installate invece
      // delle due dichiarazioni di schema, che sono l'unica cosa che quel test
      // sorveglia — ed è il criterio che la #120 impone.
      //
      // Il modo in cui fallisce senza questo alias merita di essere scritto,
      // perché non si riconosce: `expected [Function ZodObject] to be [Function
      // ZodObject] — Compared values have no visual difference`.
      zod: path.resolve(__dirname, './node_modules/zod'),
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['tests/e2e/**', '**/node_modules/**', '**/dist/**'],
    // Node 25+ enables experimental Web Storage by default; without a backing file
    // its built-in `localStorage` resolves to `undefined` and shadows the one tests
    // expect (vitest#8757). Disabling it lets our setup own the global cleanly and
    // silences the `--localstorage-file` ExperimentalWarning.
    execArgv: nodeMajor >= 25 ? ['--no-experimental-webstorage'] : [],
  },
})
