import { createClient } from '@supabase/supabase-js'
// Non da `supabase.types`: la versione ristretta rimette il vocabolario che il
// generatore perde. Passando di qui vale per tutti i consumatori e per il
// client stesso, che così rifiuta anche le scritture fuori vocabolario.
import type { Database } from './supabase.overrides'
import { createSessionBoundFetch, userIsInside } from './sessionBoundFetch'
import { declareSessionCheck, pausingOnHeldBack, releaseOnAuthEvent } from './heldBackRequests'
import { createFailureReportingFetch } from './supabaseFailureReport'
import { reportSupabaseFailure } from './sentry'

export type { Database } from './supabase.overrides'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env.local file.'
  )
}

/**
 * Create Supabase client with auth configuration.
 *
 * `detectSessionInUrl: true` is required for password reset, magic link and
 * OAuth redirects because Supabase reads auth tokens from URL fragments. As a
 * side effect it can auto-login from any URL carrying an active token (even in
 * incognito); `authStore` guards and logs this — do not disable it.
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  global: {
    // Ogni richiesta fallita diventa un evento Sentry con il solo codice
    // (#192). Chi è dentro non manda richieste da anonimo, e una richiesta
    // trattenuta mette in pausa React Query come una rete assente: il perché
    // in `sessionBoundFetch.ts` e `heldBackRequests.ts` (#229). La
    // segnalazione sta fuori, così vede anche le richieste trattenute: per
    // supabase-js sono un `{ error }` come le altre.
    fetch: createFailureReportingFetch({
      supabaseUrl,
      report: reportSupabaseFailure,
      fetchImpl: pausingOnHeldBack(
        createSessionBoundFetch({ publicKey: supabaseAnonKey, hasUser: userIsInside })
      ),
    }),
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
    // 15s instead of the default 25s: faster disconnect detection on mobile.
    heartbeatIntervalMs: 15000,
    timeout: 20000,
  },
})

// Al rinnovo del token, o all'uscita, le scritture in pausa ripartono (#229).
// E se il rinnovo è riuscito prima che la pausa scattasse, la toglie il
// controllo della sessione: il perché in `heldBackRequests.ts`.
supabase.auth.onAuthStateChange((event) => releaseOnAuthEvent(event))
declareSessionCheck(async () => (await supabase.auth.getSession()).data.session !== null)
