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
 * Si toglie **per id** e non ripristinando una fotografia delle liste, come
 * fanno le altre tre mutazioni: con più creazioni in volo la fotografia della
 * prima cancellerebbe la card della seconda.
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

describe('useCreateFood', () => {
  it('una creazione rifiutata toglie la sua card da tutte le liste, senza aspettare la rilettura', async () => {
    const { result } = mountHook()

    act(() => result.current.mutate({ data: insert('Yogurt'), id: 'yogurt' }))
    await waitFor(() => expect(idsIn(ALL)).toEqual(['yogurt', 'latte']))
    expect(idsIn(FRIDGE)).toEqual(['yogurt', 'latte'])

    await act(async () => outcomes.get('yogurt')?.reject(new Error('Non è stato possibile salvare')))

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Non è stato possibile salvare'))
    expect(idsIn(ALL)).toEqual(['latte'])
    expect(idsIn(FRIDGE)).toEqual(['latte'])
  })

  it('con due creazioni in volo, la prima che fallisce non porta via la card della seconda', async () => {
    const first = mountHook()
    const second = mountHook()

    act(() => first.result.current.mutate({ data: insert('Yogurt'), id: 'yogurt' }))
    await waitFor(() => expect(idsIn(ALL)).toContain('yogurt'))
    act(() => second.result.current.mutate({ data: insert('Burro'), id: 'burro' }))
    await waitFor(() => expect(idsIn(ALL)).toEqual(['burro', 'yogurt', 'latte']))

    await act(async () => outcomes.get('yogurt')?.reject(new Error('rifiutata')))

    await waitFor(() => expect(toastError).toHaveBeenCalled())
    expect(idsIn(ALL)).toEqual(['burro', 'latte'])
  })

  it('una creazione riuscita lascia la card in lista', async () => {
    const { result } = mountHook()

    act(() => result.current.mutate({ data: insert('Yogurt'), id: 'yogurt' }))
    await waitFor(() => expect(idsIn(ALL)).toContain('yogurt'))

    await act(async () => outcomes.get('yogurt')?.resolve({ id: 'yogurt', name: 'Yogurt' } as Food))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(idsIn(ALL)).toEqual(['yogurt', 'latte'])
    expect(toastError).not.toHaveBeenCalled()
  })

  // Offline la mutazione va in pausa e riparte da sola: non è un errore, e la
  // card è la sola traccia che l'utente ha di ciò che ha appena inserito.
  it('una creazione in pausa perché si è offline tiene la sua card', async () => {
    onlineManager.setOnline(false)
    const { result } = mountHook()

    act(() => result.current.mutate({ data: insert('Yogurt'), id: 'yogurt' }))

    await waitFor(() => expect(result.current.isPaused).toBe(true))
    expect(idsIn(ALL)).toEqual(['yogurt', 'latte'])
    expect(toastError).not.toHaveBeenCalled()
  })
})
