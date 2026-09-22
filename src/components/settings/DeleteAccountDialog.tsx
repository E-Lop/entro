import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2, AlertTriangle, Info, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { clearAuthStorage } from '../../lib/auth'
import { useAuth } from '../../hooks/useAuth'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../ui/alert-dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { triggerHaptic } from '@/lib/haptics'
import { inlineErrorAttrs } from '@/lib/a11y'
import { logError } from '@/lib/safeLog'
import { removePhotosOfDeletedFoods } from '@/lib/accountDeletion'

/**
 * Delete Account Dialog Component
 * GDPR Article 17 - Right to Erasure
 *
 * Cosa viene eliminato lo decide `delete_user()`, e lo dice `DeletionScope`.
 */
interface DeletionPreview {
  listShared: boolean
  activeFoodCount: number
}

type PreviewState = DeletionPreview | 'unavailable' | null

async function fetchDeletionPreview(): Promise<DeletionPreview | 'unavailable'> {
  const { data, error } = await supabase.rpc('account_deletion_preview')
  const row = data?.[0]
  return error || !row
    ? 'unavailable'
    : { listShared: row.list_shared, activeFoodCount: row.active_food_count }
}

/**
 * Cosa sparisce con l'account. Due casi, come li decide `delete_user()`:
 * da unico membro va via la lista con i suoi alimenti; da una lista condivisa
 * se ne va solo l'utente, e gli alimenti restano agli altri, perché in una
 * lista condivisa non c'è un «mio» e un «tuo» (#152).
 */
function DeletionScope({ preview }: { preview: PreviewState }) {
  if (preview === null) return null

  if (preview === 'unavailable') {
    return (
      <p>
        Il tuo profilo sarà eliminato permanentemente. Non riusciamo a mostrarti il dettaglio di
        cosa verrà eliminato con lui.
      </p>
    )
  }

  if (preview.listShared) {
    return (
      <>
        <p>Saranno eliminati permanentemente:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Profilo utente</li>
          <li>Inviti pendenti</li>
        </ul>
        <p>Lascerai la lista condivisa: gli alimenti restano agli altri membri.</p>
      </>
    )
  }

  const { activeFoodCount } = preview
  return (
    <>
      <p>Tutti i tuoi dati saranno eliminati permanentemente:</p>
      <ul className="list-disc pl-5 space-y-1">
        <li>Profilo utente</li>
        <li>
          La tua lista, con{' '}
          <span className="font-medium">
            {activeFoodCount} {activeFoodCount === 1 ? 'alimento' : 'alimenti'} in lista
          </span>
        </li>
        <li>Immagini caricate</li>
        <li>Inviti pendenti</li>
      </ul>
    </>
  )
}

