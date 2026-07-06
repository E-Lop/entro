import { useEffect } from 'react'
import { toast } from 'sonner'
import { WELCOME_TOAST_EVENT, WELCOME_TOAST_FLAG } from '../lib/welcomeToast'

/**
 * Mostra una sola volta il toast "invito accettato".
 *
 * Il flag viene impostato da `authStore` dopo l'accettazione dell'invito. Se il
 * flag e' gia' presente al mount lo consumiamo subito (redirect da conferma
 * email); se viene impostato mentre la dashboard e' gia' montata reagiamo
 * all'evento che `notifyWelcomeToast` emette. Prima il toast compariva solo
 * grazie al reload rimosso in B2, quindi senza questo listener sarebbe apparso
 * solo alla visita successiva.
 */
export function useWelcomeToast(): void {
  useEffect(() => {
    const consume = () => {
      if (localStorage.getItem(WELCOME_TOAST_FLAG) !== 'true') return
      localStorage.removeItem(WELCOME_TOAST_FLAG)
      toast.success('Benvenuto! Ora puoi vedere la lista condivisa', {
        duration: 5000,
      })
    }

    consume()
    window.addEventListener(WELCOME_TOAST_EVENT, consume)
    return () => window.removeEventListener(WELCOME_TOAST_EVENT, consume)
  }, [])
}
