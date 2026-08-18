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

/**
 * Crea una lista con owner e un invito pending con short_code noto. Ritorna { listId, shortCode }.
 * `options.expiresAt` permette di seedare un invito già scaduto (default: +7 giorni).
 */
export async function seedPendingInviteByCode(
  ownerId: string,
  options?: { expiresAt?: Date },
): Promise<{ listId: string; shortCode: string }> {
  const { data: list, error: listError } = await adminClient
    .from('lists')
    .insert({ created_by: ownerId, name: 'Lista codice E2E' })
    .select('id')
    .single()
  if (listError || !list) throw new Error(`Impossibile creare la lista: ${listError?.message}`)
  await adminClient.from('list_members').insert({ list_id: list.id, user_id: ownerId })
  const shortCode = crypto.randomUUID().slice(0, 8).toUpperCase()
  const expiresAt = options?.expiresAt ?? new Date(Date.now() + 7 * 24 * 3600 * 1000)
  const { error } = await adminClient.from('invites').insert({
    list_id: list.id,
    token: `e2e-${crypto.randomUUID()}`,
    short_code: shortCode,
    created_by: ownerId,
    status: 'pending',
    // il check constraint `valid_expiry` impone expires_at > created_at: per
    // seedare un invito già scaduto retrodatiamo anche created_at.
    created_at: expiresAt < new Date() ? new Date(expiresAt.getTime() - 3600_000).toISOString() : undefined,
    expires_at: expiresAt.toISOString(),
  })
  if (error) throw new Error(`Impossibile creare l'invito: ${error.message}`)
  return { listId: list.id, shortCode }
}

/**
 * Crea un ulteriore invito pending per una lista GIÀ esistente (stesso owner).
 * Usato per simulare un secondo link di invito verso una lista di cui l'utente
 * è già membro (es. link riutilizzato/duplicato). Ritorna lo short_code.
 */
export async function seedAdditionalInviteForList(
  listId: string,
  ownerId: string,
  options?: { expiresAt?: Date },
): Promise<string> {
  const shortCode = crypto.randomUUID().slice(0, 8).toUpperCase()
  const { error } = await adminClient.from('invites').insert({
    list_id: listId,
    token: `e2e-${crypto.randomUUID()}`,
    short_code: shortCode,
    created_by: ownerId,
    status: 'pending',
    expires_at: (options?.expiresAt ?? new Date(Date.now() + 7 * 24 * 3600 * 1000)).toISOString(),
  })
  if (error) throw new Error(`Impossibile creare l'invito aggiuntivo: ${error.message}`)
  return shortCode
}

/** True se la lista esiste ancora (via service-role). */
export async function listExists(listId: string): Promise<boolean> {
  const { data } = await adminClient.from('lists').select('id').eq('id', listId).maybeSingle()
  return data !== null
}

/** True se l'utente risulta membro della lista indicata (via service-role). */
export async function isMember(listId: string, userId: string): Promise<boolean> {
  const { data } = await adminClient
    .from('list_members')
    .select('id')
    .eq('list_id', listId)
    .eq('user_id', userId)
    .maybeSingle()
  return data !== null
}

/** Numero di righe list_members per (lista, utente) — per verificare l'assenza di duplicati. */
export async function countListMemberships(listId: string, userId: string): Promise<number> {
  const { count, error } = await adminClient
    .from('list_members')
    .select('id', { count: 'exact', head: true })
    .eq('list_id', listId)
    .eq('user_id', userId)
  if (error) throw new Error(`Impossibile contare le membership: ${error.message}`)
  return count ?? 0
}

/** Stato corrente dell'invito identificato da short_code (via service-role). */
export async function getInviteStatusByShortCode(shortCode: string): Promise<string | null> {
  const { data } = await adminClient
    .from('invites')
    .select('status')
    .eq('short_code', shortCode)
    .maybeSingle()
  return data?.status ?? null
}

/**
 * Aggiunge `n` foods a una lista (per testare food_count / cascade).
 * `category_id` è FK obbligatoria verso `public.categories` (schema baseline
 * 20260109): usiamo la categoria seed 'dairy'. `storage_location` accetta solo
 * 'fridge' | 'freezer' | 'pantry' (check constraint), non le label italiane.
 */
/**
 * Crea la lista personale di un utente e ce lo iscrive.
 *
 * Serve ai test che partono da una dashboard già popolata: l'app la crea da sé
 * al primo accesso, ma non subito, e un inserimento che arriva prima viene
 * rifiutato dalla RLS (`new row violates row-level security policy`).
 */
export async function createListForUser(ownerId: string): Promise<string> {
  const { data: list, error } = await adminClient
    .from('lists')
    .insert({ created_by: ownerId, name: 'Lista E2E' })
    .select('id')
    .single()
  if (error || !list) throw new Error(`Impossibile creare la lista: ${error?.message}`)

  await adminClient.from('list_members').insert({ list_id: list.id, user_id: ownerId })
  return list.id
}

export async function seedFoods(listId: string, ownerId: string, n: number): Promise<void> {
  const { data: category, error: categoryError } = await adminClient
    .from('categories')
    .select('id')
    .eq('name', 'dairy')
    .single()
  if (categoryError || !category) {
    throw new Error(`Impossibile trovare la categoria seed 'dairy': ${categoryError?.message}`)
  }
  const rows = Array.from({ length: n }, (_, i) => ({
    list_id: listId,
    user_id: ownerId,
    name: `Food E2E ${i}`,
    category_id: category.id,
    storage_location: 'fridge',
    quantity: 1,
    quantity_unit: 'pz',
    expiry_date: new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString().slice(0, 10),
  }))
  const { error } = await adminClient.from('foods').insert(rows)
  if (error) throw new Error(`Impossibile creare i foods: ${error.message}`)
}
