// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { PageLoader } from '../PageLoader'

afterEach(cleanup)

describe('PageLoader', () => {
  it('expone lo stato di caricamento agli screen reader', () => {
    render(<PageLoader />)
    const status = screen.getByRole('status')
    expect(status).toBeTruthy()
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(status.textContent).toContain('Caricamento')
  })

  it('disattiva l’animazione con prefers-reduced-motion', () => {
    const { container } = render(<PageLoader />)
    const spinner = container.querySelector('.animate-spin')
    expect(spinner).toBeTruthy()
    expect(spinner?.className).toContain('motion-reduce:animate-none')
  })
})
