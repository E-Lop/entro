// Single source of truth for expiry-status classification.
// Mirrors the canonical SQL view `foods_with_expiry_status` (see docs/development/DOMAIN_GLOSSARY.md).
// Pure classification only — no presentation (Tailwind) or localized strings.
import { differenceInDays } from 'date-fns'
import type { ExpiryStatus } from '@/types/food.types'

/** "Scade entro" imminente: giorni alla scadenza per `expires_soon`. */
export const EXPIRY_IMMINENT_DAYS = 2
/** Finestra "in scadenza": giorni alla scadenza per `expires_this_week` / filtro `expiring_soon`. */
export const EXPIRY_SOON_DAYS = 7

/** Normalize to local midnight so the diff is a whole calendar-day count, regardless of time of day. */
function toMidnight(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function parseValidDate(value: string | Date): Date {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid expiry date: ${String(value)}`)
  }
  return date
}

/**
 * Whole calendar days from `now` until `expiryDate` (negative if already past).
 * `now` is injectable for deterministic tests.
 */
export function getDaysUntilExpiry(expiryDate: string | Date, now: Date = new Date()): number {
  return differenceInDays(toMidnight(parseValidDate(expiryDate)), toMidnight(now))
}

/** Classify an expiry date into the canonical 5-state model. */
export function getExpiryStatus(expiryDate: string | Date, now: Date = new Date()): ExpiryStatus {
  const days = getDaysUntilExpiry(expiryDate, now)
  if (days < 0) return 'expired'
  if (days === 0) return 'expires_today'
  if (days <= EXPIRY_IMMINENT_DAYS) return 'expires_soon'
  if (days <= EXPIRY_SOON_DAYS) return 'expires_this_week'
  return 'fresh'
}

/** Statuses that count as "in scadenza" (0..7 days, not yet expired). */
const EXPIRING_SOON_STATUSES: readonly ExpiryStatus[] = ['expires_today', 'expires_soon', 'expires_this_week']

export function isExpired(status: ExpiryStatus): boolean {
  return status === 'expired'
}

export function isExpiringSoon(status: ExpiryStatus): boolean {
  return EXPIRING_SOON_STATUSES.includes(status)
}
