import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { reloadDashboard } from '../dashboardReload'

/**
 * Cosa rilancia «Riprova» sulla dashboard (#210, gemella di entro-mobile#216).
 *
 * Alimenti e categorie sono due letture. Se all'apertura cadono entrambe,
 * rilanciare solo gli alimenti li riporta e lascia le categorie in errore
 * finché la schermata non viene rimontata: `refetchOnWindowFocus` è spento per
 * tutta l'app, e il rilancio al ritorno della rete non scatta se a essere
 * fermo era il server. Il client React Query è vero, perché il difetto sta in
 * ciò che React Query fa di una query in errore, non in una chiamata nostra.
 */
describe('reloadDashboard', () => {
  function watch(queryFn: () => Promise<unknown>, key: string) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const observer = new QueryObserver(client, { queryKey: [key], queryFn })
    const unsubscribe = observer.subscribe(() => {})
    return { observer, unsubscribe }
  }

  const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

  it('con le categorie fallite, rilancia gli alimenti e anche le categorie', async () => {
    const readFoods = vi.fn().mockRejectedValueOnce(new Error('server fermo')).mockResolvedValue([{ id: 'f1' }])
    const readCategories = vi.fn().mockRejectedValueOnce(new Error('server fermo')).mockResolvedValue([{ id: 'c1' }])
    const foods = watch(readFoods, 'foods')
    const categories = watch(readCategories, 'categories')
    await settle()
    expect(categories.observer.getCurrentResult().isError).toBe(true)

    await reloadDashboard(foods.observer.getCurrentResult(), categories.observer.getCurrentResult())
    await settle()

    expect(readFoods).toHaveBeenCalledTimes(2)
    expect(readCategories).toHaveBeenCalledTimes(2)
    expect(categories.observer.getCurrentResult().data).toEqual([{ id: 'c1' }])
    foods.unsubscribe()
    categories.unsubscribe()
  })

  it('con le categorie già caricate, rilancia solo gli alimenti', async () => {
    const readFoods = vi.fn().mockRejectedValueOnce(new Error('server fermo')).mockResolvedValue([{ id: 'f1' }])
    const readCategories = vi.fn().mockResolvedValue([{ id: 'c1' }])
    const foods = watch(readFoods, 'foods')
    const categories = watch(readCategories, 'categories')
    await settle()

    await reloadDashboard(foods.observer.getCurrentResult(), categories.observer.getCurrentResult())
    await settle()

    expect(readFoods).toHaveBeenCalledTimes(2)
    expect(readCategories).toHaveBeenCalledTimes(1)
    foods.unsubscribe()
    categories.unsubscribe()
  })

  it('con le categorie ancora in lettura e senza dati, le rilancia: se poi cadono nessun altro lo farebbe', async () => {
    // Il caso di chi tocca «Riprova» mentre il ritentativo delle categorie è
    // in volo: non sono ancora in errore, ma dati non ne hanno.
    const readFoods = vi.fn().mockResolvedValue([{ id: 'f1' }])
    let fail: (error: Error) => void = () => {}
    const readCategories = vi
      .fn()
      .mockImplementationOnce(() => new Promise((_resolve, reject) => (fail = reject)))
      .mockResolvedValue([{ id: 'c1' }])
    const foods = watch(readFoods, 'foods')
    const categories = watch(readCategories, 'categories')
    await settle()
    expect(categories.observer.getCurrentResult().isError).toBe(false)

    await reloadDashboard(foods.observer.getCurrentResult(), categories.observer.getCurrentResult())
    fail(new Error('server fermo'))
    await settle()

    expect(readCategories).toHaveBeenCalledTimes(2)
    expect(categories.observer.getCurrentResult().data).toEqual([{ id: 'c1' }])
    foods.unsubscribe()
    categories.unsubscribe()
  })

  it('se le categorie falliscono di nuovo, il rilancio degli alimenti arriva lo stesso in fondo', async () => {
    const readFoods = vi.fn().mockRejectedValueOnce(new Error('server fermo')).mockResolvedValue([{ id: 'f1' }])
    const readCategories = vi.fn().mockRejectedValue(new Error('server fermo'))
    const foods = watch(readFoods, 'foods')
    const categories = watch(readCategories, 'categories')
    await settle()

    await expect(
      reloadDashboard(foods.observer.getCurrentResult(), categories.observer.getCurrentResult()),
    ).resolves.toBeDefined()
    await settle()

    expect(foods.observer.getCurrentResult().data).toEqual([{ id: 'f1' }])
    foods.unsubscribe()
    categories.unsubscribe()
  })
})
