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

const {
  mockAuth,
  mockFrom,
  mockListBuilder,
  mockInsertBuilder,
  mockLogError,
  mockDeleteFoodImage,
  mockIsPendingUrl,
} = vi.hoisted(() => {
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
    mockDeleteFoodImage: vi.fn(),
    mockIsPendingUrl: vi.fn<(url: unknown) => boolean>(() => false),
  }
})

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: mockAuth, from: mockFrom },
}))
vi.mock('@/lib/safeLog', () => ({ logError: mockLogError, logWarn: vi.fn() }))
vi.mock('@/lib/storage', () => ({ deleteFoodImage: mockDeleteFoodImage }))
vi.mock('@/lib/pendingImages', () => ({
  isPendingUrl: mockIsPendingUrl,
  deletePendingImage: vi.fn(),
}))

import { createFood } from '@/lib/foods'

const DATA = { name: 'Yogurt', expiry_date: '2026-12-31' } as Parameters<typeof createFood>[0]

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null })
  mockFrom.mockImplementation((table: string) =>
    table === 'list_members' ? mockListBuilder : mockInsertBuilder
  )
})

describe('createFood senza una lista', () => {
  it('non tenta la scrittura, che la policy rifiuterebbe comunque', async () => {
    mockListBuilder.maybeSingle.mockResolvedValue({ data: null, error: null })

    const { food, error } = await createFood(DATA)

    expect(food).toBeNull()
    expect(error).not.toBeNull()
    expect(mockInsertBuilder.insert).not.toHaveBeenCalled()
  })

  it('dice all’utente cosa fare, in italiano', async () => {
    mockListBuilder.maybeSingle.mockResolvedValue({ data: null, error: null })

    const { error } = await createFood(DATA)

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

    const { error } = await createFood(DATA)

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

    await createFood(DATA)

    expect(mockLogError).toHaveBeenCalled()
  })
})

describe('createFood sul percorso felice', () => {
  it('scrive con il `list_id` dell’utente', async () => {
    mockListBuilder.maybeSingle.mockResolvedValue({ data: { list_id: 'lista-1' }, error: null })
    mockInsertBuilder.single.mockResolvedValue({ data: { id: 'f1', name: 'Yogurt' }, error: null })

    const { food, error } = await createFood(DATA)

    expect(error).toBeNull()
    expect(food).toEqual({ id: 'f1', name: 'Yogurt' })
    expect(mockInsertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ list_id: 'lista-1', user_id: 'u1' })
    )
  })
})

/**
 * Una riga fallita dopo un upload riuscito lascia un oggetto che nessuna riga
 * cita: si cancella subito, invece di aspettare che qualcuno lo trovi nel
 * bucket (#114). L'ordine giusto viene da `entro-family/core/food-images.md`:
 * carica l'oggetto, poi scrivi la riga, e se la riga fallisce togli l'oggetto.
 */
describe('createFood — la foto appena caricata, se la riga non si scrive', () => {
  const PHOTO = 'u1/1757846400000-latte.jpg'

  it('il database rifiuta: l’oggetto appena caricato si cancella', async () => {
    mockListBuilder.maybeSingle.mockResolvedValue({ data: { list_id: 'lista-1' }, error: null })
    mockInsertBuilder.single.mockResolvedValue({ data: null, error: { message: 'boom' } })

    const { error } = await createFood({ ...DATA, image_url: PHOTO })

    expect(error).not.toBeNull()
    expect(mockDeleteFoodImage).toHaveBeenCalledWith(PHOTO)
  })

  it('manca la lista: la riga non parte, e l’oggetto si cancella lo stesso', async () => {
    mockListBuilder.maybeSingle.mockResolvedValue({ data: null, error: null })

    await createFood({ ...DATA, image_url: PHOTO })

    expect(mockDeleteFoodImage).toHaveBeenCalledWith(PHOTO)
  })

  it('se anche la cancellazione fallisce, l’errore che arriva è quello della riga', async () => {
    // L'orfano è spazzatura recuperabile: si logga, ma non prende il posto
    // del messaggio che dice all'utente cosa non è andato.
    mockListBuilder.maybeSingle.mockResolvedValue({ data: { list_id: 'lista-1' }, error: null })
    mockInsertBuilder.single.mockResolvedValue({ data: null, error: { message: 'boom' } })
    mockDeleteFoodImage.mockRejectedValueOnce(new Error('Storage irraggiungibile'))

    const { error } = await createFood({ ...DATA, image_url: PHOTO })

    expect(error?.message).toBe('Non è stato possibile salvare l\'alimento. Riprova.')
  })

  it('la riga si scrive: l’oggetto resta', async () => {
    mockListBuilder.maybeSingle.mockResolvedValue({ data: { list_id: 'lista-1' }, error: null })
    mockInsertBuilder.single.mockResolvedValue({ data: { id: 'f1' }, error: null })

    await createFood({ ...DATA, image_url: PHOTO })

    expect(mockDeleteFoodImage).not.toHaveBeenCalled()
  })

  it('senza foto non tocca Storage', async () => {
    mockListBuilder.maybeSingle.mockResolvedValue({ data: { list_id: 'lista-1' }, error: null })
    mockInsertBuilder.single.mockResolvedValue({ data: null, error: { message: 'boom' } })

    await createFood(DATA)

    expect(mockDeleteFoodImage).not.toHaveBeenCalled()
  })

  it('un riferimento `pending://` non va a Storage: non ci è mai salito', async () => {
    mockIsPendingUrl.mockImplementation((url: unknown) => String(url).startsWith('pending://'))
    mockListBuilder.maybeSingle.mockResolvedValue({ data: { list_id: 'lista-1' }, error: null })
    mockInsertBuilder.single.mockResolvedValue({ data: null, error: { message: 'boom' } })

    await createFood({ ...DATA, image_url: 'pending://abc' })

    expect(mockDeleteFoodImage).not.toHaveBeenCalled()
  })
})
