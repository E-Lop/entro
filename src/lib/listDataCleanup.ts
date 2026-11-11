import { queryClient } from './queryClient'
import { clearPersistedCache } from './queryPersister'
import { clearSignedImageCaches } from './signedImageCache'

/**
 * Quanto si aspetta prima di svuotare le foto una seconda volta. Una card della
 * lista di prima può avere una foto già in viaggio: il service worker la mette
 * in cache quando arriva, anche dopo la prima pulizia. È il margine che
 * «Lascia la lista» usava già prima di ricaricare.
 */
const IN_FLIGHT_IMAGE_GRACE_MS = 100

/**
 * Dimentica ciò che il dispositivo tiene di una lista a cui l'utente non ha più
 * accesso: l'ha lasciata, è entrato in un'altra accettando un invito, o è stato
 * tolto (#240, #256).
 *
 * È la funzione sola che chiede la Regola 2 di
 * `conventions/local-data-when-access-ends.md` (entro-family), colonna «Lista
 * lasciata o tolti». La chiamano tutti i momenti in cui si perde una lista,
 * così nessuno svuota un insieme diverso dagli altri. La sessione resta: è
 * l'uscita, non questa, a toglierla (`clearAuthStorage`).
 *
 * Svuota tre cose:
 * - la cache delle query **in memoria**, con le scritture in coda, che non
 *   devono partire per una lista che non è più dell'utente;
 * - la cache delle query persistita in IndexedDB, che all'apertura dopo
 *   riporterebbe gli alimenti della lista di prima;
 * - la cache delle foto, che il service worker serve senza chiedere al server
 *   (#213).
 *
 * Le query si **azzerano** invece di sparire (`clear`). Una query montata
 * tiene il proprio risultato anche dopo `clear()`, e nessuna lettura parte: la
 * dashboard continuerebbe a mostrare gli alimenti della lista di prima.
 *
 * L'ordine conta, e l'ha trovato la prova nel browser. Prima si tolgono i dati
 * a tutte le query, senza rileggere. Così le card della lista di prima si
 * smontano. Se si rileggesse subito, ognuna chiederebbe di firmare la propria
 * foto. Il server rifiuta, ma la query resterebbe nel client persistito con il
 * percorso della foto di un altro membro. Poi si tolgono le query rimaste
 * senza nessuno che le mostri, e solo allora si rileggono quelle montate.
 *
 * Non lancia mai: se una cancellazione fallisce l'uscita avviene lo stesso, e
 * le altre si provano comunque.
 */
export async function clearListData(): Promise<void> {
  queryClient.getMutationCache().clear()
  for (const query of queryClient.getQueryCache().getAll()) query.reset()

  await clearPersistedCache().catch(() => {})
  await clearSignedImageCaches().catch(() => {})

  // Il margine serve due volte: React smonta le card della lista di prima, e
  // le loro foto già in viaggio arrivano in cache, da dove si tolgono qui sotto.
  await new Promise((resolve) => setTimeout(resolve, IN_FLIGHT_IMAGE_GRACE_MS))
  await clearSignedImageCaches().catch(() => {})

  queryClient.removeQueries({ type: 'inactive' })
  // La rilettura non si aspetta: chi ricarica la pagina subito dopo non deve
  // attendere la rete.
  void queryClient.refetchQueries({ type: 'active' })
}
