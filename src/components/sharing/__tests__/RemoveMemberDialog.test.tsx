// @vitest-environment jsdom
/**
 * La conferma prima di togliere un membro (#196): nomina la persona e dice le
 * tre conseguenze, e toglie solo dopo il sì.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const { removeListMember, toast } = vi.hoisted(() => ({
  removeListMember: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/invites', () => ({ removeListMember }))
vi.mock('sonner', () => ({ toast }))

import { RemoveMemberDialog } from '../RemoveMemberDialog'

const BRUNO = { userId: 'u-b', displayName: 'Bruno Bianchi' }

function renderDialog(member: typeof BRUNO | null = BRUNO) {
  const onOpenChange = vi.fn()
  const onRemoved = vi.fn()
  render(<RemoveMemberDialog member={member} onOpenChange={onOpenChange} onRemoved={onRemoved} />)
  return { onOpenChange, onRemoved }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('RemoveMemberDialog', () => {
  it('senza un membro resta chiuso', () => {
    renderDialog(null)

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('nomina la persona e dice le tre conseguenze', () => {
    renderDialog()

    const dialog = screen.getByRole('dialog', { name: 'Togli dalla lista' })
    expect(dialog.textContent).toContain('Vuoi togliere Bruno Bianchi dalla lista condivisa?')
    expect(dialog.textContent).toContain('Gli alimenti che ha inserito restano nella lista.')
    expect(dialog.textContent).toContain('Riparte da una lista personale vuota, e non vede più questa.')
    expect(dialog.textContent).toContain('Gli inviti ancora attivi di questa lista smettono di funzionare.')
  })

  it('aprirlo non toglie nessuno, e «Annulla» nemmeno', async () => {
    const { onOpenChange } = renderDialog()

    await userEvent.setup().click(screen.getByRole('button', { name: 'Annulla' }))

    expect(removeListMember).not.toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('dopo il sì toglie quella persona, lo dice, e fa rileggere l’elenco', async () => {
    removeListMember.mockResolvedValue({ success: true, error: null })
    const { onOpenChange, onRemoved } = renderDialog()

    await userEvent.setup().click(screen.getByRole('button', { name: 'Togli dalla lista' }))

    await waitFor(() => expect(onRemoved).toHaveBeenCalledTimes(1))
    expect(removeListMember).toHaveBeenCalledWith('u-b')
    expect(toast.success).toHaveBeenCalledWith('Bruno Bianchi non fa più parte della lista')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('se il server rifiuta dice perché, resta aperto e non annuncia niente', async () => {
    removeListMember.mockResolvedValue({
      success: false,
      error: new Error('Questa persona non fa più parte della lista.'),
    })
    const { onOpenChange, onRemoved } = renderDialog()

    await userEvent.setup().click(screen.getByRole('button', { name: 'Togli dalla lista' }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Questa persona non fa più parte della lista.'))
    expect(toast.success).not.toHaveBeenCalled()
    expect(onRemoved).not.toHaveBeenCalled()
    expect(onOpenChange).not.toHaveBeenCalled()
  })
})
