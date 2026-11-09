// @vitest-environment jsdom
/**
 * Un upload fallito non si salva in silenzio (#114).
 *
 * Prima `resolveImageFile` inghiottiva l'errore e restituiva un ripiego —
 * `null` in creazione, la foto precedente in modifica — e la scrittura
 * partiva lo stesso: il dialogo si chiudeva e arrivava il toast verde, senza
 * la foto appena scelta. È il caso peggiore, perché l'utente crede di avere
 * una foto che non esiste.
 *
 * La regola viene da `entro-family/core/food-images.md`: se l'oggetto non
 * sale, la riga non si scrive e l'errore arriva a schermo con il form ancora
 * aperto e la foto ancora scelta. Il gemello su entro-mobile è
 * `writeWithImage` in `src/shared/lib/foodImages.ts`.
 */
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Food } from '@/lib/foods'
import type { FoodFormData } from '@/lib/validations/food.schemas'

const { mocks } = vi.hoisted(() => ({
  mocks: {
    isOnline: vi.fn(() => true),
    uploadFoodImage: vi.fn(),
    savePendingImage: vi.fn(),
    createMutate: vi.fn(),
    updateMutate: vi.fn(),
    createMutateAsync: vi.fn(),
    updateMutateAsync: vi.fn(),
    toastError: vi.fn(),
    toastInfo: vi.fn(),
  },
}))

vi.mock('sonner', () => ({
  toast: { error: mocks.toastError, info: mocks.toastInfo, success: vi.fn() },
}))
vi.mock('@tanstack/react-query', () => ({
  onlineManager: { isOnline: mocks.isOnline },
}))
vi.mock('../useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../useFoods', () => ({
  useCreateFood: () => ({
    mutate: mocks.createMutate,
    mutateAsync: mocks.createMutateAsync,
    isPending: false,
  }),
  useUpdateFood: () => ({
    mutate: mocks.updateMutate,
    mutateAsync: mocks.updateMutateAsync,
    isPending: false,
  }),
  useDeleteFood: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock('@/lib/storage', () => ({ uploadFoodImage: mocks.uploadFoodImage }))
vi.mock('@/lib/pendingImages', () => ({ savePendingImage: mocks.savePendingImage }))
vi.mock('@/lib/haptics', () => ({ triggerHaptic: vi.fn() }))
vi.mock('@/lib/safeLog', () => ({ logError: vi.fn() }))
vi.mock('@/lib/focusAfterRemoval', () => ({ restoreFocusTo: vi.fn() }))
vi.mock('../usePendingMutations', () => ({ useFoodHasPendingWrite: () => false }))

import { useFoodFormDialog } from '../useFoodFormDialog'

const PHOTO = new File(['x'], 'latte.jpg', { type: 'image/jpeg' })

function formData(image_url: FoodFormData['image_url']): FoodFormData {
  return {
    name: 'Latte',
    expiry_date: '2026-09-20',
    category_id: 'dairy',
    storage_location: 'fridge',
    quantity: null,
    quantity_unit: null,
    notes: null,
    image_url,
  } as FoodFormData
}

const EDITING = { id: 'f1', name: 'Latte', image_url: 'u1/1-vecchia.jpg' } as Food

beforeEach(() => {
  vi.clearAllMocks()
  mocks.isOnline.mockReturnValue(true)
  // A rete presente la scrittura si aspetta (#248, #255): di serie riesce.
  mocks.createMutateAsync.mockResolvedValue({ id: 'nuovo' })
  mocks.updateMutateAsync.mockResolvedValue({ id: 'f1' })
})

afterEach(() => {
  cleanup()
})

describe('creare con una foto', () => {
  it('upload riuscito: la riga parte col percorso caricato e il dialogo si chiude', async () => {
    mocks.uploadFoodImage.mockResolvedValue('u1/2-latte.jpg')
    const { result } = renderHook(() => useFoodFormDialog())
    act(() => result.current.setIsAddDialogOpen(true))

    await act(() => result.current.handleCreateFood(formData(PHOTO)))

    expect(mocks.createMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ image_url: 'u1/2-latte.jpg' }) })
    )
    expect(result.current.isAddDialogOpen).toBe(false)
  })

  it('upload fallito: nessuna riga, il dialogo resta aperto e l’errore arriva a schermo', async () => {
    mocks.uploadFoodImage.mockRejectedValue(new Error('new row violates row-level security policy'))
    const { result } = renderHook(() => useFoodFormDialog())
    act(() => result.current.setIsAddDialogOpen(true))

    await act(() => result.current.handleCreateFood(formData(PHOTO)))

    expect(mocks.createMutate).not.toHaveBeenCalled()
    expect(mocks.createMutateAsync).not.toHaveBeenCalled()
    expect(result.current.isAddDialogOpen).toBe(true)
    expect(mocks.toastError).toHaveBeenCalledTimes(1)
    // Il testo di Storage resta nei log: a schermo va una frase che l'utente
    // può usare.
    expect(mocks.toastError.mock.calls[0][0]).not.toMatch(/row-level|policy/)
  })

  it('offline, la foto che non si riesce a mettere in coda ferma il salvataggio allo stesso modo', async () => {
    // È lo stesso difetto sulla strada `pending://`: il ripiego era `null`, e
    // l'alimento si salvava offline senza la foto con il toast di conferma.
    mocks.isOnline.mockReturnValue(false)
    mocks.savePendingImage.mockRejectedValue(new DOMException('QuotaExceededError'))
    const { result } = renderHook(() => useFoodFormDialog())
    act(() => result.current.setIsAddDialogOpen(true))

    await act(() => result.current.handleCreateFood(formData(PHOTO)))

    expect(mocks.createMutate).not.toHaveBeenCalled()
    expect(result.current.isAddDialogOpen).toBe(true)
    expect(mocks.toastError).toHaveBeenCalledTimes(1)
    expect(mocks.toastInfo).not.toHaveBeenCalled()
  })

  it('senza foto non carica niente e salva', async () => {
    const { result } = renderHook(() => useFoodFormDialog())

    await act(() => result.current.handleCreateFood(formData(null)))

    expect(mocks.uploadFoodImage).not.toHaveBeenCalled()
    expect(mocks.createMutateAsync).toHaveBeenCalledTimes(1)
  })
})

