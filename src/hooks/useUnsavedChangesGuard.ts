import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Chiede conferma prima di buttare via un form con modifiche non salvate.
 *
 * Fino al 7 set 2026 non chiedeva niente: Esc, click fuori e la X di
 * `ui/dialog.tsx` chiudevano il dialogo e con lui una foto appena scattata
 * (entro#119, punto 3 — `grep isDirty` dava zero risultati). Il gemello nativo
 * ha chiuso lo stesso buco nella fetta 3/2 di entro-mobile, con l'action sheet
 * di iOS e il dialogo di Android; qui il meccanismo è un altro, e la
 * **decisione** è la stessa: un form sporco non si chiude in silenzio.
 *
 * ## Le tre uscite sono una sola
 *
 * Radix instrada Esc, il click fuori e la X sullo stesso `onOpenChange(false)`
 * (`DialogContent` monta la X che chiama `DialogPrimitive.Close`). Basta quindi
 * avvolgere quel callback: `intercetta` restituisce il gestore da passare al
 * `Dialog`, e chi lo usa non deve sapere da quale delle tre l'utente sia
 * uscito.
 *
 * ## `beforeunload` è la quarta uscita, e non passa da Radix
 *
 * Ricaricare la pagina o chiudere la scheda non tocca nessun dialogo. È la sola
 * uscita che il browser gestisce da sé, e l'unico modo di intercettarla è
 * `beforeunload` con `preventDefault()`. Il testo non lo decidiamo noi: dal
 * 2019 Chrome e Firefox mostrano una frase propria e ignorano `returnValue`,
 * quindi qui non se ne scrive uno.
 *
 * Il listener si registra **solo quando il form è sporco**: un `beforeunload`
 * sempre attivo disabilita il bfcache, cioè rallenta ogni navigazione indietro
 * per proteggere un caso che quasi mai è vero.
 *
 * ## Perché lo stato di conferma vive qui e non nel chiamante
 *
 * Chi chiude il dialogo e chi conferma sono due momenti separati da un render:
 * fra i due va tenuta da parte **l'azione sospesa**. Tenerla nel chiamante
 * vorrebbe dire ripetere lo stesso `useState` in ogni dialogo che ha un form —
 * e la creazione e la modifica sono già due.
 */
export function useUnsavedChangesGuard(isDirty: boolean) {
  /** L'azione trattenuta: `null` quando non c'è niente in sospeso. */
  const [pendingClose, setPendingClose] = useState<(() => void) | null>(null)

  // In un ref perché `intercetta` non deve cambiare identità a ogni tasto
  // premuto nel form: verrebbe passata a `Dialog` come prop nuova a ogni
  // carattere digitato.
  const isDirtyRef = useRef(isDirty)
  isDirtyRef.current = isDirty

  useEffect(() => {
    if (!isDirty) return

    const avvisa = (evento: BeforeUnloadEvent) => {
      // `preventDefault()` è la forma che la specifica indica oggi; il testo lo
      // sceglie il browser e non si può cambiare.
      evento.preventDefault()
    }

    window.addEventListener('beforeunload', avvisa)
    return () => window.removeEventListener('beforeunload', avvisa)
  }, [isDirty])

  /**
   * Avvolge l'`onOpenChange` di un `Dialog`: a form pulito lascia passare, a
   * form sporco trattiene la chiusura e apre la conferma.
   *
   * L'apertura (`open === true`) passa sempre: la guardia riguarda solo l'uscita.
   */
  const intercetta = useCallback(
    (chiudi: () => void) => (open: boolean) => {
      if (open) return
      if (!isDirtyRef.current) {
        chiudi()
        return
      }
      // La funzione va avvolta: `useState` chiama ciò che riceve.
      setPendingClose(() => chiudi)
    },
    []
  )

  const scarta = useCallback(() => {
    pendingClose?.()
    setPendingClose(null)
  }, [pendingClose])

  const annulla = useCallback(() => setPendingClose(null), [])

  return {
    /** Vero mentre la conferma è a schermo. */
    isConfirmOpen: pendingClose !== null,
    intercetta,
    scarta,
    annulla,
  }
}
