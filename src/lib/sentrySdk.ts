/**
 * Le sole parti di `@sentry/react` che usa `sentry.ts` (#192).
 *
 * Il modulo si carica soltanto con `import()`, quando c'è `VITE_SENTRY_DSN`.
 * Passare di qui invece che da `import('@sentry/react')` lascia al bundler
 * togliere il resto dell'SDK: l'import dinamico dell'intero pacchetto ne
 * portava nel chunk ogni parte, 149 KB compressi misurati sulla build del
 * 22 ott 2026.
 */
export {
  captureException,
  close,
  flush,
  getCurrentScope,
  httpClientIntegration,
  init,
  withScope,
} from '@sentry/react'
