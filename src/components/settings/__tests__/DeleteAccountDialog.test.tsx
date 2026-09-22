// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

type Preview = { data: { list_shared: boolean; active_food_count: number }[] | null; error: { message: string } | null }

const { signInWithPassword, signOut, rpc, preview, navigateMock, clearAuthStorage, removePhotos } = vi.hoisted(() => {
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
    removePhotos: vi.fn((): Promise<void> => Promise.resolve()),
  }
})

vi.mock('react-router-dom', () => ({ useNavigate: () => navigateMock }))
vi.mock('@/lib/auth', () => ({ clearAuthStorage }))
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'a@b.it' } }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/haptics', () => ({ triggerHaptic: vi.fn() }))
vi.mock('@/lib/accountDeletion', () => ({ removePhotosOfDeletedFoods: removePhotos }))
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { signInWithPassword, signOut },
    rpc,
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

  it('la conferma resta disabilitata finché non si sa cosa verrà eliminato', async () => {
    // Senza anteprima il dialogo non sa se togliere le foto: confermare prima
    // che arrivi le salterebbe, e lascerebbe orfane quelle di un unico membro.
    let answer: (value: Preview) => void = () => {}
    preview.mockImplementationOnce(() => new Promise<Preview>((resolve) => { answer = resolve }))
    const user = setup()
    render(<DeleteAccountDialog />)

    const passwordInput = await openDialog(user)
    await user.type(passwordInput, 'secret123')
    const confirm = screen.getByRole('button', { name: 'Capisco, elimina il mio account' }) as HTMLButtonElement
    expect(confirm.disabled).toBe(true)

    answer({ data: [{ list_shared: false, active_food_count: 1 }], error: null })
    await vi.waitFor(() => expect(confirm.disabled).toBe(false))
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

// #152 e #145: le foto si tolgono solo quando spariscono anche i loro alimenti,
// e se non si riesce a toglierle l'account non si cancella.
describe('DeleteAccountDialog — foto', () => {
  async function confirmDeletion() {
    signInWithPassword.mockResolvedValue({ error: null })
    const user = setup()
    render(<DeleteAccountDialog />)
    const passwordInput = await openDialog(user)
    await user.type(passwordInput, 'secret123')
    await user.click(screen.getByRole('button', { name: 'Capisco, elimina il mio account' }))
  }

  it('da una lista condivisa non toglie nessuna foto', async () => {
    preview.mockResolvedValue({ data: [{ list_shared: true, active_food_count: 2 }], error: null })

    await confirmDeletion()

    await vi.waitFor(() => expect(rpc).toHaveBeenCalledWith('delete_user'))
    expect(removePhotos).not.toHaveBeenCalled()
  })

  it('se l\u2019anteprima non arriva non toglie nessuna foto: meglio un orfano che una foto altrui persa', async () => {
    preview.mockResolvedValue({ data: null, error: { message: 'network' } })

    await confirmDeletion()

    await vi.waitFor(() => expect(rpc).toHaveBeenCalledWith('delete_user'))
    expect(removePhotos).not.toHaveBeenCalled()
  })

  it('da unico membro toglie le foto prima di cancellare l\u2019account', async () => {
    preview.mockResolvedValue({ data: [{ list_shared: false, active_food_count: 2 }], error: null })

    await confirmDeletion()

    await vi.waitFor(() => expect(rpc).toHaveBeenCalledWith('delete_user'))
    expect(removePhotos).toHaveBeenCalledTimes(1)
    const deleteUserCall = rpc.mock.calls.findIndex(([name]) => name === 'delete_user')
    expect(removePhotos.mock.invocationCallOrder[0]).toBeLessThan(rpc.mock.invocationCallOrder[deleteUserCall])
  })

  it('decide sulle foto con l\u2019anteprima del momento della conferma, non con quella dell\u2019apertura', async () => {
    // All'apertura l'utente è l'unico membro; prima della conferma qualcuno
    // entra nella lista. Con l'anteprima vecchia si toglierebbero le foto di
    // alimenti che restano al nuovo membro.
    preview
      .mockResolvedValueOnce({ data: [{ list_shared: false, active_food_count: 2 }], error: null })
      .mockResolvedValueOnce({ data: [{ list_shared: true, active_food_count: 2 }], error: null })

    await confirmDeletion()

    await vi.waitFor(() => expect(rpc).toHaveBeenCalledWith('delete_user'))
    expect(removePhotos).not.toHaveBeenCalled()
  })

  it('se le foto non si tolgono, l\u2019account resta: errore nel dialogo, niente cancellazione e niente logout', async () => {
    preview.mockResolvedValue({ data: [{ list_shared: false, active_food_count: 2 }], error: null })
    removePhotos.mockRejectedValueOnce(new Error('Non siamo riusciti a eliminare le tue foto. Riprova tra poco.'))

    await confirmDeletion()

    const err = await screen.findByRole('alert')
    expect(err.textContent).toMatch(/eliminare le tue foto/)
    expect(screen.getByPlaceholderText('Inserisci password')).toBeTruthy()
    expect(rpc).not.toHaveBeenCalledWith('delete_user')
    expect(signOut).not.toHaveBeenCalled()
    expect(navigateMock).not.toHaveBeenCalled()
  })
})
