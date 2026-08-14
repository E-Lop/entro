/**
 * I tipi generati, ristretti dove il generatore non arriva.
 *
 * `foods.status`, `foods.storage_location` e `foods.quantity_unit` sono colonne
 * `text` con un `CHECK`, non tipi `enum` di Postgres. `supabase gen types` non
 * legge i check constraint, quindi da `supabase.types.ts` escono come `string`
 * e `string | null`: il vocabolario esiste nel database e si perde in
 * TypeScript, dove `updateFoodStatus(id, 'banana')` compilava.
 *
 * Qui il vocabolario rientra, e viene da **una sola** fonte lato TypeScript:
 * gli enum Zod di `validations/food.schemas.ts`, che sono anche l'unico dei
 * punti che ridichiaravano quelle liste a *fare* qualcosa a runtime.
 *
 * Il restringimento è sicuro perché il CHECK lo garantisce: sono i valori che
 * il database accetta, da qualunque client. Che le due liste restino uguali lo
 * tiene fermo `__tests__/foodVocabulary.test.ts`.
 *
 * Questo file va tenuto separato da `supabase.types.ts`, che `npm run
 * supabase:types` riscrive da capo a ogni rigenerazione.
 */
import type { Database as Generata } from './supabase.types'
import type {
  FoodStatus,
  QuantityUnit,
  StorageLocation,
} from './validations/food.schemas'

type TabelleGenerate = Generata['public']['Tables']

/**
 * Nullabilità e obbligatorietà ricalcano il DDL, non i desideri del codice:
 * `status` ha un default ma **non** è `not null`, e un CHECK non rifiuta NULL.
 * Restringere il vocabolario dichiarando anche non-nullo sarebbe scambiare una
 * correzione per due.
 */
type VocabolarioRow = {
  status: FoodStatus | null
  storage_location: StorageLocation
  quantity_unit: QuantityUnit | null
}

type VocabolarioInsert = {
  status?: FoodStatus | null
  storage_location: StorageLocation
  quantity_unit?: QuantityUnit | null
}

type VocabolarioUpdate = Partial<VocabolarioInsert>

type ColonneVocabolario = keyof VocabolarioRow

type FoodsRistretta = {
  Row: Omit<TabelleGenerate['foods']['Row'], ColonneVocabolario> & VocabolarioRow
  Insert: Omit<TabelleGenerate['foods']['Insert'], ColonneVocabolario> & VocabolarioInsert
  Update: Omit<TabelleGenerate['foods']['Update'], ColonneVocabolario> & VocabolarioUpdate
  Relationships: TabelleGenerate['foods']['Relationships']
}

export type Database = Omit<Generata, 'public'> & {
  public: Omit<Generata['public'], 'Tables'> & {
    Tables: Omit<TabelleGenerate, 'foods'> & { foods: FoodsRistretta }
  }
}
