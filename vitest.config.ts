import { defineConfig } from 'vitest/config'
import path from 'path'

const nodeMajor = Number(process.versions.node.split('.')[0])

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    // Node 25+ enables experimental Web Storage by default; without a backing file
    // its built-in `localStorage` resolves to `undefined` and shadows the one tests
    // expect (vitest#8757). Disabling it lets our setup own the global cleanly and
    // silences the `--localstorage-file` ExperimentalWarning.
    execArgv: nodeMajor >= 25 ? ['--no-experimental-webstorage'] : [],
  },
})
