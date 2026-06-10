// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { OfflineBanner } from '../OfflineBanner'

const { mockOnline, mockPending } = vi.hoisted(() => ({
  mockOnline: vi.fn(),
  mockPending: vi.fn(),
}))

vi.mock('@/hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => mockOnline(),
}))
vi.mock('@/hooks/usePendingMutations', () => ({
  usePendingMutationsCount: () => mockPending(),
}))

afterEach(cleanup)

describe('OfflineBanner', () => {
  it('renders nothing when online with no pending mutations', () => {
    mockOnline.mockReturnValue(true)
    mockPending.mockReturnValue(0)
    const { container } = render(<OfflineBanner />)
    expect(container.firstChild).toBeNull()
  })

  it('shows a tokenized warning status when offline (no raw amber)', () => {
    mockOnline.mockReturnValue(false)
    mockPending.mockReturnValue(0)
    render(<OfflineBanner />)
    const banner = screen.getByRole('status')
    expect(banner.textContent).toContain('Sei offline')
    expect(banner.className).toContain('bg-warning')
    expect(banner.className).not.toMatch(/bg-amber/)
  })

  it('shows a tokenized primary sync status while flushing pending mutations online', () => {
    mockOnline.mockReturnValue(true)
    mockPending.mockReturnValue(3)
    render(<OfflineBanner />)
    const banner = screen.getByRole('status')
    expect(banner.textContent).toContain('Sincronizzazione in corso... (3)')
    expect(banner.className).toContain('bg-primary')
    expect(banner.className).not.toMatch(/bg-blue/)
  })
})
