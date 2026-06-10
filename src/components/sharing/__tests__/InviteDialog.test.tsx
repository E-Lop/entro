// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const { createInvite, getUserList } = vi.hoisted(() => ({
  createInvite: vi.fn(),
  getUserList: vi.fn(),
}))

vi.mock('@/lib/invites', () => ({ createInvite, getUserList }))

import { InviteDialog } from '../InviteDialog'

afterEach(() => {
  cleanup()
  createInvite.mockReset()
  getUserList.mockReset()
})

async function generateCode() {
  getUserList.mockResolvedValue({ list: { id: 'list-1' }, error: null })
  createInvite.mockResolvedValue({ success: true, shortCode: 'JKB3TY', error: null })
  const user = userEvent.setup()
  render(<InviteDialog open onOpenChange={() => {}} />)
  await user.click(screen.getByRole('button', { name: /Genera codice invito/ }))
  return user
}

describe('InviteDialog — codice generato', () => {
  it('comunica la validità di 7 giorni del codice', async () => {
    await generateCode()
    expect(await screen.findByText('JKB3TY')).toBeTruthy()
    expect(screen.getByText(/Valido per 7 giorni/)).toBeTruthy()
  })

  it('annuncia il codice agli screen reader con una regione live', async () => {
    await generateCode()
    const status = await screen.findByRole('status')
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(status.textContent).toContain('JKB3TY')
  })

  it('usa il titolo coerente "Crea invito" nello stato iniziale', async () => {
    render(<InviteDialog open onOpenChange={() => {}} />)
    expect(screen.getByText('Crea invito')).toBeTruthy()
  })
})
