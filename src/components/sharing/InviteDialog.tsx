import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Mail, Loader2 } from 'lucide-react'
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
import { createInvite, getUserList } from '../../lib/invites'

// Zod schema for email validation
const inviteSchema = z.object({
  email: z
    .string()
    .email('Inserisci un indirizzo email valido')
    .min(1, 'Email richiesta'),
})

type InviteFormData = z.infer<typeof inviteSchema>

interface InviteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InviteDialog({ open, onOpenChange }: InviteDialogProps) {
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
  })

  const onSubmit = async (data: InviteFormData) => {
    setIsLoading(true)

    try {
      // Get user's list ID
      const { list, error: listError } = await getUserList()

      if (listError || !list) {
        toast.error('Non hai una lista da condividere')
        return
      }

      // Create invite
      const result = await createInvite(data.email, list.id)

      if (result.error || !result.success || !result.invite) {
        toast.error(result.error?.message || 'Impossibile creare l\'invito')
        return
      }

      // Success - generate and copy invite URL
      const inviteUrl = `${window.location.origin}/signup?invite_token=${result.invite.token}`

      try {
        await navigator.clipboard.writeText(inviteUrl)
        toast.success(
          `Invito creato per ${data.email}! Link copiato negli appunti. Condividilo con l'utente.`,
          { duration: 6000 }
        )
      } catch {
        toast.success(
          `Invito creato per ${data.email}! Copia questo link: ${inviteUrl}`,
          { duration: 8000 }
        )
      }

      // Reset form and close dialog
      reset()
      onOpenChange(false)
    } catch (error) {
      toast.error('Si è verificato un errore. Riprova.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Invita membro</DialogTitle>
          <DialogDescription>
            Invita qualcuno a condividere la tua lista di alimenti.
            Il link di invito verrà copiato negli appunti per condividerlo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="esempio@email.com"
                  className="pl-9"
                  {...register('email')}
                  disabled={isLoading}
                />
              </div>
              {errors.email && (
                <p className="text-sm text-red-500" role="alert">
                  {errors.email.message}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Annulla
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Invio...
                </>
              ) : (
                'Invia invito'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
