// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
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

  it('evidenzia le note come contenuto neutro a token (no ambra grezza)', () => {
    render(<FoodCard food={makeFood({ notes: 'Aprire entro 2 giorni' })} />)
    const note = screen.getByText('Aprire entro 2 giorni')
    expect(note.className).toContain('bg-muted')
    expect(note.className).not.toMatch(/bg-amber/)
  })
})

describe('FoodCard — alternativa allo swipe (WCAG 2.5.1, livello A)', () => {
  it('espone un menu azioni raggiungibile, non nascosto dietro il breakpoint', () => {
    // I pulsanti del footer sono `hidden sm:flex`, e `display: none` non è
    // «nascosto visivamente»: toglie dall'albero di accessibilità. Sotto i
    // 640px lo swipe era l'unica strada, ed è `aria-hidden`.
    render(<FoodCard food={makeFood()} onEdit={vi.fn()} onDelete={vi.fn()} />)

    const trigger = screen.getByRole('button', { name: 'Azioni per Latte' })

    // Nessun antenato lo toglie dal rendering a larghezza da telefono.
    for (let node = trigger.parentElement; node; node = node.parentElement) {
      expect(node.className).not.toMatch(/(^|\s)hidden(\s|$)/)
      expect(node.getAttribute('aria-hidden')).not.toBe('true')
    }
  })

  it('il menu si apre da tastiera e collega le stesse azioni', async () => {
    // Aperto con Enter, non col mouse: è la strada di chi non può fare lo
    // swipe, ed è il motivo per cui questo menu esiste.
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    const food = makeFood()
    render(<FoodCard food={food} onEdit={onEdit} onDelete={onDelete} />)

    fireEvent.keyDown(screen.getByRole('button', { name: 'Azioni per Latte' }), { key: 'Enter' })

    const elimina = await screen.findByRole('menuitem', { name: /Elimina/ })
    expect(screen.getByRole('menuitem', { name: /Modifica/ })).toBeTruthy()

    fireEvent.click(elimina)
    expect(onDelete).toHaveBeenCalledWith(food)
  })

  it('senza azioni disponibili non mostra un menu vuoto', () => {
    render(<FoodCard food={makeFood()} />)
    expect(screen.queryByRole('button', { name: /Azioni per/ })).toBeNull()
  })

  it('il bersaglio del menu resta ≥44px, come il resto dell\'app', () => {
    render(<FoodCard food={makeFood()} onEdit={vi.fn()} onDelete={vi.fn()} />)
    const trigger = screen.getByRole('button', { name: 'Azioni per Latte' })
    expect(trigger.className).toContain('h-11')
    expect(trigger.className).toContain('w-11')
  })
})

describe('FoodCard — a ogni larghezza esiste esattamente una strada', () => {
  it('il menu ⋮ e i pulsanti del footer si escludono a vicenda', () => {
    // Se qualcuno cambia uno dei due breakpoint senza toccare l'altro, si
    // ricade nel difetto originale (nessuna strada sotto i 640px) o nella
    // duplicazione (due strade sopra). L'invariante vive in due classi
    // Tailwind in due punti del file: qui lo teniamo fermo.
    const { container } = render(
      <FoodCard food={makeFood()} onEdit={vi.fn()} onDelete={vi.fn()} />
    )

    const trigger = screen.getByRole('button', { name: 'Azioni per Latte' })
    const footer = container.querySelector('[class*="hidden"][class*="sm:flex"]')

    expect(footer).not.toBeNull()
    expect(trigger.className).toContain('sm:hidden')
    // Il trigger non è nascosto di base: sotto i 640px c'è.
    expect(trigger.className).not.toMatch(/(^|\s)hidden(\s|$)/)
  })

  it('i pulsanti del footer restano quelli di prima', () => {
    render(<FoodCard food={makeFood()} onEdit={vi.fn()} onDelete={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Modifica Latte' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Elimina Latte' })).toBeTruthy()
  })
})
