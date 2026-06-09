// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { ImageUpload } from '../ImageUpload'

// A signed URL is needed so the preview (and its Remove button) renders.
vi.mock('@/hooks/useSignedUrl', () => ({
  useSignedUrl: (path: string | null) => ({
    signedUrl: path ? 'https://example.test/signed.jpg' : null,
    isLoading: false,
    error: null,
  }),
}))

afterEach(() => cleanup())

describe('ImageUpload — remove affordance (touch)', () => {
  it('shows the Rimuovi button without relying on hover, and removes on click', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ImageUpload value="foods/existing.jpg" onChange={onChange} />)

    const removeBtn = screen.getByRole('button', { name: /Rimuovi immagine/i })
    expect(removeBtn).toBeInTheDocument()
    // Must NOT be hover-gated: touch devices have no hover state.
    expect(removeBtn.className).not.toMatch(/opacity-0/)
    expect(removeBtn.className).not.toMatch(/group-hover/)
    // Comfortable touch target.
    expect(removeBtn.className).toMatch(/min-h-\[44px\]/)

    await user.click(removeBtn)
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('renders camera and gallery choices in the empty state', () => {
    render(<ImageUpload value={null} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Scatta foto con fotocamera/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Scegli foto dalla galleria/i })).toBeInTheDocument()
  })
})
