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
import { acceptInviteWithConfirmation } from '../../lib/invites'
import { foodsKeys } from '../../hooks/useFoods'

interface AcceptInviteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  shortCode: string
  onSuccess?: () => void
}

interface ConfirmationData {
  foodCount: number
}

export function AcceptInviteDialog({
  open,
  onOpenChange,
  shortCode,
  onSuccess,
}: AcceptInviteDialogProps) {
  const queryClient = useQueryClient()
  const [isLoading, setIsLoading] = useState(false)
  const [confirmationData, setConfirmationData] = useState<ConfirmationData | null>(null)

  const handleAccept = async (force: boolean = false) => {
    setIsLoading(true)

    try {
      const result = await acceptInviteWithConfirmation(shortCode, force)

      if (result.error) {
        toast.error(result.error.message || 'Impossibile accettare l\'invito')
        return
      }

      // Se richiede conferma, mostra warning
      if (result.requiresConfirmation && !force) {
        setConfirmationData({
          foodCount: result.foodCount || 0,
        })
        return
      }

      if (result.success) {
        toast.success('Ti sei unito alla lista condivisa!')
        onOpenChange(false)

        // Invalidate foods cache to force reload with new shared list data
        await queryClient.invalidateQueries({ queryKey: foodsKeys.all })

        // Callback or fallback to page reload
        if (onSuccess) {
          onSuccess()
        } else {
          setTimeout(() => window.location.reload(), 100)
        }
      }
    } catch {
      toast.error('Si è verificato un errore. Riprova.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setConfirmationData(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {!confirmationData ? (
          // Initial state - Join confirmation
          <>
            <DialogHeader>
              <DialogTitle>Unisciti alla lista</DialogTitle>
              <DialogDescription>
                Stai per unirti a una lista condivisa usando il codice{' '}
                <span className="font-mono font-semibold">{shortCode}</span>
              </DialogDescription>
            </DialogHeader>

            <div className="py-6 text-center">
              <p className="text-sm text-muted-foreground">
                Potrai vedere e gestire gli alimenti insieme agli altri membri.
              </p>
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
                onClick={() => handleAccept(false)}
                disabled={isLoading}
                className="w-full sm:w-auto"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Caricamento...
                  </>
                ) : (
                  'Unisciti'
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          // Confirmation state - Data loss warning
          <>
            <DialogHeader>
              <DialogTitle>Attenzione: Perdita dati</DialogTitle>
              <DialogDescription>
                Accettando questo invito rinuncerai alla tua lista personale
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <Alert variant="destructive">
                <AlertDescription>
                  <div className="space-y-1">
                    <p>
                      La tua lista personale contiene{' '}
                      <span className="font-semibold">
                        {confirmationData.foodCount} {confirmationData.foodCount === 1 ? 'alimento' : 'alimenti'}
                      </span>.
                    </p>
                    <p>
                      Tutti questi dati saranno eliminati definitivamente.
                    </p>
                  </div>
                </AlertDescription>
              </Alert>

              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Una volta unito alla nuova lista, vedrai solo gli alimenti condivisi
                  con gli altri membri. Questa azione non può essere annullata.
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
                onClick={() => handleAccept(true)}
                disabled={isLoading}
                className="w-full sm:w-auto"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Caricamento...
                  </>
                ) : (
                  'Conferma e Unisciti'
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
