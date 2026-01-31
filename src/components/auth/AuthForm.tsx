import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { loginSchema, signupSchema, type LoginFormData, type SignupFormData } from '../../lib/validations/auth.schemas'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form'

interface AuthFormProps {
  mode: 'login' | 'signup'
  onSuccess?: (email?: string) => void
  prefillEmail?: string | null
  lockEmail?: boolean
  disableSubmit?: boolean
}

export function AuthForm({ mode, onSuccess, prefillEmail, lockEmail, disableSubmit }: AuthFormProps) {
  const { signIn, signUp } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Use appropriate schema based on mode
  const schema = mode === 'login' ? loginSchema : signupSchema

  const form = useForm<LoginFormData | SignupFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: prefillEmail || '',
      password: '',
      ...(mode === 'signup' && { full_name: '', confirmPassword: '' }),
    },
  })

  // Update email field when prefillEmail changes
  useEffect(() => {
    if (prefillEmail) {
      form.setValue('email', prefillEmail)
    }
  }, [prefillEmail, form])

  const handleSubmit = async (data: LoginFormData | SignupFormData) => {
    setIsSubmitting(true)

    try {
      let result

      if (mode === 'login') {
        result = await signIn(data.email, data.password)
      } else {
        // Type assertion safe here because we know signup form has full_name
        const signupData = data as SignupFormData
        result = await signUp(data.email, data.password, signupData.full_name)
      }

      if (result.success) {
        form.reset()
        onSuccess?.(data.email)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        {/* Full Name Field (only for signup) */}
        {mode === 'signup' && (
          <FormField
            control={form.control}
            name="full_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    placeholder="Mario Rossi"
                    autoComplete="name"
                    disabled={isSubmitting}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Email Field */}
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
                  disabled={isSubmitting || lockEmail}
                  className={lockEmail ? 'bg-muted cursor-not-allowed' : ''}
                  {...field}
                />
              </FormControl>
              {lockEmail && (
                <p className="text-xs text-muted-foreground">
                  L'email è precompilata dall'invito e non può essere modificata
                </p>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Password Field */}
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
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
            </FormItem>
          )}
        />

        {/* Confirm Password Field (only for signup) */}
        {mode === 'signup' && (
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Conferma Password</FormLabel>
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
        )}

        {/* Submit Button */}
        <Button
          type="submit"
          className="w-full"
          disabled={isSubmitting || disableSubmit}
        >
          {isSubmitting
            ? mode === 'login'
              ? 'Accesso in corso...'
              : 'Registrazione in corso...'
            : mode === 'login'
            ? 'Accedi'
            : 'Registrati'}
        </Button>
      </form>
    </Form>
  )
}
