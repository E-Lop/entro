import { UserPlus, LogIn, LogOut } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { Button } from '../ui/button'

interface InviteMenuDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  isInSharedList: boolean
  onCreateInvite: () => void
  onAcceptInvite: () => void
  onLeaveList: () => void
}

export function InviteMenuDialog({
  open,
  onOpenChange,
  isInSharedList,
  onCreateInvite,
  onAcceptInvite,
  onLeaveList,
}: InviteMenuDialogProps) {
  const handleOptionClick = (action: () => void) => {
    onOpenChange(false)
    // Small delay to allow dialog close animation
    setTimeout(action, 100)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Inviti</DialogTitle>
          <DialogDescription>
            Gestisci la condivisione della tua lista
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-4">
          {/* Option 1: Create invite */}
          <Button
            variant="outline"
            className="h-auto flex-col items-start gap-2 p-4 text-left"
            onClick={() => handleOptionClick(onCreateInvite)}
          >
            <div className="flex items-center gap-3 w-full">
              <UserPlus className="h-5 w-5 flex-shrink-0" />
              <div className="flex-1">
                <div className="font-medium">Crea invito</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Genera un codice per invitare altri alla tua lista
                </div>
              </div>
            </div>
          </Button>

          {/* Option 2: Accept invite */}
          <Button
            variant="outline"
            className="h-auto flex-col items-start gap-2 p-4 text-left"
            onClick={() => handleOptionClick(onAcceptInvite)}
          >
            <div className="flex items-center gap-3 w-full">
              <LogIn className="h-5 w-5 flex-shrink-0" />
              <div className="flex-1">
                <div className="font-medium">Accetta invito</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Inserisci un codice per unirti a una lista condivisa
                </div>
              </div>
            </div>
          </Button>

          {/* Option 3: Leave shared list (only if in shared list) */}
          {isInSharedList && (
            <Button
              variant="outline"
              className="h-auto flex-col items-start gap-2 p-4 text-left border-destructive/50 hover:bg-destructive/10"
              onClick={() => handleOptionClick(onLeaveList)}
            >
              <div className="flex items-center gap-3 w-full">
                <LogOut className="h-5 w-5 flex-shrink-0 text-destructive" />
                <div className="flex-1">
                  <div className="font-medium text-destructive">Abbandona lista condivisa</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Esci dalla lista condivisa e crea una nuova lista personale
                  </div>
                </div>
              </div>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
