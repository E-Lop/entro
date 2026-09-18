import { describe, expect, it } from "vitest";
import {
  AuthApiError,
  AuthRetryableFetchError,
  AuthWeakPasswordError,
} from "@supabase/auth-js";
import { GENERIC_AUTH_ERROR, authErrorMessage } from "../authErrorMessage";

/**
 * La tabella decisa il 18 set 2026 (entro-mobile#33, entro#100). Gli errori
 * sono costruiti con le classi vere di `auth-js`, non con oggetti finti: il
 * test prova anche che `code` stia dove il modulo lo cerca.
 */
describe("authErrorMessage", () => {
  it.each([
    ["invalid_credentials", "Email o password non corretti"],
    ["email_not_confirmed", "Conferma la tua email prima di accedere"],
    ["user_already_exists", "Esiste già un account con questa email"],
    ["email_exists", "Esiste già un account con questa email"],
    [
      "same_password",
      "La nuova password deve essere diversa da quella attuale",
    ],
    [
      "over_email_send_rate_limit",
      "Troppi tentativi, riprova fra qualche minuto",
    ],
    ["over_request_rate_limit", "Troppi tentativi, riprova fra qualche minuto"],
    ["otp_expired", "Il link è scaduto, richiedine uno nuovo"],
  ])("%s → «%s»", (code, message) => {
    expect(
      authErrorMessage(new AuthApiError("English from the server", 400, code)),
    ).toBe(message);
  });

  it("la password debole ha il suo messaggio", () => {
    const error = new AuthWeakPasswordError("Password should be…", 422, [
      "length",
    ]);

    expect(authErrorMessage(error)).toBe(
      "La password è troppo debole: scegline una più lunga o meno comune",
    );
  });

  // Il messaggio del server è generico **di proposito**: distinguere «email
  // inesistente» da «password sbagliata» direbbe a chiunque se un account c'è.
  it("non distingue l’utente inesistente dalla password sbagliata", () => {
    const wrongPassword = new AuthApiError(
      "Invalid login credentials",
      400,
      "invalid_credentials",
    );
    const noUser = new AuthApiError("User not found", 400, "user_not_found");

    expect(authErrorMessage(noUser)).toBe(GENERIC_AUTH_ERROR);
    expect(authErrorMessage(wrongPassword)).not.toMatch(/esiste|registrat/i);
  });

  it("un codice che non è in tabella cade nel generico, mai nel testo del server", () => {
    const error = new AuthApiError(
      "Signups not allowed for this instance",
      422,
      "signup_disabled",
    );

    expect(authErrorMessage(error)).toBe(GENERIC_AUTH_ERROR);
  });

  // Il caso visto a schermo il 6 set 2026: auth spento, e `auth-js` mette nel
  // messaggio la `Response` serializzata, con l'URL dell'endpoint.
  it("il 503 col corpo serializzato non porta a schermo né JSON né URL", () => {
    const body =
      '{"status":503,"statusText":"service unavailable","url":"http://127.0.0.1:54321/auth/v1/token?grant_type=password"}';

    const message = authErrorMessage(new AuthRetryableFetchError(body, 503));

    expect(message).toBe(GENERIC_AUTH_ERROR);
    expect(message).not.toMatch(/http|503|\{/);
  });

  // Deciso il 1 set 2026 (entro-mobile#33): la rete assente si distingue, perché
  // l'utente può farci qualcosa. `auth-js` la segnala con `status` 0
  // (`fetch.ts`: «fetch failed (network / CORS / aborted request)»); un 5xx ha
  // lo stesso nome ma lo stato vero, ed è un guasto nostro: resta generico.
  it("la rete assente ha il suo messaggio, il server guasto no", () => {
    const offline = new AuthRetryableFetchError("Network request failed", 0);
    const serverDown = new AuthRetryableFetchError("{}", 502);

    expect(authErrorMessage(offline)).toBe(
      "Non riesco a raggiungere il server. Controlla la connessione e riprova",
    );
    expect(authErrorMessage(serverDown)).toBe(GENERIC_AUTH_ERROR);
  });

  it("uno status 0 senza il nome giusto non basta", () => {
    expect(authErrorMessage({ status: 0 })).toBe(GENERIC_AUTH_ERROR);
    expect(authErrorMessage(Object.assign(new Error("x"), { status: 0 }))).toBe(
      GENERIC_AUTH_ERROR,
    );
  });

  // Il riconoscimento è per `code`, mai per testo (doc Supabase, *Auth error
  // codes*): un messaggio che *somiglia* a un caso noto non basta.
  it("non riconosce un errore dal testo", () => {
    expect(authErrorMessage(new Error("Invalid login credentials"))).toBe(
      GENERIC_AUTH_ERROR,
    );
    expect(authErrorMessage({ message: "Invalid login credentials" })).toBe(
      GENERIC_AUTH_ERROR,
    );
  });

  it.each([
    [null],
    [undefined],
    ["stringa"],
    [42],
    [{}],
    [{ code: 7 }],
    [{ code: "__proto__" }],
  ])("un valore qualunque (%p) dà il generico senza lanciare", (value) => {
    expect(authErrorMessage(value)).toBe(GENERIC_AUTH_ERROR);
  });
});
