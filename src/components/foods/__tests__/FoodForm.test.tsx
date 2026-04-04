// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { FoodForm } from '../FoodForm'

// Capture the onScanSuccess callback passed to BarcodeScanner
let capturedOnScanSuccess: ((barcode: string) => void) | null = null

// Mock dependencies using vi.hoisted so mocks are available in factory functions
const { mockFetchProduct, mockMapProduct } = vi.hoisted(() => ({
  mockFetchProduct: vi.fn(),
  mockMapProduct: vi.fn(),
}))

vi.mock('@/lib/openfoodfacts', () => ({
  fetchProductByBarcode: mockFetchProduct,
  mapProductToFormData: mockMapProduct,
}))

vi.mock('@/hooks/useFoods', () => ({
  useCategories: () => ({ data: [{ id: 'cat-1', name: 'Latticini' }], isLoading: false }),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
    })),
    removeChannel: vi.fn(),
  },
}))

vi.mock('@/lib/realtime', () => ({
  mutationTracker: {
    isLocalMutation: vi.fn().mockReturnValue(false),
  },
}))

// Mock BarcodeScanner to capture onScanSuccess callback
// The FoodForm uses lazy(() => import('../barcode/BarcodeScanner'))
// vi.mock resolves relative to the test file
vi.mock('../../barcode/BarcodeScanner', () => ({
  BarcodeScanner: (props: { onScanSuccess: (barcode: string) => void }) => {
    capturedOnScanSuccess = props.onScanSuccess
    return <div data-testid="mock-barcode-scanner">Scanner Mock</div>
  },
}))

describe('FoodForm accordion sections', () => {
  const mockOnSubmit = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    capturedOnScanSuccess = null
  })

  afterEach(() => {
    cleanup()
  })

  it('should have main section open by default', () => {
    render(<FoodForm mode="create" onSubmit={mockOnSubmit} />)

    const mainSection = document.getElementById('section-main')
    const detailsSection = document.getElementById('section-details')

    expect(mainSection).not.toBeNull()
    expect(detailsSection).not.toBeNull()
    // Main section should be visible (not hidden)
    expect(mainSection).not.toHaveClass('hidden')
    // Details section should be hidden
    expect(detailsSection).toHaveClass('hidden')
  })

  it('should apply background class to closed section header', () => {
    render(<FoodForm mode="create" onSubmit={mockOnSubmit} />)

    // Main is open by default, details is closed
    const mainButton = document.querySelector('button[aria-controls="section-main"]')!
    const detailsButton = document.querySelector('button[aria-controls="section-details"]')!

    // Closed section (details) should have background class
    expect(detailsButton.className).toMatch(/bg-muted/)
    // Open section (main) should NOT have the closed background class
    expect(mainButton.className).not.toMatch(/bg-muted/)
  })

  it('should NOT apply background class to open section header', () => {
    render(<FoodForm mode="create" onSubmit={mockOnSubmit} />)

    const mainButton = document.querySelector('button[aria-controls="section-main"]')!

    // Main is open by default — no background
    expect(mainButton.className).not.toMatch(/bg-muted/)
  })

  it('should swap background class when toggling sections', async () => {
    const user = userEvent.setup()
    render(<FoodForm mode="create" onSubmit={mockOnSubmit} />)

    const mainButton = document.querySelector('button[aria-controls="section-main"]')!
    const detailsButton = document.querySelector('button[aria-controls="section-details"]')!

    // Initially: main open (no bg), details closed (bg)
    expect(mainButton.className).not.toMatch(/bg-muted/)
    expect(detailsButton.className).toMatch(/bg-muted/)

    // Click details to open it (closes main)
    await user.click(detailsButton)

    // Now: main closed (bg), details open (no bg)
    expect(mainButton.className).toMatch(/bg-muted/)
    expect(detailsButton.className).not.toMatch(/bg-muted/)
  })

  it('should keep main section open after barcode scan populates notes', async () => {
    const user = userEvent.setup()

    // Setup mocks: barcode scan returns product with notes
    mockFetchProduct.mockResolvedValue({
      data: { product_name: 'Latte Intero', categories_tags: ['dairies'] },
      error: null,
    })
    mockMapProduct.mockReturnValue({
      name: 'Latte Intero',
      category_id: 'cat-1',
      storage_location: 'fridge',
      quantity: 1,
      quantity_unit: 'l',
      notes: 'Ingredienti: latte intero pastorizzato',
    })

    render(<FoodForm mode="create" onSubmit={mockOnSubmit} />)

    // Open the barcode scanner by clicking the scan button
    const scanButtons = screen.getAllByLabelText('Apri scanner barcode per compilare automaticamente i dati')
    await user.click(scanButtons[0])

    // Wait for lazy-loaded BarcodeScanner mock to render via Suspense
    await waitFor(() => {
      expect(capturedOnScanSuccess).not.toBeNull()
    })

    // Simulate a barcode scan
    await act(async () => {
      capturedOnScanSuccess!('1234567890123')
    })

    // After scan completes, main section should STILL be open (not switched to details)
    await waitFor(() => {
      const mainSection = document.getElementById('section-main')
      const detailsSection = document.getElementById('section-details')

      expect(mainSection).not.toHaveClass('hidden')
      expect(detailsSection).toHaveClass('hidden')
    })
  })
})
