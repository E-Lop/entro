/**
 * Cosa dire all'utente quando una RPC degli inviti risponde `success: false`.
 *
 * Le RPC (`join_list_via_invite`, `accept_pending_invite_by_email`) mettono in
 * `error_message` un **codice**, e la frase la sceglie il client: il testo che
 * l'utente legge non vive in una migrazione, dove nessun client lo potrebbe
 * tradurre (#101, deciso il 25 set 2026). Tutto ciò che non è in tabella cade
 * nella frase generica, compreso un testo di Postgres: il messaggio del server
 * non arriva mai a schermo.
 *
 * Fino alla migrazione della #101 il server restituisce ancora le frasi di
 * prima: `LEGACY` le riconosce, così il passaggio non cambia niente a schermo.
 * Si toglie quando la migrazione è in produzione e i client vecchi sono
 * aggiornati.
 *
 * Non importa niente di piattaforma. Gemello di `entro-mobile/src/shared/lib/inviteErrorMessage.ts`.
 */
export const GENERIC_INVITE_ERROR = "Non è stato possibile accettare l'invito. Riprova."

const MESSAGES: Record<string, string> = {
  not_authenticated: 'Sessione scaduta. Accedi di nuovo.',
  invalid_code: 'Invito non valido',
  invalid_or_expired: 'Invito non valido o scaduto',
  expired: 'Questo invito è scaduto',
  unexpected: GENERIC_INVITE_ERROR,
}

/**
 * Le frasi che il server restituiva prima dei codici, con il codice che le
 * sostituisce. Coppie e non un oggetto: le frasi sono valori, non nomi.
 */
const LEGACY = new Map<string, string>([
  ['User not authenticated', 'not_authenticated'],
  ['Invito non valido', 'invalid_code'],
  ['Invito non valido o scaduto', 'invalid_or_expired'],
  ['Questo invito è scaduto', 'expired'],
  [GENERIC_INVITE_ERROR, 'unexpected'],
])

export function inviteErrorMessage(value: string | null | undefined): string {
  if (!value) return GENERIC_INVITE_ERROR
  const code = LEGACY.get(value) ?? value
  return MESSAGES[code] ?? GENERIC_INVITE_ERROR
}
