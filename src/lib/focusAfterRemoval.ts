/**
 * Dove va il fuoco quando una riga esce dalla lista.
 *
 * La rimozione di un alimento è ottimistica: la card sparisce dalla lista
 * *prima* che il dialogo di conferma finisca di chiudersi. Radix, chiudendosi,
 * prova a restituire il fuoco al pulsante che l'aveva aperto — che non esiste
 * più — e il fuoco cade su `document.body`: il primo Tab riparte dall'inizio
 * del documento, dopo **ogni** eliminazione, anche a rete perfetta (entro#87).
 *
 * La destinazione segue la convenzione di famiglia `fuoco-dopo-una-rimozione`:
 * riga successiva, intestazione della lista come ripiego, e sul rollback il
 * fuoco torna sulla riga ricomparsa. La regola è condivisa con entro-mobile;
 * il meccanismo no — lì si passa da `AccessibilityInfo.setAccessibilityFocus`.
 *
 * Si lavora sul DOM e non sui dati di proposito: la dashboard rende le card in
 * più viste (griglia, settimana, calendario) e l'ordine visivo è l'unica cosa
 * che le accomuna. L'annuncio non ha bisogno di una live region a parte: i
 * bersagli sono elementi che si annunciano da soli quando ricevono il fuoco.
 */

/** Marca il pulsante azioni di una card, col suo id alimento come valore. */
export const FOOD_ACTIONS_ATTR = 'data-food-actions'

/** Marca l'intestazione della lista, il ripiego quando non c'è un successivo. */
export const LIST_HEADING_ATTR = 'data-list-heading'

/** Dove il fuoco è finito davvero. */
export type FocusDestination = 'next' | 'heading' | 'none'

function actionButtons(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(`[${FOOD_ACTIONS_ATTR}]`))
}

/**
 * Posizione del pulsante azioni di un alimento fra quelli presenti.
 * Va letta **prima** della rimozione: dopo, quell'elemento non c'è più.
 */
export function actionsIndexOf(foodId: string, root: ParentNode = document): number {
  return actionButtons(root).findIndex(
    (button) => button.getAttribute(FOOD_ACTIONS_ATTR) === foodId
  )
}

/**
 * Sposta il fuoco dopo che la riga in posizione `removedIndex` è uscita.
 *
 * A rimozione avvenuta, l'elemento che occupa quella posizione **è** la riga
 * successiva: non serve incrementare l'indice. Se non c'è — la rimossa era
 * l'ultima, o la lista è vuota — si ripiega sull'intestazione.
 */
export function moveFocusAfterRemoval(
  removedIndex: number,
  root: ParentNode = document
): FocusDestination {
  if (removedIndex >= 0) {
    const next = actionButtons(root)[removedIndex]
    if (next) {
      next.focus()
      return 'next'
    }
  }

  // `removedIndex` negativo significa che la riga non è stata trovata prima
  // della rimozione — succede nelle viste che non espongono il pulsante
  // azioni. Anche lì l'intestazione è meglio del vuoto.
  const heading = root.querySelector<HTMLElement>(`[${LIST_HEADING_ATTR}]`)
  if (heading) {
    heading.focus()
    return 'heading'
  }

  return 'none'
}

/**
 * Riporta il fuoco su una riga ricomparsa dopo un rollback.
 * Ritorna `false` se non c'è: chi chiama non deve dare per scontato che ci sia.
 */
export function restoreFocusTo(foodId: string, root: ParentNode = document): boolean {
  const button = root.querySelector<HTMLElement>(`[${FOOD_ACTIONS_ATTR}="${foodId}"]`)
  if (!button) return false

  button.focus()
  return true
}

/**
 * Riporta il fuoco a chi ha aperto il dialogo quando l'utente annulla.
 *
 * Serve perché Radix, con un dialogo **controllato** — nessun
 * `AlertDialogTrigger`, apertura da stato — non lo fa: misurato su Chromium, a
 * dialogo annullato il fuoco finisce su `document.body` esattamente come dopo
 * un'eliminazione. È un difetto fratello di quello della #87, su un percorso
 * che la issue dava per sano.
 *
 * Se il nodo che aveva aperto il dialogo non è più nel documento si ripiega
 * sulla riga, che è comunque meglio del vuoto.
 */
export function restoreFocusToOpener(
  opener: HTMLElement | null,
  fallbackFoodId: string | null,
  root: ParentNode = document
): boolean {
  if (opener?.isConnected) {
    opener.focus()
    return true
  }

  return fallbackFoodId ? restoreFocusTo(fallbackFoodId, root) : false
}
