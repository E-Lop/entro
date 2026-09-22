// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

type Preview = { data: { list_shared: boolean; active_food_count: number }[] | null; error: { message: string } | null }

const { signInWithPassword, signOut, rpc, preview, navigateMock, clearAuthStorage, foodsWithImages, removeImages } = vi.hoisted(() => {
  const preview = vi.fn(
    (): Promise<Preview> => Promise.resolve({ data: [{ list_shared: false, active_food_count: 4 }], error: null })
  )
  return {
    signInWithPassword: vi.fn(),
    signOut: vi.fn(() => Promise.resolve({ error: null })),
    // L'anteprima e la cancellazione passano entrambe da `rpc`: si separano per nome.
    rpc: vi.fn((name: string) => (name === 'account_deletion_preview' ? preview() : Promise.resolve({ error: null }))),
    preview,
    navigateMock: vi.fn(),
    clearAuthStorage: vi.fn(),
    foodsWithImages: vi.fn((): Promise<{ data: { image_url: string }[] }> => Promise.resolve({ data: [] })),
    removeImages: vi.fn(() => Promise.resolve({ data: [], error: null })),
  }
})

vi.mock('react-router-dom', () => ({ useNavigate: () => navigateMock }))
vi.mock('@/lib/auth', () => ({ clearAuthStorage }))
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'a@b.it' } }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/haptics', () => ({ triggerHaptic: vi.fn() }))
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ not: foodsWithImages }),
      }),
    }),
    auth: { signInWithPassword, signOut },
    rpc,
    storage: { from: () => ({ remove: removeImages }) },
  },
}))

import { DeleteAccountDialog } from '../DeleteAccountDialog'

const setup = () => userEvent.setup({ pointerEventsCheck: 0 })

async function openDialog(user: ReturnType<typeof setup>) {
  await user.click(screen.getByRole('button', { name: 'Elimina account' }))
  return screen.findByPlaceholderText('Inserisci password')
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('DeleteAccountDialog — salvaguardie azione distruttiva', () => {
  it('mantiene il pulsante di conferma disabilitato finché la password è vuota', async () => {
    const user = setup()
    render(<DeleteAccountDialog />)

    const passwordInput = await openDialog(user)
    const confirm = screen.getByRole('button', {
      name: 'Capisco, elimina il mio account',
    }) as HTMLButtonElement
    expect(confirm.disabled).toBe(true)

    await user.type(passwordInput, 'secret123')
    expect(confirm.disabled).toBe(false)
  })

  it('con password errata mostra l’errore inline, tiene aperto il dialog e non naviga via', async () => {
    signInWithPassword.mockResolvedValue({ error: { message: 'invalid login' } })
    const user = setup()
    render(<DeleteAccountDialog />)

    const passwordInput = await openDialog(user)
    await user.type(passwordInput, 'wrong-password')
    await user.click(
      screen.getByRole('button', { name: 'Capisco, elimina il mio account' })
    )

    const err = await screen.findByRole('alert')
    expect(err.textContent).toMatch(/Password non corretta/)
    // Il dialog resta aperto: il campo password è ancora presente
    expect(screen.getByPlaceholderText('Inserisci password')).toBeTruthy()
    // Nessuna navigazione/cancellazione su errore
    expect(navigateMock).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalledWith('delete_user')
  })

  it('collega l’errore al campo password via aria-invalid e aria-describedby', async () => {
    signInWithPassword.mockResolvedValue({ error: { message: 'invalid login' } })
    const user = setup()
    render(<DeleteAccountDialog />)

    const passwordInput = await openDialog(user)
    await user.type(passwordInput, 'wrong-password')
    await user.click(
      screen.getByRole('button', { name: 'Capisco, elimina il mio account' })
    )
    await screen.findByRole('alert')

    const input = screen.getByPlaceholderText('Inserisci password')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.getAttribute('aria-describedby')).toBe('delete-password-error')
  })

  it('con 0 alimenti non rifà la fetch dell\u2019anteprima alla riapertura del dialog', async () => {
    // Con un totale reale di 0, il vecchio guard `!foodCount` rifaceva la query
    // a ogni apertura. Si guarda se l'anteprima c'è, non se il numero è zero.
    preview.mockResolvedValue({ data: [{ list_shared: false, active_food_count: 0 }], error: null })
    const user = setup()
    render(<DeleteAccountDialog />)

    await openDialog(user)
    await screen.findByText(/0 alimenti in lista/)
    expect(preview).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Annulla' }))
    await user.click(screen.getByRole('button', { name: 'Elimina account' }))
    await screen.findByPlaceholderText('Inserisci password')

    expect(preview).toHaveBeenCalledTimes(1)
  })
})

