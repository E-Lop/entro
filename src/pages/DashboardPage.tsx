import { useState, useMemo, lazy, Suspense } from 'react'
import { FoodModals } from '../components/foods/FoodModals'
import { LIST_HEADING_ATTR } from '@/lib/focusAfterRemoval'
import { useSearchParams } from 'react-router-dom'
import { Plus, ShoppingBasket, X, List, Calendar } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useWelcomeToast } from '../hooks/useWelcomeToast'
import { useDocumentMeta } from '../hooks/useDocumentMeta'
import { useFoods, useCategories } from '../hooks/useFoods'
import { useFoodFormDialog } from '../hooks/useFoodFormDialog'
import { useDebounce } from '../hooks/useDebounce'
import { useSwipeHint } from '../hooks/useSwipeHint'
import { SwipeableCardProvider } from '../hooks/useSwipeableCardController'
import { useRealtimeFoods } from '../hooks/useRealtimeFoods'
import { FoodCard } from '../components/foods/FoodCard'
import { FoodFilters } from '../components/foods/FoodFilters'
import { InstructionCard } from '../components/foods/InstructionCard'
import { KofiButton } from '../components/ui/KofiButton'
import { NotificationPrompt } from '../components/pwa/NotificationPrompt'
import { DashboardStats } from '../components/foods/DashboardStats'

// Lazy load heavy components only shown on user interaction
const WeekView = lazy(() => import('../components/foods/WeekView').then(m => ({ default: m.WeekView })))
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import type { Food, FilterParams } from '@/lib/foods'
import { deriveDashboardData } from '@/lib/foodFilters'
import { parseFilterParams, buildSearchParams } from '@/lib/foodFilterParams'
import { cn } from '@/lib/utils'

/**
 * Dashboard Page - Home page for authenticated users with food management
 */
const INSTRUCTION_CARD_KEY = 'entro_hasSeenInstructionCard'

/**
 * Determine which empty state to show when there are no foods
 */
type EmptyStateType = 'filtered' | 'instruction' | 'no-foods'

function getEmptyStateType(activeFiltersCount: number, showInstructionCard: boolean): EmptyStateType {
  if (activeFiltersCount > 0) {
    return 'filtered'
  }
  if (showInstructionCard) {
    return 'instruction'
  }
  return 'no-foods'
}

