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
    quiet_hours_enabled: false,
    quiet_hours_start: 22,
    quiet_hours_end: 8,
    max_notifications_per_day: 3,
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

  it('le select delle ore silenziose hanno un nome accessibile', async () => {
    prefsRef.current = basePrefs({ quiet_hours_enabled: true })
    render(<NotificationSettings />)

    expect(screen.getByRole('combobox', { name: 'Inizio ore silenziose' })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Fine ore silenziose' })).toBeTruthy()
  })
})
