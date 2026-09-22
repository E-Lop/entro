import { supabase } from './supabase'
import { extractPathFromUrlOrPath } from './storage'
import { isPendingUrl } from './pendingImages'

const PHOTOS_NOT_REMOVED = 'Non siamo riusciti a eliminare le tue foto. Riprova tra poco.'

/**
 * Toglie dal bucket le foto degli alimenti che la cancellazione dell'account
 * elimina (#145).
 *
 * Va chiamata **solo quando l'utente è l'unico membro della sua lista**: è il
 * caso in cui `delete_user()` elimina la lista con tutti i suoi alimenti, e
 * quindi tutte le foto che la RLS gli lascia leggere sono di alimenti che
 * spariscono, compresi quelli tolti con il loro esito. Da una lista condivisa
 * gli alimenti restano agli altri membri, e con loro le foto (#152).
 *
 * Lancia se non riesce a leggere quali foto togliere o se la rimozione torna un
 * errore: dopo la cancellazione dell'utente nessun client potrebbe più toglierle,
 * quindi chi chiama deve fermarsi. Il messaggio è per l'utente, e non contiene
 * percorsi. Un oggetto che le policy dello Storage non lasciano togliere, per
 * esempio nella cartella di un ex membro ancora iscritto, non è un errore:
 * `remove()` lo salta in silenzio, e la foto resta al suo proprietario.
 *
 * Vive qui, e non nel dialogo, perché la stessa regola servirà alla
 * cancellazione dell'account di entro-mobile.
 */
export async function removePhotosOfDeletedFoods(): Promise<void> {
  const { data, error } = await supabase.from('foods').select('image_url').not('image_url', 'is', null)
  if (error) throw new Error(PHOTOS_NOT_REMOVED)

  const paths = new Set<string>()
  for (const { image_url } of data ?? []) {
    if (!image_url || isPendingUrl(image_url)) continue
    const path = extractPathFromUrlOrPath(image_url)
    // Un URL che non è del nostro bucket torna com'era: non c'è niente da togliere.
    if (!path.startsWith('http')) paths.add(path)
  }
  if (paths.size === 0) return

  const { error: removeError } = await supabase.storage.from('food-images').remove([...paths])
  if (removeError) throw new Error(PHOTOS_NOT_REMOVED)
}
