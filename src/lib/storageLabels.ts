// Le parole con cui il luogo di conservazione si presenta all'utente.
//
// Stessa natura delle etichette di scadenza: sono **dominio**, non
// presentazione. Vivono nel bundle di famiglia — `entro-family/core/
// storage-and-units.md`, sezione «Le parole che l'utente legge» — e questo
// modulo è la loro trascrizione in codice, identica sui due client
// ([entro-mobile#82](https://github.com/E-Lop/entro-mobile/issues/82)).
//
// Un modulo suo e non insieme a `expiryLabels.ts`, perché nel bundle sono due
// pagine diverse: i due guardiani leggono file diversi.
//
// Le parole c'erano già nel bundle prima di questa fetta, in fondo alla riga
// di `StorageLocation`, e i due client le copiavano di lì **correttamente**.
// Quello che mancava era una tabella leggibile da un test: la corrispondenza
// era giusta e niente avrebbe fatto rumore se avesse smesso di esserlo.
//
// `src/lib/__tests__/storageLabels.test.ts` legge la tabella e fa fallire
// questo file se dice qualcos'altro.
import type { StorageLocation } from '@/lib/validations/food.schemas'

export const STORAGE_LABELS: Readonly<Record<StorageLocation, string>> = {
  fridge: 'Frigo',
  freezer: 'Freezer',
  pantry: 'Dispensa',
}
