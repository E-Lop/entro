import { Link } from 'react-router-dom'
import { ShoppingBasket, CalendarDays, Settings } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'

/**
 * Dashboard Page - Home page for authenticated users
 */
export function DashboardPage() {
  const { user } = useAuth()

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">
          Benvenuto, {user?.email?.split('@')[0] || 'Utente'}!
        </h2>
        <p className="text-slate-600 mt-2">
          Gestisci le scadenze dei tuoi alimenti e riduci gli sprechi.
        </p>
      </div>

      {/* Quick Stats / Placeholder Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alimenti Totali</CardTitle>
            <ShoppingBasket className="h-4 w-4 text-slate-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-slate-600 mt-1">
              Nessun alimento ancora
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Scadenza</CardTitle>
            <CalendarDays className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-slate-600 mt-1">
              Prossimi 7 giorni
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categorie</CardTitle>
            <Settings className="h-4 w-4 text-slate-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">11</div>
            <p className="text-xs text-slate-600 mt-1">
              Categorie disponibili
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Card */}
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
            <div className="text-xs text-slate-500">
              Prossimamente: Aggiungi alimenti, scansiona barcode, visualizza statistiche
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Connection Link */}
      <div className="text-center">
        <Link
          to="/test-connection"
          className="text-sm text-primary hover:underline"
        >
          Verifica connessione database →
        </Link>
      </div>
    </div>
  )
}
