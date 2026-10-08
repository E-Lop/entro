// @vitest-environment jsdom
/**
 * Il menu «Inviti» e l'elenco dei membri (#196).
 *
 * L'elenco lo vede solo chi può togliere: il server dà i nomi solo a lui, e a
 * chiunque altro il menu arriva con l'elenco vuoto. Nessuno ci trova sé
 * stesso: per uscire resta «Abbandona lista condivisa».
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InviteMenuDialog } from '../InviteMenuDialog'
import type { RemovableMember } from '@/lib/invites'

const BRUNO: RemovableMember = { userId: 'u-b', displayName: 'Bruno Bianchi' }
const CARLA: RemovableMember = { userId: 'u-c', displayName: 'carla@example.test' }

function renderMenu(removableMembers: RemovableMember[], onRemoveMember = vi.fn()) {
  render(
    <InviteMenuDialog
      open
      onOpenChange={() => {}}
      isInSharedList
      onCreateInvite={() => {}}
      onAcceptInvite={() => {}}
      onLeaveList={() => {}}
      removableMembers={removableMembers}
      onRemoveMember={onRemoveMember}
    />
  )
  return onRemoveMember
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('InviteMenuDialog — i membri della lista', () => {
  it('chi non può togliere non vede nessun elenco', () => {
    renderMenu([])

    expect(screen.queryByText('Membri della lista')).toBeNull()
    expect(screen.queryByRole('button', { name: /^Togli / })).toBeNull()
    // Il resto del menu c'è.
    expect(screen.getByText('Abbandona lista condivisa')).toBeTruthy()
  })

  it('chi può togliere vede ogni membro col suo nome, o con l’email se il nome manca', () => {
    renderMenu([BRUNO, CARLA])

    expect(screen.getByRole('heading', { name: 'Membri della lista' })).toBeTruthy()
    expect(screen.getByText('Bruno Bianchi')).toBeTruthy()
    expect(screen.getByText('carla@example.test')).toBeTruthy()
  })

  it('ogni azione dice chi toglie, anche a chi non vede la riga', () => {
    renderMenu([BRUNO, CARLA])

    expect(screen.getByRole('button', { name: 'Togli Bruno Bianchi dalla lista' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Togli carla@example.test dalla lista' })).toBeTruthy()
  })

  it('«Togli» passa quel membro alla conferma, non lo toglie da sé', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const onRemoveMember = renderMenu([BRUNO, CARLA])

    await userEvent
      .setup({ advanceTimers: vi.advanceTimersByTime })
      .click(screen.getByRole('button', { name: 'Togli carla@example.test dalla lista' }))
    await act(() => vi.advanceTimersByTimeAsync(150))

    expect(onRemoveMember).toHaveBeenCalledTimes(1)
    expect(onRemoveMember).toHaveBeenCalledWith(CARLA)
  })
})
