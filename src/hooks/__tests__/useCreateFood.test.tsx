// @vitest-environment jsdom
/**
 * Una creazione che fallisce toglie la propria card ottimistica (#139).
 *
 * Prima la toglieva solo la rilettura che segue ogni mutazione: se falliva
 * anche quella — il server irraggiungibile, cioè il caso più probabile in cui
 * una creazione fallisce — in lista restava un alimento che non esiste. Qui le
 * liste non hanno una `queryFn`, quindi la rilettura non risponde mai: la card
 * deve sparire lo stesso.
 *
 * Si toglie **per id** e non ripristinando una fotografia delle liste: con più
 * creazioni in volo la fotografia della prima cancellerebbe la card della
 * seconda. Dalla #141 fanno così anche le altre tre mutazioni
 * (`useFoodsConcurrentRollback.test.tsx`).
 */
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Food, FoodInsert } from '@/lib/foods'

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }))

vi.mock('sonner', () => ({ toast: { error: toastError, success: vi.fn() } }))
vi.mock('@/lib/foods', () => ({ getFoods: vi.fn(), getFoodById: vi.fn(), getCategories: vi.fn() }))
vi.mock('@/lib/mutationDefaults', () => ({
  mutationKeys: {
    createFood: ['createFood'],
    updateFood: ['updateFood'],
    deleteFood: ['deleteFood'],
    updateFoodStatus: ['updateFoodStatus'],
  },
}))

import { foodsKeys, useCreateFood } from '../useFoods'

type Variables = { data: FoodInsert; id: string }

const existing = { id: 'latte', name: 'Latte' } as Food
const ALL = foodsKeys.list()
const FRIDGE = foodsKeys.list({ storage_location: 'fridge' } as never)

const insert = (name: string): FoodInsert =>
  ({ name, expiry_date: '2026-12-31', user_id: 'u1' }) as FoodInsert

let queryClient: QueryClient
/** Chi decide l'esito di ogni creazione, per id. */
let outcomes: Map<string, { resolve: (food: Food) => void; reject: (error: Error) => void }>

const idsIn = (key: readonly unknown[]) =>
  (queryClient.getQueryData<Food[]>(key) ?? []).map((food) => food.id)

function mountHook() {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return renderHook(() => useCreateFood(), { wrapper })
}

beforeEach(() => {
  vi.clearAllMocks()
  onlineManager.setOnline(true)
  outcomes = new Map()
  queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  queryClient.setMutationDefaults(['createFood'], {
    mutationFn: ({ id }: Variables) =>
      new Promise<Food>((resolve, reject) => outcomes.set(id, { resolve, reject })),
  })
  queryClient.setQueryData(ALL, [existing])
  queryClient.setQueryData(FRIDGE, [existing])
})

afterEach(() => {
  cleanup()
  queryClient.clear()
  onlineManager.setOnline(true)
})

/**
 * Una creazione offline va in pausa con la sua card, e riparte quando torna la
 * rete: è lì che può fallire dopo aver mostrato la card, ed è lì che vale la
 * #139.
 */
async function queuedOfflineThenOnline(
  result: { current: ReturnType<typeof useCreateFood> },
  variables: Variables,
) {
  act(() => result.current.mutate(variables))
  await waitFor(() => expect(result.current.isPaused).toBe(true))
}

describe('useCreateFood offline: la card resta finché la scrittura non ha un esito (#139)', () => {
  beforeEach(() => {
    onlineManager.setOnline(false)
  })

  it('una creazione in pausa perché si è offline tiene la sua card', async () => {
    // Offline la mutazione va in pausa e riparte da sola: non è un errore, e la
    // card è la sola traccia che l'utente ha di ciò che ha appena inserito.
    const { result } = mountHook()

    await queuedOfflineThenOnline(result, { data: insert('Yogurt'), id: 'yogurt' })

    expect(idsIn(ALL)).toEqual(['yogurt', 'latte'])
    expect(toastError).not.toHaveBeenCalled()
  })

  it('ripartita e rifiutata, toglie la sua card da tutte le liste, senza aspettare la rilettura', async () => {
    const { result } = mountHook()
    await queuedOfflineThenOnline(result, { data: insert('Yogurt'), id: 'yogurt' })
    expect(idsIn(FRIDGE)).toEqual(['yogurt', 'latte'])

    act(() => onlineManager.setOnline(true))
    await waitFor(() => expect(outcomes.has('yogurt')).toBe(true))
    await act(async () => outcomes.get('yogurt')?.reject(new Error('Non è stato possibile salvare')))

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Non è stato possibile salvare'))
    expect(idsIn(ALL)).toEqual(['latte'])
    expect(idsIn(FRIDGE)).toEqual(['latte'])
  })

  it('con due creazioni in coda, la prima che fallisce non porta via la card della seconda', async () => {
    const first = mountHook()
    const second = mountHook()
    await queuedOfflineThenOnline(first.result, { data: insert('Yogurt'), id: 'yogurt' })
    await queuedOfflineThenOnline(second.result, { data: insert('Burro'), id: 'burro' })
    expect(idsIn(ALL)).toEqual(['burro', 'yogurt', 'latte'])

    act(() => onlineManager.setOnline(true))
    await waitFor(() => expect(outcomes.has('yogurt')).toBe(true))
    await act(async () => outcomes.get('yogurt')?.reject(new Error('rifiutata')))

    await waitFor(() => expect(toastError).toHaveBeenCalled())
    expect(idsIn(ALL)).toEqual(['burro', 'latte'])
  })
})

/**
 * A rete presente il form aspetta l'esito (#248): una card che compare dietro
 * al dialogo e sparisce se la scrittura fallisce non dice niente di vero.
 * L'alimento entra in lista quando il server l'ha scritto, con la riga che il
 * server restituisce.
 */
describe('useCreateFood a rete presente: niente card prima dell’esito (#248)', () => {
  it('in volo la lista non cambia', async () => {
    const { result } = mountHook()

    act(() => result.current.mutate({ data: insert('Yogurt'), id: 'yogurt' }))
    await waitFor(() => expect(outcomes.has('yogurt')).toBe(true))

    expect(idsIn(ALL)).toEqual(['latte'])
    expect(idsIn(FRIDGE)).toEqual(['latte'])
  })

  it('riuscita: in lista entra la riga del server', async () => {
    const { result } = mountHook()

    act(() => result.current.mutate({ data: insert('Yogurt'), id: 'yogurt' }))
    await waitFor(() => expect(outcomes.has('yogurt')).toBe(true))
    const saved = { id: 'yogurt', name: 'Yogurt', list_id: 'lista-1' } as Food
    await act(async () => outcomes.get('yogurt')?.resolve(saved))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(idsIn(ALL)).toEqual(['yogurt', 'latte'])
    expect(queryClient.getQueryData<Food[]>(ALL)?.[0]).toEqual(saved)
    expect(toastError).not.toHaveBeenCalled()
  })

  it('fallita: la lista non è mai cambiata, e l’errore arriva a schermo', async () => {
    const { result } = mountHook()

    act(() => result.current.mutate({ data: insert('Yogurt'), id: 'yogurt' }))
    await waitFor(() => expect(outcomes.has('yogurt')).toBe(true))
    await act(async () =>
      outcomes.get('yogurt')?.reject(new Error('Non è stato possibile salvare l\'alimento. Riprova.'))
    )

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith('Non è stato possibile salvare l\'alimento. Riprova.')
    )
    expect(idsIn(ALL)).toEqual(['latte'])
  })
})
