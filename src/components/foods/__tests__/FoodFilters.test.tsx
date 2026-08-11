// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { FoodFilters } from '../FoodFilters'
import type { FilterParams } from '@/lib/foods'

afterEach(cleanup)

const baseProps = {
  filters: {} as FilterParams,
  onFiltersChange: () => {},
  categories: [],
  onClearFilters: () => {},
  isExpanded: false,
  onToggle: () => {},
}

describe('FoodFilters — badge filtri attivi (identità brand)', () => {
  it('usa il token primary, mai il blu, per il conteggio filtri attivi', () => {
    render(<FoodFilters {...baseProps} activeFiltersCount={2} />)
    const badge = screen.getByText('2')
    expect(badge.className).not.toMatch(/blue/)
    expect(badge.className).toMatch(/primary/)
  })
})

describe('FoodFilters — il filtro si chiama scadenza, non stato', () => {
  it('etichetta il gruppo «Scadenza» e l\'opzione «Non scaduti»', () => {
    // Il filtro guarda `expiry_date`, non la colonna `status` del ciclo di
    // vita: «Attivi» richiamava il valore `active` di quest'ultima.
    render(<FoodFilters {...baseProps} activeFiltersCount={0} isExpanded={true} />)

    const select = screen.getByLabelText('Scadenza')
    expect(screen.queryByLabelText('Stato')).toBeNull()
    expect([...select.querySelectorAll('option')].map(o => o.textContent)).toEqual([
      'Tutti',
      '✅ Non scaduti',
      '⏰ In scadenza (7gg)',
      '❌ Scaduti',
    ])
  })

  it('emette il filtro sotto la chiave `expiry`', () => {
    const onFiltersChange = vi.fn()
    render(
      <FoodFilters
        {...baseProps}
        activeFiltersCount={0}
        isExpanded={true}
        onFiltersChange={onFiltersChange}
      />
    )

    fireEvent.change(screen.getByLabelText('Scadenza'), { target: { value: 'not_expired' } })
    expect(onFiltersChange).toHaveBeenCalledWith({ expiry: 'not_expired' })
  })
})

describe('FoodFilters — target tattili (WCAG 2.5.5 / regola progetto ≥44px)', () => {
  it('rende la ricerca con altezza ≥44px (h-11)', () => {
    render(<FoodFilters {...baseProps} activeFiltersCount={0} isExpanded={true} />)
    const search = screen.getByPlaceholderText('Cerca alimenti...')
    expect(search.className).toContain('h-11')
  })

  it('rende tutte le select con altezza ≥44px (h-11), mai h-10', () => {
    render(<FoodFilters {...baseProps} activeFiltersCount={0} isExpanded={true} />)
    const selects = screen.getAllByRole('combobox')
    expect(selects.length).toBe(4)
    for (const select of selects) {
      expect(select.className).toContain('h-11')
      expect(select.className).not.toContain('h-10')
    }
  })
})
