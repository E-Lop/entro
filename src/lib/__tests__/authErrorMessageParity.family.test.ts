/**
 * La tabella dei messaggi di autenticazione è **una** decisione in **due** file.
 *
 * `src/lib/authErrorMessage.ts` non è un pacchetto condiviso: è una copia, e
 * l'altra è `src/shared/lib/authErrorMessage.ts` su entro-mobile. La tabella è
 * stata decisa una volta per i due client (entro#100, entro-mobile#33), e due
 * copie che divergono fanno dire ai due client cose diverse per lo stesso
 * errore senza che niente diventi rosso.
 *
 * Il modulo non importa niente, quindi le due copie possono essere **uguali
 * carattere per carattere** — tranne la riga «Gemello di…», che per forza
 * nomina l'altro repo. Il confronto è sul testo e non sul comportamento: una
 * sonda sui codici noti non vedrebbe un codice aggiunto da un lato solo.
 *
 * Vale la regola di `twinSchema.ts`: l'assenza è un **errore**, non un motivo
 * per saltare.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/** In CI il workflow clona entro-mobile e punta qui, come per lo schema gemello. */
const TWIN_FOLDER = process.env.ENTRO_MOBILE_SHARED_LIB_DIR
  ? resolve(process.env.ENTRO_MOBILE_SHARED_LIB_DIR)
  : join(__dirname, '..', '..', '..', '..', 'entro-mobile', 'src', 'shared', 'lib')

const OURS = join(__dirname, '..', 'authErrorMessage.ts')
const TWIN = join(TWIN_FOLDER, 'authErrorMessage.ts')

/** Il file senza la riga che nomina l'altro repo, l'unica che deve differire. */
function comparable(path: string): string {
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => !line.includes('Gemello di'))
    .join('\n')
}

describe('authErrorMessage è uguale sui due client', () => {
  it('trova la copia di entro-mobile', () => {
    expect(
      existsSync(TWIN),
      `Copia gemella non trovata in ${TWIN}: clona E-Lop/entro-mobile affiancato a questo ` +
        'repo (CLAUDE.md), oppure indica la cartella con ENTRO_MOBILE_SHARED_LIB_DIR.',
    ).toBe(true)
  })

  // Senza, un filtro che un giorno togliesse troppo renderebbe uguali due file
  // vuoti: la forma peggiore di verde.
  it('sta confrontando la tabella, non due file svuotati', () => {
    expect(comparable(OURS)).toContain("['invalid_credentials', 'Email o password non corretti']")
    expect(
      readFileSync(OURS, 'utf8')
        .split('\n')
        .filter((l) => l.includes('Gemello di')),
    ).toHaveLength(1)
  })

  it('le due copie dicono le stesse cose', () => {
    expect(
      comparable(OURS),
      'authErrorMessage.ts è cambiato da un lato solo: la stessa modifica va portata su ' +
        'entro-mobile (src/shared/lib/authErrorMessage.ts), o tolta di qui.',
    ).toBe(comparable(TWIN))
  })
})
