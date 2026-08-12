// @vitest-environment jsdom
/**
 * La conferma di eliminazione non chiede «sei sicuro?», chiede **com'è finita**.
 *
 * La domanda «sei sicuro?» non produce nessun dato: l'utente ha già deciso
 * premendo Elimina. La stessa interazione, chiesta diversamente, dice se quel
 * cibo è stato mangiato o buttato — che è l'unico modo per sapere quanto se ne
 * spreca.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { FoodModals } from '../FoodModals'
import type { Food } from '@/lib/foods'

afterEach(cleanup)

const FOOD = { id: 'food-1', name: 'Yogurt greco' } as Food

function renderDialog(onDeleteFood = vi.fn(), isDeleting = false) {
  render(
    <FoodModals
      isAddDialogOpen={false}
      onAddDialogChange={vi.fn()}
      onCreateFood={vi.fn()}
      isCreating={false}
      editingFood={null}
      onEditDialogChange={vi.fn()}
      onUpdateFood={vi.fn()}
      isUpdating={false}
      deletingFood={FOOD}
      onDeleteDialogChange={vi.fn()}
      onDeleteFood={onDeleteFood}
      isDeleting={isDeleting}
    />
  )
  return onDeleteFood
}

describe('conferma eliminazione — chiede l\'esito', () => {
  it('offre le tre uscite, non un sì/no', () => {
    renderDialog()

    expect(screen.getByRole('button', { name: /L'ho consumato/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /L'ho buttato/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Toglilo e basta/ })).toBeTruthy()
  })

  it('nomina l\'alimento, così non si elimina quello sbagliato', () => {
    renderDialog()
    expect(screen.getByText(/Yogurt greco/)).toBeTruthy()
  })

  it('«consumato» registra l\'esito', () => {
    const onDeleteFood = renderDialog()

    fireEvent.click(screen.getByRole('button', { name: /L'ho consumato/ }))

    expect(onDeleteFood).toHaveBeenCalledWith('consumed')
  })

  it('«buttato» registra l\'esito', () => {
    const onDeleteFood = renderDialog()

    fireEvent.click(screen.getByRole('button', { name: /L'ho buttato/ }))

    expect(onDeleteFood).toHaveBeenCalledWith('wasted')
  })

  it('«toglilo e basta» non registra nessun esito', () => {
    // È l'errore di inserimento: sporcare la metrica anti-spreco con gli
    // errori la rende inutile quanto lasciarla vuota.
    const onDeleteFood = renderDialog()

    fireEvent.click(screen.getByRole('button', { name: /Toglilo e basta/ }))

    expect(onDeleteFood).toHaveBeenCalledWith()
    expect(onDeleteFood.mock.calls[0]).toHaveLength(0)
  })

  it('si può ancora annullare senza togliere niente', () => {
    const onDeleteFood = renderDialog()

    fireEvent.click(screen.getByRole('button', { name: 'Annulla' }))

    expect(onDeleteFood).not.toHaveBeenCalled()
  })

  it('tutte le scelte hanno un bersaglio ≥44px', () => {
    renderDialog()

    for (const nome of [/L'ho consumato/, /L'ho buttato/, /Toglilo e basta/, /^Annulla$/]) {
      expect(screen.getByRole('button', { name: nome }).className).toContain('h-11')
    }
  })

  it('durante l\'eliminazione non si può premere due volte', () => {
    renderDialog(vi.fn(), true)

    for (const nome of [/L'ho consumato/, /L'ho buttato/, /Toglilo e basta/]) {
      expect(screen.getByRole('button', { name: nome }).hasAttribute('disabled')).toBe(true)
    }
  })
})
