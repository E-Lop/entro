// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { CalendarFoodCard } from '../CalendarFoodCard'
import type { Food } from '@/lib/foods'

afterEach(cleanup)

function makeFood(overrides: Partial<Food> = {}): Food {
  return {
    id: 'food-1',
    name: 'Latte',
    quantity: null,
    quantity_unit: null,
    expiry_date: new Date().toISOString(),
    image_url: null,
    storage_location: 'fridge',
    category_id: null,
    notes: null,
    ...overrides,
  } as Food
}

describe('CalendarFoodCard — accessibilità (WCAG 2.1.1 tastiera)', () => {
  it('espone l’alimento come <button> con nome accessibile (operabile da tastiera)', () => {
    render(<CalendarFoodCard food={makeFood({ name: 'Yogurt' })} onEdit={() => {}} />)
    const btn = screen.getByRole('button', { name: /Yogurt/ })
    expect(btn.tagName).toBe('BUTTON')
  })

  it('chiama onEdit con l’alimento quando attivato', () => {
    const onEdit = vi.fn()
    const food = makeFood({ name: 'Pane' })
    render(<CalendarFoodCard food={food} onEdit={onEdit} />)
    fireEvent.click(screen.getByRole('button', { name: /Pane/ }))
    expect(onEdit).toHaveBeenCalledWith(food)
  })

  it('include quantità e unità nel nome accessibile quando presenti', () => {
    render(
      <CalendarFoodCard
        food={makeFood({ name: 'Riso', quantity: 500, quantity_unit: 'g' })}
        onEdit={() => {}}
      />
    )
    expect(screen.getByRole('button', { name: /Riso.*500.*g/ })).toBeTruthy()
  })
})
