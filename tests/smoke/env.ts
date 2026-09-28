/**
 * La suite di smoke si configura solo dall'ambiente (#187).
 *
 * Sono le variabili che la #189 mette nell'Environment `production`. Nessuna
 * chiave `service_role`: ogni operazione passa dalle sessioni di A o di B.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { fail } from './failure'

export interface Sentinel {
  client: SupabaseClient
  userId: string
}

function required(name: string): string {
  const value = process.env[name]
  // Il nome della variabile è testo fisso: si può stampare. Il valore no.
  if (!value) fail(`variabile d'ambiente mancante: ${name}`)
  return value
}

/** Una sessione di A o di B, con la chiave anon e le sue credenziali. */
export async function signIn(who: 'A' | 'B'): Promise<Sentinel> {
  const url = required('SMOKE_SUPABASE_URL')
  const anonKey = required('SMOKE_SUPABASE_ANON_KEY')
  const email = required(`SMOKE_${who}_EMAIL`)
  const password = required(`SMOKE_${who}_PASSWORD`)

  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  let result: Awaited<ReturnType<typeof client.auth.signInWithPassword>>
  try {
    result = await client.auth.signInWithPassword({ email, password })
  } catch {
    // Una connessione rifiutata lancia invece di restituire `{ error }`.
    fail(`accesso di ${who} non riuscito`)
  }
  if (result.error || !result.data.user) fail(`accesso di ${who} non riuscito`)
  return { client, userId: result.data.user.id }
}