export function DeleteAccountDialog() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  // Cosa farà la cancellazione, chiesto al server (#152): è lui a decidere
  // cosa sparisce, e un client che lo deducesse da sé potrebbe dire una cosa e
  // farne un'altra. `null` finché non arriva, `'unavailable'` se la chiamata
  // fallisce: in quel caso il dialogo non promette niente, ma non blocca.
  const [preview, setPreview] = useState<PreviewState>(null)
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleOpenChange = async (isOpen: boolean) => {
    setOpen(isOpen)

    // Si chiede una volta sola, anche quando gli alimenti sono zero.
    if (isOpen && preview === null) setPreview(await fetchDeletionPreview())

    // Reset password and error when closing
    if (!isOpen) {
      setPassword('')
      setError(null)
    }
  }

  const handleDelete = async () => {
    if (!user) {
      setError('Utente non autenticato')
      return
    }

    if (!password.trim()) {
      setError('Inserisci la tua password per confermare')
      return
    }

    setIsDeleting(true)
    setError(null)
    triggerHaptic('error')

    try {
      // Step 1: Re-authenticate user with password
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email || '',
        password: password,
      })

      if (authError) {
        throw new Error('Password non corretta')
      }

      // Step 2: le foto degli alimenti che spariscono — solo da unico membro.
      // Da una lista condivisa gli alimenti restano agli altri, e con loro le
      // foto (#152); senza anteprima non si sa, e un orfano costa meno di una
      // foto tolta a qualcun altro. Se non si riesce a toglierle ci si ferma
      // qui: dopo la cancellazione nessuno potrebbe più farlo (#145).
      // L'anteprima si rilegge adesso: quella dell'apertura può essere vecchia,
      // se nel frattempo qualcuno è entrato nella lista.
      const current = await fetchDeletionPreview()
      setPreview(current)
      const onlyMember = current !== 'unavailable' && !current.listShared
      if (onlyMember) await removePhotosOfDeletedFoods()

      // Step 3: Delete user account. `delete_user()` elimina le liste di cui
      // l'utente era l'unico membro (con i loro alimenti), i suoi inviti e le
      // sue appartenenze; da una lista condivisa esce e basta, e gli alimenti
      // restano agli altri membri (#152).
      const { error: deleteError } = await supabase.rpc('delete_user')

      if (deleteError) {
        // If RPC function doesn't exist, we can't delete the user programmatically
        // This requires admin API access which isn't available in the client
        throw new Error(
          'Non è possibile eliminare l\'account automaticamente. Contatta il supporto.'
        )
      }

      // Step 4: Clear local session only (account already deleted from server)
      // Use scope: 'local' to avoid 400 error when trying to invalidate deleted account
      await supabase.auth.signOut({ scope: 'local' })
      clearAuthStorage()

      // Step 5: Show success message and redirect
      toast.success('Account eliminato con successo', {
        description: 'Tutti i tuoi dati sono stati rimossi.',
      })

      // Navigate to a goodbye page or login
      navigate('/login', { replace: true })
    } catch (err) {
      // Tieni aperto il dialog e mostra l'errore inline sotto il campo password,
      // così l'utente può correggere senza perdere il contesto della conferma.
      logError('Delete account error:', err)
      setError(
        err instanceof Error
          ? err.message
          : 'Si è verificato un errore. Riprova più tardi.'
      )
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" className="w-full h-11">
          <Trash2 className="mr-2 h-4 w-4" />
          Elimina account
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <AlertDialogTitle>Elimina account</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-left font-semibold text-destructive">
            Attenzione: questa azione è irreversibile.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Contenuto rich fuori da AlertDialogDescription (è un <p>): qui può
            contenere lista, disclosure e box senza nesting HTML non valido. */}
        <div className="space-y-3 text-left text-sm">
          <DeletionScope preview={preview} />

          {/* Technical details collapsible */}
          <button
            type="button"
            onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
            aria-expanded={showTechnicalDetails}
            aria-controls="delete-technical-details"
            className="flex items-center gap-1.5 min-h-11 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Info className="h-3.5 w-3.5" />
            <span>Dettagli tecnici</span>
            {showTechnicalDetails ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>

          {showTechnicalDetails && (
            <div
              id="delete-technical-details"
              className="text-xs bg-muted/50 p-2.5 rounded-md space-y-1 border border-border/50"
            >
              <p className="font-medium">Modalità cancellazione:</p>
              <ul className="space-y-0.5 pl-2">
                <li>• Eliminazione permanente dal database</li>
                <li>• Backup conservati max 6 mesi (policy provider)</li>
                <li>• Conforme GDPR Art. 17</li>
              </ul>
            </div>
          )}
        </div>

        <div className="space-y-2 py-4">
          <Label htmlFor="password">Conferma con la tua password</Label>
          <Input
            id="password"
            type="password"
            placeholder="Inserisci password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              if (error) setError(null)
            }}
            disabled={isDeleting}
            className="h-11"
            {...inlineErrorAttrs(!!error, 'delete-password-error')}
          />
          {error && (
            <p id="delete-password-error" role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>
            Annulla
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              handleDelete()
            }}
            // Finché l'anteprima non risponde non si sa se togliere le foto (#145).
            disabled={isDeleting || !password.trim() || preview === null}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? 'Eliminazione...' : 'Capisco, elimina il mio account'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
