import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321'
const LOCAL_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const LOCAL_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

const supabaseUrl = process.env.E2E_SUPABASE_URL ?? LOCAL_SUPABASE_URL
const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ?? LOCAL_SERVICE_ROLE_KEY
const anonKey = process.env.E2E_SUPABASE_ANON_KEY ?? LOCAL_ANON_KEY

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

/**
 * Rende condivisa la lista personale dell'utente aggiungendo un secondo membro
 * (via service-role, bypassando RLS). Così l'app rileva `isInSharedList` e il
 * menu inviti mostra anche l'opzione "Abbandona lista condivisa".
 * Ritorna il co-membro creato, da eliminare nel teardown.
 */
export async function makeUserListShared(userId: string, coMemberPassword: string): Promise<E2EUser> {
  // L'app crea la lista personale al primo login (RPC `create_personal_list`,
  // idempotente). La pre-creiamo qui così possiamo aggiungere subito un secondo
  // membro; al login l'app troverà la membership esistente e non la duplicherà.
  const { data: list, error: listError } = await adminClient
    .from('lists')
    .insert({ created_by: userId, name: 'Lista E2E condivisa' })
    .select('id')
    .single()

  if (listError || !list) {
    throw new Error(`Impossibile creare la lista E2E: ${listError?.message}`)
  }

  const coMember = await createE2EUser(createE2EEmail(), coMemberPassword)

  const { error: membersError } = await adminClient.from('list_members').insert([
    { list_id: list.id, user_id: userId },
    { list_id: list.id, user_id: coMember.id },
  ])

  if (membersError) {
    throw new Error(`Impossibile aggiungere i membri alla lista E2E: ${membersError.message}`)
  }

  return coMember
}

/**
 * Crea una lista per `ownerId` e un invito pending indirizzato a `inviteeEmail`.
 * Ritorna il list_id. Usa il service-role (bypassa RLS).
 */
export async function seedPendingInviteByEmail(ownerId: string, inviteeEmail: string): Promise<string> {
  const { data: list, error: listError } = await adminClient
    .from('lists')
    .insert({ created_by: ownerId, name: 'Lista invito E2E' })
    .select('id')
    .single()
  if (listError || !list) throw new Error(`Impossibile creare la lista invito: ${listError?.message}`)

  await adminClient.from('list_members').insert({ list_id: list.id, user_id: ownerId })

  const { error: inviteError } = await adminClient.from('invites').insert({
    list_id: list.id,
    email: inviteeEmail,
    pending_user_email: inviteeEmail.toLowerCase(),
    token: `e2e-${crypto.randomUUID()}`,
    short_code: crypto.randomUUID().slice(0, 8).toUpperCase(),
    created_by: ownerId,
    status: 'pending',
    expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
  })
  if (inviteError) throw new Error(`Impossibile creare l'invito: ${inviteError.message}`)
  return list.id
}

/**
 * Client anonimo (ruolo `anon`), senza persistenza di sessione: usato come
 * base per l'autenticazione via password nei test e2e.
 */
export function anonClient(): SupabaseClient {
  return createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Autentica un client anonimo come l'utente indicato (email + password) e
 * restituisce il client autenticato, da usare per esercitare RPC/RLS con i
 * permessi reali dell'utente (non service-role).
 */
export async function signInAsUser(email: string, password: string): Promise<SupabaseClient> {
  const client = anonClient()
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) {
    throw new Error(`Impossibile autenticarsi come ${email}: ${error.message}`)
  }
  return client
}
