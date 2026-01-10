import { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, ShoppingBasket, CalendarDays, AlertTriangle, X } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useFoods, useCategories, useCreateFood, useUpdateFood, useDeleteFood } from '../hooks/useFoods'
import { useDebounce } from '../hooks/useDebounce'
import { FoodCard } from '../components/foods/FoodCard'
import { FoodForm } from '../components/foods/FoodForm'
import { FoodFilters } from '../components/foods/FoodFilters'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog'
import type { Food, FoodInsert, FoodUpdate, FilterParams } from '@/lib/foods'
import type { FoodFormData } from '@/lib/validations/food.schemas'
import { differenceInDays } from 'date-fns'

/**
 * Dashboard Page - Home page for authenticated users with food management
 */
export function DashboardPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  // Parse filters from URL query params
  const filters = useMemo<FilterParams>(() => {
    return {
      category_id: searchParams.get('category') || undefined,
      storage_location: (searchParams.get('storage') as FilterParams['storage_location']) || undefined,
      status: (searchParams.get('status') as FilterParams['status']) || 'all',
      search: searchParams.get('search') || undefined,
      sortBy: (searchParams.get('sortBy') as FilterParams['sortBy']) || 'expiry_date',
      sortOrder: (searchParams.get('sortOrder') as FilterParams['sortOrder']) || 'asc',
    }
  }, [searchParams])

  // Debounce search to avoid excessive API calls
  const debouncedSearch = useDebounce(filters.search, 300)
  const debouncedFilters = useMemo<FilterParams>(() => {
    return {
      ...filters,
      search: debouncedSearch,
    }
  }, [filters, debouncedSearch])

  // Fetch data with filters
  const { data: foods = [], isLoading: foodsLoading } = useFoods(debouncedFilters)
  const { data: categories = [] } = useCategories()

  // Mutations
  const createMutation = useCreateFood()
  const updateMutation = useUpdateFood()
  const deleteMutation = useDeleteFood()

  // Dialog states
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingFood, setEditingFood] = useState<Food | null>(null)
  const [deletingFood, setDeletingFood] = useState<Food | null>(null)

  // Filters UI state - collapsed by default on mobile
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false)

  // Calculate active filters count (excluding default values)
  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (filters.category_id) count++
    if (filters.storage_location) count++
    if (filters.status && filters.status !== 'all') count++
    if (filters.search) count++
    // Don't count sort as active filter since it always has a value
    return count
  }, [filters])

  // Handlers for filter changes
  const handleFiltersChange = (newFilters: FilterParams) => {
    const params = new URLSearchParams()

    if (newFilters.category_id) params.set('category', newFilters.category_id)
    if (newFilters.storage_location) params.set('storage', newFilters.storage_location)
    if (newFilters.status && newFilters.status !== 'all') params.set('status', newFilters.status)
    if (newFilters.search) params.set('search', newFilters.search)
    if (newFilters.sortBy) params.set('sortBy', newFilters.sortBy)
    if (newFilters.sortOrder) params.set('sortOrder', newFilters.sortOrder)

    setSearchParams(params)
  }

  const handleClearFilters = () => {
    setSearchParams({})
  }

  const handleToggleFilters = () => {
    setIsFiltersExpanded(!isFiltersExpanded)
  }

  // Quick filter handlers for stats cards
  const handleQuickFilter = (status: 'all' | 'expiring_soon' | 'expired') => {
    if (status === 'all') {
      // Clear all filters to show everything
      setSearchParams({})
    } else {
      // Apply status filter
      const params = new URLSearchParams()
      params.set('status', status)
      setSearchParams(params)
    }
    // Scroll to foods section on mobile
    window.scrollTo({ top: 400, behavior: 'smooth' })
  }

  // Calculate stats
  // FIX: Normalize dates to midnight to avoid time-of-day calculation issues
  const stats = useMemo(() => {
    // Normalize now to midnight for accurate calendar day difference
    const now = new Date()
    now.setHours(0, 0, 0, 0)

    const expiringSoon = foods.filter((food) => {
      const expiryDate = new Date(food.expiry_date)
      expiryDate.setHours(0, 0, 0, 0)
      const daysUntilExpiry = differenceInDays(expiryDate, now)
      return daysUntilExpiry >= 0 && daysUntilExpiry <= 7
    })
    const expired = foods.filter((food) => {
      const expiryDate = new Date(food.expiry_date)
      expiryDate.setHours(0, 0, 0, 0)
      const daysUntilExpiry = differenceInDays(expiryDate, now)
      return daysUntilExpiry < 0
    })

    return {
      total: foods.length,
      expiringSoon: expiringSoon.length,
      expired: expired.length,
    }
  }, [foods])

  // Handlers
  const handleCreateFood = async (data: FoodFormData) => {
    // Upload image if File is selected
    let imagePath: string | null = null
    if (data.image_url instanceof File) {
      try {
        const { uploadFoodImage } = await import('@/lib/storage')
        imagePath = await uploadFoodImage(data.image_url, user!.id)
      } catch (error) {
        console.error('Image upload failed:', error)
        // Continue without image rather than failing the whole operation
      }
    } else if (typeof data.image_url === 'string') {
      imagePath = data.image_url
    }

    const foodData: FoodInsert = {
      ...data,
      quantity: data.quantity ?? null,
      quantity_unit: data.quantity_unit ?? null,
      notes: data.notes ?? null,
      image_url: imagePath,
      status: 'active',
      user_id: user!.id,
      barcode: null,
      consumed_at: null,
      deleted_at: null,
    }

    await createMutation.mutateAsync(foodData)
    setIsAddDialogOpen(false)
  }

  const handleUpdateFood = async (data: FoodFormData) => {
    if (!editingFood) return

    // Upload image if File is selected
    let imagePath: string | null | undefined
    if (data.image_url instanceof File) {
      try {
        const { uploadFoodImage } = await import('@/lib/storage')
        imagePath = await uploadFoodImage(data.image_url, user!.id)
      } catch (error) {
        console.error('Image upload failed:', error)
        // Keep existing image on upload failure
        imagePath = editingFood.image_url
      }
    } else {
      // Keep string path or null
      imagePath = data.image_url ?? undefined
    }

    // Exclude image_url from spread since we handle it separately
    const { image_url: _, ...dataWithoutImage } = data

    const foodData: FoodUpdate = {
      ...dataWithoutImage,
      image_url: imagePath,
    }

    await updateMutation.mutateAsync({ id: editingFood.id, data: foodData })
    setEditingFood(null)
  }

  const handleDeleteFood = async () => {
    if (!deletingFood) return

    await deleteMutation.mutateAsync(deletingFood.id)
    setDeletingFood(null)
  }

  const handleEditClick = (food: Food) => {
    setEditingFood(food)
  }

  const handleDeleteClick = (food: Food) => {
    setDeletingFood(food)
  }

  // Get category for a food item
  const getCategoryForFood = (food: Food) => {
    return categories.find((cat) => cat.id === food.category_id)
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Welcome Section - Compact on Mobile */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Ciao, {user?.email?.split('@')[0] || 'Utente'}!
          </h2>
          <p className="text-sm sm:text-base text-slate-600 mt-1">
            Gestisci le scadenze e riduci gli sprechi.
          </p>
        </div>
        {/* Desktop Button */}
        <Button
          onClick={() => setIsAddDialogOpen(true)}
          size="lg"
          className="hidden sm:flex"
        >
          <Plus className="h-5 w-5 mr-2" />
          Alimento
        </Button>
      </div>

      {/* Quick Stats - Compact Mobile Grid */}
      <div className="grid grid-cols-3 gap-3">
        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${
            !filters.status || filters.status === 'all' ? 'ring-2 ring-blue-500' : ''
          }`}
          onClick={() => handleQuickFilter('all')}
        >
          <CardContent className="p-4 flex flex-col items-center text-center">
            <ShoppingBasket className="h-6 w-6 text-slate-600 mb-2" />
            <div className="text-2xl font-bold mb-1">{stats.total}</div>
            <p className="text-xs text-slate-600 leading-tight">Totali</p>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${
            filters.status === 'expiring_soon' ? 'ring-2 ring-orange-500' : ''
          }`}
          onClick={() => handleQuickFilter('expiring_soon')}
        >
          <CardContent className="p-4 flex flex-col items-center text-center">
            <CalendarDays className="h-6 w-6 text-orange-600 mb-2" />
            <div className="text-2xl font-bold mb-1">{stats.expiringSoon}</div>
            <p className="text-xs text-slate-600 leading-tight">In scadenza</p>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${
            filters.status === 'expired' ? 'ring-2 ring-red-500' : ''
          }`}
          onClick={() => handleQuickFilter('expired')}
        >
          <CardContent className="p-4 flex flex-col items-center text-center">
            <AlertTriangle className="h-6 w-6 text-red-600 mb-2" />
            <div className="text-2xl font-bold mb-1">{stats.expired}</div>
            <p className="text-xs text-slate-600 leading-tight">Scaduti</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search - Collapsible */}
      <FoodFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        categories={categories}
        activeFiltersCount={activeFiltersCount}
        onClearFilters={handleClearFilters}
        isExpanded={isFiltersExpanded}
        onToggle={handleToggleFilters}
      />

      {/* Foods Grid */}
      {foodsLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600"></div>
            <div className="text-slate-600">Caricamento alimenti...</div>
          </div>
        </div>
      ) : foods.length === 0 ? (
        activeFiltersCount > 0 ? (
          // Empty state for filtered results
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center justify-center text-center">
                <ShoppingBasket className="h-16 w-16 text-slate-300 mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  Nessun risultato trovato
                </h3>
                <p className="text-sm text-slate-600 max-w-sm mb-6">
                  Non ci sono alimenti che corrispondono ai filtri selezionati.
                  Prova a modificare i criteri di ricerca o cancella i filtri.
                </p>
                <Button onClick={handleClearFilters} variant="outline">
                  <X className="h-4 w-4 mr-2" />
                  Cancella tutti i filtri
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          // Empty state for no foods at all
          <Card>
            <CardHeader>
              <CardTitle>I Tuoi Alimenti</CardTitle>
              <CardDescription>
                Qui appariranno tutti gli alimenti che aggiungerai
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ShoppingBasket className="h-16 w-16 text-slate-300 mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  Nessun alimento ancora
                </h3>
                <p className="text-sm text-slate-600 max-w-sm mb-6">
                  Inizia ad aggiungere gli alimenti dalla tua dispensa, frigo o freezer
                  per tenere traccia delle scadenze.
                </p>
                <Button onClick={() => setIsAddDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Aggiungi il primo alimento
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      ) : (
        <div>
          <h3 className="text-xl font-semibold text-slate-900 mb-4">
            {activeFiltersCount > 0 ? `Risultati filtrati (${foods.length})` : `I Tuoi Alimenti (${foods.length})`}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {foods.map((food) => (
              <FoodCard
                key={food.id}
                food={food}
                category={getCategoryForFood(food)}
                onEdit={handleEditClick}
                onDelete={handleDeleteClick}
              />
            ))}
          </div>
        </div>
      )}

      {/* Add Food Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Aggiungi Nuovo Alimento</DialogTitle>
            <DialogDescription>
              Inserisci le informazioni dell'alimento da aggiungere
            </DialogDescription>
          </DialogHeader>
          <FoodForm
            mode="create"
            onSubmit={handleCreateFood}
            onCancel={() => setIsAddDialogOpen(false)}
            isSubmitting={createMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Food Dialog */}
      <Dialog open={!!editingFood} onOpenChange={(open) => !open && setEditingFood(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifica Alimento</DialogTitle>
            <DialogDescription>
              Aggiorna le informazioni dell'alimento
            </DialogDescription>
          </DialogHeader>
          {editingFood && (
            <FoodForm
              mode="edit"
              initialData={editingFood}
              onSubmit={handleUpdateFood}
              onCancel={() => setEditingFood(null)}
              isSubmitting={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingFood} onOpenChange={(open) => !open && setDeletingFood(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma Eliminazione</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare "{deletingFood?.name}"? Questa azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteFood}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Eliminazione...' : 'Elimina'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Floating Action Button (FAB) - Mobile Only */}
      <button
        onClick={() => setIsAddDialogOpen(true)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-green-600 text-white shadow-lg hover:bg-green-700 active:scale-95 transition-all flex items-center justify-center sm:hidden"
        aria-label="Aggiungi alimento"
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  )
}
