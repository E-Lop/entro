// Le forme con cui un'unità di quantità si presenta all'utente, al singolare e
// al plurale.
//
// Terza tabella di parole che passa dal bundle di famiglia, dopo gli stati di
// scadenza e i luoghi di conservazione: sta in
// `entro-family/core/storage-and-units.md`, sezione «Le forme leggibili delle
// unità», e `__tests__/unitLabels.test.ts` fa fallire questo file se dice
// qualcos'altro.
//
// Perché non stia dentro `quantity.ts`, che è l'unico consumatore: lì vivono
// passi e minimi, cioè aritmetica del dominio, e qui parole che un guardiano
// confronta con una sorgente esterna. Sono due dipendenze diverse dello stesso
// concetto, come `storageLabels.ts` accanto a `expiryLabels.ts`.
//
// Gemello di `entro-mobile/src/shared/lib/unitLabels.ts`: stesse parole, stessa
// regola, corrette nella stessa passata (entro-mobile#43).
import type { QuantityUnit } from '@/lib/validations/food.schemas'

/**
 * `one` e `other` sono le categorie cardinali CLDR, non nomi nostri.
 *
 * Cinque unità su sei sono **simboli** invariabili e ripetono la stessa parola
 * nelle due colonne: non è ridondanza da compattare con un fallback, è la
 * tabella che rende l'anomalia visibile — `confezioni` è un sostantivo
 * italiano finito in un elenco di simboli, ed è l'unica riga che varia.
 */
export type UnitForms = Readonly<{ one: string; other: string }>

export const UNIT_FORMS: Readonly<Record<QuantityUnit, UnitForms>> = {
  pz: { one: 'pz', other: 'pz' },
  kg: { one: 'kg', other: 'kg' },
  g: { one: 'g', other: 'g' },
  l: { one: 'l', other: 'l' },
  ml: { one: 'ml', other: 'ml' },
  confezioni: { one: 'confezione', other: 'confezioni' },
}

/**
 * La forma da mettere accanto a un numero.
 *
 * Il confronto con `1` **è** la regola CLDR per l'italiano, non una sua
 * semplificazione: `one` vale per `i = 1 and v = 0`, e l'unica unità che varia
 * è intera, quindi `v = 0` sempre. Il ragionamento per esteso, con il motivo
 * per cui `Intl.PluralRules` non è la strada, sta nel bundle accanto alla
 * tabella.
 *
 * Senza numero (`null`, cioè quantità non tracciata) non c'è niente con cui
 * accordarsi e si cita la forma generica, che in italiano è il plurale.
 */
export function unitLabel(value: number | null | undefined, unit: QuantityUnit): string {
  return UNIT_FORMS[unit][value === 1 ? 'one' : 'other']
}
