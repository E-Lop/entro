// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const { mutate, subscribe, unsubscribe, pushState, prefsRef } = vi.hoisted(() => ({
  mutate: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  pushState: { status: 'subscribed', isLoading: false },
  prefsRef: { current: null as unknown },
}))

vi.mock('@/hooks/usePushSubscription', () => ({
  usePushSubscription: () => ({ ...pushState, subscribe, unsubscribe }),
}))
vi.mock('@/hooks/useNotificationPreferences', () => ({
  useNotificationPreferences: () => ({ data: prefsRef.current }),
  useUpdateNotificationPreferences: () => ({ mutate }),
}))

import { NotificationSettings } from '../NotificationSettings'

function basePrefs(overrides: Record<string, unknown> = {}) {
  return {
    expiry_intervals: [7, 3],
    ...overrides,
  }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  pushState.status = 'subscribed'
  pushState.isLoading = false
})

describe('NotificationSettings — intervalli di avviso', () => {
  it('rimuovere un intervallo (con altri attivi) salva la nuova selezione', async () => {
    prefsRef.current = basePrefs({ expiry_intervals: [7, 3] })
    const user = userEvent.setup()
    render(<NotificationSettings />)

    await user.click(screen.getByRole('checkbox', { name: '7 giorni prima' }))

    expect(mutate).toHaveBeenCalledWith({ expiry_intervals: [3] })
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('togliere l’ultimo intervallo non salva e mostra l’avviso (salvaguardia non silenziosa)', async () => {
    prefsRef.current = basePrefs({ expiry_intervals: [7] })
    const user = userEvent.setup()
    render(<NotificationSettings />)

    await user.click(screen.getByRole('checkbox', { name: '7 giorni prima' }))

    expect(mutate).not.toHaveBeenCalled()
    const hint = screen.getByRole('status')
    expect(hint.textContent).toMatch(/almeno un intervallo/i)
  })
})

describe('NotificationSettings — toggle push', () => {
  it('espone aria-pressed=true quando iscritto', () => {
    prefsRef.current = basePrefs()
    render(<NotificationSettings />)

    const toggle = screen.getByRole('button', { name: 'Disattiva' })
    expect(toggle.getAttribute('aria-pressed')).toBe('true')
  })

  it('con subscription persa (status lost) mostra "Attiva" e avvisa che le notifiche si sono disattivate', () => {
    prefsRef.current = basePrefs()
    pushState.status = 'lost'
    render(<NotificationSettings />)

    expect(screen.getByRole('button', { name: 'Attiva' })).toBeTruthy()
    expect(screen.getByText(/si sono disattivate/i)).toBeTruthy()
  })
})

// Con un invio al giorno a ora fissa il limite non limitava niente, e le ore
// silenziose facevano saltare la notifica invece di rimandarla (#154).
describe('NotificationSettings — niente ore silenziose né limite giornaliero', () => {
  it('non mostra le ore silenziose né il limite, anche con valori salvati prima', () => {
    // Le colonne restano nel database: un utente che le aveva attivate non
    // deve rivederle.
    prefsRef.current = {
      ...basePrefs(),
      quiet_hours_enabled: true,
      quiet_hours_start: 22,
      quiet_hours_end: 10,
      max_notifications_per_day: 3,
    }
    render(<NotificationSettings />)

    expect(screen.queryByText(/ore silenziose/i)).toBeNull()
    expect(screen.queryByText(/al giorno/i)).toBeNull()
    expect(screen.queryAllByRole('combobox')).toHaveLength(0)
    // Restano i cinque intervalli e l'attivazione.
    expect(screen.getAllByRole('checkbox')).toHaveLength(5)
    expect(screen.getByRole('button', { name: 'Disattiva' })).toBeTruthy()
  })
})
