// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const { isHapticsSupported, isHapticsEnabled, setHapticsEnabled, triggerHaptic } = vi.hoisted(() => ({
  isHapticsSupported: vi.fn(() => true),
  isHapticsEnabled: vi.fn(() => false),
  setHapticsEnabled: vi.fn(),
  triggerHaptic: vi.fn(),
}))

vi.mock('@/lib/haptics', () => ({
  isHapticsSupported,
  isHapticsEnabled,
  setHapticsEnabled,
  triggerHaptic,
}))

import { HapticSettings } from '../HapticSettings'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  isHapticsSupported.mockReturnValue(true)
  isHapticsEnabled.mockReturnValue(false)
})

describe('HapticSettings', () => {
  it('rende un heading di livello 2 "Feedback aptico"', () => {
    render(<HapticSettings />)
    expect(
      screen.getByRole('heading', { level: 2, name: 'Feedback aptico' })
    ).toBeTruthy()
  })

  it('non rende nulla se gli haptics non sono supportati', () => {
    isHapticsSupported.mockReturnValue(false)
    const { container } = render(<HapticSettings />)
    expect(container.firstChild).toBeNull()
  })

  it('espone aria-pressed e lo aggiorna al toggle', async () => {
    const user = userEvent.setup()
    render(<HapticSettings />)

    const toggle = screen.getByRole('button', { name: 'Attiva' })
    expect(toggle.getAttribute('aria-pressed')).toBe('false')

    await user.click(toggle)

    expect(setHapticsEnabled).toHaveBeenCalledWith(true)
    expect(triggerHaptic).toHaveBeenCalledWith('success')
    const toggled = screen.getByRole('button', { name: 'Disattiva' })
    expect(toggled.getAttribute('aria-pressed')).toBe('true')
  })
})
