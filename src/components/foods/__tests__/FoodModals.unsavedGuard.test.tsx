// @vitest-environment jsdom
/**
 * La guardia delle modifiche non salvate si spegne quando il dialogo si chiude,
 * **per qualunque motivo** (#131).
 *
 * Le uscite dell'utente — Esc, clic fuori, la X — passano da `guard.intercept`,
 * che riabbassa `dirty`. Il salvataggio no: chiude il dialogo dall'esterno,
 * cambiando `isAddDialogOpen` o `editingFood`, e il form si smonta senza dire
 * che non è più sporco. Il `beforeunload` restava registrato, e ricaricare la
 * pagina chiedeva «Lasciare il sito?» con nessun form aperto.
 *
 * La prova è lo stesso evento sintetico con cui la #119 aveva provato le altre
 * uscite: `defaultPrevented` dice se il listener c'è ancora.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import type { Food } from '@/lib/foods'

// Il form vero porta con sé categorie, scanner e validazione: qui interessa
// solo che dica «sono sporco», che è l'unica cosa che la guardia ascolta.
vi.mock('../FoodForm', () => ({
  FoodForm: ({ onDirtyChange }: { onDirtyChange?: (dirty: boolean) => void }) => (
    <button type="button" onClick={() => onDirtyChange?.(true)}>
      sporca il form
    </button>
  ),
}))

import { FoodModals } from '../FoodModals'

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
})

const FOOD = { id: 'food-1', name: 'Yogurt greco' } as Food

function props(overrides: Partial<Parameters<typeof FoodModals>[0]> = {}) {
  return {
    isAddDialogOpen: false,
    onAddDialogChange: vi.fn(),
    onCreateFood: vi.fn(),
    isCreating: false,
    editingFood: null,
    onEditDialogChange: vi.fn(),
    onUpdateFood: vi.fn(),
    isUpdating: false,
    deletingFood: null,
    onDeleteDialogChange: vi.fn(),
    onDeleteFood: vi.fn(),
    isDeleting: false,
    ...overrides,
  }
}

/** `true` se un `beforeunload` in questo momento chiederebbe conferma. */
function wouldWarnOnUnload(): boolean {
  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)
  return event.defaultPrevented
}

describe.each([
  ['creazione', { isAddDialogOpen: true }, { isAddDialogOpen: false }],
  ['modifica', { editingFood: FOOD }, { editingFood: null }],
])('la guardia dopo un salvataggio — %s', (_name, open, closed) => {
  it('col form sporco un ricaricamento chiede conferma', async () => {
    render(<FoodModals {...props(open)} />)

    fireEvent.click(await screen.findByText('sporca il form'))

    await waitFor(() => expect(wouldWarnOnUnload()).toBe(true))
  })

  it('chiuso il dialogo dall’esterno, come fa il salvataggio, non chiede più niente', async () => {
    const { rerender } = render(<FoodModals {...props(open)} />)
    fireEvent.click(await screen.findByText('sporca il form'))
    await waitFor(() => expect(wouldWarnOnUnload()).toBe(true))

    rerender(<FoodModals {...props(closed)} />)

    await waitFor(() => expect(wouldWarnOnUnload()).toBe(false))
  })

  it('riaperto il dialogo dopo il salvataggio, il form nuovo parte pulito', async () => {
    const { rerender } = render(<FoodModals {...props(open)} />)
    fireEvent.click(await screen.findByText('sporca il form'))
    await waitFor(() => expect(wouldWarnOnUnload()).toBe(true))

    rerender(<FoodModals {...props(closed)} />)
    rerender(<FoodModals {...props(open)} />)
    await screen.findByText('sporca il form')

    expect(wouldWarnOnUnload()).toBe(false)
  })
})
