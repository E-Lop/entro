// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
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