describe('modificare con una foto nuova', () => {
  it('upload fallito: la foto di prima non viene riscritta come se nulla fosse, e il dialogo resta aperto', async () => {
    mocks.uploadFoodImage.mockRejectedValue(new Error('Payload too large'))
    const { result } = renderHook(() => useFoodFormDialog())
    act(() => result.current.handleEditClick(EDITING))

    await act(() => result.current.handleUpdateFood(formData(PHOTO)))

    expect(mocks.updateMutate).not.toHaveBeenCalled()
    expect(mocks.updateMutateAsync).not.toHaveBeenCalled()
    expect(result.current.editingFood).toBe(EDITING)
    expect(mocks.toastError).toHaveBeenCalledTimes(1)
  })

  it('upload riuscito: la riga parte col nuovo percorso e il dialogo si chiude', async () => {
    mocks.uploadFoodImage.mockResolvedValue('u1/3-nuova.jpg')
    const { result } = renderHook(() => useFoodFormDialog())
    act(() => result.current.handleEditClick(EDITING))

    await act(() => result.current.handleUpdateFood(formData(PHOTO)))

    expect(mocks.updateMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'f1', data: expect.objectContaining({ image_url: 'u1/3-nuova.jpg' }) })
    )
    expect(result.current.editingFood).toBeNull()
  })

  it('togliere la foto scrive `image_url: null`, non `undefined`', async () => {
    // `ImageUpload` consegna `null` quando l'utente toglie la foto, e prima qui
    // diventava `undefined`: `JSON.stringify` butta la chiave, quindi l'UPDATE
    // lasciava la riga col vecchio percorso — mentre `updateFood`, vedendo la
    // chiave nel payload, cancellava l'oggetto. Una riga che punta al nulla.
    const { result } = renderHook(() => useFoodFormDialog())
    act(() => result.current.handleEditClick(EDITING))

    await act(() => result.current.handleUpdateFood(formData(null)))

    const [{ data }] = mocks.updateMutateAsync.mock.calls[0] as [{ data: Record<string, unknown> }]
    expect(data.image_url).toBeNull()
    expect(JSON.parse(JSON.stringify(data))).toHaveProperty('image_url', null)
  })

  it('senza foto nuova non carica niente', async () => {
    const { result } = renderHook(() => useFoodFormDialog())
    act(() => result.current.handleEditClick(EDITING))

    await act(() => result.current.handleUpdateFood(formData('u1/1-vecchia.jpg')))

    expect(mocks.uploadFoodImage).not.toHaveBeenCalled()
    expect(mocks.updateMutateAsync).toHaveBeenCalledTimes(1)
  })
})

