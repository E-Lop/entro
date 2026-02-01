import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { Button } from '../ui/button'
import { Alert, AlertDescription } from '../ui/alert'
import { leaveSharedList } from '../../lib/invites'
import { foodsKeys } from '../../hooks/useFoods'

interface LeaveListDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LeaveListDialog({
  open,
  onOpenChange,
}: LeaveListDialogProps) {
  const queryClient = useQueryClient()
  const [isLoading, setIsLoading] = useState(false)

  const handleLeave = async () => {
    setIsLoading(true)

    try {
      const result = await leaveSharedList()

      if (result.error) {
        toast.error(result.error.message || 'Impossibile abbandonare la lista')
        return
      }

      if (result.success) {
        toast.success('Hai abbandonato la lista condivisa')
        onOpenChange(false)

        // Invalida TUTTA la cache dei foods per forzare il reload della nuova lista personale
        await queryClient.invalidateQueries({ queryKey: foodsKeys.all })

        // Reload page to show new personal list
        setTimeout(() => {
          window.location.reload()
        }, 100)
      }
    } catch {
      toast.error('Si è verificato un errore. Riprova.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Abbandona lista condivisa</DialogTitle>
          <DialogDescription>
            Sei sicuro di voler abbandonare questa lista?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert variant="destructive">
            <AlertDescription>
              <div className="space-y-1">
                <p>
                  Abbandonando questa lista condivisa, verrà creata una nuova lista personale vuota.
                </p>
                <p>
                  Non potrai più vedere gli alimenti condivisi con gli altri membri.
                </p>
              </div>
            </AlertDescription>
          </Alert>

          <div className="rounded-lg bg-muted p-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Gli altri membri della lista continueranno a vedere e gestire gli alimenti condivisi.
              Potrai sempre unirti di nuovo alla lista se ricevi un nuovo invito.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            Annulla
          </Button>
          <Button
            variant="destructive"
            onClick={handleLeave}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Caricamento...
              </>
            ) : (
              'Abbandona lista'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
