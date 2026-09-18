// @vitest-environment jsdom
/**
 * Il testo di Supabase Auth non diventa il messaggio (entro#100).
 *
 * Le quattro funzioni di `auth.ts` che una pagina mostra restituiscono il
 * messaggio scelto dalla tabella di `authErrorMessage`, per `error.code`, e
 * tengono l'originale in `Error.cause`. Che a schermo arrivi davvero quello lo
 * prova `tests/e2e/auth-message-not-on-screen.spec.ts`: qui si prova la regola.
 */
import { AuthApiError, AuthRetryableFetchError } from '@supabase/auth-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { auth } = vi.hoisted(() => ({
  auth: {
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updateUser: vi.fn(),
  },
}))

vi.mock('@/lib/supabase', () => ({ supabase: { auth } }))
vi.mock('@/lib/pushNotifications', () => ({ unsubscribeFromPush: vi.fn() }))
vi.mock('@/lib/queryPersister', () => ({ clearPersistedCache: vi.fn() }))

import { resetPasswordRequest, signIn, signUp, updatePassword } from '@/lib/auth'
import { GENERIC_AUTH_ERROR } from '@/lib/authErrorMessage'

const refused = (error: Error) => ({ data: { user: null, session: null }, error })

beforeEach(() => vi.clearAllMocks())

describe('ogni funzione dice la cosa decisa per il suo caso', () => {
  it('signIn: credenziali sbagliate, generico di proposito', async () => {
    auth.signInWithPassword.mockResolvedValue(
      refused(new AuthApiError('Invalid login credentials', 400, 'invalid_credentials'))
    )

    const { error } = await signIn('utente@example.com', 'sbagliata')

    expect(error?.message).toBe('Email o password non corretti')
  })

  it('signIn: email non confermata', async () => {
    auth.signInWithPassword.mockResolvedValue(
      refused(new AuthApiError('Email not confirmed', 400, 'email_not_confirmed'))
    )

    const { error } = await signIn('utente@example.com', 'Password1!')

    expect(error?.message).toBe('Conferma la tua email prima di accedere')
  })

  it('signUp: account già esistente', async () => {
    auth.signUp.mockResolvedValue(
      refused(new AuthApiError('User already registered', 422, 'user_already_exists'))
    )

    const { error } = await signUp('utente@example.com', 'Password1!', 'Mario Rossi')

    expect(error?.message).toBe('Esiste già un account con questa email')
  })

  it('resetPasswordRequest: troppe email', async () => {
    auth.resetPasswordForEmail.mockResolvedValue(
      refused(new AuthApiError('Email rate limit exceeded', 429, 'over_email_send_rate_limit'))
    )

    const { error } = await resetPasswordRequest('utente@example.com')

    expect(error?.message).toBe('Troppi tentativi, riprova fra qualche minuto')
  })

  it('updatePassword: password uguale alla precedente', async () => {
    auth.updateUser.mockResolvedValue(
      refused(new AuthApiError('New password should be different', 422, 'same_password'))
    )

    const { error } = await updatePassword('Password1!')

    expect(error?.message).toBe('La nuova password deve essere diversa da quella attuale')
  })
})

/**
 * Il caso visto a schermo su entro-mobile il 6 set 2026: con l'auth
 * irraggiungibile `auth-js` mette nel messaggio la risposta serializzata.
 */
describe('il testo del server non diventa il messaggio, e resta in cause', () => {
  const unavailable = new AuthRetryableFetchError(
    '{"status":503,"url":"http://127.0.0.1:54321/auth/v1/token"}',
    503
  )

  it.each([
    ['signUp', 'signUp', () => signUp('utente@example.com', 'Password1!', 'Mario Rossi')],
    ['signIn', 'signInWithPassword', () => signIn('utente@example.com', 'Password1!')],
    ['resetPasswordRequest', 'resetPasswordForEmail', () => resetPasswordRequest('a@b.it')],
    ['updatePassword', 'updateUser', () => updatePassword('Password1!')],
  ] as const)('%s', async (_name, method, call) => {
    auth[method].mockResolvedValue(refused(unavailable))

    const { error } = await call()

    expect(error?.message).toBe(GENERIC_AUTH_ERROR)
    expect(error?.cause).toBe(unavailable)
  })

  it('anche quando il client lancia invece di restituire', async () => {
    const thrown = new TypeError('Failed to fetch')
    auth.signInWithPassword.mockRejectedValue(thrown)

    const { error } = await signIn('utente@example.com', 'Password1!')

    expect(error?.message).toBe(GENERIC_AUTH_ERROR)
    expect(error?.cause).toBe(thrown)
  })
})
