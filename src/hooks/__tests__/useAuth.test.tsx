// @vitest-environment jsdom
/**
 * `useAuth().signOut()` — che cosa resta in memoria dopo un logout rifiutato (#81).
 *
 * `authStore` non si svuota da solo sul percorso d'errore: supabase-js emette
 * `SIGNED_OUT` solo quando la chiamata riesce o quando il server risponde
 * 401/403/404 (vedi `lib/__tests__/supabaseSignOutEvents.test.ts`). Se la rete
 * cade, lo store resta pieno e l'app continua a credere l'utente dentro anche
 * dopo che i token locali sono spariti.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

const { serviceSignOut, toastError, toastSuccess, logError } = vi.hoisted(() => ({
  serviceSignOut: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  logError: vi.fn(),
}))

vi.mock('sonner', () => ({ toast: { error: toastError, success: toastSuccess } }))
vi.mock('@/lib/safeLog', () => ({ logError }))
vi.mock('../../lib/auth', () => ({
  signOut: serviceSignOut,
  signUp: vi.fn(),
  signIn: vi.fn(),
}))

import { useAuth } from '../useAuth'
import { useAuthStore } from '../../stores/authStore'

/** Mette lo store nello stato di un utente entrato. */
function entra() {
  useAuthStore.setState({
    user: { id: 'u1', email: 'utente@example.com' } as never,
    isAuthenticated: true,
  })
}

beforeEach(() => {
  entra()
})

afterEach(() => {
  vi.clearAllMocks()
  useAuthStore.getState().clearAuth()
})

describe('useAuth().signOut()', () => {
  it('svuota lo store quando la pulizia locale è riuscita, anche se Supabase rifiuta', async () => {
    serviceSignOut.mockResolvedValue({
      error: new Error('Failed to fetch'),
      localSessionCleared: true,
    })
    const { result } = renderHook(() => useAuth())

    await act(async () => {
      await result.current.signOut()
    })

    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('lascia lo store intatto se la pulizia locale è fallita', async () => {
    serviceSignOut.mockResolvedValue({
      error: new Error('Storage disabilitato'),
      localSessionCleared: false,
    })
    const { result } = renderHook(() => useAuth())

    await act(async () => {
      await result.current.signOut()
    })

    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })

  it('propaga la pulizia locale a chi decide dove mandare l’utente', async () => {
    serviceSignOut.mockResolvedValue({
      error: new Error('Failed to fetch'),
      localSessionCleared: true,
    })
    const { result } = renderHook(() => useAuth())

    let esito: Awaited<ReturnType<typeof result.current.signOut>> | undefined
    await act(async () => {
      esito = await result.current.signOut()
    })

    expect(esito?.success).toBe(false)
    expect(esito?.localSessionCleared).toBe(true)
  })

  it('avvisa l’utente senza rimandargli il messaggio del server', async () => {
    // Il messaggio di Supabase è in inglese e può contenere identificativi di
    // sessione: quello che serve all'utente è sapere che altrove potrebbe
    // essere ancora dentro.
    serviceSignOut.mockResolvedValue({
      error: new Error('Session from session_id claim in JWT does not exist'),
      localSessionCleared: true,
    })
    const { result } = renderHook(() => useAuth())

    await act(async () => {
      await result.current.signOut()
    })

    expect(toastError).toHaveBeenCalledTimes(1)
    const messaggio = String(toastError.mock.calls[0][0])
    expect(messaggio).not.toContain('session_id')
    expect(messaggio.length).toBeGreaterThan(0)
  })

  it('sul percorso felice avvisa del successo e svuota lo store', async () => {
    serviceSignOut.mockResolvedValue({ error: null, localSessionCleared: true })
    const { result } = renderHook(() => useAuth())

    await act(async () => {
      await result.current.signOut()
    })

    expect(toastSuccess).toHaveBeenCalled()
    expect(toastError).not.toHaveBeenCalled()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })
})
