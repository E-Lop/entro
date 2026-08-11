// Mappatura fra i parametri d'URL della dashboard e FilterParams.
//
// Estratta dalla pagina perché contiene una promessa verso l'esterno: il
// vecchio parametro `?status=` sta in link salvati e condivisi, e va
// continuato ad accettare in lettura anche ora che il nome interno è `expiry`.
// Una promessa del genere va provata, e provarla dentro un `useMemo` della
// dashboard vorrebbe dire montare l'intera pagina per verificare una
// traduzione di stringhe.
import type { FilterParams } from '@/lib/foods'

type ExpiryFilter = NonNullable<FilterParams['expiry']>

const EXPIRY_VALUES: readonly ExpiryFilter[] = [
  'all',
  'not_expired',
  'expiring_soon',
  'expired',
]

/**
 * Vecchio vocabolario del parametro `?status=` → nuovo.
 *
 * L'unica traduzione vera è `active` → `not_expired`: nel vecchio nome
 * significava «non scaduto», che è cosa diversa dall'`active` del ciclo di
 * vita («non ancora concluso»). Si conserva il significato, non la parola.
 */
const LEGACY_EXPIRY: Readonly<Record<string, ExpiryFilter>> = {
  all: 'all',
  active: 'not_expired',
  expiring_soon: 'expiring_soon',
  expired: 'expired',
}

const STORAGE_VALUES: readonly NonNullable<FilterParams['storage_location']>[] = [
  'fridge',
  'freezer',
  'pantry',
]

const SORT_BY_VALUES: readonly NonNullable<FilterParams['sortBy']>[] = [
  'expiry_date',
  'name',
  'created_at',
  'category_id',
]

/** Restituisce il valore solo se appartiene al vocabolario, altrimenti niente. */
function pick<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  return allowed.find((candidate) => candidate === value)
}

/** Il nuovo nome vince; il vecchio resta come ripiego per i link già in giro. */
function readExpiry(params: URLSearchParams): ExpiryFilter {
  const current = pick(params.get('expiry'), EXPIRY_VALUES)
  if (current) return current

  const legacy = params.get('status')
  if (legacy !== null && legacy in LEGACY_EXPIRY) return LEGACY_EXPIRY[legacy]

  return 'all'
}

export function parseFilterParams(params: URLSearchParams): FilterParams {
  return {
    category_id: params.get('category') || undefined,
    storage_location: pick(params.get('storage'), STORAGE_VALUES),
    expiry: readExpiry(params),
    search: params.get('search') || undefined,
    sortBy: pick(params.get('sortBy'), SORT_BY_VALUES) ?? 'expiry_date',
    sortOrder: params.get('sortOrder') === 'desc' ? 'desc' : 'asc',
  }
}

export function buildSearchParams(filters: FilterParams): URLSearchParams {
  const params = new URLSearchParams()

  if (filters.category_id) params.set('category', filters.category_id)
  if (filters.storage_location) params.set('storage', filters.storage_location)
  // `all` è il valore di riposo: scriverlo sporcherebbe l'URL senza dire nulla.
  if (filters.expiry && filters.expiry !== 'all') params.set('expiry', filters.expiry)
  if (filters.search) params.set('search', filters.search)
  if (filters.sortBy) params.set('sortBy', filters.sortBy)
  if (filters.sortOrder) params.set('sortOrder', filters.sortOrder)

  return params
}
