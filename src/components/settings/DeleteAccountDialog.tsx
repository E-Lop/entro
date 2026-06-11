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

/**
 * Delete Account Dialog Component
 * GDPR Article 17 - Right to Erasure
 *
 * Allows users to permanently delete their account and all associated data:
 * - User profile
 * - All food items
 * - Uploaded images (Supabase Storage)
 * - List memberships
 * - Pending invites
 *
 * Cascade deletes are handled via Supabase RLS policies
 */
export function DeleteAccountDialog() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [foodCount, setFoodCount] = useState<number | null>(null)
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch food count when dialog opens
  const handleOpenChange = async (isOpen: boolean) => {
    setOpen(isOpen)

    // `foodCount === null` e non `!foodCount`: con un totale reale di 0 alimenti
    // `!foodCount` resta truthy → la query veniva rifatta a ogni riapertura del dialog.
    if (isOpen && foodCount === null) {
      // Fetch food count
      const { count } = await supabase
        .from('foods')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null)

      setFoodCount(count || 0)
    }

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

      // Step 2: Delete all images from Supabase Storage
      // Get all foods with images
      const { data: foodsWithImages } = await supabase
        .from('foods')
        .select('image_url')
        .eq('user_id', user.id)
        .not('image_url', 'is', null)

      if (foodsWithImages && foodsWithImages.length > 0) {
        // Extract storage paths from signed URLs
        const imagePaths = foodsWithImages
          .map((food) => {
            if (!food.image_url) return null
            // Extract path from signed URL: /storage/v1/object/sign/food-images/USER_ID/FILE
            const match = food.image_url.match(/food-images\/([^?]+)/)
            return match ? match[1] : null
          })
          .filter(Boolean) as string[]

        if (imagePaths.length > 0) {
          // Delete images in batches
          await supabase.storage.from('food-images').remove(imagePaths)
        }
      }

      // Step 3: Delete user account
      // This triggers cascade deletes for:
      // - foods table (via RLS policies)
      // - list_members table (via RLS policies)
      // - invites table (via RLS policies)
      // - lists table if user is the only member (handled by RLS)
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
      console.error('Delete account error:', err)
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
          <p>Tutti i tuoi dati saranno eliminati permanentemente:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Profilo utente</li>
            <li>
              Tutti gli alimenti{' '}
              {foodCount !== null && (
                <span className="font-medium">({foodCount} totali)</span>
              )}
            </li>
            <li>Immagini caricate</li>
            <li>Liste condivise e appartenenze</li>
            <li>Inviti pendenti</li>
          </ul>

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
            disabled={isDeleting || !password.trim()}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? 'Eliminazione...' : 'Capisco, elimina il mio account'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
