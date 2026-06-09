// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { DayRow } from '../DayRow'
import type { Food } from '@/lib/foods'

afterEach(cleanup)

function dateOffset(days: number): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + days)
  return d
}

function makeFood(overrides: Partial<Food> = {}): Food {
  return {
    id: Math.random().toString(36).slice(2),
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

describe('DayRow — intestazione giorno (recognition)', () => {
  it('mostra "Oggi" per la data odierna come heading <h3>', () => {
    render(<DayRow date={dateOffset(0)} foods={[]} onEdit={() => {}} />)
    const heading = screen.getByRole('heading', { level: 3 })
    expect(heading.textContent).toContain('Oggi')
  })

  it('mostra "Domani" per il giorno successivo', () => {
    render(<DayRow date={dateOffset(1)} foods={[]} onEdit={() => {}} />)
    expect(screen.getByRole('heading', { level: 3 }).textContent).toContain('Domani')
  })

  it('mostra il giorno della settimana per le date oltre domani', () => {
    render(<DayRow date={dateOffset(3)} foods={[]} onEdit={() => {}} />)
    const text = screen.getByRole('heading', { level: 3 }).textContent || ''
    expect(text).not.toContain('Oggi')
    expect(text).not.toContain('Domani')
  })
})

describe('DayRow — giorno vuoto', () => {
  it('non rende alcuna card e mostra "nessuna scadenza"', () => {
    render(<DayRow date={dateOffset(2)} foods={[]} onEdit={() => {}} />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText(/nessuna scadenza/i)).toBeTruthy()
  })

  it('usa text-muted-foreground pieno (non /70) per il testo vuoto (contrasto AA)', () => {
    render(<DayRow date={dateOffset(2)} foods={[]} onEdit={() => {}} />)
    const el = screen.getByText(/nessuna scadenza/i)
    expect(el.className).toMatch(/text-muted-foreground(\s|$)/)
    expect(el.className).not.toContain('muted-foreground/70')
  })
})

describe('DayRow — giorno con alimenti', () => {
  it('rende una card-button per ogni alimento', () => {
    render(
      <DayRow
        date={dateOffset(3)}
        foods={[makeFood({ name: 'Pane' }), makeFood({ name: 'Riso' })]}
        onEdit={() => {}}
      />
    )
    expect(screen.getAllByRole('button').length).toBe(2)
  })

  it('mostra il conteggio testuale (mai solo colore)', () => {
    render(<DayRow date={dateOffset(3)} foods={[makeFood(), makeFood(), makeFood()]} onEdit={() => {}} />)
    expect(screen.getByText('3 alimenti')).toBeTruthy()
  })

  it('pluralizza "1 alimento" al singolare', () => {
    render(<DayRow date={dateOffset(3)} foods={[makeFood()]} onEdit={() => {}} />)
    expect(screen.getByText('1 alimento')).toBeTruthy()
  })
})

describe('DayRow — urgenza sul giorno (token, mai solo colore)', () => {
  it('oggi usa il token destructive sul conteggio (scade oggi = critico)', () => {
    render(<DayRow date={dateOffset(0)} foods={[makeFood()]} onEdit={() => {}} />)
    const badge = screen.getByText('1 alimento')
    expect(badge.className).toContain('destructive')
    expect(badge.className).not.toMatch(/(red|orange)-\d/)
  })

  it('i giorni successivi usano il token warning (ambra unica)', () => {
    render(<DayRow date={dateOffset(2)} foods={[makeFood()]} onEdit={() => {}} />)
    const badge = screen.getByText('1 alimento')
    expect(badge.className).toContain('warning')
    expect(badge.className).not.toMatch(/(red|orange|yellow)-\d/)
  })
})
