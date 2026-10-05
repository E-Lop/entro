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

const { mockSignOut, mockUnsubscribeFromPush, mockClearPersistedCache, mockClearSignedImageCaches } =
  vi.hoisted(() => ({
    mockSignOut: vi.fn(),
    mockUnsubscribeFromPush: vi.fn(),
    mockClearPersistedCache: vi.fn(),
    mockClearSignedImageCaches: vi.fn(),
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

vi.mock('@/lib/signedImageCache', () => ({
  clearSignedImageCaches: mockClearSignedImageCaches,
}))

import { signOut } from '@/lib/auth'
import { queryClient } from '@/lib/queryClient'

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
  mockClearSignedImageCaches.mockResolvedValue(undefined)
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

  it('chiude solo la sessione di questo browser, non quelle degli altri dispositivi', async () => {
    // Il default di supabase-js è `scope: 'global'`, che revoca ogni sessione
    // dell'utente: un logout dal telefono chiudeva anche il browser (#119 di
    // entro-mobile). La regola è in entro-family, `conventions/sign-out-scope.md`.
    await signOut()

    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' })
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

  it('svuota la cache in memoria: chi entra dopo nella stessa scheda non vede la lista di chi è uscito', async () => {
    // L'uscita non ricarica la pagina, e le chiavi delle query non portano
    // l'utente: senza questo, il prossimo accesso monta la dashboard sopra i
    // dati ancora «freschi» di chi c'era prima. Visto nel browser: tre card
    // di un altro account a schermo finché la lista non viene riletta.
    queryClient.setQueryData(['foods', 'list'], [{ id: 'di-chi-esce' }])
    queryClient.setQueryData(['signed-url', 'utente/foto.jpg'], 'https://esempio/firmata')

    await signOut()

    expect(queryClient.getQueryData(['foods', 'list'])).toBeUndefined()
    expect(queryClient.getQueryData(['signed-url', 'utente/foto.jpg'])).toBeUndefined()
  })

  it('svuota la cache in memoria anche quando Supabase rifiuta il logout', async () => {
    queryClient.setQueryData(['foods', 'list'], [{ id: 'di-chi-esce' }])
    mockSignOut.mockResolvedValue({ error: { message: 'Session non trovata' } })

    await signOut()

    expect(queryClient.getQueryData(['foods', 'list'])).toBeUndefined()
  })

  it('svuota la cache in memoria anche quando la chiamata a Supabase solleva', async () => {
    queryClient.setQueryData(['foods', 'list'], [{ id: 'di-chi-esce' }])
    mockSignOut.mockRejectedValue(new Error('Network request failed'))

    await signOut()

    expect(queryClient.getQueryData(['foods', 'list'])).toBeUndefined()
  })

  it('con la cache in memoria se ne vanno le scritture in coda: non devono partire con la sessione di un altro', async () => {
    const mutation = queryClient.getMutationCache().build(queryClient, { mutationFn: async () => 'ok' })
    expect(queryClient.getMutationCache().getAll()).toContain(mutation)

    await signOut()

    expect(queryClient.getMutationCache().getAll()).toHaveLength(0)
  })

  it('svuota la cache delle foto: chi entra dopo non deve trovare quelle di chi è uscito', async () => {
    // #213: il service worker tiene le foto viste per 7 giorni sotto una chiave
    // senza token, quindi le serve a chiunque usi questo browser dopo.
    await signOut()

    expect(mockClearSignedImageCaches).toHaveBeenCalledTimes(1)
  })

  it('svuota la cache delle foto anche quando Supabase rifiuta il logout', async () => {
    mockSignOut.mockResolvedValue({ error: { message: 'Session non trovata' } })

    await signOut()

    expect(mockClearSignedImageCaches).toHaveBeenCalledTimes(1)
  })

  it('svuota la cache delle foto anche quando la chiamata a Supabase solleva', async () => {
    mockSignOut.mockRejectedValue(new Error('Network request failed'))

    await signOut()

    expect(mockClearSignedImageCaches).toHaveBeenCalledTimes(1)
  })

  it('se la cache delle foto non si svuota il logout resta un logout', async () => {
    seedSession()
    mockClearSignedImageCaches.mockRejectedValue(new Error('Cache bloccata'))

    const { error, localSessionCleared } = await signOut()

    expect(error).toBeNull()
    expect(localSessionCleared).toBe(true)
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
