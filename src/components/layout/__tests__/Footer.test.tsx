// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import { Footer } from '../Footer'

afterEach(cleanup)

describe('Footer', () => {
  it('mostra i tre link legali raggiungibili', () => {
    render(<Footer />)
    expect(screen.getByRole('link', { name: /Privacy Policy/ })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Termini e Condizioni/ })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Cookie Policy/ })).toBeTruthy()
  })

  it('apre i link in una nuova scheda in modo sicuro e annunciato', () => {
    render(<Footer />)
    const link = screen.getByRole('link', { name: /Privacy Policy/ })
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
    // l'apertura in nuova scheda è annunciata agli screen reader
    expect(within(link).getByText(/nuova scheda/)).toBeTruthy()
  })

  it('dà ai link un’area tattile adeguata (≥44px)', () => {
    render(<Footer />)
    const link = screen.getByRole('link', { name: /Cookie Policy/ })
    expect(link.className).toMatch(/min-h-11|min-h-\[44px\]/)
  })
})
