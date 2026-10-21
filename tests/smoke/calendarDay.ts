/**
 * Il giorno di calendario di «oggi» per i dati di prova, qualunque sia il fuso
 * della macchina (#187).
 *
 * Sta in un modulo senza import perché lo leggono due mondi: la suite smoke,
 * che passa da vite, e lo script del seme (#234), che Node esegue direttamente
 * e che non risolve l'alias `@/`.
 */

/** Il fuso di «oggi», qualunque sia quello della macchina. */
export const SMOKE_TIME_ZONE = 'Europe/Rome'

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
