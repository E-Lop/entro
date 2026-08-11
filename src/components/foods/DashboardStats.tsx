import { ShoppingBasket, CalendarDays, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FilterParams } from '@/lib/foods'

interface DashboardStatsProps {
  stats: { total: number; expiringSoon: number; expired: number }
  currentExpiry: FilterParams['expiry']
  onQuickFilter: (expiry: 'all' | 'expiring_soon' | 'expired') => void
}

const STAT_CARD_BASE =
  "text-left transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg border bg-card text-card-foreground shadow"
const STAT_CARD_SELECTED = 'ring-2 ring-primary'

export function DashboardStats({ stats, currentExpiry, onQuickFilter }: DashboardStatsProps) {
  // Nessun filtro e filtro `all` sono la stessa selezione: normalizzarli qui
  // evita di ripetere il doppio confronto su ogni card.
  const selected = currentExpiry ?? 'all'

  return (
    <div className="grid grid-cols-3 gap-3" role="group" aria-label="Statistiche rapide">
      <button
        onClick={() => onQuickFilter('all')}
        className={cn(STAT_CARD_BASE, selected === 'all' && STAT_CARD_SELECTED)}
        aria-label={`Mostra tutti gli alimenti (${stats.total})`}
        aria-pressed={selected === 'all'}
      >
        <div className="p-4 flex flex-col items-center text-center">
          <ShoppingBasket className="h-6 w-6 text-muted-foreground mb-2" aria-hidden="true" />
          <div className="text-2xl font-bold mb-1">{stats.total}</div>
          <p className="text-xs text-muted-foreground leading-tight">Totali</p>
        </div>
      </button>

      <button
        onClick={() => onQuickFilter('expiring_soon')}
        className={cn(STAT_CARD_BASE, selected === 'expiring_soon' && STAT_CARD_SELECTED)}
        aria-label={`Mostra alimenti in scadenza (${stats.expiringSoon})`}
        aria-pressed={selected === 'expiring_soon'}
      >
        <div className="p-4 flex flex-col items-center text-center">
          <CalendarDays className="h-6 w-6 text-warning mb-2" aria-hidden="true" />
          <div className="text-2xl font-bold mb-1">{stats.expiringSoon}</div>
          <p className="text-xs text-muted-foreground leading-tight">In scadenza</p>
        </div>
      </button>

      <button
        onClick={() => onQuickFilter('expired')}
        className={cn(STAT_CARD_BASE, selected === 'expired' && STAT_CARD_SELECTED)}
        aria-label={`Mostra alimenti scaduti (${stats.expired})`}
        aria-pressed={selected === 'expired'}
      >
        <div className="p-4 flex flex-col items-center text-center">
          <AlertTriangle className="h-6 w-6 text-destructive mb-2" aria-hidden="true" />
          <div className="text-2xl font-bold mb-1">{stats.expired}</div>
          <p className="text-xs text-muted-foreground leading-tight">Scaduti</p>
        </div>
      </button>
    </div>
  )
}
