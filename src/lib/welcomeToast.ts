/**
 * Contratto per il toast di benvenuto mostrato dopo l'accettazione di un invito.
 *
 * `authStore` accetta l'invito e segnala il toast; la dashboard lo consuma.
 * L'accettazione puo' avvenire prima che la dashboard sia montata (redirect da
 * conferma email) oppure mentre e' gia' montata (invito processato dopo il
 * render): il flag in localStorage copre il primo caso, l'evento il secondo.
 */
export const WELCOME_TOAST_FLAG = 'show_welcome_toast'
export const WELCOME_TOAST_EVENT = 'entro:welcome-toast'

/** Segnala che il toast di benvenuto va mostrato alla prossima occasione. */
export function notifyWelcomeToast(): void {
  localStorage.setItem(WELCOME_TOAST_FLAG, 'true')
  window.dispatchEvent(new Event(WELCOME_TOAST_EVENT))
}
