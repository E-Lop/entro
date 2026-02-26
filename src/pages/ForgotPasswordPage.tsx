import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { ArrowLeft, Mail } from 'lucide-react'
import { resetPasswordRequest } from '../lib/auth'
import { useDocumentMeta } from '../hooks/useDocumentMeta'
import { forgotPasswordSchema, type ForgotPasswordFormData } from '../lib/validations/auth.schemas'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../components/ui/form'

export default function ForgotPasswordPage() {
  useDocumentMeta('Recupera password')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  const form = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  })

  const handleSubmit = async (data: ForgotPasswordFormData) => {
    setIsSubmitting(true)

    try {
      const { error } = await resetPasswordRequest(data.email)

      if (error) {
        toast.error(error.message)
        return
      }

      setEmailSent(true)
      toast.success('Email inviata con successo!')
      form.reset()
    } finally {
      setIsSubmitting(false)
    }
  }

  if (emailSent) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Controlla la tua email</h1>
            <p className="mt-2 text-muted-foreground">
              Ti abbiamo inviato un link per reimpostare la password. Controlla la tua casella di posta.
            </p>
          </div>

          <div className="rounded-lg border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Non hai ricevuto l'email? Controlla la cartella spam o{' '}
              <button
                onClick={() => setEmailSent(false)}
                className="text-primary hover:underline"
              >
                riprova
              </button>
              .
            </p>
          </div>

          <div className="text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Torna al login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Password dimenticata?</h1>
          <p className="mt-2 text-muted-foreground">
            Inserisci la tua email e ti invieremo un link per reimpostare la password.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="tua@email.com"
                        autoComplete="email"
                        disabled={isSubmitting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Invio in corso...' : 'Invia link di reset'}
              </Button>
            </form>
          </Form>
        </div>

        <div className="text-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Torna al login
          </Link>
        </div>
      </div>
    </div>
  )
}