/**
 * A rete presente il form resta aperto fino all'esito della scrittura (#248
 * per la creazione, #255 per la modifica). Prima si chiudeva subito: se la
 * scrittura falliva senza essere trattenuta — la rete che cade con
 * `navigator.onLine` vero, o un rifiuto del server — i dati e il `File`
 * scelto se ne andavano con il form. Il form tiene tutto finché è montato, e
 * lo è finché il dialogo resta aperto.
 *
 * Il toast dell'errore lo mostra l'`onError` della mutazione, con il messaggio
 * della #244 (`useCreateFood.test.tsx`); l'oggetto caricato lo cancellano
 * `createFood` e `updateFood` (`foodsCreate.test.ts`, `foodsUpdateImage.test.ts`).
 * Qui si prova il dialogo.
 *
 * Offline resta come prima: la mutazione va in pausa e il suo Promise non si
 * risolve finché la rete non torna, quindi lì il dialogo si chiude subito.
 */
const networkFailure = () =>
  new Error('Non è stato possibile salvare l\'alimento. Riprova.', { cause: { status: 0 } })
const serverRejection = () =>
  new Error('Non è stato possibile salvare l\'alimento. Riprova.', { cause: { status: 403 } })

describe('creare a rete presente: il dialogo aspetta l’esito (#248)', () => {
  it('riuscita: il dialogo si chiude, senza il toast dell’offline', async () => {
    mocks.uploadFoodImage.mockResolvedValue('u1/2-latte.jpg')
    const { result } = renderHook(() => useFoodFormDialog())
    act(() => result.current.setIsAddDialogOpen(true))

    await act(() => result.current.handleCreateFood(formData(PHOTO)))

    expect(mocks.createMutateAsync).toHaveBeenCalledTimes(1)
    expect(mocks.createMutate).not.toHaveBeenCalled()
    expect(result.current.isAddDialogOpen).toBe(false)
    expect(mocks.toastInfo).not.toHaveBeenCalled()
  })

  it('prima dell’esito il dialogo è ancora aperto', async () => {
    let settle: (value: unknown) => void = () => {}
    mocks.createMutateAsync.mockReturnValue(new Promise((resolve) => { settle = resolve }))
    const { result } = renderHook(() => useFoodFormDialog())
    act(() => result.current.setIsAddDialogOpen(true))

    let submitted: Promise<void> = Promise.resolve()
    act(() => { submitted = result.current.handleCreateFood(formData(null)) })
    await act(async () => {})

    expect(mocks.createMutateAsync).toHaveBeenCalledTimes(1)
    expect(result.current.isAddDialogOpen).toBe(true)

    await act(async () => { settle({ id: 'nuovo' }); await submitted })
    expect(result.current.isAddDialogOpen).toBe(false)
  })

  it.each([
    ['per rete (status 0)', networkFailure],
    ['per rifiuto del server', serverRejection],
  ])('fallita %s: il dialogo resta aperto e non si ritenta da qui', async (_label, failure) => {
    mocks.uploadFoodImage.mockResolvedValue('u1/2-latte.jpg')
    mocks.createMutateAsync.mockRejectedValue(failure())
    const { result } = renderHook(() => useFoodFormDialog())
    act(() => result.current.setIsAddDialogOpen(true))

    // L'errore non esce dal gestore: il form lo aspetta con `await`, e un
    // rifiuto qui diventerebbe un errore non gestito.
    await act(() => result.current.handleCreateFood(formData(PHOTO)))

    expect(result.current.isAddDialogOpen).toBe(true)
    expect(mocks.createMutateAsync).toHaveBeenCalledTimes(1)
    expect(mocks.toastInfo).not.toHaveBeenCalled()
  })

  it('un secondo «Salva» rifà tutto, foto compresa', async () => {
    mocks.uploadFoodImage
      .mockResolvedValueOnce('u1/2-latte.jpg')
      .mockResolvedValueOnce('u1/3-latte.jpg')
    mocks.createMutateAsync.mockRejectedValueOnce(networkFailure())
    const { result } = renderHook(() => useFoodFormDialog())
    act(() => result.current.setIsAddDialogOpen(true))

    await act(() => result.current.handleCreateFood(formData(PHOTO)))
    await act(() => result.current.handleCreateFood(formData(PHOTO)))

    expect(mocks.uploadFoodImage).toHaveBeenCalledTimes(2)
    expect(mocks.createMutateAsync).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ image_url: 'u1/3-latte.jpg' }) })
    )
    expect(result.current.isAddDialogOpen).toBe(false)
  })

  it('a rete assente come prima: in coda, dialogo chiuso subito, toast dell’offline', async () => {
    mocks.isOnline.mockReturnValue(false)
    mocks.savePendingImage.mockResolvedValue('pending://abc')
    const { result } = renderHook(() => useFoodFormDialog())
    act(() => result.current.setIsAddDialogOpen(true))

    await act(() => result.current.handleCreateFood(formData(PHOTO)))

    expect(mocks.createMutate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ image_url: 'pending://abc' }) })
    )
    expect(mocks.createMutateAsync).not.toHaveBeenCalled()
    expect(result.current.isAddDialogOpen).toBe(false)
    expect(mocks.toastInfo).toHaveBeenCalledTimes(1)
  })
})

