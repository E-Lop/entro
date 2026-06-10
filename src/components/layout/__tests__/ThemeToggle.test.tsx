// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const { setTheme } = vi.hoisted(() => ({ setTheme: vi.fn() }))

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({ theme: 'dark', setTheme, effectiveTheme: 'dark' }),
}))

import { ThemeToggle } from '../ThemeToggle'

afterEach(() => {
  cleanup()
  setTheme.mockReset()
})

describe('ThemeToggle', () => {
  it('espone le opzioni come radio con lo stato corrente annunciato', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)
    await user.click(screen.getByRole('button', { name: 'Cambia tema' }))

    const radios = await screen.findAllByRole('menuitemradio')
    expect(radios).toHaveLength(3)

    const scuro = radios.find((r) => /Scuro/.test(r.textContent || ''))
    expect(scuro?.getAttribute('aria-checked')).toBe('true')

    const chiaro = radios.find((r) => /Chiaro/.test(r.textContent || ''))
    expect(chiaro?.getAttribute('aria-checked')).toBe('false')
  })

  it('non usa il glifo ✓ per indicare la selezione', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)
    await user.click(screen.getByRole('button', { name: 'Cambia tema' }))
    await screen.findAllByRole('menuitemradio')
    expect(document.body.textContent).not.toContain('✓')
  })

  it('cambia tema alla selezione di un’opzione', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)
    await user.click(screen.getByRole('button', { name: 'Cambia tema' }))
    const radios = await screen.findAllByRole('menuitemradio')
    const chiaro = radios.find((r) => /Chiaro/.test(r.textContent || ''))!
    await user.click(chiaro)
    expect(setTheme).toHaveBeenCalledWith('light')
  })
})
