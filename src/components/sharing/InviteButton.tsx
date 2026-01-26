import { Mail } from 'lucide-react'
import { Button } from '../ui/button'

interface InviteButtonProps {
  onClick: () => void
}

export function InviteButton({ onClick }: InviteButtonProps) {
  // Check feature flag
  const isSharedListsEnabled = import.meta.env.VITE_ENABLE_SHARED_LISTS === 'true'

  // Don't render if feature is disabled
  if (!isSharedListsEnabled) {
    return null
  }

  return (
    <Button
      variant="ghost"
      className="w-full justify-start"
      onClick={onClick}
    >
      <Mail className="mr-2 h-4 w-4" />
      Inviti
    </Button>
  )
}
