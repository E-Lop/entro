import { ShoppingBasket, CalendarDays, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FilterParams } from '@/lib/foods'

interface DashboardStatsProps {
  stats: { total: number; expiringSoon: number; expired: number }
  currentStatus: FilterParams['status']
  onQuickFilter: (status: 'all' | 'expiring_soon' | 'expired') => void
}

export function DashboardStats({ stats, currentStatus, onQuickFilter }: DashboardStatsProps) {
  return (
    <div className="grid grid-cols-3 gap-3" role="group" aria-label="Statistiche rapide">
      <button
        onClick={() => onQuickFilter('all')}
        className={cn(
          "text-left transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg border bg-card text-card-foreground shadow",
          !currentStatus || currentStatus === 'all' ? 'ring-2 ring-blue-500' : ''
        )}
        aria-label={`Mostra tutti gli alimenti (${stats.total})`}
        aria-pressed={!currentStatus || currentStatus === 'all'}
      >
        <div className="p-4 flex flex-col items-center text-center">
          <ShoppingBasket className="h-6 w-6 text-muted-foreground mb-2" aria-hidden="true" />
          <div className="text-2xl font-bold mb-1">{stats.total}</div>
          <p className="text-xs text-muted-foreground leading-tight">Totali</p>
        </div>
      </button>

      <button
        onClick={() => onQuickFilter('expiring_soon')}
        className={cn(
          "text-left transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg border bg-card text-card-foreground shadow",
          currentStatus === 'expiring_soon' ? 'ring-2 ring-orange-500' : ''
        )}
        aria-label={`Mostra alimenti in scadenza (${stats.expiringSoon})`}
        aria-pressed={currentStatus === 'expiring_soon'}
      >
        <div className="p-4 flex flex-col items-center text-center">
          <CalendarDays className="h-6 w-6 text-orange-600 mb-2" aria-hidden="true" />
          <div className="text-2xl font-bold mb-1">{stats.expiringSoon}</div>
          <p className="text-xs text-muted-foreground leading-tight">In scadenza</p>
        </div>
      </button>

      <button
        onClick={() => onQuickFilter('expired')}
        className={cn(
          "text-left transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg border bg-card text-card-foreground shadow",
          currentStatus === 'expired' ? 'ring-2 ring-red-500' : ''
        )}
        aria-label={`Mostra alimenti scaduti (${stats.expired})`}
        aria-pressed={currentStatus === 'expired'}
      >
        <div className="p-4 flex flex-col items-center text-center">
          <AlertTriangle className="h-6 w-6 text-red-600 mb-2" aria-hidden="true" />
          <div className="text-2xl font-bold mb-1">{stats.expired}</div>
          <p className="text-xs text-muted-foreground leading-tight">Scaduti</p>
        </div>
      </button>
    </div>
  )
}
