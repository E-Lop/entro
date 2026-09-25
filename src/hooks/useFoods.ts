import { useQuery, useMutation, useQueryClient, onlineManager, type QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  getFoods,
  getFoodById,
  getCategories,
  type Food,
  type FoodInsert,
  type FoodUpdate,
  type FilterParams,
} from '@/lib/foods'
import { mutationKeys, type DeleteFoodVariables } from '@/lib/mutationDefaults'

/**
 * Le scritture sugli alimenti vanno al server in fila, nell'ordine in cui sono
 * state fatte (#141): `onMutate` parte subito, la chiamata aspetta la fine
 * della precedente. Serve quando due scritture toccano lo stesso alimento, per
 * esempio una modifica fatta offline a un alimento creato offline. Lo scope è
 * uno solo per tutti gli alimenti perché in TanStack Query 5 è un'opzione del
 * `useMutation`, non della singola chiamata a `mutate()`.
 */
const FOOD_WRITES_SCOPE = { id: 'food-writes' }

/**
 * Cosa ha cambiato una modifica ottimistica su un alimento: per ogni lista in
 * cache (e per il dettaglio), i valori di prima dei soli campi toccati.
 */
type FoodPatch = {
  id: string
  applied: Partial<Food>
  previous: [readonly unknown[], Partial<Food>][]
}

function pick(food: Food, keys: string[]): Partial<Food> {
  return Object.fromEntries(keys.map((k) => [k, food[k as keyof Food]])) as Partial<Food>
}

/** Applica `changes` all'alimento `id` in tutte le liste e nel dettaglio, ricordando i valori di prima. */
function patchFood(queryClient: QueryClient, id: string, changes: Partial<Food>): FoodPatch {
  const keys = Object.keys(changes)
  const previous: FoodPatch['previous'] = []
  for (const [queryKey, list] of queryClient.getQueriesData<Food[]>({ queryKey: foodsKeys.lists() })) {
    const current = list?.find((food) => food.id === id)
    if (!current) continue
    previous.push([queryKey, pick(current, keys)])
    queryClient.setQueryData<Food[]>(queryKey, list!.map((food) => (food.id === id ? { ...food, ...changes } : food)))
  }
  const detail = queryClient.getQueryData<Food>(foodsKeys.detail(id))
  if (detail) {
    previous.push([foodsKeys.detail(id), pick(detail, keys)])
    queryClient.setQueryData<Food>(foodsKeys.detail(id), { ...detail, ...changes })
  }
  return { id, applied: changes, previous }
}

/**
 * Annulla una modifica fallita, un campo alla volta: il valore di prima torna
 * solo se il campo ha ancora quello scritto da questa mutazione. Così non si
 * cancella una mutazione successiva sullo stesso alimento, né su un altro
 * (#141): prima si rimetteva una fotografia di tutte le liste.
 */
function revertFoodPatch(queryClient: QueryClient, patch: FoodPatch | undefined) {
  if (!patch) return
  const revert = (food: Food, previous: Partial<Food>): Food => {
    const out = { ...food }
    for (const [key, value] of Object.entries(previous)) {
      const k = key as keyof Food
      if (Object.is(food[k], patch.applied[k])) (out as Record<string, unknown>)[k] = value
    }
    return out
  }
  for (const [queryKey, previous] of patch.previous) {
    const data = queryClient.getQueryData<Food[] | Food>(queryKey)
    if (Array.isArray(data)) {
      queryClient.setQueryData<Food[]>(queryKey, data.map((food) => (food.id === patch.id ? revert(food, previous) : food)))
    } else if (data) {
      queryClient.setQueryData<Food>(queryKey, revert(data, previous))
    }
  }
}

/** Dove stava un alimento tolto, lista per lista, per rimetterlo al suo posto se la rimozione fallisce. */
type FoodRemoval = { id: string; positions: [readonly unknown[], number, Food, string | undefined][] }

function removeFood(queryClient: QueryClient, id: string): FoodRemoval {
  const positions: FoodRemoval['positions'] = []
  for (const [queryKey, list] of queryClient.getQueriesData<Food[]>({ queryKey: foodsKeys.lists() })) {
    const index = list?.findIndex((food) => food.id === id) ?? -1
    if (index < 0) continue
    positions.push([queryKey, index, list![index], list![index + 1]?.id])
    queryClient.setQueryData<Food[]>(queryKey, list!.filter((food) => food.id !== id))
  }
  return { id, positions }
}

