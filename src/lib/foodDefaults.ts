import type { StorageLocation } from './validations/food.schemas'

/**
 * I valori che la categoria scelta suggerisce al form.
 *
 * Una sola regola vive qui, ed è **dominio**: la categoria pre-compila il
 * *luogo di conservazione*, e nient'altro. Sta in `src/shared/` perché la
 * risposta non può dipendere dal client — un utente che sceglie «Latticini»
 * sulla PWA e sull'app deve vedere proposto lo stesso luogo, o i due client
 * mostrerebbero dati diversi.
 *
 * ⚠️ **La shelf-life media NON pre-compila la data di scadenza.** Il bundle
 * (`core/categories.md`) lo diceva fino al 4 set 2026 ed è stato corretto:
 * descriveva un comportamento che nessun client ha mai avuto. La ragione è
 * scritta nel form di entro — le stime variano troppo con la condizione del
 * prodotto, come dice il commento nel form qui accanto — e una data
 * pre-compilata sbagliata è peggio di un campo vuoto,
 * perché sembra un dato e viene salvata senza guardarla. Se qualcuno tornerà
 * a proporlo, la decisione da riaprire è la 3 del 4 settembre 2026.
 */

/** La forma minima che serve di una categoria: il resto non entra in gioco. */
export interface CategoryWithDefaultStorage {
  default_storage: StorageLocation
}

export interface StorageContext {
  /** Il luogo attualmente nel form, o `null` se non ne ha ancora uno. */
  current: StorageLocation | null
  /**
   * Se l'utente ha **toccato** il controllo del luogo, almeno una volta.
   *
   * Non è «il valore è diverso dal predefinito»: un utente che sceglie a mano
   * proprio il luogo che la categoria avrebbe proposto ha comunque deciso, e
   * un cambio di categoria successivo non deve scavalcarlo.
   */
  touched: boolean
  /**
   * `true` in creazione, `false` in modifica.
   *
   * In modifica il luogo è un dato che l'utente ha già scelto — magari mesi
   * fa, magari proprio contro il predefinito — e cambiare categoria non è il
   * permesso di riscriverlo.
   */
  isCreate: boolean
}

/**
 * Il luogo che il form deve mostrare dopo che la categoria è cambiata.
 *
 * Restituisce sempre un valore da usare, mai un'istruzione: il chiamante lo
 * assegna e basta, senza replicare le condizioni. Torna `current` immutato in
 * tutti i casi in cui non c'è niente da suggerire.
 */
export function storageLocationForCategory(
  category: CategoryWithDefaultStorage | null | undefined,
  { current, touched, isCreate }: StorageContext
): StorageLocation | null {
  if (!isCreate) return current
  if (touched) return current
  if (!category) return current
  return category.default_storage
}
