/**
 * L'etichetta di scadenza che la card di un alimento noto deve mostrare (#191).
 *
 * Vale nel giorno del ripristino: lì i giorni che mancano alla scadenza sono
 * proprio `offsetDays`. Per questo il controllo nel browser gira sempre subito
 * dopo un ripristino, mai da solo. Il giorno dopo «Scade oggi» diventa
 * «Scaduto», ed è quello che distingue una schermata viva da una vecchia.
 *
 * Le parole vengono da `getExpiryLabel()`, la stessa funzione delle card: una
 * parola che cambia nel bundle di famiglia cambia anche qui.
 */
import { getExpiryLabel } from '../../src/lib/expiryLabels'
import type { KnownFood } from '../smoke/knownFoods'

export function expectedLabel(food: KnownFood): string {
  return getExpiryLabel(food.expectedStatus, food.offsetDays)
}
