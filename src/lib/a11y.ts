/**
 * Attributi ARIA per un input con errore inline gestito a mano (stato locale,
 * fuori da react-hook-form). Uniforma il pattern altrimenti duplicato nei
 * dialog con validazione manuale (es. DeleteAccountDialog, AcceptInviteFlowDialog):
 * `aria-invalid` presente solo in errore e `aria-describedby` che punta al
 * messaggio d'errore o, in sua assenza, a un eventuale testo di aiuto.
 *
 * I form basati su react-hook-form usano invece `FormControl` (in `ui/form.tsx`),
 * che deriva `aria-invalid` dallo stato del campo: non passare da qui.
 */
export function inlineErrorAttrs(
  hasError: boolean,
  errorId: string,
  describedByWhenValid?: string
): { 'aria-invalid': true | undefined; 'aria-describedby': string | undefined } {
  return {
    'aria-invalid': hasError ? true : undefined,
    'aria-describedby': hasError ? errorId : describedByWhenValid,
  }
}
