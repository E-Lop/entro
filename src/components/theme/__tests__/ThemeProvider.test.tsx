// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '../ThemeProvider'
import { useTheme } from '@/hooks/useTheme'

// jsdom has no matchMedia; the provider reads it on the 'system' branch.
beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia
  localStorage.clear()
  document.documentElement.className = ''
})

afterEach(cleanup)

function ThemeProbe() {
  const { theme, effectiveTheme, setTheme } = useTheme()
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="effective">{effectiveTheme}</span>
      <button onClick={() => setTheme('light')}>to-light</button>
    </div>
  )
}

describe('ThemeProvider', () => {
  it('applies the stored dark preference to <html> on mount, on any route', () => {
    localStorage.setItem('entro-theme', 'dark')
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    )
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.classList.contains('light')).toBe(false)
    expect(screen.getByTestId('effective').textContent).toBe('dark')
  })

  it('switches the <html> class when the theme changes', () => {
    localStorage.setItem('entro-theme', 'dark')
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    )
    fireEvent.click(screen.getByText('to-light'))
    expect(document.documentElement.classList.contains('light')).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(localStorage.getItem('entro-theme')).toBe('light')
  })

  it('throws if useTheme is used without a provider', () => {
    // Silence the expected React error boundary log.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<ThemeProbe />)).toThrow(/must be used within a ThemeProvider/)
    spy.mockRestore()
  })
})
