// @vitest-environment jsdom
/**
 * `signOut` — la pulizia dello storage non deve dipendere dall'esito di Supabase.
 *
 * Il caso vero non è il logout che riesce: è quello in cui la sessione è già
 * scaduta lato server, Supabase rifiuta la richiesta, e i token restano nel
 * browser. Su una macchina condivisa quei token sono leggibili da chiunque
 * apra i devtools, e al ricaricamento il client può ricostruirci sopra una
 * sessione.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockSignOut, mockUnsubscribeFromPush, mockClearPersistedCache } = vi.hoisted(() => ({
  mockSignOut: vi.fn(),
  mockUnsubscribeFromPush: vi.fn(),
  mockClearPersistedCache: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { signOut: mockSignOut } },
}))

vi.mock('@/lib/pushNotifications', () => ({
  unsubscribeFromPush: mockUnsubscribeFromPush,
}))

vi.mock('@/lib/queryPersister', () => ({
  clearPersistedCache: mockClearPersistedCache,
}))

import { signOut } from '@/lib/auth'

/** Le chiavi che un utente loggato si trova in `localStorage`. */
function seedSession(): void {
  localStorage.setItem('sb-rmbmmwcxtnanacxbkihc-auth-token', 'token-di-sessione')
  localStorage.setItem('supabase.auth.token', 'token-legacy')
  localStorage.setItem('show_welcome_toast', '1')
  sessionStorage.setItem('user_initialized_abc', '1')
  sessionStorage.setItem('explicit_auth', '123')
  // Non è roba di auth: deve sopravvivere al logout.
  localStorage.setItem('theme', 'dark')
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  sessionStorage.clear()
  mockUnsubscribeFromPush.mockResolvedValue(undefined)
  mockClearPersistedCache.mockResolvedValue(undefined)
  mockSignOut.mockResolvedValue({ error: null })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('signOut', () => {
  it('pulisce lo storage quando Supabase accetta il logout', async () => {
    seedSession()

    const { error } = await signOut()

    expect(error).toBeNull()
    expect(localStorage.getItem('sb-rmbmmwcxtnanacxbkihc-auth-token')).toBeNull()
    expect(localStorage.getItem('supabase.auth.token')).toBeNull()
    expect(sessionStorage.getItem('user_initialized_abc')).toBeNull()
  })

  it('lascia intatto quello che non è di auth', async () => {
    seedSession()

    await signOut()

    expect(localStorage.getItem('theme')).toBe('dark')
  })

  it('pulisce lo storage anche quando Supabase rifiuta il logout', async () => {
    // Sessione già scaduta lato server: è il caso che lasciava i token nel
    // browser mentre la UI riportava l'utente al login.
    seedSession()
    mockSignOut.mockResolvedValue({ error: { message: 'Session from session_id claim in JWT does not exist' } })

    const { error } = await signOut()

    expect(error?.message).toBe('Session from session_id claim in JWT does not exist')
    expect(localStorage.getItem('sb-rmbmmwcxtnanacxbkihc-auth-token')).toBeNull()
    expect(localStorage.getItem('supabase.auth.token')).toBeNull()
    expect(sessionStorage.getItem('user_initialized_abc')).toBeNull()
  })

  it('pulisce lo storage anche quando la chiamata a Supabase solleva', async () => {
    seedSession()
    mockSignOut.mockRejectedValue(new Error('Network request failed'))

    const { error } = await signOut()

    expect(error?.message).toBe('Network request failed')
    expect(localStorage.getItem('sb-rmbmmwcxtnanacxbkihc-auth-token')).toBeNull()
  })

  it('non solleva se la pulizia stessa fallisce: riporta l\'errore nella risposta', async () => {
    // `localStorage` può sollevare quando il browser blocca lo storage
    // (Safari con i cookie bloccati, contesti incorporati). Il contratto del
    // modulo è che nessun wrapper sollevi mai: chi chiama legge `error`.
    seedSession()
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('Storage disabilitato')
    })

    const { error } = await signOut()

    expect(error?.message).toBe('Storage disabilitato')
  })

  it('quando falliscono entrambi riporta l\'errore di Supabase, che è la causa', async () => {
    seedSession()
    mockSignOut.mockResolvedValue({ error: { message: 'Session non trovata' } })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('Storage disabilitato')
    })

    const { error } = await signOut()

    expect(error?.message).toBe('Session non trovata')
  })

  it('non lascia che un fallimento della disiscrizione push blocchi la pulizia', async () => {
    seedSession()
    mockUnsubscribeFromPush.mockRejectedValue(new Error('Push endpoint irraggiungibile'))

    const { error } = await signOut()

    expect(error).toBeNull()
    expect(localStorage.getItem('sb-rmbmmwcxtnanacxbkihc-auth-token')).toBeNull()
  })
  it('segnala la pulizia locale riuscita anche quando Supabase rifiuta', async () => {
    // È il discriminante di chi chiama: su questo dispositivo l'utente è
    // fuori, quindi va portato al login comunque. Non lo si può dedurre da
    // `error`, che qui è valorizzato.
    seedSession()
    mockSignOut.mockRejectedValue(new Error('Failed to fetch'))

    const { error, localSessionCleared } = await signOut()

    expect(error?.message).toBe('Failed to fetch')
    expect(localSessionCleared).toBe(true)
  })

  it('segnala la pulizia locale fallita quando lo storage è bloccato', async () => {
    // Qui i token possono essere rimasti: chi chiama non deve dare per
    // scontato che l'utente sia uscito da questo dispositivo.
    seedSession()
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('Storage disabilitato')
    })

    const { localSessionCleared } = await signOut()

    expect(localSessionCleared).toBe(false)
  })

  it('segnala la pulizia locale riuscita sul percorso felice', async () => {
    seedSession()

    const { localSessionCleared } = await signOut()

    expect(localSessionCleared).toBe(true)
  })
})
