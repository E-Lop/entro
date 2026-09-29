import { useCallback, useEffect, useState } from 'react'
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog'
import { Button } from '../ui/button'
import { createInvite, getMyActiveInvites, getUserList, revokeInvite } from '../../lib/invites'
import type { ActiveInvite } from '../../types/invite.types'

/**
 * Quanto manca alla scadenza di un invito. Gli inviti durano 7 giorni
 * (create-invite), quindi bastano i giorni interi, e sotto il giorno una
 * forma sola.
 */
const TIME = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' })
const DAY = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' })

/**
 * Quando è stato creato un invito. Un invito non ha destinatario (entra chi
 * usa il codice per primo), e il codice da solo non si riconosce: chi l'ha
 * mandato ricorda quando. Deciso dal maintainer il 29 set 2026 (#194).
 */
function creationLabel(createdAt: string): string {
  const created = new Date(createdAt)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const time = TIME.format(created)
  if (created.toDateString() === today.toDateString()) return `Creato oggi alle ${time}`
  if (created.toDateString() === yesterday.toDateString()) return `Creato ieri alle ${time}`
  return `Creato il ${DAY.format(created)} alle ${time}`
}

function expiryLabel(expiresAt: string): string {
  const days = Math.floor((new Date(expiresAt).getTime() - Date.now()) / (24 * 3600 * 1000))
  if (days < 1) return 'Scade tra meno di un giorno'
  return days === 1 ? 'Scade tra 1 giorno' : `Scade tra ${days} giorni`
}

interface InviteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InviteDialog({ open, onOpenChange }: InviteDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  // I propri inviti ancora usabili, con l'azione «Revoca» (#194).
  const [activeInvites, setActiveInvites] = useState<ActiveInvite[]>([])
  const [activeInvitesError, setActiveInvitesError] = useState<string | null>(null)
  const [revoking, setRevoking] = useState<ActiveInvite | null>(null)
  const [isRevoking, setIsRevoking] = useState(false)

  const loadActiveInvites = useCallback(async () => {
    const { invites, error } = await getMyActiveInvites()
    setActiveInvites(invites)
    setActiveInvitesError(error ? error.message : null)
  }, [])

  useEffect(() => {
    if (open) void loadActiveInvites()
  }, [open, loadActiveInvites])

  const handleRevoke = async () => {
    if (!revoking) return
    setIsRevoking(true)
    const { success, error } = await revokeInvite(revoking.id)
    setIsRevoking(false)
    if (success) {
      toast.success(`Invito ${revoking.short_code} revocato`)
    } else {
      toast.error(error?.message || 'Non è stato possibile revocare l\'invito. Riprova.')
    }
    setRevoking(null)
    await loadActiveInvites()
  }

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

    } catch {
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
      } catch {
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
    setRevoking(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        {!inviteCode ? (
          // Schermata iniziale - NESSUN FORM
          <>
            <DialogHeader>
              <DialogTitle>Crea invito</DialogTitle>
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
                    <Loader2 className="mr-2 h-5 w-5 animate-spin motion-reduce:animate-none" />
                    Creazione codice...
                  </>
                ) : (
                  'Genera codice invito'
                )}
              </Button>
            </div>

            {activeInvitesError ? (
              <p className="text-sm text-destructive">{activeInvitesError}</p>
            ) : activeInvites.length > 0 ? (
              <section aria-labelledby="active-invites-title" className="space-y-inner">
                <h3 id="active-invites-title" className="text-sm font-medium">
                  I tuoi inviti attivi
                </h3>
                <ul aria-labelledby="active-invites-title" className="divide-y rounded-lg border">
                  {activeInvites.map((invite) => (
                    <li key={invite.id} className="flex items-center justify-between gap-siblings p-3">
                      <div>
                        <p className="font-mono font-semibold tracking-wider">{invite.short_code}</p>
                        {invite.created_at && (
                          <p className="text-xs text-muted-foreground">{creationLabel(invite.created_at)}</p>
                        )}
                        <p className="text-xs text-muted-foreground">{expiryLabel(invite.expires_at)}</p>
                      </div>
                      <Button
                        variant="outline"
                        className="min-h-11"
                        aria-label={`Revoca l'invito ${invite.short_code}`}
                        onClick={() => setRevoking(invite)}
                      >
                        Revoca
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

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
              <div
                className="bg-primary/10 rounded-lg p-6 text-center"
                role="status"
                aria-live="polite"
              >
                <p className="text-sm text-muted-foreground mb-2">
                  Codice invito
                </p>
                <p className="text-4xl font-bold tracking-wider font-mono">
                  {inviteCode}
                </p>
                {/* Scadenza fissata a 7 giorni in create-invite/index.ts */}
                <p className="mt-3 text-xs text-muted-foreground">
                  Valido per 7 giorni
                </p>
              </div>

              {/* Bottoni azione */}
              <div className="grid grid-cols-2 gap-siblings mt-6">
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

      <AlertDialog open={revoking !== null} onOpenChange={(isOpen) => !isOpen && setRevoking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revocare l'invito {revoking?.short_code}?</AlertDialogTitle>
            <AlertDialogDescription>
              Chi ha il codice non potrà più usarlo per unirsi alla tua lista. Chi è già
              entrato resta nella lista.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRevoking}>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void handleRevoke()
              }}
              disabled={isRevoking}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Revoca
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}
