/**
 * La coda offline e la foto in attesa: `pending://` si risolve guardando il
 * **valore**, non chi ha scritto il payload (#113).
 *
 * Prima `updateFood` risolveva l'immagine solo se `variables.data.user_id` era
 * valorizzato. In creazione lo è; in modifica no, perché `handleUpdateFood`
 * costruisce il payload dal form, che `user_id` non ce l'ha. Una foto scattata
 * offline in modifica finiva in tabella come `pending://…`: una stringa che
 * solo l'IndexedDB di quel browser sa leggere.
 *
 * Si prova la `mutationFn` vera, presa da `getMutationDefaults`: è quella che
 * riprende una mutazione in pausa dopo un ricaricamento.
 */
import { QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mocks } = vi.hoisted(() => ({
  mocks: {
    getSession: vi.fn(),
    createFood: vi.fn(),
    updateFood: vi.fn(),
    uploadFoodImage: vi.fn(),
    pendingImageToFile: vi.fn(),
    deletePendingImage: vi.fn(),
  },
}))

vi.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession: mocks.getSession } } }))
vi.mock('@/lib/foods', () => ({
  createFood: mocks.createFood,
  updateFood: mocks.updateFood,
  softDeleteFood: vi.fn(),
  updateFoodStatus: vi.fn(),
}))
vi.mock('@/lib/storage', () => ({ uploadFoodImage: mocks.uploadFoodImage }))
vi.mock('@/lib/pendingImages', () => ({
  isPendingUrl: (url: unknown) => typeof url === 'string' && url.startsWith('pending://'),
  pendingImageToFile: mocks.pendingImageToFile,
  deletePendingImage: mocks.deletePendingImage,
}))
vi.mock('@/lib/realtime', () => ({ mutationTracker: { track: vi.fn() } }))
vi.mock('@/lib/safeLog', () => ({ logWarn: vi.fn() }))

import { mutationKeys, registerMutationDefaults } from '@/lib/mutationDefaults'

const PHOTO = new File(['x'], 'foto.jpg', { type: 'image/jpeg' })

function mutationFn<V>(key: readonly string[]) {
  const client = new QueryClient()
  registerMutationDefaults(client)
  return client.getMutationDefaults(key).mutationFn as (variables: V) => Promise<unknown>
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null })
  mocks.pendingImageToFile.mockResolvedValue(PHOTO)
  mocks.uploadFoodImage.mockResolvedValue('u1/9-foto.jpg')
  mocks.deletePendingImage.mockResolvedValue(undefined)
  mocks.updateFood.mockResolvedValue({ food: { id: 'f1' }, error: null })
  mocks.createFood.mockResolvedValue({ food: { id: 'f1' }, error: null })
})

type UpdateVariables = { id: string; data: Record<string, unknown> }

describe('updateFood in coda — la foto scattata offline', () => {
  it('senza `user_id` nel payload la carica lo stesso, e la riga riceve il percorso', async () => {
    // Il payload di `handleUpdateFood`: i campi del form, senza `user_id`.
    const run = mutationFn<UpdateVariables>(mutationKeys.updateFood)

    await run({ id: 'f1', data: { name: 'Latte', image_url: 'pending://abc' } })

    expect(mocks.uploadFoodImage).toHaveBeenCalledWith(PHOTO, 'u1')
    expect(mocks.updateFood).toHaveBeenCalledWith(
      'f1',
      expect.objectContaining({ image_url: 'u1/9-foto.jpg' })
    )
    expect(mocks.deletePendingImage).toHaveBeenCalledWith('pending://abc')
  })

  it('mai `pending://` verso il database', async () => {
    const run = mutationFn<UpdateVariables>(mutationKeys.updateFood)

    await run({ id: 'f1', data: { image_url: 'pending://abc' } })

    const [, data] = mocks.updateFood.mock.calls[0] as [string, Record<string, unknown>]
    expect(String(data.image_url)).not.toMatch(/^pending:\/\//)
  })

  it('se il caricamento fallisce la foto di prima non si tocca', async () => {
    // Con `image_url: null` `updateFood` toglierebbe la foto che la riga ha
    // oggi e cancellerebbe l'oggetto: una modifica fallita a metà costerebbe
    // una foto che l'utente non ha chiesto di togliere.
    mocks.uploadFoodImage.mockRejectedValue(new Error('Storage irraggiungibile'))
    const run = mutationFn<UpdateVariables>(mutationKeys.updateFood)

    await run({ id: 'f1', data: { name: 'Latte', image_url: 'pending://abc' } })

    const [, data] = mocks.updateFood.mock.calls[0] as [string, Record<string, unknown>]
    expect(data.image_url).toBeUndefined()
    expect(data.name).toBe('Latte')
  })

  it('un percorso d’archivio passa com’è, senza leggere la sessione', async () => {
    const run = mutationFn<UpdateVariables>(mutationKeys.updateFood)

    await run({ id: 'f1', data: { image_url: 'u1/1-vecchia.jpg' } })

    expect(mocks.uploadFoodImage).not.toHaveBeenCalled()
    expect(mocks.updateFood).toHaveBeenCalledWith('f1', { image_url: 'u1/1-vecchia.jpg' })
  })

  it('senza sessione non carica niente, e la riga non riceve `pending://`', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null })
    const run = mutationFn<UpdateVariables>(mutationKeys.updateFood)

    await run({ id: 'f1', data: { image_url: 'pending://abc' } })

    expect(mocks.uploadFoodImage).not.toHaveBeenCalled()
    const [, data] = mocks.updateFood.mock.calls[0] as [string, Record<string, unknown>]
    expect(data.image_url).toBeUndefined()
  })
})

describe('createFood in coda — resta com’era', () => {
  it('risolve la foto in attesa con lo `user_id` del payload', async () => {
    const run = mutationFn<{ id: string; data: Record<string, unknown> }>(mutationKeys.createFood)

    await run({ id: 'f1', data: { name: 'Latte', user_id: 'u1', image_url: 'pending://abc' } })

    expect(mocks.uploadFoodImage).toHaveBeenCalledWith(PHOTO, 'u1')
    expect(mocks.createFood).toHaveBeenCalledWith(
      expect.objectContaining({ image_url: 'u1/9-foto.jpg' }),
      'f1'
    )
  })

  // Dalla #152 `user_id` è nullable nello schema: il tipo non lo garantisce più.
  it('senza `user_id` nel payload carica la foto nella cartella della sessione', async () => {
    const run = mutationFn<{ id: string; data: Record<string, unknown> }>(mutationKeys.createFood)

    await run({ id: 'f1', data: { name: 'Latte', image_url: 'pending://abc' } })

    expect(mocks.uploadFoodImage).toHaveBeenCalledWith(PHOTO, 'u1')
    expect(mocks.createFood).toHaveBeenCalledWith(
      expect.objectContaining({ image_url: 'u1/9-foto.jpg' }),
      'f1'
    )
  })

  it('senza `user_id` e senza sessione non carica niente, e la riga non riceve `pending://`', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null })
    const run = mutationFn<{ id: string; data: Record<string, unknown> }>(mutationKeys.createFood)

    await run({ id: 'f1', data: { name: 'Latte', image_url: 'pending://abc' } })

    expect(mocks.uploadFoodImage).not.toHaveBeenCalled()
    const [data] = mocks.createFood.mock.calls[0] as [Record<string, unknown>]
    expect(data.image_url).toBeNull()
  })
})
