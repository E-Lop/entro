// @vitest-environment jsdom
/**
 * Che cosa fa davvero `supabase.auth.signOut()` quando il server rifiuta.
 *
 * La #81 lascia aperta una domanda che decide la forma del rimedio: se
 * supabase-js emetta `SIGNED_OUT` anche sul percorso d'errore. Se lo emette,
 * `authStore` si svuota, `ProtectedRoute` porta al login da solo e il difetto
 * si riduce a una finestra breve; se non lo emette, l'utente resta sulla
 * dashboard finché non ricarica.
 *
 * La risposta non si legge nella documentazione: qui si monta il client vero
 * con `fetch` finto e si guarda che cosa succede. Il test è di
 * caratterizzazione — descrive una dipendenza, non il nostro codice — e serve
 * a due cose: motivare il rimedio, e accorgersi se una versione futura di
 * supabase-js cambia comportamento sotto di noi.
 */
import { createClient } from '@supabase/supabase-js'
import { afterEach, describe, expect, it, vi } from 'vitest'

const URL_SUPABASE = 'http://localhost:9999'
const CHIAVE_ANON = 'chiave-anonima-di-prova'

/** Sessione plausibile e non scaduta, come quella di un utente entrato. */
function sessionePersistita() {
  return {
    access_token: 'access-token-di-prova',
    refresh_token: 'refresh-token-di-prova',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: '00000000-0000-0000-0000-000000000001',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'utente@example.com',
      app_metadata: {},
      user_metadata: {},
      created_at: new Date().toISOString(),
    },
  }
}

/**
 * Client vero con storage in memoria già popolato e rete sotto controllo.
 * `rispostaLogout` decide come il server tratta la chiamata a `/logout`.
 */
function clientConSessione(rispostaLogout: () => Promise<Response>) {
  const memoria = new Map<string, string>()
  const chiaveStorage = 'sb-localhost-auth-token'
  memoria.set(chiaveStorage, JSON.stringify(sessionePersistita()))

  const fetchFinto = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url.includes('/logout')) return rispostaLogout()
    return new Response('{}', { status: 200 })
  })

  const client = createClient(URL_SUPABASE, CHIAVE_ANON, {
    auth: {
      autoRefreshToken: false,
      persistSession: true,
      detectSessionInUrl: false,
      storageKey: chiaveStorage,
      storage: {
        getItem: (k: string) => memoria.get(k) ?? null,
        setItem: (k: string, v: string) => void memoria.set(k, v),
        removeItem: (k: string) => void memoria.delete(k),
      },
    },
    global: { fetch: fetchFinto as unknown as typeof fetch },
  })

  return { client, memoria, chiaveStorage, fetchFinto }
}

type ClientDiProva = ReturnType<typeof clientConSessione>['client']

/** Raccoglie gli eventi di `onAuthStateChange` emessi durante il test. */
function registraEventi(client: ClientDiProva) {
  const eventi: string[] = []
  const { data } = client.auth.onAuthStateChange((evento) => {
    eventi.push(evento)
  })
  return { eventi, disiscrivi: () => data.subscription.unsubscribe() }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('supabase.auth.signOut() sul percorso d’errore', () => {
  it('con la sessione già scaduta lato server non ritorna errore ed emette SIGNED_OUT', async () => {
    const { client, memoria, chiaveStorage } = clientConSessione(
      async () =>
        new Response(
          JSON.stringify({
            code: 403,
            message: 'Session from session_id claim in JWT does not exist',
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        )
    )
    const { eventi, disiscrivi } = registraEventi(client)

    const { error } = await client.auth.signOut()

    expect(error).toBeNull()
    expect(eventi).toContain('SIGNED_OUT')
    expect(memoria.has(chiaveStorage)).toBe(false)
    disiscrivi()
  })

  it('quando la rete cade ritorna errore e NON emette SIGNED_OUT', async () => {
    const { client, memoria, chiaveStorage } = clientConSessione(() =>
      Promise.reject(new TypeError('Failed to fetch'))
    )
    const { eventi, disiscrivi } = registraEventi(client)

    const { error } = await client.auth.signOut()

    expect(error).not.toBeNull()
    expect(eventi).not.toContain('SIGNED_OUT')
    // La sessione resta nello storage di supabase-js: è la nostra
    // `clearAuthStorage()` a toglierla, non il client.
    expect(memoria.has(chiaveStorage)).toBe(true)
    disiscrivi()
  })
})
