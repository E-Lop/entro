/**
 * L'annuncio degli errori di scrittura agli screen reader (#121).
 *
 * Quando una scrittura fallisce e il rollback rimette la lista com'era, chi
 * usa uno screen reader deve saperlo subito: MDN, *ARIA: alert role*, nomina
 * alla lettera il caso, «The connection to the server was lost so local
 * changes will not be saved». sonner mette tutti i toast in una sola live
 * region `polite`, che accoda invece di interrompere, e non ha un'opzione per
 * cambiarlo (letto nella sorgente installata, 2.0.7).
 *
 * Il messaggio finisce allora anche in una regione nostra con `role="alert"`,
 * `WriteErrorAnnouncer`, montata vuota con `AppLayout`, prima di qualunque scrittura. MDN avverte che un elemento
 * con `role="alert"` creato già pieno spesso non viene annunciato: serve un
 * cambio di contenuto. Per questo ogni annuncio svuota la regione e la
 * riempie un attimo dopo, anche quando il messaggio è uguale al precedente.
 */

/** Il tempo fra lo svuotamento e il messaggio: basta un commit separato. */
const REFILL_DELAY_MS = 100

let current = ''
let pending: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()

function emit(next: string) {
  current = next
  for (const listener of listeners) listener()
}

export function announceWriteError(message: string): void {
  if (pending) clearTimeout(pending)
  emit('')
  pending = setTimeout(() => {
    pending = undefined
    emit(message)
  }, REFILL_DELAY_MS)
}

export function getWriteErrorAnnouncement(): string {
  return current
}

export function subscribeWriteErrorAnnouncement(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
