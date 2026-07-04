import { createClient } from '@supabase/supabase-js'

const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321'
const LOCAL_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const supabaseUrl = process.env.E2E_SUPABASE_URL ?? LOCAL_SUPABASE_URL
const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ?? LOCAL_SERVICE_ROLE_KEY

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

export interface E2EUser {
  id: string
  email: string
  password: string
}

export function createE2EEmail(): string {
  return `e2e-${Date.now()}-${crypto.randomUUID()}@example.test`
}

export async function createE2EUser(email: string, password: string): Promise<E2EUser> {
  await deleteE2EUserByEmail(email)

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Utente E2E' },
  })

  if (error) {
    throw new Error(`Impossibile creare utente E2E. Supabase locale e' avviato? ${error.message}`)
  }
  if (!data.user) {
    throw new Error('Supabase non ha restituito l\'utente E2E creato')
  }

  return { id: data.user.id, email, password }
}

export async function deleteE2EUserByEmail(email: string): Promise<void> {
  const { data, error } = await adminClient.auth.admin.listUsers()
  if (error) {
    throw new Error(`Impossibile leggere gli utenti E2E. Supabase locale e' avviato? ${error.message}`)
  }

  const user = data.users.find((candidate) => candidate.email === email)
  if (!user) return

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id)
  if (deleteError) {
    throw new Error(`Impossibile eliminare l'utente E2E ${email}: ${deleteError.message}`)
  }
}
