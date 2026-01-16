import { z } from 'zod'

// Login schema: email + password (min 6 chars per Supabase requirement)
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email richiesta')
    .email('Email non valida'),
  password: z
    .string()
    .min(6, 'La password deve contenere almeno 6 caratteri'),
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
    password: z
      .string()
      .min(6, 'La password deve contenere almeno 6 caratteri')
      .max(72, 'La password non può superare 72 caratteri'),
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
