import { z } from 'zod'

// Password validation regex patterns
const hasUpperCase = /[A-Z]/
const hasLowerCase = /[a-z]/
const hasNumber = /[0-9]/
const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/

// Strong password validation
const strongPasswordSchema = z
  .string()
  .min(8, 'La password deve contenere almeno 8 caratteri')
  .max(72, 'La password non può superare 72 caratteri')
  .refine((password) => hasUpperCase.test(password), {
    message: 'La password deve contenere almeno una lettera maiuscola',
  })
  .refine((password) => hasLowerCase.test(password), {
    message: 'La password deve contenere almeno una lettera minuscola',
  })
  .refine((password) => hasNumber.test(password), {
    message: 'La password deve contenere almeno un numero',
  })
  .refine((password) => hasSpecialChar.test(password), {
    message: 'La password deve contenere almeno un carattere speciale (!@#$%^&*...)',
  })

// Login schema: email + password (less strict for login)
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email richiesta')
    .email('Email non valida'),
  password: z
    .string()
    .min(1, 'Password richiesta'),
})

// Signup schema: full_name + email + password + confirmPassword (passwords must match)
export const signupSchema = z
  .object({
    full_name: z
      .string()
      .min(1, 'Nome richiesto')
      .min(2, 'Il nome deve contenere almeno 2 caratteri')
      .max(100, 'Il nome non può superare 100 caratteri')
      .trim(),
    email: z
      .string()
      .min(1, 'Email richiesta')
      .email('Email non valida'),
    password: strongPasswordSchema,
    confirmPassword: z
      .string()
      .min(1, 'Conferma password richiesta'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Le password non corrispondono',
    path: ['confirmPassword'],
  })

// Forgot password schema: only email
export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, 'Email richiesta')
    .email('Email non valida'),
})

// Reset password schema: new password + confirm password
export const resetPasswordSchema = z
  .object({
    password: strongPasswordSchema,
    confirmPassword: z
      .string()
      .min(1, 'Conferma password richiesta'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Le password non corrispondono',
    path: ['confirmPassword'],
  })

// Export inferred TypeScript types
export type LoginFormData = z.infer<typeof loginSchema>
export type SignupFormData = z.infer<typeof signupSchema>
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>
