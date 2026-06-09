// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { FoodCard } from '../FoodCard'
import type { Food } from '@/lib/foods'

// useSignedUrl hits Supabase storage; stub it so the card renders offline.
vi.mock('@/hooks/useSignedUrl', () => ({
  useSignedUrl: () => ({ signedUrl: null, isLoading: false, error: null }),
}))

afterEach(cleanup)

/** Build an expiry_date exactly `n` calendar days from today (timezone-safe). */
function daysFromNow(n: number): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + n)
  return d.toISOString()
}

function makeFood(overrides: Partial<Food> = {}): Food {
  return {
    id: 'food-1',
    name: 'Latte',
    quantity: null,
    quantity_unit: null,
    expiry_date: daysFromNow(30),
    image_url: null,
    storage_location: 'fridge',
    category_id: null,
    notes: null,
    ...overrides,
  } as Food
}

function badge(text: string | RegExp) {
  return screen.getByText(text)
}

describe('FoodCard — stato di scadenza (business rule)', () => {
  it('mostra "Scaduto" con il token destructive per alimenti scaduti', () => {
    render(<FoodCard food={makeFood({ expiry_date: daysFromNow(-2) })} />)
    const el = badge('Scaduto')
    expect(el.className).toContain('bg-destructive')
  })

  it('mostra "Scade oggi" con il token destructive quando scade oggi', () => {
    render(<FoodCard food={makeFood({ expiry_date: daysFromNow(0) })} />)
    const el = badge('Scade oggi')
    expect(el.className).toContain('bg-destructive')
  })

  it('usa il token warning (ambra unica) per gli alimenti in scadenza entro 7 giorni', () => {
    render(<FoodCard food={makeFood({ expiry_date: daysFromNow(5) })} />)
    const el = badge('5 giorni')
    expect(el.className).toContain('text-warning')
    expect(el.className).not.toMatch(/text-(yellow|orange)-\d/)
  })

  it('usa lo stesso token warning al confine dei 7 giorni', () => {
    render(<FoodCard food={makeFood({ expiry_date: daysFromNow(7) })} />)
    expect(badge('7 giorni').className).toContain('text-warning')
  })

  it('usa il token success per alimenti freschi (oltre 7 giorni)', () => {
    render(<FoodCard food={makeFood({ expiry_date: daysFromNow(8) })} />)
    const el = badge('8 giorni')
    expect(el.className).toContain('text-success')
    expect(el.className).not.toMatch(/text-green-\d/)
  })
})

describe('FoodCard — pluralizzazione giorni', () => {
  it('dice "1 giorno" al singolare', () => {
    render(<FoodCard food={makeFood({ expiry_date: daysFromNow(1) })} />)
    expect(screen.getByText('1 giorno')).toBeTruthy()
    expect(screen.queryByText('1 giorni')).toBeNull()
  })

  it('dice "N giorni" al plurale', () => {
    render(<FoodCard food={makeFood({ expiry_date: daysFromNow(3) })} />)
    expect(screen.getByText('3 giorni')).toBeTruthy()
  })
})

describe('FoodCard — accessibilità & identità', () => {
  it('annuncia lo stato di scadenza con role=status + testo (mai solo colore)', () => {
    render(<FoodCard food={makeFood({ expiry_date: daysFromNow(2) })} />)
    const status = screen.getByRole('status')
    expect(status.getAttribute('aria-label')).toContain('Stato scadenza')
    expect(status.textContent).toContain('2 giorni')
  })

  it('rende il nome alimento come heading <h3>', () => {
    render(<FoodCard food={makeFood({ name: 'Yogurt' })} />)
    const heading = screen.getByRole('heading', { level: 3, name: /Yogurt/ })
    expect(heading).toBeTruthy()
  })
})
