// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { NotificationPrompt } from '../NotificationPrompt'

const { subscribe, pushState } = vi.hoisted(() => ({
  subscribe: vi.fn(),
  pushState: { status: 'prompt' as string, isLoading: false },
}))

vi.mock('@/hooks/usePushSubscription', () => ({
  usePushSubscription: () => ({ status: pushState.status, isLoading: pushState.isLoading, subscribe }),
}))

const DISMISSED_KEY = 'entro_notification_prompt_dismissed'

beforeEach(() => {
  localStorage.clear()
  pushState.status = 'prompt'
  pushState.isLoading = false
  subscribe.mockClear()
  subscribe.mockResolvedValue(undefined)
})

afterEach(cleanup)

describe('NotificationPrompt — upsell (status "prompt")', () => {
  it('stays hidden below the food threshold (business rule)', () => {
    const { container } = render(<NotificationPrompt foodCount={2} />)
    expect(container.firstChild).toBeNull()
  })

  it('shows the opt-in above the threshold', () => {
    render(<NotificationPrompt foodCount={3} />)
    expect(screen.getByRole('button', { name: 'Attiva' })).toBeTruthy()
  })

  it('dismisses and persists the choice permanently when "Non ora" is clicked', () => {
    const { container } = render(<NotificationPrompt foodCount={3} />)
    fireEvent.click(screen.getByRole('button', { name: 'Non ora' }))
    expect(localStorage.getItem(DISMISSED_KEY)).toBe('true')
    expect(container.firstChild).toBeNull()
  })

  it('subscribes when "Attiva" is clicked', () => {
    render(<NotificationPrompt foodCount={3} />)
    fireEvent.click(screen.getByRole('button', { name: 'Attiva' }))
    expect(subscribe).toHaveBeenCalledTimes(1)
  })

  it('renders 44px touch targets for the actions and the dismiss control', () => {
    render(<NotificationPrompt foodCount={3} />)
    expect(screen.getByRole('button', { name: 'Attiva' }).className).toContain('h-11')
    const dismiss = screen.getByRole('button', { name: 'Chiudi' })
    expect(dismiss.className).toContain('h-11')
    expect(dismiss.className).toContain('w-11')
  })
})

describe('NotificationPrompt — healthy / unsupported', () => {
  it('stays hidden when already subscribed', () => {
    pushState.status = 'subscribed'
    const { container } = render(<NotificationPrompt foodCount={10} />)
    expect(container.firstChild).toBeNull()
  })

  it('stays hidden when push is unsupported', () => {
    pushState.status = 'unsupported'
    const { container } = render(<NotificationPrompt foodCount={10} />)
    expect(container.firstChild).toBeNull()
  })
})

describe('NotificationPrompt — subscription persa (status "lost")', () => {
  it('shows the re-enable nudge even with zero foods (always visible)', () => {
    pushState.status = 'lost'
    render(<NotificationPrompt foodCount={0} />)
    expect(screen.getByText(/si sono disattivate/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Riattiva' })).toBeTruthy()
  })

  it('re-subscribes when "Riattiva" is clicked', () => {
    pushState.status = 'lost'
    render(<NotificationPrompt foodCount={0} />)
    fireEvent.click(screen.getByRole('button', { name: 'Riattiva' }))
    expect(subscribe).toHaveBeenCalledTimes(1)
  })

  it('dismiss is per-session: hides without persisting to localStorage', () => {
    pushState.status = 'lost'
    const { container } = render(<NotificationPrompt foodCount={0} />)
    fireEvent.click(screen.getByRole('button', { name: 'Chiudi' }))
    expect(container.firstChild).toBeNull()
    expect(localStorage.getItem(DISMISSED_KEY)).toBeNull()
  })

  it('a malfunction cannot be silenced by the permanent upsell dismissal (safeguard)', () => {
    // User previously dismissed the first-time opt-in forever...
    localStorage.setItem(DISMISSED_KEY, 'true')
    pushState.status = 'lost'
    render(<NotificationPrompt foodCount={0} />)
    // ...but a genuinely broken subscription must still surface.
    expect(screen.getByRole('button', { name: 'Riattiva' })).toBeTruthy()
  })
})
