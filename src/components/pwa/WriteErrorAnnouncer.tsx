import { useSyncExternalStore } from 'react'
import { getWriteErrorAnnouncement, subscribeWriteErrorAnnouncement } from '../../lib/writeErrorAnnouncer'

/**
 * La regione che annuncia gli errori di scrittura agli screen reader (#121).
 *
 * È nel DOM con `AppLayout`, vuota, e visibile solo agli screen reader: il toast di
 * sonner resta per chi guarda. `role="alert"` è assertivo e atomico, quindi
 * l'annuncio interrompe la lettura in corso. Perché il nodo esista prima del
 * messaggio, e perché il messaggio passi dal vuoto, lo spiega
 * `src/lib/writeErrorAnnouncer.ts`.
 */
export function WriteErrorAnnouncer() {
  const message = useSyncExternalStore(subscribeWriteErrorAnnouncement, getWriteErrorAnnouncement)
  return (
    <div role="alert" data-write-error-announcer="" className="sr-only">
      {message}
    </div>
  )
}