export function DashboardPage() {
  useDocumentMeta('I miei alimenti')
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  // Show swipe hint on first load (mobile only)
  useSwipeHint()

  // Setup real-time synchronization for foods
  useRealtimeFoods()

  // Show welcome toast if user just accepted an invite
  useWelcomeToast()

  // Track instruction card visibility
  const [showInstructionCard, setShowInstructionCard] = useState(() => {
    return localStorage.getItem(INSTRUCTION_CARD_KEY) !== 'true'
  })

  // View mode from URL params
  const viewMode = (searchParams.get('view') as 'list' | 'calendar') || 'list'

  // Filtri letti dall'URL: la mappatura, e con essa la retrocompatibilità del
  // vecchio `?status=`, vive in @/lib/foodFilterParams.
  const filters = useMemo<FilterParams>(() => parseFilterParams(searchParams), [searchParams])

  // Debounce search to avoid excessive API calls
  const debouncedSearch = useDebounce(filters.search, 300)
  const debouncedFilters = useMemo<FilterParams>(() => {
    return {
      ...filters,
      search: debouncedSearch,
    }
  }, [filters, debouncedSearch])

  // Una sola query non filtrata: chiave di cache stabile, caricata a ogni visita
  // online → persistita e disponibile offline. Filtro/ordinamento/conteggi sono
  // derivati client-side dagli stessi dati (vedi @/lib/foodFilters).
  const { data: allFoods = [], isLoading: foodsLoading } = useFoods()

  const { foods, stats } = useMemo(
    () => deriveDashboardData(allFoods, debouncedFilters),
    [allFoods, debouncedFilters],
  )

  const { data: categories = [] } = useCategories()

  // Food CRUD dialogs and handlers
  const {
    isAddDialogOpen, setIsAddDialogOpen,
    editingFood, setEditingFood,
    deletingFood, setDeletingFood,
    handleCreateFood, handleUpdateFood, handleDeleteFood,
    deleteOpenerRef,
    handleEditClick, handleDeleteClick,
    isCreating, isUpdating, isDeleting,
  } = useFoodFormDialog()

  // Filters UI state - collapsed by default on mobile
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false)

  // Calculate active filters count (excluding default values)
  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (filters.category_id) count++
    if (filters.storage_location) count++
    if (filters.expiry && filters.expiry !== 'all') count++
    if (filters.search) count++
    // Don't count sort as active filter since it always has a value
    return count
  }, [filters])

  // Handlers for filter changes
  const handleFiltersChange = (newFilters: FilterParams) => {
    setSearchParams(buildSearchParams(newFilters))
  }

  const handleClearFilters = () => {
    setSearchParams({})
  }

  const handleToggleFilters = () => {
    setIsFiltersExpanded(!isFiltersExpanded)
  }

  const handleViewModeChange = (mode: 'list' | 'calendar') => {
    const params = new URLSearchParams(searchParams)
    params.set('view', mode)
    setSearchParams(params)
  }

  // Quick filter handlers for stats cards
  const handleQuickFilter = (expiry: 'all' | 'expiring_soon' | 'expired') => {
    // Si riparte da un URL nuovo: la card azzera gli altri filtri. `all` non
    // viene scritto, così l'URL torna pulito.
    setSearchParams(buildSearchParams({ expiry }))
    // Scroll to foods section on mobile
    window.scrollTo({ top: 400, behavior: 'smooth' })
  }

  // Get category for a food item
  const getCategoryForFood = (food: Food) => {
    return categories.find((cat) => cat.id === food.category_id)
  }

  const handleDismissInstructionCard = () => {
    localStorage.setItem(INSTRUCTION_CARD_KEY, 'true')
    setShowInstructionCard(false)
  }

  return (
    <div className="space-y-6 pb-20 sm:pb-6">
      {/* Welcome Section - Compact on Mobile */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Ciao, {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Utente'}!
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Gestisci le scadenze e riduci gli sprechi.
          </p>
        </div>
        {/* Add Food Button */}
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
      <DashboardStats stats={stats} currentExpiry={filters.expiry} onQuickFilter={handleQuickFilter} />

      {/* Notification Prompt */}
      <NotificationPrompt foodCount={stats.total} />

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
      {/* Ripiego del fuoco quando la card eliminata era l'ultima (entro#87).
          `tabIndex={-1}` la rende raggiungibile per via programmatica; il
          `focus:not-sr-only` è lo stesso trattamento del link «vai al
          contenuto» in AppLayout, e serve perché un'intestazione riservata
          agli screen reader lascerebbe senza indicatore visibile chi naviga
          da tastiera guardando lo schermo. */}
      <h2
        {...{ [LIST_HEADING_ATTR]: '' }}
        tabIndex={-1}
        className="sr-only focus:not-sr-only focus:mb-2 focus:inline-block focus:rounded-md focus:px-2 focus:py-1 focus:text-lg focus:font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
      >
        I tuoi alimenti
      </h2>
      {foodsLoading ? (
        <div className="flex items-center justify-center py-12" role="status" aria-live="polite">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin motion-reduce:animate-none rounded-full border-4 border-border border-t-primary" aria-hidden="true"></div>
            <div className="text-muted-foreground">Caricamento alimenti...</div>
          </div>
        </div>
      ) : foods.length === 0 ? (
        // Render appropriate empty state based on context
        (() => {
          const emptyStateType = getEmptyStateType(activeFiltersCount, showInstructionCard)

          switch (emptyStateType) {
            case 'filtered':
              return (
                <Card>
                  <CardContent className="py-12">
                    <div className="flex flex-col items-center justify-center text-center">
                      <ShoppingBasket className="h-16 w-16 text-muted-foreground/50 mb-4" />
                      <h3 className="text-lg font-semibold text-foreground mb-2">
                        Nessun risultato trovato
                      </h3>
                      <p className="text-sm text-muted-foreground max-w-sm mb-6">
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
              )

            case 'instruction':
              return (
                <div className="max-w-md mx-auto">
                  <InstructionCard onDismiss={handleDismissInstructionCard} />
                </div>
              )

            case 'no-foods':
              return (
                <Card>
                  <CardHeader>
                    <CardTitle>I Tuoi Alimenti</CardTitle>
                    <CardDescription>
                      Qui appariranno tutti gli alimenti che aggiungerai
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <ShoppingBasket className="h-16 w-16 text-muted-foreground/50 mb-4" />
                      <h3 className="text-lg font-semibold text-foreground mb-2">
                        Nessun alimento ancora
                      </h3>
                      <p className="text-sm text-muted-foreground max-w-sm mb-6">
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
          }
        })()
      ) : (
        <div>
          {/* View Mode Toggle */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2" role="group" aria-label="Modalità visualizzazione">
              <button
                onClick={() => handleViewModeChange('list')}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  viewMode === 'list'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
                aria-label="Visualizza come lista"
                aria-pressed={viewMode === 'list'}
              >
                <List className="h-4 w-4" aria-hidden="true" />
                <span className="font-medium">Lista</span>
                <span className="text-sm opacity-75">({foods.length})</span>
              </button>
              <button
                onClick={() => handleViewModeChange('calendar')}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  viewMode === 'calendar'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
                aria-label="Visualizza come calendario"
                aria-pressed={viewMode === 'calendar'}
              >
                <Calendar className="h-4 w-4" aria-hidden="true" />
                <span className="font-medium">Calendario</span>
              </button>
            </div>
            {activeFiltersCount > 0 && (
              <span className="text-sm text-muted-foreground">
                {foods.length} risultat{foods.length === 1 ? 'o' : 'i'} filtrat{foods.length === 1 ? 'o' : 'i'}
              </span>
            )}
          </div>

          {/* Conditional View Rendering */}
          {viewMode === 'calendar' ? (
            <Suspense fallback={
              <div className="flex items-center justify-center py-12" role="status" aria-label="Caricamento calendario">
                <div className="h-8 w-8 animate-spin motion-reduce:animate-none rounded-full border-4 border-border border-t-primary" aria-hidden="true"></div>
              </div>
            }>
              <WeekView
                foods={foods}
                onEdit={handleEditClick}
              />
            </Suspense>
          ) : (
            <SwipeableCardProvider>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {foods.map((food, index) => (
                  <FoodCard
                    key={food.id}
                    food={food}
                    category={getCategoryForFood(food)}
                    onEdit={handleEditClick}
                    onDelete={handleDeleteClick}
                    showHintAnimation={index === 0}
                  />
                ))}
              </div>
            </SwipeableCardProvider>
          )}
        </div>
      )}

      {/* Food Modals (Add, Edit, Delete) */}
      <FoodModals
        isAddDialogOpen={isAddDialogOpen}
        onAddDialogChange={setIsAddDialogOpen}
        onCreateFood={handleCreateFood}
        isCreating={isCreating}
        editingFood={editingFood}
        onEditDialogChange={() => setEditingFood(null)}
        onUpdateFood={handleUpdateFood}
        isUpdating={isUpdating}
        deletingFood={deletingFood}
        onDeleteDialogChange={() => setDeletingFood(null)}
        onDeleteFood={handleDeleteFood}
        deleteOpener={deleteOpenerRef}
        isDeleting={isDeleting}
      />

      {/* Ko-fi Support Button */}
      <KofiButton />

      {/* Floating Action Button (FAB) - Mobile Only */}
      <button
        onClick={() => setIsAddDialogOpen(true)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 active:scale-95 transition-[transform,background-color] duration-150 ease-[var(--ease-out-quart)] flex items-center justify-center sm:hidden"
        aria-label="Aggiungi alimento"
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  )
}
export default DashboardPage
