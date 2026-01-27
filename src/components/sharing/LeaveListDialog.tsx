import { useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
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

        <div className="py-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <span className="font-semibold">Attenzione:</span> Abbandonando questa lista condivisa,
              verrà creata una nuova lista personale vuota. Non potrai più vedere gli alimenti
              condivisi con gli altri membri.
            </AlertDescription>
          </Alert>

          <div className="mt-4 p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              Gli altri membri della lista continueranno a vedere e gestire gli alimenti condivisi.
              Potrai sempre unirti di nuovo alla lista se ricevi un nuovo invito.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
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
