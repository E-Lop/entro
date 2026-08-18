// @vitest-environment jsdom
/**
 * La conferma di eliminazione non chiede «sei sicuro?», chiede **com'è finita**.
 *
 * La domanda «sei sicuro?» non produce nessun dato: l'utente ha già deciso
 * premendo Elimina. La stessa interazione, chiesta diversamente, dice se quel
 * cibo è stato mangiato o buttato — che è l'unico modo per sapere quanto se ne
 * spreca.
 */
import { useState } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { FoodModals } from '../FoodModals'
import { FOOD_ACTIONS_ATTR, LIST_HEADING_ATTR } from '@/lib/focusAfterRemoval'
import type { Food } from '@/lib/foods'

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
})

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

/**
 * Dove finisce il fuoco quando il dialogo si chiude (#87).
 *
 * La regola è quella della convenzione di famiglia `fuoco-dopo-una-rimozione`;
 * qui si verifica il pezzo che vive nel dialogo, cioè che Radix non riporti il
 * fuoco su una card che nel frattempo è sparita. Il test rende la lista attorno
 * al dialogo — è il contratto vero: il modulo cerca i bersagli nel documento.
 */
describe('conferma eliminazione — dove finisce il fuoco', () => {
  /** Le card della lista, con l'intestazione che fa da ripiego. */
  function renderList(ids: string[]) {
    const list = document.createElement('div')
    const heading = document.createElement('h2')
    heading.setAttribute(LIST_HEADING_ATTR, '')
    heading.tabIndex = -1
    heading.textContent = 'I tuoi alimenti'
    list.appendChild(heading)

    for (const id of ids) {
      const card = document.createElement('div')
      card.setAttribute(FOOD_ACTIONS_ATTR, id)
      card.tabIndex = -1
      list.appendChild(card)
    }
    document.body.appendChild(list)
    return list
  }

  /**
   * Il dialogo deve **chiudersi** davvero: `onCloseAutoFocus` scatta lì, e con
   * `deletingFood` fisso non scatterebbe mai. Qui la chiusura è quella vera.
   */
  function DialogWithState({ removeId }: { removeId: string }) {
    const [deleting, setDeleting] = useState<Food | null>(FOOD)

    return (
      <FoodModals
        isAddDialogOpen={false}
        onAddDialogChange={vi.fn()}
        onCreateFood={vi.fn()}
        isCreating={false}
        editingFood={null}
        onEditDialogChange={vi.fn()}
        onUpdateFood={vi.fn()}
        isUpdating={false}
        deletingFood={deleting}
        onDeleteDialogChange={() => setDeleting(null)}
        onDeleteFood={() => {
          // Come l'aggiornamento ottimistico: la card esce dalla lista, e
          // subito dopo il dialogo si chiude.
          document.querySelector(`[${FOOD_ACTIONS_ATTR}="${removeId}"]`)?.remove()
          setDeleting(null)
        }}
        isDeleting={false}
      />
    )
  }

  it('porta il fuoco sulla card successiva, non su body', async () => {
    renderList(['food-0', 'food-1', 'food-2'])
    render(<DialogWithState removeId="food-1" />)

    fireEvent.click(screen.getByRole('button', { name: /Toglilo e basta/ }))

    await waitFor(() => {
      expect(document.activeElement?.getAttribute(FOOD_ACTIONS_ATTR)).toBe('food-2')
    })
  })

  it('ripiega sull’intestazione quando era l’ultima', async () => {
    renderList(['food-0', 'food-1'])
    render(<DialogWithState removeId="food-1" />)

    fireEvent.click(screen.getByRole('button', { name: /L'ho consumato/ }))

    await waitFor(() => {
      expect(document.activeElement?.hasAttribute(LIST_HEADING_ATTR)).toBe(true)
    })
  })

  it('su «Annulla» non scavalca il comportamento predefinito', async () => {
    // Qui la card c'è ancora: restituire il fuoco a chi ha aperto il dialogo è
    // giusto, e spostarlo altrove sarebbe il difetto al contrario.
    renderList(['food-0', 'food-1', 'food-2'])
    render(<DialogWithState removeId="food-1" />)

    fireEvent.click(screen.getByRole('button', { name: 'Annulla' }))

    await waitFor(() => {
      expect(document.activeElement?.getAttribute(FOOD_ACTIONS_ATTR)).not.toBe('food-2')
    })
    expect(document.querySelector(`[${FOOD_ACTIONS_ATTR}="food-1"]`)).not.toBeNull()
  })
})
