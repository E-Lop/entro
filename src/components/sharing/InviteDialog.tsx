import { useState } from 'react'
import { Copy, Share2, Check, Loader2 } from 'lucide-react'
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
import { createInvite, getUserList } from '../../lib/invites'

interface InviteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InviteDialog({ open, onOpenChange }: InviteDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleCreateInvite = async () => {
    setIsLoading(true)

    try {
      const { list, error: listError } = await getUserList()
      if (listError || !list) {
        toast.error('Non hai una lista da condividere')
        return
      }

      // NO email needed!
      const result = await createInvite(list.id)

      if (result.error || !result.success || !result.shortCode) {
        toast.error(result.error?.message || 'Impossibile creare l\'invito')
        return
      }

      // Success - mostra codice
      setInviteCode(result.shortCode)

    } catch (error) {
      toast.error('Si è verificato un errore. Riprova.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopyCode = async () => {
    if (!inviteCode) return

    try {
      await navigator.clipboard.writeText(inviteCode)
      setCopied(true)
      toast.success('Codice copiato!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Impossibile copiare il codice')
    }
  }

  const handleShare = async () => {
    if (!inviteCode) return

    const shareData = {
      title: 'Invito entro',
      text: `Unisciti alla mia lista su entro! Usa il codice: ${inviteCode}`,
      url: `${window.location.origin}/join/${inviteCode}`
    }

    if (navigator.share) {
      try {
        await navigator.share(shareData)
      } catch (err) {
        // User cancelled, ignore
      }
    } else {
      // Fallback: copy URL
      try {
        await navigator.clipboard.writeText(shareData.url)
        toast.success('Link copiato!')
      } catch {
        toast.error('Impossibile condividere')
      }
    }
  }

  const handleClose = () => {
    setInviteCode(null)
    setCopied(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        {!inviteCode ? (
          // Schermata iniziale - NESSUN FORM
          <>
            <DialogHeader>
              <DialogTitle>Invita membro</DialogTitle>
              <DialogDescription>
                Crea un codice invito da condividere con chi vuoi.
                Il codice può essere usato da chiunque per unirsi alla tua lista.
              </DialogDescription>
            </DialogHeader>

            <div className="py-6 text-center">
              <Button
                onClick={handleCreateInvite}
                disabled={isLoading}
                size="lg"
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Creazione codice...
                  </>
                ) : (
                  'Genera codice invito'
                )}
              </Button>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isLoading}
                className="w-full"
              >
                Annulla
              </Button>
            </DialogFooter>
          </>
        ) : (
          // Mostra codice dopo creazione
          <>
            <DialogHeader>
              <DialogTitle>Invito creato!</DialogTitle>
              <DialogDescription>
                Condividi questo codice con chi vuoi invitare
              </DialogDescription>
            </DialogHeader>

            <div className="py-6">
              {/* Codice grande e visibile */}
              <div className="bg-primary/10 rounded-lg p-6 text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  Codice invito
                </p>
                <p className="text-4xl font-bold tracking-wider font-mono">
                  {inviteCode}
                </p>
              </div>

              {/* Bottoni azione */}
              <div className="grid grid-cols-2 gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={handleCopyCode}
                  className="w-full"
                >
                  {copied ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Copiato!
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Copia
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleShare}
                  className="w-full"
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  Condividi
                </Button>
              </div>

              {/* Istruzioni */}
              <div className="mt-6 p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Condividi questo codice via WhatsApp, Telegram, SMS o qualsiasi app.
                  Il destinatario potrà usarlo durante la registrazione o visitare:
                </p>
                <p className="text-sm font-mono mt-2 break-all">
                  {window.location.origin}/join/{inviteCode}
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleClose} className="w-full">
                Chiudi
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
