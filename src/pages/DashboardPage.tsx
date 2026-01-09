import { useState, useMemo } from 'react'
import { Plus, ShoppingBasket, CalendarDays, AlertTriangle } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useFoods, useCategories, useCreateFood, useUpdateFood, useDeleteFood } from '../hooks/useFoods'
import { FoodCard } from '../components/foods/FoodCard'
import { FoodForm } from '../components/foods/FoodForm'
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
import type { Food, FoodInsert, FoodUpdate } from '@/lib/foods'
import type { FoodFormData } from '@/lib/validations/food.schemas'
import { differenceInDays } from 'date-fns'

/**
 * Dashboard Page - Home page for authenticated users with food management
 */
export function DashboardPage() {
  const { user } = useAuth()

  // Fetch data
  const { data: foods = [], isLoading: foodsLoading } = useFoods()
  const { data: categories = [] } = useCategories()

  // Mutations
  const createMutation = useCreateFood()
  const updateMutation = useUpdateFood()
  const deleteMutation = useDeleteFood()

  // Dialog states
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingFood, setEditingFood] = useState<Food | null>(null)
  const [deletingFood, setDeletingFood] = useState<Food | null>(null)

  // Calculate stats
  const stats = useMemo(() => {
    const now = new Date()
    const expiringSoon = foods.filter((food) => {
      const daysUntilExpiry = differenceInDays(new Date(food.expiry_date), now)
      return daysUntilExpiry >= 0 && daysUntilExpiry <= 7
    })
    const expired = foods.filter((food) => {
      const daysUntilExpiry = differenceInDays(new Date(food.expiry_date), now)
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
    const foodData: FoodInsert = {
      ...data,
      quantity: data.quantity ?? null,
      quantity_unit: data.quantity_unit ?? null,
      notes: data.notes ?? null,
      status: 'active',
      user_id: user!.id,
      image_url: null,
      barcode: null,
      consumed_at: null,
      deleted_at: null,
    }

    await createMutation.mutateAsync(foodData)
    setIsAddDialogOpen(false)
  }

  const handleUpdateFood = async (data: FoodFormData) => {
    if (!editingFood) return

    const foodData: FoodUpdate = {
      ...data,
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
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Benvenuto, {user?.email?.split('@')[0] || 'Utente'}!
          </h2>
          <p className="text-slate-600 mt-2">
            Gestisci le scadenze dei tuoi alimenti e riduci gli sprechi.
          </p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)} size="lg">
          <Plus className="h-5 w-5 mr-2" />
          Aggiungi Alimento
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alimenti Totali</CardTitle>
            <ShoppingBasket className="h-4 w-4 text-slate-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-slate-600 mt-1">
              {stats.total === 0 ? 'Nessun alimento ancora' : 'Nella tua dispensa'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Scadenza</CardTitle>
            <CalendarDays className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.expiringSoon}</div>
            <p className="text-xs text-slate-600 mt-1">
              Prossimi 7 giorni
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scaduti</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.expired}</div>
            <p className="text-xs text-slate-600 mt-1">
              Da rimuovere
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Foods Grid */}
      {foodsLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-slate-600">Caricamento...</div>
        </div>
      ) : foods.length === 0 ? (
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
      ) : (
        <div>
          <h3 className="text-xl font-semibold text-slate-900 mb-4">
            I Tuoi Alimenti ({foods.length})
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
    </div>
  )
}
