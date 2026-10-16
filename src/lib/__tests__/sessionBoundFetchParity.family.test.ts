/**
 * `sessionBoundFetch` è **una** regola in **due** file (#229).
 *
 * `src/lib/sessionBoundFetch.ts` è una copia di
 * `entro-mobile/src/lib/sessionBoundFetch.ts` (entro-mobile#259): chi è dentro
 * non manda richieste da anonimo. Due copie che divergono farebbero trattenere
 * richieste diverse ai due client senza che niente diventi rosso.
 *
 * A differenza di `authErrorMessageParity`, qui il confronto è sul **codice**
 * e non sul testo: i commenti raccontano due storie diverse (il Pixel 9 e
 * `loadFailure.ts` di là, la scheda in background e la coda di React Query di
 * qua), e devono poterlo fare. Il codice no.
 *
 * Vale la regola di `twinSchema.ts`: l'assenza è un **errore**, non un motivo
 * per saltare.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/** In CI il workflow clona entro-mobile e punta qui, come per gli altri gemelli. */
const TWIN_FOLDER = process.env.ENTRO_MOBILE_LIB_DIR
  ? resolve(process.env.ENTRO_MOBILE_LIB_DIR)
  : join(__dirname, '..', '..', '..', '..', 'entro-mobile', 'src', 'lib')

const OURS = join(__dirname, '..', 'sessionBoundFetch.ts')
const TWIN = join(TWIN_FOLDER, 'sessionBoundFetch.ts')

/** Il file senza commenti né righe vuote: resta il codice. */
function codeOf(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .map((line) => line.trimEnd())
    .filter((line) => line !== '')
    .join('\n')
}

describe('sessionBoundFetch ha lo stesso codice sui due client', () => {
  it('trova la copia di entro-mobile', () => {
    expect(
      existsSync(TWIN),
      `Copia gemella non trovata in ${TWIN}: clona E-Lop/entro-mobile affiancato a questo ` +
        'repo (CLAUDE.md), oppure indica la cartella con ENTRO_MOBILE_LIB_DIR.',
    ).toBe(true)
  })

  // Senza, un filtro che un giorno togliesse troppo renderebbe uguali due file
  // vuoti: la forma peggiore di verde.
  it('sta confrontando il codice, non due file svuotati', () => {
    const code = codeOf(OURS)
    expect(code).toContain("const AUTH_PATH = '/auth/v1/'")
    expect(code).toContain("throw new TypeError('Request held back: no session token available')")
    expect(code).not.toContain('Gemello di')
  })

  it('le due copie hanno lo stesso codice', () => {
    expect(
      codeOf(OURS),
      'sessionBoundFetch.ts è cambiato da un lato solo: la stessa modifica va portata su ' +
        'entro-mobile (src/lib/sessionBoundFetch.ts), o tolta di qui.',
    ).toBe(codeOf(TWIN))
  })
})
