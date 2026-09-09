/**
 * Il vocabolario delle colonne `text` + CHECK, confrontato con gli enum Zod.
 *
 * `foods.status`, `foods.storage_location` e `foods.quantity_unit` non sono
 * tipi `enum` di Postgres: sono `text` con un `CHECK`. Il generatore di tipi
 * Supabase **non legge i check constraint**, quindi da `supabase gen types`
 * escono `string | null` e il vocabolario si perde per strada.
 *
 * Il pavimento è quindi di due definizioni, non una: il CHECK, che è l'unico
 * punto che rifiuta davvero una scrittura sbagliata — anche da un client che
 * non è questo — e gli enum Zod, che sono la fonte unica lato TypeScript.
 *
 * Questo test tiene ferma la cucitura fra le due. Senza, la divergenza
 * passerebbe in silenzio: è esattamente il modo in cui il difetto della issue
 * #85 si è formato.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Food, FoodUpdate } from '@/lib/foods'
import {
  statusEnum,
  storageLocationEnum,
  quantityUnitEnum,
} from '@/lib/validations/food.schemas'

/**
 * Asserzioni di tipo: non girano con vitest, si verificano con `tsc -b`.
 *
 * `@ts-expect-error` fallisce in **due** direzioni, ed è ciò che serve qui: se
 * il tipo torna largo la direttiva diventa inutilizzata e il compilatore lo
 * segnala. La riga è quindi rossa oggi, quando `Food['status']` è `string |
 * null` e `'banana'` passa, e resta a guardia dopo.
 */

// @ts-expect-error — 'banana' non è un esito: il vocabolario è quello del CHECK
export const inventedOutcome: Food['status'] = 'banana'

// @ts-expect-error — 'garage' non è un luogo di conservazione
export const inventedStorage: Food['storage_location'] = 'garage'

// @ts-expect-error — 'litri' non è un'unità: le unità sono 'l' e 'ml'
export const inventedUnit: Food['quantity_unit'] = 'litri'

// @ts-expect-error — nemmeno una UPDATE può scrivere un esito fuori vocabolario
export const inventedWrite: FoodUpdate = { status: 'banana' }

const MIGRATIONS_FOLDER = join(process.cwd(), 'supabase', 'migrations')

function migrationFile(): string[] {
  return readdirSync(MIGRATIONS_FOLDER)
    .filter((name) => name.endsWith('.sql'))
    .map((name) => readFileSync(join(MIGRATIONS_FOLDER, name), 'utf8'))
}

/**
 * Il corpo di `create table public.foods (...)`.
 *
 * Delimitare il blocco non è pignoleria: `invites` ha una colonna `status` con
 * un CHECK suo (`pending`/`accepted`/`expired`), e un confronto fatto su tutto
 * il file la scambierebbe per quella di `foods`, verificando la cosa sbagliata
 * con l'aria di funzionare.
 */
function foodsTableBody(): string {
  const blocks = migrationFile().flatMap((sql) => {
    const start = sql.indexOf('create table public.foods (')
    if (start === -1) return []
    const fine = sql.indexOf('\n);', start)
    return [sql.slice(start, fine)]
  })

  expect(
    blocks,
    'atteso un solo `create table public.foods` fra le migrazioni'
  ).toHaveLength(1)

  return blocks[0]
}

/** I valori fra apici dentro `<colonna> = any (array[...])`. */
function allowedCheckValues(column: string): string[] {
  const pattern = new RegExp(
    `${column}\\s*=\\s*any\\s*\\(\\s*array\\[([^\\]]*)\\]`,
    'i'
  )
  const found = foodsTableBody().match(pattern)

  expect(found, `nessun CHECK trovato per la colonna ${column}`).not.toBeNull()

  return [...found![1].matchAll(/'([^']*)'/g)].map((m) => m[1])
}

describe('vocabolario delle colonne text + CHECK', () => {
  it.each([
    ['status', statusEnum],
    ['storage_location', storageLocationEnum],
    ['quantity_unit', quantityUnitEnum],
  ])('l\'enum Zod di %s elenca gli stessi valori del CHECK', (column, enumZod) => {
    expect([...enumZod.options].sort()).toEqual(allowedCheckValues(column).sort())
  })

  /**
   * Il confronto qui sopra legge la definizione originale della tabella. Una
   * migrazione successiva che sostituisse il constraint lo lascerebbe passare
   * mentre verifica una riga di SQL ormai superata — cioè un test verde che non
   * prova più niente. Meglio farlo fallire e costringere a riscriverlo.
   */
  it('nessuna migrazione successiva ridefinisce quei CHECK', () => {
    const ridefinizioni = migrationFile().flatMap((sql) => [
      ...sql.matchAll(
        /alter\s+table[^;]*\bfoods\b[^;]*\bcheck\b[^;]*\b(status|storage_location|quantity_unit)\b/gis
      ),
    ])

    expect(
      ridefinizioni.map((m) => m[0]),
      'un CHECK è stato ridefinito: aggiorna questo test perché legga la definizione valida'
    ).toEqual([])
  })
})
