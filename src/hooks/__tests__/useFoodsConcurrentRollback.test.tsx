// @vitest-environment jsdom
/**
 * Una mutazione fallita annulla solo ciò che ha toccato lei (#141).
 *
 * Modifica, cambio di stato e rimozione rimettevano, in caso d'errore, una
 * fotografia di tutte le liste presa prima del proprio aggiornamento
 * ottimistico. Con più mutazioni in volo quella fotografia cancellava anche gli
 * aggiornamenti delle altre. Qui le liste non hanno una `queryFn`: la rilettura
 * che segue ogni mutazione non risponde mai, che è il caso in cui il difetto
 * restava a schermo.
 *
 * E le scritture sugli alimenti passano in fila: `onMutate` parte subito, ma le
 * chiamate al server una alla volta, nell'ordine in cui sono state fatte.
 */
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Food } from '@/lib/foods'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock('@/lib/foods', () => ({ getFoods: vi.fn(), getFoodById: vi.fn(), getCategories: vi.fn() }))
vi.mock('@/lib/mutationDefaults', () => ({
  mutationKeys: {
    createFood: ['createFood'],
    updateFood: ['updateFood'],
    deleteFood: ['deleteFood'],
    updateFoodStatus: ['updateFoodStatus'],
  },
}))

import { foodsKeys, useDeleteFood, useUpdateFood, useUpdateFoodStatus } from '../useFoods'

const ALL = foodsKeys.list()
const FRIDGE = foodsKeys.list({ storage_location: 'fridge' } as never)

const food = (id: string, name: string): Food =>
  ({ id, name, status: 'active', consumed_at: null, notes: null }) as Food

let queryClient: QueryClient
/** Ogni chiamata al server, nell'ordine in cui parte, con chi ne decide l'esito. */
let calls: { key: string; id: string; resolve: () => void; reject: (e: Error) => void }[]

function register(key: string) {
  queryClient.setMutationDefaults([key], {
    mutationFn: ({ id }: { id: string }) =>
      new Promise<Food>((resolve, reject) => {
        calls.push({ key, id, resolve: () => resolve(food(id, 'server')), reject })
      }),
  })
}

function mountHooks() {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return renderHook(
    () => ({ update: useUpdateFood(), status: useUpdateFoodStatus(), remove: useDeleteFood() }),
    { wrapper },
  ).result
}

const inList = (key: readonly unknown[]) => queryClient.getQueryData<Food[]>(key) ?? []
const byId = (key: readonly unknown[], id: string) => inList(key).find((f) => f.id === id)

/** Fa partire la chiamata al server numero `n` (contando da 0) e la decide. */
async function settle(n: number, outcome: 'ok' | 'fail') {
  await waitFor(() => expect(calls.length).toBeGreaterThan(n))
  await act(async () => {
    if (outcome === 'ok') calls[n].resolve()
    else calls[n].reject(new Error('rete'))
  })
}

beforeEach(() => {
  onlineManager.setOnline(true)
  calls = []
  queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  for (const key of ['updateFood', 'deleteFood', 'updateFoodStatus']) register(key)
  queryClient.setQueryData(ALL, [food('latte', 'Latte'), food('uova', 'Uova'), food('pane', 'Pane')])
  queryClient.setQueryData(FRIDGE, [food('latte', 'Latte'), food('uova', 'Uova')])
})

afterEach(() => {
  cleanup()
  queryClient.clear()
})

describe('mutazioni in volo insieme', () => {
  it('una modifica fallita non riporta indietro la rimozione riuscita di un altro alimento', async () => {
    const hooks = mountHooks()
    act(() => {
      hooks.current.update.mutate({ id: 'latte', data: { name: 'Latte intero' } })
      hooks.current.remove.mutate({ id: 'uova' })
    })

    await settle(0, 'fail') // la modifica di latte
    await settle(1, 'ok') // la rimozione di uova

    expect(byId(ALL, 'latte')?.name).toBe('Latte')
    expect(byId(ALL, 'uova')).toBeUndefined()
    expect(byId(FRIDGE, 'uova')).toBeUndefined()
  })

  it('se falliscono due rimozioni tornano tutte e due, al loro posto', async () => {
    const hooks = mountHooks()
    act(() => {
      hooks.current.remove.mutate({ id: 'latte' })
      hooks.current.remove.mutate({ id: 'uova' })
    })

    await settle(0, 'fail')
    await settle(1, 'fail')

    expect(inList(ALL).map((f) => f.id)).toEqual(['latte', 'uova', 'pane'])
    expect(inList(FRIDGE).map((f) => f.id)).toEqual(['latte', 'uova'])
  })

  it('sullo stesso alimento annulla solo i campi suoi: lo stato cambiato da un\'altra resta', async () => {
    const hooks = mountHooks()
    act(() => {
      hooks.current.update.mutate({ id: 'latte', data: { name: 'Latte intero' } })
      hooks.current.status.mutate({ id: 'latte', status: 'consumed' })
    })

    await settle(0, 'fail')
    await settle(1, 'ok')

    expect(byId(ALL, 'latte')?.name).toBe('Latte')
    expect(byId(ALL, 'latte')?.status).toBe('consumed')
  })

  it('non annulla un campo che una mutazione successiva ha già riscritto', async () => {
    const hooks = mountHooks()
    act(() => {
      hooks.current.update.mutate({ id: 'latte', data: { name: 'Latte intero' } })
      hooks.current.update.mutate({ id: 'latte', data: { name: 'Latte scremato' } })
    })

    await settle(0, 'fail')

    expect(byId(ALL, 'latte')?.name).toBe('Latte scremato')
  })

  it('le chiamate al server partono in fila: la seconda aspetta la fine della prima', async () => {
    const hooks = mountHooks()
    act(() => {
      hooks.current.update.mutate({ id: 'latte', data: { name: 'Latte intero' } })
      hooks.current.remove.mutate({ id: 'uova' })
    })

    // Le due modifiche ottimistiche ci sono già entrambe.
    await waitFor(() => expect(byId(ALL, 'uova')).toBeUndefined())
    expect(byId(ALL, 'latte')?.name).toBe('Latte intero')

    await waitFor(() => expect(calls).toHaveLength(1))
    await new Promise((r) => setTimeout(r, 50))
    expect(calls).toHaveLength(1)

    await settle(0, 'ok')
    await waitFor(() => expect(calls).toHaveLength(2))
    expect(calls.map((c) => c.id)).toEqual(['latte', 'uova'])
  })
})
