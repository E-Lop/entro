/**
 * Le sentinelle A e B sul Supabase **locale**, e questa è la fonte unica delle
 * loro credenziali (#187). Valgono solo sullo stack locale, come la password
 * degli utenti E2E; quelle di produzione stanno nell'Environment `production`
 * (#189) e non passano mai di qui.
 */
export const LOCAL_SENTINELS = {
  a: { email: 'smoke-a@example.test', password: 'SentinellaLocale-A-2026' },
  b: { email: 'smoke-b@example.test', password: 'SentinellaLocale-B-2026' },
} as const
