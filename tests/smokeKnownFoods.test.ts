/**
 * I dati noti della suite di smoke, e il controllo che il livello (a) fa su di
 * essi (#187).
 *
 * Il controllo confronta ogni data con il giorno del **suo ultimo ripristino**,
 * letto da `updated_at` in `Europe/Rome`, e non con «oggi»: fra la mezzanotte e
 * la riscrittura quotidiana le date di ieri sono ancora quelle giuste.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getExpiryStatus } from '@/lib/expiry'
import {
  KNOWN_FOODS,
  addDays,
  checkKnownFoods,
  knownPhotoPath,
  romeDay,
  statusOn,
  type KnownFoodRow,
} from './smoke/knownFoods'

const USER_ID = '00000000-0000-4000-8000-00000000000a'

/** Le righe come le scrive il ripristino, all'istante `restoredAt`. */
function restoredRows(restoredAt: string): KnownFoodRow[] {
  const day = romeDay(new Date(restoredAt))
  return KNOWN_FOODS.map((food) => ({
    id: food.id,
    name: food.name,
    expiry_date: addDays(day, food.offsetDays),
    updated_at: restoredAt,
    deleted_at: null,
    image_url: food.hasPhoto ? knownPhotoPath(USER_ID) : null,
  }))
}

afterEach(() => {
  vi.useRealTimers()
})

describe('i dati noti', () => {
  it('coprono i cinque stati di scadenza, uno per alimento', () => {
    expect(KNOWN_FOODS.map((food) => food.expectedStatus).sort()).toEqual(
      ['expired', 'expires_soon', 'expires_this_week', 'expires_today', 'fresh']
    )
  })

  it('hanno id fissi e distinti, e una foto sola', () => {
    expect(new Set(KNOWN_FOODS.map((food) => food.id)).size).toBe(5)
    expect(KNOWN_FOODS.filter((food) => food.hasPhoto)).toHaveLength(1)
  })

  it('ogni offset produce lo stato dichiarato secondo getExpiryStatus', () => {
    for (const food of KNOWN_FOODS) {
      expect(statusOn(addDays('2026-09-28', food.offsetDays), '2026-09-28')).toBe(food.expectedStatus)
    }
  })

  it('gli offset stanno sui bordi delle soglie: un giorno in più cambia stato', () => {
    // Se le soglie cambiano e gli offset restano scritti a mano, questo diventa
    // rosso: un offset derivato si sposta con la soglia.
    for (const food of KNOWN_FOODS.filter((f) => f.expectedStatus !== 'fresh')) {
      expect(statusOn(addDays('2026-09-28', food.offsetDays + 1), '2026-09-28')).not.toBe(food.expectedStatus)
    }
  })
})

describe('i giorni in Europe/Rome', () => {
  it('le 22:30 UTC sono già il giorno dopo a Roma, d’estate', () => {
    expect(romeDay(new Date('2026-09-28T22:30:00Z'))).toBe('2026-09-29')
  })

  it('le 23:30 UTC d’inverno sono il giorno dopo, le 22:30 no', () => {
    expect(romeDay(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01')
    expect(romeDay(new Date('2026-12-31T22:30:00Z'))).toBe('2026-12-31')
  })

  it('addDays attraversa mesi, anni e il cambio d’ora', () => {
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('statusOn non dipende dal fuso della macchina', () => {
    const original = process.env.TZ
    try {
      for (const tz of ['UTC', 'Pacific/Honolulu', 'Pacific/Kiritimati', 'Europe/Rome']) {
        process.env.TZ = tz
        expect(statusOn('2026-09-28', '2026-09-28')).toBe('expires_today')
        expect(statusOn('2026-09-27', '2026-09-28')).toBe('expired')
      }
    } finally {
      process.env.TZ = original
    }
  })

  it('statusOn è getExpiryStatus a mezzanotte del giorno di riferimento', () => {
    expect(statusOn('2026-10-05', '2026-09-28')).toBe(getExpiryStatus(new Date(2026, 9, 5), new Date(2026, 8, 28)))
  })
})

describe('checkKnownFoods', () => {
  it('non trova niente da dire subito dopo un ripristino', () => {
    expect(checkKnownFoods(restoredRows('2026-09-28T08:00:00Z'), USER_ID)).toEqual([])
  })

  it('resta verde dopo mezzanotte, prima della riscrittura: il giorno è quello del ripristino', () => {
    // Ripristino alle 23:59 del 28 a Roma, controllo alle 00:01 del 29.
    const rows = restoredRows('2026-09-28T21:59:00Z')
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-28T22:01:00Z'))
    expect(checkKnownFoods(rows, USER_ID)).toEqual([])
  })

  it('un alimento noto mancante', () => {
    const rows = restoredRows('2026-09-28T08:00:00Z').filter((row) => row.id !== KNOWN_FOODS[1].id)
    expect(checkKnownFoods(rows, USER_ID)).toEqual([`alimento noto mancante: ${KNOWN_FOODS[1].id}`])
  })

  it('una data spostata di un giorno', () => {
    const rows = restoredRows('2026-09-28T08:00:00Z')
    rows[2] = { ...rows[2], expiry_date: addDays(rows[2].expiry_date, 1) }
    expect(checkKnownFoods(rows, USER_ID)).toEqual([`data spostata: ${KNOWN_FOODS[2].id}`])
  })

  it('un alimento noto tolto dalla lista', () => {
    const rows = restoredRows('2026-09-28T08:00:00Z')
    rows[0] = { ...rows[0], deleted_at: '2026-09-28T09:00:00Z' }
    expect(checkKnownFoods(rows, USER_ID)).toEqual([`alimento noto tolto: ${KNOWN_FOODS[0].id}`])
  })

  it('un nome cambiato', () => {
    const rows = restoredRows('2026-09-28T08:00:00Z')
    rows[3] = { ...rows[3], name: 'Altro' }
    expect(checkKnownFoods(rows, USER_ID)).toEqual([`nome cambiato: ${KNOWN_FOODS[3].id}`])
  })

  it('la foto nota scollegata', () => {
    const rows = restoredRows('2026-09-28T08:00:00Z')
    const index = KNOWN_FOODS.findIndex((food) => food.hasPhoto)
    rows[index] = { ...rows[index], image_url: null }
    expect(checkKnownFoods(rows, USER_ID)).toEqual([`foto nota non collegata: ${KNOWN_FOODS[index].id}`])
  })

  it('un alimento in più, senza nominarne l’id: è un valore del database', () => {
    const rows = [...restoredRows('2026-09-28T08:00:00Z'), { ...restoredRows('2026-09-28T08:00:00Z')[0], id: 'estraneo' }]
    expect(checkKnownFoods(rows, USER_ID)).toEqual(['alimenti estranei nella lista'])
  })
})
