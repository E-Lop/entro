/**
 * Il seme degli alimenti di prova: lettura, date e controlli (#234).
 *
 * Il contenuto non sta qui: è `conventions/test-data-seed.json` del bundle di
 * famiglia, e il perché di ogni riga è scritto in `conventions/test-data.md`.
 * Qui c'è solo ciò che serve a eseguirlo (`seed.ts`) e a sorvegliarlo
 * (`testDataSeed.family.test.ts`).
 *
 * Node esegue questo file direttamente, senza build: gli import relativi hanno
 * l'estensione `.ts`, e niente passa dall'alias `@/`.
 */
import { addDays } from '../../tests/smoke/calendarDay.ts'

/** Una riga del seme, con i nomi dei campi del JSON. */
export interface SeedFood {
  category: string
  name: string
  storage: string
  quantity: number
  unit: string
  /** Scarto in giorni dal giorno in cui si esegue. */
  days: number
  /** Lo stato che quello scarto deve produrre: un'aspettativa, non un dato da scrivere. */
  expiryStatus: string
  notes?: string
}

/** I valori che `core/` del bundle dichiara, contro cui si misura il seme. */
export interface SeedVocabulary {
  categories: readonly string[]
  storages: readonly string[]
  units: readonly string[]
  statuses: readonly string[]
}

const TEXT_FIELDS = ['category', 'name', 'storage', 'unit', 'expiryStatus'] as const
const NUMBER_FIELDS = ['quantity', 'days'] as const

/**
 * Il seme dal testo del JSON, controllato nella forma.
 *
 * Un campo mancante o del tipo sbagliato ferma tutto con il nome della riga:
 * scritto nel database diventerebbe una colonna nulla, che la RLS o un
 * `CHECK` rifiuterebbero più avanti con un messaggio che non dice quale riga.
 */
export function parseSeed(text: string): SeedFood[] {
  const data: unknown = JSON.parse(text)
  if (!Array.isArray(data)) throw new Error('il seme non è un array di righe')

  return data.map((row: Record<string, unknown>, index) => {
    const label = typeof row?.name === 'string' ? `«${row.name}»` : `riga ${index + 1}`
    for (const field of TEXT_FIELDS) {
      if (typeof row?.[field] !== 'string') throw new Error(`${label}: «${field}» manca o non è testo`)
    }
    for (const field of NUMBER_FIELDS) {
      if (typeof row[field] !== 'number') throw new Error(`${label}: «${field}» manca o non è un numero`)
    }
    if (row.notes !== undefined && typeof row.notes !== 'string') {
      throw new Error(`${label}: «notes» non è testo`)
    }
    return row as unknown as SeedFood
  })
}

/** La data di scadenza di una riga, `AAAA-MM-GG`, contata da `today`. */
export function seedExpiryDate(food: SeedFood, today: string): string {
  return addDays(today, food.days)
}

const FIELD_WORDS = [
  { field: 'category', word: 'categoria', unknown: 'sconosciuta', list: 'categories' },
  { field: 'storage', word: 'conservazione', unknown: 'sconosciuta', list: 'storages' },
  { field: 'unit', word: 'unità', unknown: 'sconosciuta', list: 'units' },
  { field: 'expiryStatus', word: 'stato', unknown: 'sconosciuto', list: 'statuses' },
] as const

/**
 * Cosa non va nel seme rispetto al bundle: una frase per problema, vuota se è
 * tutto a posto.
 *
 * - ogni riga dichiara lo stato che la sua data produce, visto da `today`;
 * - ogni valore sta nel vocabolario di `core/`;
 * - ogni valore del vocabolario ha almeno una riga.
 *
 * `statusOf` è iniettato perché la classificazione vive in `@/lib/expiry`, che
 * Node non risolve: il guardiano passa quella vera.
 */
export function seedProblems(
  seed: readonly SeedFood[],
  vocabulary: SeedVocabulary,
  statusOf: (expiryDate: string, today: string) => string,
  today: string
): string[] {
  const problems: string[] = []

  for (const food of seed) {
    const actual = statusOf(seedExpiryDate(food, today), today)
    if (actual !== food.expiryStatus) {
      problems.push(`stato dichiarato in «${food.name}»: ${food.expiryStatus}, la data produce ${actual}`)
    }
  }

  for (const { field, word, unknown, list } of FIELD_WORDS) {
    const known = vocabulary[list]
    for (const food of seed) {
      if (!known.includes(food[field])) problems.push(`${word} ${unknown} in «${food.name}»: ${food[field]}`)
    }
    for (const value of known) {
      if (!seed.some((food) => food[field] === value)) problems.push(`${word} senza righe: ${value}`)
    }
  }

  return problems
}