/**
 * Rimette l'alimento dov'era, in ogni lista in cui non è già tornato: prima
 * dell'alimento che lo seguiva, se c'è ancora, in fondo se era l'ultimo,
 * altrimenti allo stesso indice.
 * Con più rimozioni fallite l'indice da solo non basta, perché ognuna l'ha
 * preso su una lista già accorciata dalle altre.
 */
function restoreRemovedFood(queryClient: QueryClient, removal: FoodRemoval | undefined) {
  if (!removal) return
  for (const [queryKey, index, food, nextId] of removal.positions) {
    const list = queryClient.getQueryData<Food[]>(queryKey)
    if (!list || list.some((f) => f.id === removal.id)) continue
    const nextAt = nextId === undefined ? list.length : list.findIndex((f) => f.id === nextId)
    const at = nextAt >= 0 ? nextAt : Math.min(index, list.length)
    queryClient.setQueryData<Food[]>(queryKey, [...list.slice(0, at), food, ...list.slice(at)])
  }
}

function onlineToast(message: string) {
  if (onlineManager.isOnline()) {
    toast.success(message)
  }
}

/**
 * Query keys for React Query cache management
 */
export const foodsKeys = {
  all: ['foods'] as const,
  lists: () => [...foodsKeys.all, 'list'] as const,
  list: (filters?: FilterParams) => [...foodsKeys.lists(), filters || {}] as const,
  details: () => [...foodsKeys.all, 'detail'] as const,
  detail: (id: string) => [...foodsKeys.details(), id] as const,
}

export const categoriesKeys = {
  all: ['categories'] as const,
}

/**
 * Fetch all categories
 */
export function useCategories() {
  return useQuery({
    queryKey: categoriesKeys.all,
    queryFn: async () => {
      const { categories, error } = await getCategories()
      if (error) throw error
      return categories
    },
    staleTime: 1000 * 60 * 60, // Categories are relatively static (1 hour)
  })
}

/**
 * Fetch all foods for current user with optional filters
 */
export function useFoods(filters?: FilterParams) {
  return useQuery({
    queryKey: foodsKeys.list(filters),
    queryFn: async () => {
      const { foods, error } = await getFoods(filters)
      if (error) throw error
      return foods
    },
  })
}

/**
 * Fetch a single food by ID
 */
export function useFoodById(id: string | undefined) {
  return useQuery({
    queryKey: foodsKeys.detail(id || ''),
    queryFn: async () => {
      const { food, error } = await getFoodById(id!)
      if (error) throw error
      return food
    },
    enabled: !!id,
  })
}

/**
 * Create a new food item.
 * Generates a client-side UUID so the item appears in the cache immediately
 * (optimistic update) and works offline.
 *
 * Note: mutationFn is provided by registerMutationDefaults() so that
 * paused mutations can resume after a page reload.
 */
export function useCreateFood() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: mutationKeys.createFood,
    scope: FOOD_WRITES_SCOPE,
    onMutate: async (variables: { data: FoodInsert; id: string }) => {
      await queryClient.cancelQueries({ queryKey: foodsKeys.lists() })

      const optimisticFood: Food = {
        id: variables.id,
        name: variables.data.name,
        expiry_date: variables.data.expiry_date,
        category_id: variables.data.category_id ?? null,
        storage_location: variables.data.storage_location ?? 'fridge',
        quantity: variables.data.quantity ?? null,
        quantity_unit: variables.data.quantity_unit ?? null,
        notes: variables.data.notes ?? null,
        image_url: variables.data.image_url ?? null,
        barcode: variables.data.barcode ?? null,
        status: variables.data.status ?? 'active',
        consumed_at: null,
        deleted_at: null,
        user_id: '',
        list_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      queryClient.setQueriesData<Food[]>(
        { queryKey: foodsKeys.lists() },
        (old) => old ? [optimisticFood, ...old] : [optimisticFood],
      )

      return { optimisticFood }
    },
    onSuccess: () => onlineToast('Alimento aggiunto con successo'),
    onError: (error: Error, variables: { data: FoodInsert; id: string }) => {
      // La card ottimistica si toglie qui, e non si lascia alla rilettura di
      // `onSettled`: se fallisce anche quella — il server irraggiungibile, che
      // è quando una creazione fallisce — in lista resterebbe un alimento che
      // non esiste (#139). Per id, come fanno anche le altre tre mutazioni
      // dalla #141: con più mutazioni in volo una fotografia delle liste
      // cancellerebbe le card delle altre.
      queryClient.setQueriesData<Food[]>(
        { queryKey: foodsKeys.lists() },
        (old) => old?.filter((food) => food.id !== variables.id),
      )
      toast.error(error.message || 'Errore nella creazione dell\'alimento')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: foodsKeys.lists() })
    },
  })
}

