/**
 * `supabaseFailureReport` è **una** regola in **due** file (#192).
 *
 * `src/lib/supabaseFailureReport.ts` è una copia di
 * `entro-mobile/src/shared/lib/supabaseFailureReport.ts` (entro-mobile#199):
 * decide cosa di una richiesta fallita arriva a Sentry, e la decisione del
 * 2 ott 2026 — solo `code`, `status` e operazione — vale per i due client.
 * Due copie che divergono manderebbero a Sentry cose diverse senza che niente
 * diventi rosso.
 *
 * Come per `sessionBoundFetchParity`, il confronto è sul **codice** e non sul
 * testo: le intestazioni nominano l'altro repo, e devono poterlo fare.
 *
 * Vale la regola di `twinSchema.ts`: l'assenza è un **errore**, non un motivo
 * per saltare.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/** In CI il workflow clona entro-mobile e punta qui, come per gli altri gemelli. */
const TWIN_FOLDER = process.env.ENTRO_MOBILE_SHARED_LIB_DIR
  ? resolve(process.env.ENTRO_MOBILE_SHARED_LIB_DIR)
  : join(__dirname, '..', '..', '..', '..', 'entro-mobile', 'src', 'shared', 'lib')

const OURS = join(__dirname, '..', 'supabaseFailureReport.ts')
const TWIN = join(TWIN_FOLDER, 'supabaseFailureReport.ts')

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

describe('supabaseFailureReport ha lo stesso codice sui due client', () => {
  it('trova la copia di entro-mobile', () => {
    expect(
      existsSync(TWIN),
      `Copia gemella non trovata in ${TWIN}: clona E-Lop/entro-mobile affiancato a questo ` +
        'repo (CLAUDE.md), oppure indica la cartella con ENTRO_MOBILE_SHARED_LIB_DIR.',
    ).toBe(true)
  })

  // Senza, un filtro che un giorno togliesse troppo renderebbe uguali due file
  // vuoti: la forma peggiore di verde.
  it('sta confrontando il codice, non due file svuotati', () => {
    const code = codeOf(OURS)
    expect(code).toContain('const CODE_SHAPE = /^[A-Za-z0-9_.-]{1,64}$/')
    expect(code).toContain('export function createFailureReportingFetch({')
    expect(code).not.toContain('entro-mobile#199')
  })

  it('le due copie hanno lo stesso codice', () => {
    expect(
      codeOf(OURS),
      'supabaseFailureReport.ts è cambiato da un lato solo: la stessa modifica va portata su ' +
        'entro-mobile (src/shared/lib/supabaseFailureReport.ts), o tolta di qui.',
    ).toBe(codeOf(TWIN))
  })
})
