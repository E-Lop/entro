// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { ImageUpload } from '../ImageUpload'

// A signed URL is needed so the preview (and its Remove button) renders.
const signedUrlState = vi.hoisted(() => ({ loadFailed: false, onLoadError: vi.fn() }))

vi.mock('@/hooks/useSignedUrl', () => ({
  useSignedUrl: (path: string | null) => ({
    signedUrl: path ? 'https://example.test/signed.jpg' : null,
    isLoading: false,
    error: null,
    loadFailed: signedUrlState.loadFailed,
    onLoadError: signedUrlState.onLoadError,
  }),
}))

afterEach(() => {
  cleanup()
  signedUrlState.loadFailed = false
  signedUrlState.onLoadError.mockClear()
})

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

describe('ImageUpload — la foto salvata che non si carica (#211)', () => {
  it('lo dice all’hook, che ne richiede l’indirizzo', () => {
    render(<ImageUpload value="foods/existing.jpg" onChange={vi.fn()} />)

    fireEvent.error(screen.getByAltText('Anteprima immagine alimento'))

    expect(signedUrlState.onLoadError).toHaveBeenCalledTimes(1)
  })

  it('se non si carica nemmeno dopo, niente immagine rotta: lo dice, e la foto si può ancora togliere', () => {
    signedUrlState.loadFailed = true
    render(<ImageUpload value="foods/existing.jpg" onChange={vi.fn()} />)

    expect(screen.queryByAltText('Anteprima immagine alimento')).toBeNull()
    expect(screen.getByText('Errore caricamento')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Rimuovi immagine/i })).toBeInTheDocument()
  })
})