/**
 * Update an existing food item.
 *
 * Note: mutationFn is provided by registerMutationDefaults().
 */
export function useUpdateFood() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: mutationKeys.updateFood,
    scope: FOOD_WRITES_SCOPE,
    onMutate: async ({ id, data }: { id: string; data: FoodUpdate }) => {
      await queryClient.cancelQueries({ queryKey: foodsKeys.lists() })
      await queryClient.cancelQueries({ queryKey: foodsKeys.detail(id) })

      return { patch: patchFood(queryClient, id, data as Partial<Food>) }
    },
    onSuccess: () => onlineToast('Alimento aggiornato con successo'),
    onError: (error: Error, { id }: { id: string; data: FoodUpdate }, context) => {
      revertFoodPatch(queryClient, context?.patch)
      queryClient.invalidateQueries({ queryKey: foodsKeys.detail(id) })
      toast.error(error.message || 'Errore nell\'aggiornamento dell\'alimento')
    },
    onSettled: (_data, _error, { id }: { id: string; data: FoodUpdate }) => {
      queryClient.invalidateQueries({ queryKey: foodsKeys.lists() })
      queryClient.invalidateQueries({ queryKey: foodsKeys.detail(id) })
    },
  })
}

/**
 * Toglie un alimento dalla lista, registrandone l'esito quando c'è.
 *
 * Note: mutationFn is provided by registerMutationDefaults().
 */
export function useDeleteFood() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: mutationKeys.deleteFood,
    scope: FOOD_WRITES_SCOPE,
    onMutate: async ({ id }: DeleteFoodVariables) => {
      await queryClient.cancelQueries({ queryKey: foodsKeys.lists() })

      return { removal: removeFood(queryClient, id) }
    },
    onError: (error: Error, _variables: DeleteFoodVariables, context) => {
      restoreRemovedFood(queryClient, context?.removal)
      toast.error(error.message || 'Errore nell\'eliminazione dell\'alimento')
    },
    onSuccess: () => onlineToast('Alimento eliminato con successo'),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: foodsKeys.lists() })
    },
  })
}

/**
 * Update food status (consumed, expired, wasted).
 *
 * Note: mutationFn is provided by registerMutationDefaults().
 */
export function useUpdateFoodStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: mutationKeys.updateFoodStatus,
    scope: FOOD_WRITES_SCOPE,
    onMutate: async ({ id, status }: { id: string; status: Food['status'] }) => {
      await queryClient.cancelQueries({ queryKey: foodsKeys.lists() })
      await queryClient.cancelQueries({ queryKey: foodsKeys.detail(id) })

      const statusUpdate: Partial<Food> = { status }
      if (status === 'consumed') {
        statusUpdate.consumed_at = new Date().toISOString()
      }

      return { patch: patchFood(queryClient, id, statusUpdate) }
    },
    onSuccess: () => onlineToast('Stato aggiornato con successo'),
    onError: (error: Error, { id }: { id: string; status: Food['status'] }, context) => {
      revertFoodPatch(queryClient, context?.patch)
      queryClient.invalidateQueries({ queryKey: foodsKeys.detail(id) })
      toast.error(error.message || 'Errore nell\'aggiornamento dello stato')
    },
    onSettled: (_data, _error, { id }: { id: string; status: Food['status'] }) => {
      queryClient.invalidateQueries({ queryKey: foodsKeys.lists() })
      queryClient.invalidateQueries({ queryKey: foodsKeys.detail(id) })
    },
  })
}
