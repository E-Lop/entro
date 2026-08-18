/**
 * `createFood` quando la lista dell'utente manca (#94).
 *
 * Prima il codice proseguiva con `list_id: null`, commentandolo come «personal
 * food». Non era una degradazione elegante: la policy di inserimento pretende
 * `list_id is not null` con appartenenza, quindi quel percorso finiva
 * **sempre** nel rifiuto della RLS — e all'utente arrivava il testo di
 * Postgres, in inglese, col nome della tabella dentro.
 *
 * Dalla #94 la lista la crea un trigger su `auth.users`, quindi qui l'assenza è
 * un'anomalia: si dice cosa è successo invece di tentare una scrittura che non
 * può riuscire.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockAuth, mockFrom, mockListBuilder, mockInsertBuilder, mockLogError } = vi.hoisted(() => {
  const mockListBuilder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
  }
  const mockInsertBuilder = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn(),
  }
  return {
    mockAuth: { getSession: vi.fn() },
    mockFrom: vi.fn(),
    mockListBuilder,
    mockInsertBuilder,
    mockLogError: vi.fn(),
  }
})

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: mockAuth, from: mockFrom },
}))
vi.mock('@/lib/safeLog', () => ({ logError: mockLogError, logWarn: vi.fn() }))
vi.mock('@/lib/storage', () => ({ deleteFoodImage: vi.fn() }))
vi.mock('@/lib/pendingImages', () => ({
  isPendingUrl: vi.fn(() => false),
  deletePendingImage: vi.fn(),
}))

import { createFood } from '@/lib/foods'

const DATI = { name: 'Yogurt', expiry_date: '2026-12-31' } as Parameters<typeof createFood>[0]

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null })
  mockFrom.mockImplementation((tabella: string) =>
    tabella === 'list_members' ? mockListBuilder : mockInsertBuilder
  )
})

describe('createFood senza una lista', () => {
  it('non tenta la scrittura, che la policy rifiuterebbe comunque', async () => {
    mockListBuilder.maybeSingle.mockResolvedValue({ data: null, error: null })

    const { food, error } = await createFood(DATI)

    expect(food).toBeNull()
    expect(error).not.toBeNull()
    expect(mockInsertBuilder.insert).not.toHaveBeenCalled()
  })

  it('dice all’utente cosa fare, in italiano', async () => {
    mockListBuilder.maybeSingle.mockResolvedValue({ data: null, error: null })

    const { error } = await createFood(DATI)

    expect(error?.message).toContain('lista')
    expect(error?.message).toContain('Ricarica')
  })
})

describe('createFood quando il database rifiuta', () => {
  it('non rimanda all’utente il messaggio di Postgres', async () => {
    mockListBuilder.maybeSingle.mockResolvedValue({ data: { list_id: 'lista-1' }, error: null })
    mockInsertBuilder.single.mockResolvedValue({
      data: null,
      error: { message: 'new row violates row-level security policy for table "foods"' },
    })

    const { error } = await createFood(DATI)

    expect(error?.message).not.toContain('row-level security')
    expect(error?.message).not.toContain('foods')
    expect(error?.message.length).toBeGreaterThan(0)
  })

  it('il dettaglio tecnico resta nei log, dove serve', async () => {
    mockListBuilder.maybeSingle.mockResolvedValue({ data: { list_id: 'lista-1' }, error: null })
    mockInsertBuilder.single.mockResolvedValue({
      data: null,
      error: { message: 'new row violates row-level security policy for table "foods"' },
    })

    await createFood(DATI)

    expect(mockLogError).toHaveBeenCalled()
  })
})

describe('createFood sul percorso felice', () => {
  it('scrive con il `list_id` dell’utente', async () => {
    mockListBuilder.maybeSingle.mockResolvedValue({ data: { list_id: 'lista-1' }, error: null })
    mockInsertBuilder.single.mockResolvedValue({ data: { id: 'f1', name: 'Yogurt' }, error: null })

    const { food, error } = await createFood(DATI)

    expect(error).toBeNull()
    expect(food).toEqual({ id: 'f1', name: 'Yogurt' })
    expect(mockInsertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ list_id: 'lista-1', user_id: 'u1' })
    )
  })
})
