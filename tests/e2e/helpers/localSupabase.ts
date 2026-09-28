/**
 * Il Supabase locale, e la guardia che tiene gli helper E2E lì dentro (#186).
 *
 * Le chiavi sono quelle demo pubbliche che `supabase start` usa su ogni
 * macchina: non sono segreti, valgono solo sullo stack locale.
 */
export const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321'
export const LOCAL_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
export const LOCAL_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

/** Gli host che contano come «la macchina di chi fa girare i test». */
const LOCAL_HOSTS = ['127.0.0.1', 'localhost', '[::1]']

/**
 * Ferma gli helper se non stanno parlando col Supabase locale.
 *
 * Va chiamata prima di creare qualunque client. Controlla URL **e** chiave: un
 * URL locale con una chiave vera non esiste, e una chiave demo puntata altrove
 * è comunque un tentativo di scrivere fuori da qui. Nessuna variabile
 * d'ambiente la disattiva: la suite smoke su produzione (#187) non passa da
 * questi helper, e non è un motivo per allentarla.
 */
export function assertLocalSupabase(url: string, serviceRoleKey: string): void {
  let hostname: string
  try {
    hostname = new URL(url).hostname
  } catch {
    throw new Error(`Helper E2E: URL non valido: «${url}».`)
  }

  if (!LOCAL_HOSTS.includes(hostname)) {
    throw new Error(
      `Helper E2E: scrivono solo sul Supabase locale, e ${hostname} non lo è. ` +
        'Creano e cancellano utenti con la chiave service_role: controlla E2E_SUPABASE_URL.'
    )
  }

  if (serviceRoleKey !== LOCAL_SERVICE_ROLE_KEY) {
    throw new Error(
      'Helper E2E: la chiave service_role non è quella demo del Supabase locale. ' +
        'Controlla E2E_SUPABASE_SERVICE_ROLE_KEY.'
    )
  }
}