describe('modificare a rete presente: il dialogo aspetta l’esito (#255)', () => {
  it('riuscita: il dialogo si chiude', async () => {
    const { result } = renderHook(() => useFoodFormDialog())
    act(() => result.current.handleEditClick(EDITING))

    await act(() => result.current.handleUpdateFood(formData('u1/1-vecchia.jpg')))

    expect(mocks.updateMutateAsync).toHaveBeenCalledTimes(1)
    expect(result.current.editingFood).toBeNull()
    expect(mocks.toastInfo).not.toHaveBeenCalled()
  })

  it.each([
    ['per rete (status 0)', networkFailure],
    ['per rifiuto del server', serverRejection],
  ])('fallita %s: il dialogo resta aperto sull’alimento', async (_label, failure) => {
    mocks.uploadFoodImage.mockResolvedValue('u1/3-nuova.jpg')
    mocks.updateMutateAsync.mockRejectedValue(failure())
    const { result } = renderHook(() => useFoodFormDialog())
    act(() => result.current.handleEditClick(EDITING))

    await act(() => result.current.handleUpdateFood(formData(PHOTO)))

    expect(result.current.editingFood).toBe(EDITING)
    expect(mocks.toastInfo).not.toHaveBeenCalled()
  })

  it('a rete assente come prima: in coda, dialogo chiuso subito, toast dell’offline', async () => {
    mocks.isOnline.mockReturnValue(false)
    mocks.savePendingImage.mockResolvedValue('pending://def')
    const { result } = renderHook(() => useFoodFormDialog())
    act(() => result.current.handleEditClick(EDITING))

    await act(() => result.current.handleUpdateFood(formData(PHOTO)))

    expect(mocks.updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'f1', data: expect.objectContaining({ image_url: 'pending://def' }) })
    )
    expect(mocks.updateMutateAsync).not.toHaveBeenCalled()
    expect(result.current.editingFood).toBeNull()
    expect(mocks.toastInfo).toHaveBeenCalledTimes(1)
  })
})
