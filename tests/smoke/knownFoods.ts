/**
 * I dati noti della sentinella A: la definizione unica, usata dal ripristino e
 * dalle verifiche (#187).
 *
 * Cinque alimenti con id fissi, uno per stato di scadenza. Le date non sono
 * scritte qui: sono offset dal giorno del ripristino, ricavati dalle soglie di
 * `getExpiryStatus()`, così una soglia che cambia sposta anche l'offset.
 */
import { EXPIRY_IMMINENT_DAYS, EXPIRY_SOON_DAYS, getExpiryStatus } from '@/lib/expiry'
import type { ExpiryStatus } from '@/types/food.types'

/** Il fuso di «oggi», qualunque sia quello della macchina. */
export const SMOKE_TIME_ZONE = 'Europe/Rome'

export interface KnownFood {
  id: string
  name: string
  expectedStatus: ExpiryStatus
  offsetDays: number
  hasPhoto: boolean
}

export const KNOWN_FOODS: readonly KnownFood[] = [
  {
    id: '5e7ee1a0-0187-4000-8000-000000000001',
    name: 'Sentinella scaduta',
    expectedStatus: 'expired',
    offsetDays: -1,
    hasPhoto: false,
  },
  {
    id: '5e7ee1a0-0187-4000-8000-000000000002',
    name: 'Sentinella scade oggi',
    expectedStatus: 'expires_today',
    offsetDays: 0,
    hasPhoto: false,
  },
  {
    id: '5e7ee1a0-0187-4000-8000-000000000003',
    name: 'Sentinella scade a breve',
    expectedStatus: 'expires_soon',
    offsetDays: EXPIRY_IMMINENT_DAYS,
    hasPhoto: false,
  },
  {
    id: '5e7ee1a0-0187-4000-8000-000000000004',
    name: 'Sentinella scade in settimana',
    expectedStatus: 'expires_this_week',
    offsetDays: EXPIRY_SOON_DAYS,
    hasPhoto: false,
  },
  {
    id: '5e7ee1a0-0187-4000-8000-000000000005',
    name: 'Sentinella fresca',
    expectedStatus: 'fresh',
    offsetDays: EXPIRY_SOON_DAYS + 1,
    hasPhoto: true,
  },
]

/** La categoria dei dati noti, per nome: gli id sono diversi in ogni database. */
export const KNOWN_CATEGORY_NAME = 'dairy'

export const KNOWN_PHOTO_NAME = 'smoke-known.jpg'

/** Il percorso della foto nota nel bucket: la cartella di A, come vogliono le policy. */
export function knownPhotoPath(userId: string): string {
  return `${userId}/${KNOWN_PHOTO_NAME}`
}

/** Un JPEG valido da 1×1: basta a far esistere l'oggetto, e il bucket accetta solo immagini. */
export const KNOWN_PHOTO_BYTES = Uint8Array.from(
  atob(
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA='
  ),
  (char) => char.charCodeAt(0)
)

/** Il giorno di calendario di un istante a Roma, `AAAA-MM-GG`. */
export function romeDay(instant: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SMOKE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant)
}

/** `day` più `n` giorni di calendario. Aritmetica in UTC: nessun cambio d'ora di mezzo. */
export function addDays(day: string, n: number): string {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, date + n)).toISOString().slice(0, 10)
}

/** Mezzanotte locale di un giorno `AAAA-MM-GG`, costruita dai numeri e non dalla stringa. */
function localMidnight(day: string): Date {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(year, month - 1, date)
}

/**
 * Lo stato di scadenza di `expiryDate` visto dal giorno `referenceDay`.
 *
 * `getExpiryStatus` lavora sulle mezzanotti locali: passandogli due mezzanotti
 * costruite dai numeri, il risultato non dipende dal fuso della macchina.
 */
export function statusOn(expiryDate: string, referenceDay: string): ExpiryStatus {
  return getExpiryStatus(localMidnight(expiryDate), localMidnight(referenceDay))
}

/** Le colonne di `foods` che il controllo legge. */
export interface KnownFoodRow {
  id: string
  name: string
  expiry_date: string
  updated_at: string
  deleted_at: string | null
  image_url: string | null
}

/**
 * Cosa non va nelle righe della lista di A rispetto ai dati noti: una
 * categoria per problema, vuota se è tutto a posto.
 *
 * Il giorno di riferimento di ogni alimento è quello del suo `updated_at` a
 * Roma, non «oggi». Le categorie nominano solo id fissi: un id estraneo è un
 * valore del database, e non si stampa.
 */
export function checkKnownFoods(rows: readonly KnownFoodRow[], userId: string): string[] {
  const problems: string[] = []
  const byId = new Map(rows.map((row) => [row.id, row]))

  if (rows.some((row) => !KNOWN_FOODS.some((food) => food.id === row.id))) {
    problems.push('alimenti estranei nella lista')
  }

  for (const food of KNOWN_FOODS) {
    const row = byId.get(food.id)
    if (!row) {
      problems.push(`alimento noto mancante: ${food.id}`)
      continue
    }
    if (row.deleted_at !== null) problems.push(`alimento noto tolto: ${food.id}`)
    if (row.name !== food.name) problems.push(`nome cambiato: ${food.id}`)

    const restoreDay = romeDay(new Date(row.updated_at))
    if (row.expiry_date !== addDays(restoreDay, food.offsetDays)) {
      problems.push(`data spostata: ${food.id}`)
    } else if (statusOn(row.expiry_date, restoreDay) !== food.expectedStatus) {
      problems.push(`stato di scadenza inatteso: ${food.id}`)
    }

    const expectedImage = food.hasPhoto ? knownPhotoPath(userId) : null
    if (row.image_url !== expectedImage) problems.push(`foto nota non collegata: ${food.id}`)
  }

  return problems
}
