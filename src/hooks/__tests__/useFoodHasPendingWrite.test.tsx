// @vitest-environment jsdom
/**
 * Il blocco vale per l'alimento che ha già una scrittura in attesa, non per
 * tutti (#153). Prima la guardia era `mutation.isPending`, globale: una
 * rimozione in coda offline bloccava la rimozione di ogni altro alimento.
 */
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider, onlineManager, useMutation } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useFoodHasPendingWrite } from '../usePendingMutations'
import { mutationKeys } from '@/lib/mutationDefaults'

let queryClient: QueryClient

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  onlineManager.setOnline(false)
})

afterEach(() => {
  cleanup()
  queryClient.clear()
  onlineManager.setOnline(true)
})

function mount() {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return renderHook(
    () => ({
      remove: useMutation({ mutationKey: mutationKeys.deleteFood, mutationFn: async () => {} }),
      milk: useFoodHasPendingWrite('latte'),
      eggs: useFoodHasPendingWrite('uova'),
      nobody: useFoodHasPendingWrite(null),
    }),
    { wrapper },
  ).result
}

describe('useFoodHasPendingWrite', () => {
  it('una rimozione in coda offline su latte blocca latte e non uova', async () => {
    const result = mount()
    act(() => result.current.remove.mutate({ id: 'latte' } as never))

    await waitFor(() => expect(result.current.milk).toBe(true))
    expect(result.current.eggs).toBe(false)
    expect(result.current.nobody).toBe(false)
  })

  it('tornata la rete la scrittura parte, e il blocco cade', async () => {
    const result = mount()
    act(() => result.current.remove.mutate({ id: 'latte' } as never))
    await waitFor(() => expect(result.current.milk).toBe(true))

    act(() => onlineManager.setOnline(true))

    await waitFor(() => expect(result.current.milk).toBe(false))
  })
})
