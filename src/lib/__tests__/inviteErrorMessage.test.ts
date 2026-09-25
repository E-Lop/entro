/**
 * Dal codice che le RPC degli inviti restituiscono alla frase che l'utente
 * legge (#101). Il testo del server non arriva mai a schermo così com'è.
 */
import { describe, expect, it } from 'vitest'
import { inviteErrorMessage, GENERIC_INVITE_ERROR } from '@/lib/inviteErrorMessage'

describe('inviteErrorMessage', () => {
  it.each([
    ['not_authenticated', 'Sessione scaduta. Accedi di nuovo.'],
    ['invalid_code', 'Invito non valido'],
    ['invalid_or_expired', 'Invito non valido o scaduto'],
    ['expired', 'Questo invito è scaduto'],
    ['unexpected', GENERIC_INVITE_ERROR],
  ])('il codice «%s» diventa «%s»', (code, message) => {
    expect(inviteErrorMessage(code)).toBe(message)
  })

  // Fino alla migrazione della #101 il server restituisce ancora frasi: si
  // riconoscono, così il passaggio non cambia niente a schermo.
  it.each([
    ['User not authenticated', 'Sessione scaduta. Accedi di nuovo.'],
    ['Invito non valido', 'Invito non valido'],
    ['Invito non valido o scaduto', 'Invito non valido o scaduto'],
    ['Questo invito è scaduto', 'Questo invito è scaduto'],
    ["Non è stato possibile accettare l'invito. Riprova.", GENERIC_INVITE_ERROR],
  ])('la frase di oggi «%s» dà «%s»', (legacy, message) => {
    expect(inviteErrorMessage(legacy)).toBe(message)
  })

  it.each([
    ['un codice che non conosce', 'quota_exceeded'],
    ['un testo di Postgres', 'duplicate key value violates unique constraint "list_members_list_id_user_id_key"'],
    ['niente', null],
    ['una stringa vuota', ''],
  ])('con %s dà la frase generica', (_label, value) => {
    expect(inviteErrorMessage(value)).toBe(GENERIC_INVITE_ERROR)
  })
})
