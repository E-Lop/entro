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
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { AcceptInviteDialog } from './AcceptInviteDialog'
import { validateInvite } from '../../lib/invites'

interface AcceptInviteFlowDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AcceptInviteFlowDialog({
  open,
  onOpenChange,
}: AcceptInviteFlowDialogProps) {
  const [shortCode, setShortCode] = useState('')
  const [isValidating, setIsValidating] = useState(false)
  const [validatedCode, setValidatedCode] = useState<string | null>(null)

  const handleValidate = async () => {
    const trimmedCode = shortCode.trim().toUpperCase()

    if (!trimmedCode) {
      toast.error('Inserisci un codice invito')
      return
    }

    if (trimmedCode.length !== 6) {
      toast.error('Il codice deve essere di 6 caratteri')
      return
    }

    setIsValidating(true)

    try {
      const result = await validateInvite(trimmedCode)

      if (result.error || !result.valid) {
        toast.error(result.error?.message || 'Codice invito non valido')
        return
      }

      // Valid invite - proceed to acceptance dialog
      setValidatedCode(trimmedCode)
    } catch {
      toast.error('Si è verificato un errore. Riprova.')
    } finally {
      setIsValidating(false)
    }
  }

  const handleClose = () => {
    setShortCode('')
    setValidatedCode(null)
    onOpenChange(false)
  }

  const handleAcceptSuccess = () => {
    handleClose()
  }

  return (
    <>
      <Dialog open={open && !validatedCode} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Accetta invito</DialogTitle>
            <DialogDescription>
              Inserisci il codice invito di 6 caratteri che hai ricevuto
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-code">Codice invito</Label>
                <Input
                  id="invite-code"
                  placeholder="ABC123"
                  value={shortCode}
                  onChange={(e) => setShortCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  className="text-center text-xl tracking-widest font-mono h-14"
                  autoFocus
                  autoComplete="off"
                  inputMode="text"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleValidate()
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground text-center">
                  Esempio: ABC123
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isValidating}
              className="w-full sm:w-auto"
            >
              Annulla
            </Button>
            <Button
              onClick={handleValidate}
              disabled={isValidating || !shortCode.trim()}
              className="w-full sm:w-auto"
            >
              {isValidating ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Verifica...
                </>
              ) : (
                'Continua'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Accept invite dialog - shown after validation */}
      {validatedCode && (
        <AcceptInviteDialog
          open={!!validatedCode}
          onOpenChange={(open) => {
            if (!open) {
              setValidatedCode(null)
              handleClose()
            }
          }}
          shortCode={validatedCode}
          onSuccess={handleAcceptSuccess}
        />
      )}
    </>
  )
}
