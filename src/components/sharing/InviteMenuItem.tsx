import { Users } from 'lucide-react'
import { DropdownMenuItem } from '../ui/dropdown-menu'

interface InviteMenuItemProps {
  onSelect: () => void
}

/**
 * Voce "Inviti" del menu utente.
 *
 * Renderizzata come vero `DropdownMenuItem` (role="menuitem") così è
 * navigabile con le frecce e chiude il dropdown alla selezione, coerente
 * con le altre voci del menu (Impostazioni, Disconnetti). In precedenza era
 * un `<Button>` annidato in `<DropdownMenuItem asChild>` che non inoltrava le
 * props passate da Radix via Slot: il risultato era un `<button>` dentro
 * `role="menu"` (ARIA non valido) che non chiudeva il dropdown alla selezione.
 */
export function InviteMenuItem({ onSelect }: InviteMenuItemProps) {
  const isSharedListsEnabled = import.meta.env.VITE_ENABLE_SHARED_LISTS === 'true'

  // Don't render if feature is disabled
  if (!isSharedListsEnabled) {
    return null
  }

  return (
    <DropdownMenuItem onSelect={onSelect} className="cursor-pointer">
      <Users className="mr-2 h-4 w-4" />
      <span>Inviti</span>
    </DropdownMenuItem>
  )
}
