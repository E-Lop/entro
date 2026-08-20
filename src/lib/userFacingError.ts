/**
 * Errore destinato all'utente, con l'originale conservato per la diagnosi.
 *
 * I messaggi che tornano dal server — Postgres via `error.message`, oppure il
 * campo `error` nel corpo di una Edge Function — sono in inglese, citano nomi
 * di tabella e possono contenere identificativi. I client li mostrano in un
 * toast o a schermo, e uno screenshot li porta più lontano di un log.
 *
 * Quello che l'utente legge è `message`; il dettaglio tecnico resta in `cause`,
 * che nessun percorso dell'app porta a schermo ma che resta disponibile a chi
 * diagnostica.
 *
 * (Da non estendere a «`cause` non finisce nei log»: dalla BCD
 * `javascript.builtins.Error.cause`, il logging predefinito della console non
 * lo stampa su Safari, ma lo stampa su Chrome dalla 125.)
 *
 * Stessa decisione applicata su entro-mobile, sulle copie condivise di
 * `foods.ts` e `invites.ts`.
 */
export function userFacingError(message: string, cause: unknown): Error {
  return new Error(message, { cause })
}
