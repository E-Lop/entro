import { Search, X, SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-react'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Button } from '../ui/button'
import { Card, CardContent } from '../ui/card'
import type { FilterParams } from '@/lib/foods'
import type { Category } from '@/lib/foods'

export interface FoodFiltersProps {
  filters: FilterParams
  onFiltersChange: (filters: FilterParams) => void
  categories: Category[]
  activeFiltersCount: number
  onClearFilters: () => void
  isExpanded: boolean
  onToggle: () => void
}

/**
 * FoodFilters Component - Advanced filtering and search controls for foods
 *
 * Features:
 * - Collapsible on mobile for better UX
 * - Search by name (debounced in parent component)
 * - Filter by category
 * - Filter by storage location
 * - Filter by status (active, expired, expiring soon)
 * - Sort by various fields
 * - Active filters badge
 * - Clear all filters button
 */
export function FoodFilters({
  filters,
  onFiltersChange,
  categories,
  activeFiltersCount,
  onClearFilters,
  isExpanded,
  onToggle,
}: FoodFiltersProps) {
  const handleSearchChange = (value: string) => {
    onFiltersChange({ ...filters, search: value })
  }

  const handleCategoryChange = (value: string) => {
    onFiltersChange({ ...filters, category_id: value || undefined })
  }

  const handleStorageChange = (value: string) => {
    onFiltersChange({
      ...filters,
      storage_location: value ? (value as 'fridge' | 'freezer' | 'pantry') : undefined,
    })
  }

  const handleStatusChange = (value: string) => {
    onFiltersChange({
      ...filters,
      status: value ? (value as 'all' | 'active' | 'expired' | 'expiring_soon') : 'all',
    })
  }

  const handleSortChange = (value: string) => {
    const [sortBy, sortOrder] = value.split('-') as [
      FilterParams['sortBy'],
      FilterParams['sortOrder']
    ]
    onFiltersChange({ ...filters, sortBy, sortOrder })
  }

  const currentSortValue = `${filters.sortBy || 'expiry_date'}-${filters.sortOrder || 'asc'}`

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Header with Toggle Button */}
          <div className="flex w-full items-center justify-between">
            <button
              onClick={onToggle}
              className="flex flex-1 items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md p-1 -m-1"
              aria-expanded={isExpanded}
              aria-label="Espandi o comprimi filtri"
            >
              <SlidersHorizontal className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <h3 className="font-semibold text-foreground">Filtri e Ricerca</h3>
              {activeFiltersCount > 0 && (
                <span className="inline-flex items-center justify-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                  {activeFiltersCount}
                </span>
              )}
              {isExpanded ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground ml-auto" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground ml-auto" aria-hidden="true" />
              )}
            </button>
            {activeFiltersCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearFilters}
                className="text-muted-foreground hover:text-foreground ml-2"
                aria-label="Cancella tutti i filtri"
              >
                <X className="h-4 w-4 mr-1" aria-hidden="true" />
                <span className="hidden sm:inline">Cancella</span>
              </Button>
            )}
          </div>

          {/* Collapsible Content */}
          {isExpanded && (
            <div className="space-y-4 pt-4 border-t">
              {/* Search Bar */}
              <div className="space-y-2">
                <Label htmlFor="search">Cerca per nome</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
                  <Input
                    id="search"
                    type="text"
                    placeholder="Cerca alimenti..."
                    value={filters.search || ''}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Filters Grid */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* Category Filter */}
                <div className="space-y-2">
                  <Label htmlFor="category">Categoria</Label>
                  <select
                    id="category"
                    value={filters.category_id || ''}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="">Tutte le categorie</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name_it}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Storage Location Filter */}
                <div className="space-y-2">
                  <Label htmlFor="storage">Posizione</Label>
                  <select
                    id="storage"
                    value={filters.storage_location || ''}
                    onChange={(e) => handleStorageChange(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="">Tutte le posizioni</option>
                    <option value="fridge">🧊 Frigo</option>
                    <option value="freezer">❄️ Freezer</option>
                    <option value="pantry">🏠 Dispensa</option>
                  </select>
                </div>

                {/* Status Filter */}
                <div className="space-y-2">
                  <Label htmlFor="status">Stato</Label>
                  <select
                    id="status"
                    value={filters.status || 'all'}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="all">Tutti</option>
                    <option value="active">✅ Attivi</option>
                    <option value="expiring_soon">⏰ In scadenza (7gg)</option>
                    <option value="expired">❌ Scaduti</option>
                  </select>
                </div>

                {/* Sort */}
                <div className="space-y-2">
                  <Label htmlFor="sort">Ordina per</Label>
                  <select
                    id="sort"
                    value={currentSortValue}
                    onChange={(e) => handleSortChange(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="expiry_date-asc">📅 Scadenza (prima i prossimi)</option>
                    <option value="expiry_date-desc">📅 Scadenza (prima i lontani)</option>
                    <option value="name-asc">🔤 Nome (A-Z)</option>
                    <option value="name-desc">🔤 Nome (Z-A)</option>
                    <option value="created_at-desc">🆕 Aggiunti recentemente</option>
                    <option value="created_at-asc">🕐 Aggiunti per primi</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
