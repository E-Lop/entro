// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { DashboardStats } from '../DashboardStats'

afterEach(cleanup)

const STATS = { total: 4, expiringSoon: 3, expired: 1 }

describe('DashboardStats — quick filter', () => {
  it('invoca onQuickFilter con lo stato corretto al click', () => {
    const onQuickFilter = vi.fn()
    render(<DashboardStats stats={STATS} currentStatus="all" onQuickFilter={onQuickFilter} />)

    fireEvent.click(screen.getByRole('button', { name: /Mostra alimenti in scadenza/ }))
    expect(onQuickFilter).toHaveBeenCalledWith('expiring_soon')

    fireEvent.click(screen.getByRole('button', { name: /Mostra alimenti scaduti/ }))
    expect(onQuickFilter).toHaveBeenCalledWith('expired')

    fireEvent.click(screen.getByRole('button', { name: /Mostra tutti gli alimenti/ }))
    expect(onQuickFilter).toHaveBeenCalledWith('all')
  })

  it('espone i conteggi nelle aria-label', () => {
    render(<DashboardStats stats={STATS} currentStatus="all" onQuickFilter={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Mostra tutti gli alimenti \(4\)/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Mostra alimenti in scadenza \(3\)/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Mostra alimenti scaduti \(1\)/ })).toBeTruthy()
  })
})

describe('DashboardStats — identità di brand (una sola voce)', () => {
  it('evidenzia la card selezionata con il ring verde brand, mai blu', () => {
    const { rerender } = render(
      <DashboardStats stats={STATS} currentStatus="all" onQuickFilter={vi.fn()} />
    )
    const all = screen.getByRole('button', { name: /Mostra tutti gli alimenti/ })
    expect(all.className).toContain('ring-primary')
    expect(all.getAttribute('aria-pressed')).toBe('true')

    rerender(<DashboardStats stats={STATS} currentStatus="expired" onQuickFilter={vi.fn()} />)
    const expired = screen.getByRole('button', { name: /Mostra alimenti scaduti/ })
    expect(expired.className).toContain('ring-primary')
    expect(expired.getAttribute('aria-pressed')).toBe('true')
  })

  it('non usa nessun ring blu/arancio/rosso fuori-brand per la selezione', () => {
    render(<DashboardStats stats={STATS} currentStatus="all" onQuickFilter={vi.fn()} />)
    for (const btn of screen.getAllByRole('button')) {
      expect(btn.className).not.toMatch(/ring-(blue|orange|red)-\d/)
    }
  })

  it('imposta aria-pressed=false sulle card non selezionate', () => {
    render(<DashboardStats stats={STATS} currentStatus="all" onQuickFilter={vi.fn()} />)
    expect(
      screen.getByRole('button', { name: /Mostra alimenti scaduti/ }).getAttribute('aria-pressed')
    ).toBe('false')
  })
})
