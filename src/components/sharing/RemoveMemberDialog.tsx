import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
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
import { removeListMember, type RemovableMember } from '../../lib/invites'

interface RemoveMemberDialogProps {
  /** Il membro da togliere; `null` tiene chiuso il dialogo. */
  member: RemovableMember | null
  onOpenChange: (open: boolean) => void
  /** Dopo una rimozione riuscita: l'elenco dei membri va riletto. */
  onRemoved: () => void
}

/**
 * La conferma prima di togliere un membro dalla lista condivisa (#196).
 *
 * Nomina la persona e dice le tre conseguenze, perché non si torna indietro
 * con un tasto: i suoi alimenti restano, lei riparte da una lista vuota, e
 * gli inviti ancora attivi smettono di funzionare.
 */
export function RemoveMemberDialog({ member, onOpenChange, onRemoved }: RemoveMemberDialogProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleRemove = async () => {
    if (!member) return
    setIsLoading(true)
    try {
      const result = await removeListMember(member.userId)
      if (!result.success) {
        toast.error(result.error?.message ?? 'Non è stato possibile togliere il membro. Riprova.')
        return
      }
      toast.success(`${member.displayName} non fa più parte della lista`)
      onOpenChange(false)
      onRemoved()
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={member !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Togli dalla lista</DialogTitle>
          <DialogDescription>
            Vuoi togliere {member?.displayName} dalla lista condivisa?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-blocks py-4">
          <Alert variant="destructive">
            <AlertDescription>
              <ul className="list-disc space-y-inner pl-4">
                <li>Gli alimenti che ha inserito restano nella lista.</li>
                <li>Riparte da una lista personale vuota, e non vede più questa.</li>
                <li>Gli inviti ancora attivi di questa lista smettono di funzionare.</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="rounded-lg bg-muted p-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Potrà rientrare solo con un invito nuovo.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            Annulla
          </Button>
          <Button
            variant="destructive"
            onClick={handleRemove}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin motion-reduce:animate-none" />
                Caricamento...
              </>
            ) : (
              'Togli dalla lista'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