// #152: il dialogo dice ciò che il server farà davvero, e lo chiede al server.
describe('DeleteAccountDialog — cosa viene eliminato', () => {
  it('unico membro della lista: annuncia l\u2019eliminazione degli alimenti in lista, con il numero', async () => {
    preview.mockResolvedValue({ data: [{ list_shared: false, active_food_count: 3 }], error: null })
    const user = setup()
    render(<DeleteAccountDialog />)

    await openDialog(user)
    expect(await screen.findByText(/3 alimenti in lista/)).toBeTruthy()
    expect(screen.getByText(/eliminati permanentemente/)).toBeTruthy()
    expect(screen.queryByText(/restano agli altri membri/)).toBeNull()
  })

  it('usa il singolare con un alimento solo', async () => {
    preview.mockResolvedValue({ data: [{ list_shared: false, active_food_count: 1 }], error: null })
    const user = setup()
    render(<DeleteAccountDialog />)

    await openDialog(user)
    expect(await screen.findByText(/1 alimento in lista/)).toBeTruthy()
  })

  it('lista condivisa: dice che gli alimenti restano agli altri membri e non annuncia la loro eliminazione', async () => {
    preview.mockResolvedValue({ data: [{ list_shared: true, active_food_count: 7 }], error: null })
    const user = setup()
    render(<DeleteAccountDialog />)

    await openDialog(user)
    expect(await screen.findByText(/Lascerai la lista condivisa: gli alimenti restano agli altri membri/)).toBeTruthy()
    expect(screen.queryByText(/alimenti in lista/)).toBeNull()
    expect(screen.queryByText(/7/)).toBeNull()
  })

  it('se l\u2019anteprima non arriva, non promette né l\u2019una né l\u2019altra cosa, e la cancellazione resta possibile', async () => {
    preview.mockResolvedValue({ data: null, error: { message: 'network' } })
    signInWithPassword.mockResolvedValue({ error: null })
    const user = setup()
    render(<DeleteAccountDialog />)

    const passwordInput = await openDialog(user)
    expect(await screen.findByText(/Non riusciamo a mostrarti il dettaglio/)).toBeTruthy()
    expect(screen.queryByText(/alimenti in lista/)).toBeNull()
    expect(screen.queryByText(/restano agli altri membri/)).toBeNull()

    await user.type(passwordInput, 'secret123')
    await user.click(screen.getByRole('button', { name: 'Capisco, elimina il mio account' }))
    expect(rpc).toHaveBeenCalledWith('delete_user')
  })
})

// #152: le foto degli alimenti che restano agli altri membri non si toccano.
describe('DeleteAccountDialog — foto', () => {
  // Una riga legacy con l'URL firmato intero: è la forma che l'estrazione del
  // percorso riconosce oggi (quella dei percorsi nudi è la #145).
  const legacyRow = { image_url: 'http://x/storage/v1/object/sign/food-images/u1/foto.jpg?token=t' }

  async function confirmDeletion() {
    signInWithPassword.mockResolvedValue({ error: null })
    const user = setup()
    render(<DeleteAccountDialog />)
    const passwordInput = await openDialog(user)
    await user.type(passwordInput, 'secret123')
    await user.click(screen.getByRole('button', { name: 'Capisco, elimina il mio account' }))
    await vi.waitFor(() => expect(rpc).toHaveBeenCalledWith('delete_user'))
  }

  it('da una lista condivisa non toglie nessuna foto', async () => {
    preview.mockResolvedValue({ data: [{ list_shared: true, active_food_count: 2 }], error: null })
    foodsWithImages.mockResolvedValue({ data: [legacyRow] })

    await confirmDeletion()

    expect(removeImages).not.toHaveBeenCalled()
  })

  it('se l\u2019anteprima non arriva non toglie nessuna foto: meglio un orfano che una foto altrui persa', async () => {
    preview.mockResolvedValue({ data: null, error: { message: 'network' } })
    foodsWithImages.mockResolvedValue({ data: [legacyRow] })

    await confirmDeletion()

    expect(removeImages).not.toHaveBeenCalled()
  })

  it('da unico membro toglie le foto dei suoi alimenti, come prima', async () => {
    preview.mockResolvedValue({ data: [{ list_shared: false, active_food_count: 2 }], error: null })
    foodsWithImages.mockResolvedValue({ data: [legacyRow] })

    await confirmDeletion()

    expect(removeImages).toHaveBeenCalledWith(['u1/foto.jpg'])
  })
})
