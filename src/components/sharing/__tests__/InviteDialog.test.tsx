// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const { createInvite, getUserList, getMyActiveInvites, revokeInvite, toastSuccess } = vi.hoisted(() => ({
  createInvite: vi.fn(),
  getUserList: vi.fn(),
  getMyActiveInvites: vi.fn(),
  revokeInvite: vi.fn(),
  toastSuccess: vi.fn(),
}))

vi.mock('@/lib/invites', () => ({ createInvite, getUserList, getMyActiveInvites, revokeInvite }))
vi.mock('sonner', () => ({ toast: { success: toastSuccess, error: vi.fn() } }))

import { InviteDialog } from '../InviteDialog'

beforeEach(() => {
  getMyActiveInvites.mockResolvedValue({ invites: [], error: null })
})

afterEach(() => {
  cleanup()
  createInvite.mockReset()
  getUserList.mockReset()
  getMyActiveInvites.mockReset()
  revokeInvite.mockReset()
  toastSuccess.mockReset()
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

// Un momento fisso: il 29 set 2026 a mezzogiorno UTC. Le ore dell'etichetta
// dipendono dal fuso di chi guarda, i giorni scelti qui no.
const NOW = new Date('2026-09-29T12:00:00Z')
const TWO_INVITES = [
  // Creato il 22 set, scade fra sei ore.
  { id: 'i1', short_code: 'ABC123', created_at: '2026-09-22T18:00:00Z', expires_at: '2026-09-29T18:00:00Z' },
  // Creato oggi, scade fra sei giorni e mezzo.
  { id: 'i2', short_code: 'XYZ789', created_at: '2026-09-29T10:00:00Z', expires_at: '2026-10-06T10:00:00Z' },
]

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: NOW })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('InviteDialog — i propri inviti attivi (#194)', () => {
  it('senza inviti attivi l\'elenco non c\'è', async () => {
    render(<InviteDialog open onOpenChange={() => {}} />)

    await vi.waitFor(() => expect(getMyActiveInvites).toHaveBeenCalled())
    expect(screen.queryByText('I tuoi inviti attivi')).toBeNull()
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('con due inviti li mostra entrambi, con quando sono stati creati e quanto manca alla scadenza', async () => {
    getMyActiveInvites.mockResolvedValue({ invites: TWO_INVITES, error: null })
    render(<InviteDialog open onOpenChange={() => {}} />)

    const list = await screen.findByRole('list', { name: 'I tuoi inviti attivi' })
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0].textContent).toContain('ABC123')
    expect(items[0].textContent).toMatch(/Creato il 22 set alle \d{2}:\d{2}/)
    expect(items[0].textContent).toContain('Scade tra meno di un giorno')
    expect(items[1].textContent).toContain('XYZ789')
    expect(items[1].textContent).toMatch(/Creato oggi alle \d{2}:\d{2}/)
    expect(items[1].textContent).toContain('Scade tra 6 giorni')
  })

  it('«Revoca» dice allo screen reader quale codice revoca', async () => {
    getMyActiveInvites.mockResolvedValue({ invites: TWO_INVITES, error: null })
    render(<InviteDialog open onOpenChange={() => {}} />)

    expect(await screen.findByRole('button', { name: 'Revoca l\'invito ABC123' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Revoca l\'invito XYZ789' })).toBeTruthy()
  })

  it('«Revoca» chiede conferma, e dopo la conferma l\'invito sparisce', async () => {
    getMyActiveInvites
      .mockResolvedValueOnce({ invites: TWO_INVITES, error: null })
      .mockResolvedValueOnce({ invites: [TWO_INVITES[1]], error: null })
    revokeInvite.mockResolvedValue({ success: true, error: null })
    const user = userEvent.setup()
    render(<InviteDialog open onOpenChange={() => {}} />)

    await user.click(await screen.findByRole('button', { name: 'Revoca l\'invito ABC123' }))
    const confirm = await screen.findByRole('alertdialog')
    expect(within(confirm).getByText(/ABC123/)).toBeTruthy()
    expect(revokeInvite).not.toHaveBeenCalled()

    await user.click(within(confirm).getByRole('button', { name: 'Revoca' }))

    expect(revokeInvite).toHaveBeenCalledWith('i1')
    await vi.waitFor(() => expect(screen.queryByText('ABC123')).toBeNull())
    expect(screen.getByText('XYZ789')).toBeTruthy()
    expect(toastSuccess).toHaveBeenCalledWith('Invito ABC123 revocato')
  })

  it('«Annulla» nella conferma non revoca niente', async () => {
    getMyActiveInvites.mockResolvedValue({ invites: TWO_INVITES, error: null })
    const user = userEvent.setup()
    render(<InviteDialog open onOpenChange={() => {}} />)

    await user.click(await screen.findByRole('button', { name: 'Revoca l\'invito ABC123' }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Annulla' }))

    expect(revokeInvite).not.toHaveBeenCalled()
    expect(screen.getByText('ABC123')).toBeTruthy()
  })
})
