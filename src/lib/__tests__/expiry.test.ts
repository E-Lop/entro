import { describe, it, expect } from 'vitest'
import {
  getExpiryStatus,
  getDaysUntilExpiry,
  isExpired,
  isExpiringSoon,
  EXPIRY_IMMINENT_DAYS,
  EXPIRY_SOON_DAYS,
} from '../expiry'
import type { ExpiryStatus } from '@/types/food.types'

// Fixed reference "now" (local) so all cases are deterministic and timezone-stable.
const NOW = new Date(2026, 5, 14, 9, 30) // 14 giu 2026, 09:30 locale

/** A local Date exactly `n` calendar days from NOW (any time-of-day collapses to the same day). */
function inDays(n: number, hour = 12): Date {
  const d = new Date(2026, 5, 14, hour)
  d.setDate(d.getDate() + n)
  return d
}

describe('getExpiryStatus — boundary del modello canonico a 5 stati', () => {
  const cases: Array<[number, ExpiryStatus]> = [
    [-10, 'expired'],
    [-1, 'expired'],
    [0, 'expires_today'],
    [1, 'expires_soon'],
    [EXPIRY_IMMINENT_DAYS, 'expires_soon'], // 2 → confine imminente incluso
    [EXPIRY_IMMINENT_DAYS + 1, 'expires_this_week'], // 3 → appena oltre imminente
    [5, 'expires_this_week'],
    [EXPIRY_SOON_DAYS, 'expires_this_week'], // 7 → confine settimana incluso
    [EXPIRY_SOON_DAYS + 1, 'fresh'], // 8 → appena oltre la settimana
    [30, 'fresh'],
  ]

  it.each(cases)('a %i giorni → %s', (days, expected) => {
    expect(getExpiryStatus(inDays(days), NOW)).toBe(expected)
  })

  it('ignora l’ora del giorno (confronto per giorno-calendario)', () => {
    // expiry a tarda sera, now al mattino: stesso conteggio di giorni interi
    const nowMorning = new Date(2026, 5, 14, 1, 0)
    const expiryLateEvening = inDays(2, 23) // +2 giorni, 23:00
    expect(getExpiryStatus(expiryLateEvening, nowMorning)).toBe('expires_soon')
  })
})

describe('getDaysUntilExpiry', () => {
  it('conta i giorni interi alla scadenza (negativo se passato)', () => {
    expect(getDaysUntilExpiry(inDays(0), NOW)).toBe(0)
    expect(getDaysUntilExpiry(inDays(3), NOW)).toBe(3)
    expect(getDaysUntilExpiry(inDays(-4), NOW)).toBe(-4)
  })

  it('accetta sia stringhe ISO sia oggetti Date', () => {
    const iso = inDays(5).toISOString()
    expect(getDaysUntilExpiry(iso, NOW)).toBe(getDaysUntilExpiry(inDays(5), NOW))
  })
})

describe('validazione input', () => {
  const invalid = ['', 'not-a-date', '2026-13-99', 'ieri']

  it.each(invalid)('lancia su data non valida: %p', (value) => {
    expect(() => getExpiryStatus(value)).toThrow(/Invalid expiry date/)
    expect(() => getDaysUntilExpiry(value)).toThrow(/Invalid expiry date/)
  })
})

describe('predicati isExpired / isExpiringSoon', () => {
  const all: ExpiryStatus[] = ['expired', 'expires_today', 'expires_soon', 'expires_this_week', 'fresh']

  it('isExpired è vero solo per "expired"', () => {
    expect(all.filter(isExpired)).toEqual(['expired'])
  })

  it('isExpiringSoon copre 0..7 giorni (today/soon/this_week), non expired né fresh', () => {
    expect(all.filter(isExpiringSoon)).toEqual(['expires_today', 'expires_soon', 'expires_this_week'])
  })
})
