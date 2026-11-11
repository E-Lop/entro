// @vitest-environment jsdom
/**
 * La pulizia di quando si perde l'accesso a una lista (#240, #256).
 *
 * `conventions/local-data-when-access-ends.md` del bundle, Regola 2, colonna
 * «Lista lasciata o tolti»: spariscono la cache delle query in memoria (con le
 * scritture in coda), quella su disco e quella delle foto, con **una funzione
 * sola** chiamata da tutti i momenti. Se una cancellazione fallisce, l'uscita
 * avviene lo stesso.
 *
 * Il client React Query è quello vero dell'app: il difetto della #256 sta in
 * ciò che React Query mostra dopo la pulizia, con alimenti letti un minuto
 * prima, cioè dentro lo `staleTime` di cinque minuti, quando nessuna lettura
 * parte da sola.
 */
import { createElement, type ReactNode } from 'react'
import { QueryClientProvider, useQuery } from '@tanstack/react-query'
import { render, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { clearPersistedCache, clearSignedImageCaches } = vi.hoisted(() => ({
  clearPersistedCache: vi.fn(),
  clearSignedImageCaches: vi.fn(),
}))

vi.mock('../queryPersister', () => ({ clearPersistedCache }))
vi.mock('../signedImageCache', () => ({ clearSignedImageCaches }))

import { queryClient } from '../queryClient'
import { clearListData } from '../listDataCleanup'

const FOODS_KEY = ['foods', 'list', {}]
const OLD_LIST = [{ id: 'f-vecchia', name: 'Yogurt della lista di prima' }]
const NEW_LIST = [{ id: 'f-nuova', name: 'Pane della lista di adesso' }]

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: queryClient }, children)

/** La dashboard, ridotta a ciò che conta: la query degli alimenti montata. */
function mountFoods(readFoods: () => Promise<unknown>) {
  return renderHook(() => useQuery({ queryKey: FOODS_KEY, queryFn: readFoods }), { wrapper })
}

beforeEach(() => {
  clearPersistedCache.mockResolvedValue(undefined)
  clearSignedImageCaches.mockResolvedValue(undefined)
})

afterEach(() => {
  queryClient.clear()
  vi.clearAllMocks()
})

describe('clearListData', () => {
  it('alimenti della lista di prima letti un minuto fa: dopo la pulizia non restano né in cache né a schermo, e si rileggono', async () => {
    queryClient.setQueryData(FOODS_KEY, OLD_LIST, { updatedAt: Date.now() - 60_000 })
    const readFoods = vi.fn().mockResolvedValue(NEW_LIST)
    const { result } = mountFoods(readFoods)
    // Dentro lo staleTime la lettura non parte: è il caso della #256.
    expect(result.current.data).toEqual(OLD_LIST)
    expect(readFoods).not.toHaveBeenCalled()

    await clearListData()

    expect(queryClient.getQueryData(FOODS_KEY)).not.toEqual(OLD_LIST)
    await waitFor(() => expect(result.current.data).toEqual(NEW_LIST))
    expect(readFoods).toHaveBeenCalledTimes(1)
  })

  it('le card della lista di prima non chiedono di firmare le loro foto: si smontano prima che si rilegga', async () => {
    // Trovata nel browser, sulla prima versione della #240: il reset rileggeva
    // subito le query montate, la card era ancora a schermo, e la richiesta di
    // firma partiva per una foto non più dell'utente. Il server la rifiutava, ma
    // la query restava nel client persistito con il percorso della foto.
    const PHOTO = 'utente-di-prima/yogurt.jpg'
    queryClient.setQueryData(FOODS_KEY, [{ id: 'f-vecchia', photo: PHOTO }], { updatedAt: Date.now() - 60_000 })
    queryClient.setQueryData(['signed-url', PHOTO], 'https://firmato/vecchio', { updatedAt: Date.now() - 60_000 })
    const readFoods = vi.fn().mockResolvedValue([])
    const sign = vi.fn().mockResolvedValue(null)

    function Photo({ path }: { path: string }) {
      useQuery({ queryKey: ['signed-url', path], queryFn: () => sign(path) })
      return null
    }
    function Dashboard() {
      const foods = useQuery({ queryKey: FOODS_KEY, queryFn: readFoods })
      return createElement(
        'div',
        null,
        ((foods.data ?? []) as { id: string; photo: string }[]).map((food) =>
          createElement(Photo, { key: food.id, path: food.photo })
        )
      )
    }
    render(createElement(QueryClientProvider, { client: queryClient }, createElement(Dashboard)))
    expect(sign).not.toHaveBeenCalled()

    await clearListData()

    await waitFor(() => expect(readFoods).toHaveBeenCalledTimes(1))
    expect(sign).not.toHaveBeenCalled()
    expect(queryClient.getQueryCache().find({ queryKey: ['signed-url', PHOTO] })).toBeUndefined()
  })

  it('le query non montate perdono i dati della lista di prima', async () => {
    queryClient.setQueryData(['categories'], [{ id: 'c1' }])

    await clearListData()

    expect(queryClient.getQueryData(['categories'])).toBeUndefined()
  })

  it('porta via le scritture in coda: non partirebbero più per una lista che non è sua', async () => {
    queryClient.getMutationCache().build(queryClient, { mutationFn: async () => 'scritta' })
    expect(queryClient.getMutationCache().getAll()).toHaveLength(1)

    await clearListData()

    expect(queryClient.getMutationCache().getAll()).toHaveLength(0)
  })

  it('svuota la cache persistita e quella delle foto', async () => {
    await clearListData()

    expect(clearPersistedCache).toHaveBeenCalledTimes(1)
    expect(clearSignedImageCaches).toHaveBeenCalled()
  })

  it('svuota le foto una seconda volta: una richiesta già partita può riscrivere la voce dopo la prima', async () => {
    await clearListData()

    expect(clearSignedImageCaches).toHaveBeenCalledTimes(2)
  })

  it('non lancia se una cancellazione fallisce, e prova lo stesso le altre', async () => {
    clearPersistedCache.mockRejectedValue(new Error('IndexedDB bloccato'))
    clearSignedImageCaches.mockRejectedValue(new Error('Cache bloccata'))
    queryClient.setQueryData(['categories'], [{ id: 'c1' }])

    await expect(clearListData()).resolves.toBeUndefined()

    expect(clearPersistedCache).toHaveBeenCalled()
    expect(clearSignedImageCaches).toHaveBeenCalled()
    expect(queryClient.getQueryData(['categories'])).toBeUndefined()
  })
})
