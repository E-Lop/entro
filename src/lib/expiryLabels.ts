// Le parole con cui lo stato di scadenza si presenta all'utente.
//
// Sono **dominio**, non presentazione: due client che etichettassero lo stesso
// alimento in modo diverso mostrerebbero *dati diversi*, non un'interazione
// diversa. Vivono quindi nel bundle di famiglia — `entro-family/core/
// expiry-status.md`, sezione «Le parole che l'utente legge» — e questo modulo
// è la loro trascrizione in codice, identica sui due client
// ([entro-mobile#44](https://github.com/E-Lop/entro-mobile/issues/44)).
//
// Prima erano scritte a mano in due posti: qui dentro `FoodCard.tsx`,
// accoppiate alle classi Tailwind, e in `expiryPresentation.ts` sul client
// nativo. Coincidevano per copia manuale, e niente avrebbe fatto rumore se
// avessero smesso.
//
// **I colori non sono qui**, ed è deliberato: `bg-destructive` di questo
// progetto e `bg-scaduto-fondo` di NativeWind non sono la stessa cosa e non
// devono esserlo. La linea passa fra la parola e il colore.
//
// `src/lib/__tests__/expiryLabels.test.ts` legge la tabella del bundle e fa
// fallire questo file se dice qualcos'altro.
import type { ExpiryStatus } from '@/types/food.types'

/** Gli stati che hanno una parola propria invece del conteggio dei giorni. */
export const EXPIRY_LABELS: Readonly<Record<'expired' | 'expires_today', string>> = {
  expired: 'Scaduto',
  expires_today: 'Scade oggi',
}

/**
 * Il conteggio con l'unità accordata.
 *
 * Il singolare non è un caso di scuola: capita ogni volta che un alimento
 * scade domani.
 */
export function formatDaysLabel(days: number): string {
  return `${days} ${days === 1 ? 'giorno' : 'giorni'}`
}

/**
 * L'etichetta dello stato, dato lo stato e i giorni già calcolati.
 *
 * `days` arriva da `getDaysUntilExpiry` invece di essere ricalcolato qui: due
 * letture del tempo a distanza di un istante possono cadere in giorni diversi,
 * e questo modulo resta senza dipendenze dall'orologio.
 */
export function getExpiryLabel(status: ExpiryStatus, days: number): string {
  switch (status) {
    case 'expired':
      return EXPIRY_LABELS.expired
    case 'expires_today':
      return EXPIRY_LABELS.expires_today
    case 'expires_soon':
    case 'expires_this_week':
    case 'fresh':
      return formatDaysLabel(days)
  }
}
