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
