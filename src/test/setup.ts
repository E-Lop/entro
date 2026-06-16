import { makeLocalStorage } from './localStorage'

// Install a working `localStorage` global for every test file. Node 25+ defines a
// built-in experimental `localStorage` accessor that returns `undefined` without
// `--localstorage-file`, and because the global already "exists" the jsdom
// environment doesn't install a usable one over it (vitest#8757, closed as an
// upstream Node behaviour). `defineProperty` reliably replaces whatever shape the
// built-in takes across Node versions; tests that need isolation call `.clear()`.
Object.defineProperty(globalThis, 'localStorage', {
  value: makeLocalStorage(),
  writable: true,
  configurable: true,
})
