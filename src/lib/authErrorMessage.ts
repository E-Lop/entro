/**
 * Cosa dire all'utente quando Supabase Auth rifiuta una richiesta.
 *
 * La tabella è stata decisa il 18 set 2026, una volta per i due client
 * (entro-mobile#33, entro#100): si distingue solo dove sapere la causa aiuta
 * l'utente a sbloccarsi. `invalid_credentials` resta generico **di proposito**:
 * distinguere «questa email non esiste» da «password sbagliata» direbbe a
 * chiunque se un account c'è.
 *
 * Il riconoscimento è per `error.code`, mai per testo: lo prescrive la doc
 * Supabase, *Auth error codes* — «Always use `error.code` and `error.name` to
 * identify errors, not string matching on error messages». Tutto ciò che non è
 * in tabella cade nel generico, compreso il caso visto a schermo il 6 set
 * 2026: con l'auth spento `auth-js` mette nel messaggio la `Response`
 * serializzata, con l'URL dell'endpoint, e quell'errore non ha `code`.
 *
 * **La rete assente** è l'unico caso senza `code`: `auth-js` la segnala con un
 * `AuthRetryableFetchError` a `status` 0 (`fetch.ts`: «fetch failed (network /
 * CORS / aborted request)»). Si distingue perché l'utente può farci qualcosa
 * (deciso il 1 set 2026); un 5xx ha lo stesso nome ma lo stato vero, è un guasto
 * nostro e resta generico.
 *
 * Non importa niente di piattaforma né `supabase-js`: legge `code` da un
 * valore qualunque. Gemello di `entro-mobile/src/shared/lib/authErrorMessage.ts`.
 */
export const GENERIC_AUTH_ERROR = "Qualcosa è andato storto, riprova";

const ACCOUNT_EXISTS = "Esiste già un account con questa email";
const TOO_MANY_ATTEMPTS = "Troppi tentativi, riprova fra qualche minuto";

const MESSAGES = new Map<string, string>([
  ["invalid_credentials", "Email o password non corretti"],
  ["email_not_confirmed", "Conferma la tua email prima di accedere"],
  ["user_already_exists", ACCOUNT_EXISTS],
  ["email_exists", ACCOUNT_EXISTS],
  [
    "weak_password",
    "La password è troppo debole: scegline una più lunga o meno comune",
  ],
  ["same_password", "La nuova password deve essere diversa da quella attuale"],
  ["over_email_send_rate_limit", TOO_MANY_ATTEMPTS],
  ["over_request_rate_limit", TOO_MANY_ATTEMPTS],
  ["otp_expired", "Il link è scaduto, richiedine uno nuovo"],
]);

const UNREACHABLE =
  "Non riesco a raggiungere il server. Controlla la connessione e riprova";

export function authErrorMessage(error: unknown): string {
  if (typeof error !== "object" || error === null) return GENERIC_AUTH_ERROR;

  const { code, name, status } = error as {
    code?: unknown;
    name?: unknown;
    status?: unknown;
  };
  if (name === "AuthRetryableFetchError" && status === 0) return UNREACHABLE;
  return (typeof code === "string" && MESSAGES.get(code)) || GENERIC_AUTH_ERROR;
}
