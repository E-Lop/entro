// @vitest-environment jsdom
/**
 * «Esci dagli altri dispositivi» (#143): chiude le sessioni degli altri
 * dispositivi e lascia intatta questa.
 *
 * Con `scope: 'others'` la sessione corrente non riceve nessun evento
 * (`@supabase/auth-js`, `signOut`): l'esito si legge solo dal risultato della
 * chiamata.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSignOut } = vi.hoisted(() => ({ mockSignOut: vi.fn() }))

vi.mock('@/lib/supabase', () => ({ supabase: { auth: { signOut: mockSignOut } } }))
vi.mock('@/lib/pushNotifications', () => ({ unsubscribeFromPush: vi.fn() }))
vi.mock('@/lib/queryPersister', () => ({ clearPersistedCache: vi.fn() }))

import { signOutOtherDevices } from '@/lib/auth'

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  localStorage.setItem('sb-rmbmmwcxtnanacxbkihc-auth-token', 'token-di-sessione')
})

describe('signOutOtherDevices', () => {
  it('chiude solo gli altri dispositivi, non questo e non tutti', async () => {
    mockSignOut.mockResolvedValue({ error: null })

    const { error } = await signOutOtherDevices()

    expect(error).toBeNull()
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'others' })
  })

  it('la sessione di questo browser resta dov\'è, anche se il server rifiuta', async () => {
    mockSignOut.mockResolvedValue({ error: { message: 'boom', status: 500 } })

    await signOutOtherDevices()

    expect(localStorage.getItem('sb-rmbmmwcxtnanacxbkihc-auth-token')).toBe('token-di-sessione')
  })

  it('un rifiuto del server diventa un errore da mostrare, senza il testo del server', async () => {
    mockSignOut.mockResolvedValue({ error: { message: 'Invalid Refresh Token: Already Used', status: 400 } })

    const { error } = await signOutOtherDevices()

    expect(error).toBeInstanceOf(Error)
    expect(error!.message).not.toContain('Refresh Token')
  })

  it('una chiamata che solleva (rete assente) non solleva a sua volta', async () => {
    mockSignOut.mockRejectedValue(new TypeError('Failed to fetch'))

    const { error } = await signOutOtherDevices()

    expect(error).toBeInstanceOf(Error)
  })
})
