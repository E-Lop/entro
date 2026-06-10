// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { NotificationPrompt } from '../NotificationPrompt'

const { mockIsSupported, mockPermission, mockSubscribe } = vi.hoisted(() => ({
  mockIsSupported: vi.fn(),
  mockPermission: vi.fn(),
  mockSubscribe: vi.fn(),
}))

vi.mock('@/lib/pushNotifications', () => ({
  isPushSupported: () => mockIsSupported(),
  getPermissionState: () => mockPermission(),
}))
vi.mock('@/hooks/usePushSubscription', () => ({
  usePushSubscription: () => ({ status: 'prompt', subscribe: mockSubscribe, isLoading: false }),
}))

beforeEach(() => {
  localStorage.clear()
  mockIsSupported.mockReturnValue(true)
  mockPermission.mockReturnValue('default')
  mockSubscribe.mockResolvedValue(undefined)
})

afterEach(cleanup)

describe('NotificationPrompt', () => {
  it('stays hidden below the food threshold (business rule)', () => {
    const { container } = render(<NotificationPrompt foodCount={2} />)
    expect(container.firstChild).toBeNull()
  })

  it('stays hidden when push is unsupported', () => {
    mockIsSupported.mockReturnValue(false)
    const { container } = render(<NotificationPrompt foodCount={10} />)
    expect(container.firstChild).toBeNull()
  })

  it('stays hidden once the permission is no longer "default"', () => {
    mockPermission.mockReturnValue('granted')
    const { container } = render(<NotificationPrompt foodCount={10} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders 44px touch targets for the actions and the dismiss control', () => {
    render(<NotificationPrompt foodCount={3} />)
    expect(screen.getByRole('button', { name: 'Attiva' }).className).toContain('h-11')
    const dismiss = screen.getByRole('button', { name: 'Chiudi' })
    expect(dismiss.className).toContain('h-11')
    expect(dismiss.className).toContain('w-11')
  })

  it('dismisses and persists the choice when "Non ora" is clicked', () => {
    const { container } = render(<NotificationPrompt foodCount={3} />)
    fireEvent.click(screen.getByRole('button', { name: 'Non ora' }))
    expect(localStorage.getItem('entro_notification_prompt_dismissed')).toBe('true')
    expect(container.firstChild).toBeNull()
  })

  it('subscribes when "Attiva" is clicked', () => {
    render(<NotificationPrompt foodCount={3} />)
    fireEvent.click(screen.getByRole('button', { name: 'Attiva' }))
    expect(mockSubscribe).toHaveBeenCalledTimes(1)
  })
})
