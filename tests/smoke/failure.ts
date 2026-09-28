/**
 * Come fallisce la suite di smoke: con una categoria scritta nel codice (#187).
 *
 * Il reporter stampa il messaggio di una `SmokeFailure` e di nient'altro,
 * quindi quel messaggio non deve mai contenere un valore arrivato dal server:
 * solo testo fisso e id fissi dei dati noti.
 */
export class SmokeFailure extends Error {
  constructor(category: string) {
    super(category)
    this.name = 'SmokeFailure'
  }
}

export function fail(category: string): never {
  throw new SmokeFailure(category)
}

export function check(condition: unknown, category: string): asserts condition {
  if (!condition) fail(category)
}

/**
 * I dati di una risposta di supabase-js, o un fallimento.
 *
 * supabase-js non lancia eccezioni: restituisce `{ error }`. Qui ogni errore
 * fa fallire il test, anche quando i dati sembrano giusti.
 */
export function must<T>(result: { data: T; error: unknown }, category: string): NonNullable<T> {
  if (result.error) fail(category)
  if (result.data === null || result.data === undefined) fail(category)
  return result.data as NonNullable<T>
}

/** Come `must`, per le scritture che non restituiscono dati. */
export function mustSucceed(result: { error: unknown }, category: string): void {
  if (result.error) fail(category)
}
