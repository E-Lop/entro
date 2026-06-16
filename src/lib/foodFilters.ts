// Filtro/ordinamento client-side degli alimenti, fonte unica @/lib/expiry.
// Replica la semantica del vecchio filtro server-side di getFoods, ma opera
// sui dati già in cache → funziona offline e resta coerente coi conteggi.
import type { Food, FilterParams } from '@/lib/foods'
import { getExpiryStatus, isExpiringSoon, isExpired } from '@/lib/expiry'

/** Applica categoria, posizione, ricerca (substring case-insensitive) e stato. */
export function filterFoods(foods: Food[], filters: FilterParams, now: Date = new Date()): Food[] {
  const search = filters.search?.trim().toLowerCase()
  return foods.filter((food) => {
    if (filters.category_id && food.category_id !== filters.category_id) return false
    if (filters.storage_location && food.storage_location !== filters.storage_location) return false
    if (search && !food.name.toLowerCase().includes(search)) return false
    if (filters.status && filters.status !== 'all') {
      const status = getExpiryStatus(food.expiry_date, now)
      if (filters.status === 'expired') return isExpired(status)
      if (filters.status === 'expiring_soon') return isExpiringSoon(status)
      if (filters.status === 'active') return !isExpired(status)
    }
    return true
  })
}

/** Ordina (copia) lato client: collazione italiana per `name`, ordinamento
 *  lessicografico per date/id ISO. Tutti i campi ordinabili sono `string`. */
export function sortFoods(
  foods: Food[],
  sortBy: FilterParams['sortBy'] = 'expiry_date',
  sortOrder: FilterParams['sortOrder'] = 'asc',
): Food[] {
  const dir = sortOrder === 'desc' ? -1 : 1
  return [...foods].sort((a, b) => {
    const av = a[sortBy]
    const bv = b[sortBy]
    const cmp = sortBy === 'name'
      ? av.localeCompare(bv, 'it', { sensitivity: 'base' })
      : av < bv ? -1 : av > bv ? 1 : 0
    return cmp * dir
  })
}

export interface DashboardData {
  foods: Food[]
  stats: { total: number; expiringSoon: number; expired: number }
}

/**
 * Deriva lista mostrata + conteggi card dalla stessa lista in cache.
 * I conteggi riflettono i filtri categoria/posizione/ricerca attivi (non lo stato);
 * la lista applica anche lo stato e l'ordinamento.
 */
export function deriveDashboardData(allFoods: Food[], filters: FilterParams, now: Date = new Date()): DashboardData {
  const scoped = filterFoods(allFoods, { ...filters, status: 'all' }, now)
  let expiringSoon = 0
  let expired = 0
  for (const food of scoped) {
    const status = getExpiryStatus(food.expiry_date, now)
    if (isExpiringSoon(status)) expiringSoon++
    if (isExpired(status)) expired++
  }
  const foods = sortFoods(filterFoods(scoped, { status: filters.status }, now), filters.sortBy, filters.sortOrder)
  return { foods, stats: { total: scoped.length, expiringSoon, expired } }
}
