import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2, AlertTriangle, Info, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
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
  const { user, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [foodCount, setFoodCount] = useState<number | null>(null)
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false)

  // Fetch food count when dialog opens
  const handleOpenChange = async (isOpen: boolean) => {
    setOpen(isOpen)

    if (isOpen && !foodCount) {
      // Fetch food count
      const { count } = await supabase
        .from('foods')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null)

      setFoodCount(count || 0)
    }

    // Reset password when closing
    if (!isOpen) {
      setPassword('')
    }
  }

  const handleDelete = async () => {
    if (!user) {
      toast.error('Utente non autenticato')
      return
    }

    if (!password.trim()) {
      toast.error('Inserisci la tua password per confermare')
      return
    }

    setIsDeleting(true)

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

      // Step 4: Sign out and clear all storage
      await signOut()

      // Step 6: Show success message and redirect
      toast.success('Account eliminato con successo', {
        description: 'Tutti i tuoi dati sono stati rimossi.',
      })

      // Navigate to a goodbye page or login
      navigate('/login', { replace: true })
    } catch (error) {
      console.error('Delete account error:', error)
      toast.error('Errore durante l\'eliminazione dell\'account', {
        description:
          error instanceof Error
            ? error.message
            : 'Si è verificato un errore. Riprova più tardi.',
      })
    } finally {
      setIsDeleting(false)
      setOpen(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" className="w-full">
          <Trash2 className="mr-2 h-4 w-4" />
          Elimina Account
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <AlertDialogTitle>Elimina Account</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-2">
            <p className="font-semibold text-destructive">
              Attenzione: questa azione è irreversibile.
            </p>
            <p>Tutti i tuoi dati saranno eliminati permanentemente:</p>
            <ul className="list-disc pl-5 space-y-1 text-sm text-left">
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
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-3"
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
              <div className="text-xs bg-muted/50 p-2.5 rounded-md space-y-1 border border-border/50">
                <p className="font-medium">Modalità cancellazione:</p>
                <ul className="space-y-0.5 pl-2">
                  <li>• Eliminazione permanente dal database</li>
                  <li>• Backup conservati max 6 mesi (policy provider)</li>
                  <li>• Conforme GDPR Art. 17</li>
                </ul>
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-4">
          <Label htmlFor="password">Conferma con la tua password</Label>
          <Input
            id="password"
            type="password"
            placeholder="Inserisci password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isDeleting}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Annulla</AlertDialogCancel>
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
