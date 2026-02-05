import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { updatePassword } from '../lib/auth'
import { resetPasswordSchema, type ResetPasswordFormData } from '../lib/validations/auth.schemas'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../components/ui/form'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const form = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  })

  const handleSubmit = async (data: ResetPasswordFormData) => {
    setIsSubmitting(true)

    try {
      const { error } = await updatePassword(data.password)

      if (error) {
        toast.error(error.message)
        return
      }

      toast.success('Password aggiornata con successo!')
      form.reset()

      // Redirect to dashboard after successful password reset
      setTimeout(() => {
        navigate('/')
      }, 1500)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Reimposta password</h1>
          <p className="mt-2 text-muted-foreground">
            Inserisci la tua nuova password.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nuova Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          autoComplete="new-password"
                          disabled={isSubmitting}
                          className="pr-10"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          tabIndex={-1}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                      <p className="font-medium">La password deve contenere:</p>
                      <ul className="space-y-0.5 ml-1">
                        <li>• Almeno 8 caratteri</li>
                        <li>• Una lettera maiuscola (A-Z)</li>
                        <li>• Una lettera minuscola (a-z)</li>
                        <li>• Un numero (0-9)</li>
                        <li>• Un carattere speciale (!@#$%...)</li>
                      </ul>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Conferma Nuova Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showConfirmPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          autoComplete="new-password"
                          disabled={isSubmitting}
                          className="pr-10"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          tabIndex={-1}
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? 'Aggiornamento in corso...' : 'Aggiorna password'}
              </Button>
            </form>
          </Form>
        </div>
      </div>
    </div>
  )
}
