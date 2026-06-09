// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { WeekView } from '../WeekView'
import type { Food } from '@/lib/foods'

afterEach(cleanup)

function isoOffset(days: number): string {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

function makeFood(overrides: Partial<Food> = {}): Food {
  return {
    id: Math.random().toString(36).slice(2),
    name: 'Latte',
    quantity: null,
    quantity_unit: null,
    expiry_date: isoOffset(1),
    image_url: null,
    storage_location: 'fridge',
    category_id: null,
    notes: null,
    ...overrides,
  } as Food
}

describe('WeekView — agenda settimanale', () => {
  it('rende le 7 sezioni-giorno come heading <h3>', () => {
    render(<WeekView foods={[makeFood({ expiry_date: isoOffset(1) })]} onEdit={() => {}} />)
    expect(screen.getAllByRole('heading', { level: 3 }).length).toBe(7)
  })

  it('colloca l’alimento nel giorno della sua scadenza', () => {
    render(<WeekView foods={[makeFood({ name: 'Yogurt', expiry_date: isoOffset(1) })]} onEdit={() => {}} />)
    // Lo Yogurt scade domani → la sezione "Domani" ha 1 alimento e il button
    expect(screen.getByRole('button', { name: /Yogurt/ })).toBeTruthy()
    expect(screen.getByText('1 alimento')).toBeTruthy()
  })

  it('mostra l’empty-state quando nessun alimento scade nei 7 giorni', () => {
    render(<WeekView foods={[makeFood({ expiry_date: isoOffset(30) })]} onEdit={() => {}} />)
    expect(screen.getByText(/Nessun alimento in scadenza/i)).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
