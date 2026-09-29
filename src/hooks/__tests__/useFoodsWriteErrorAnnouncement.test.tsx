// @vitest-environment jsdom
/**
 * Ogni scrittura sugli alimenti che fallisce annuncia l'errore allo screen
 * reader, oltre a mostrare il toast (#121): creazione, modifica, cambio di
 * stato e rimozione. Sono le quattro mutazioni con rollback.
 */
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { toastError, announce } = vi.hoisted(() => ({ toastError: vi.fn(), announce: vi.fn() }))

vi.mock('sonner', () => ({ toast: { error: toastError, success: vi.fn(), info: vi.fn() } }))
vi.mock('@/lib/writeErrorAnnouncer', () => ({ announceWriteError: announce }))
vi.mock('@/lib/foods', () => ({ getFoods: vi.fn(), getFoodById: vi.fn(), getCategories: vi.fn() }))
vi.mock('@/lib/mutationDefaults', () => ({
  mutationKeys: {
    createFood: ['createFood'],
    updateFood: ['updateFood'],
    deleteFood: ['deleteFood'],
    updateFoodStatus: ['updateFoodStatus'],
  },
}))

import { foodsKeys, useCreateFood, useDeleteFood, useUpdateFood, useUpdateFoodStatus } from '../useFoods'

const MESSAGE = 'Non è stato possibile salvare l\'alimento. Riprova.'
let queryClient: QueryClient

function mountHooks() {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return renderHook(
    () => ({ create: useCreateFood(), update: useUpdateFood(), status: useUpdateFoodStatus(), remove: useDeleteFood() }),
    { wrapper },
  ).result
}

beforeEach(() => {
  onlineManager.setOnline(true)
  queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  for (const key of ['createFood', 'updateFood', 'deleteFood', 'updateFoodStatus']) {
    queryClient.setMutationDefaults([key], { mutationFn: () => Promise.reject(new Error(MESSAGE)) })
  }
  queryClient.setQueryData(foodsKeys.list(), [{ id: 'latte', name: 'Latte', status: 'active' }])
})

afterEach(() => {
  cleanup()
  toastError.mockReset()
  announce.mockReset()
})

describe('le scritture fallite annunciano l\'errore', () => {
  it.each([
    ['creazione', (h: ReturnType<typeof mountHooks>['current']) => h.create.mutate({ data: { name: 'Uova' } as never, id: 'uova' })],
    ['modifica', (h: ReturnType<typeof mountHooks>['current']) => h.update.mutate({ id: 'latte', data: { name: 'Latte intero' } })],
    ['cambio di stato', (h: ReturnType<typeof mountHooks>['current']) => h.status.mutate({ id: 'latte', status: 'consumed' } as never)],
    ['rimozione', (h: ReturnType<typeof mountHooks>['current']) => h.remove.mutate({ id: 'latte' } as never)],
  ])('%s: toast e annuncio con lo stesso messaggio', async (_label, run) => {
    const hooks = mountHooks()
    act(() => run(hooks.current))

    await waitFor(() => expect(announce).toHaveBeenCalledWith(MESSAGE))
    expect(toastError).toHaveBeenCalledWith(MESSAGE)
  })
})
