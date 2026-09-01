/**
 * Il guardiano delle etichette: il codice deve dire quello che dice il bundle.
 *
 * Le stringhe dello stato di scadenza erano **copiate a mano** nei due client
 * ([entro-mobile#44](https://github.com/E-Lop/entro-mobile/issues/44)).
 * Spostarle in un modulo per parte le rende ordinate, non uniche: due moduli
 * scritti a mano possono divergere esattamente come due componenti. Quello che
 * le rende una fonte sola è questo test, che legge la tabella di
 * `entro-family/core/expiry-status.md` e fa fallire il codice se non combacia.
 *
 * Il gemello su entro-mobile legge la **stessa** tabella. Da lì la garanzia:
 * cambiare una parola nel bundle rompe le due CI finché entrambi i client non
 * seguono.
 *
 * ## Perché non degrada a verde quando il bundle manca
 *
 * Un test che si salta quando non trova la sorgente è la forma peggiore di
 * verde: passa esattamente nella situazione in cui non sta guardando niente.
 * Qui l'assenza del bundle è un **errore**, con il percorso cercato nel
 * messaggio. In CI la cartella si impone con `ENTRO_FAMILY_DIR`.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ExpiryStatus } from '@/types/food.types'
import { EXPIRY_LABELS, formatDaysLabel, getExpiryLabel } from '@/lib/expiryLabels'

/**
 * Il bundle vive affiancato ai repo in `~/Documents/`. In CI quel percorso non
 * esiste: il workflow lo clona e punta qui con `ENTRO_FAMILY_DIR`.
 */
const CARTELLA_BUNDLE = process.env.ENTRO_FAMILY_DIR
  ? resolve(process.env.ENTRO_FAMILY_DIR)
  : join(__dirname, '..', '..', '..', '..', 'entro-family')

function paginaStatiDiScadenza(): string {
  const percorso = join(CARTELLA_BUNDLE, 'core', 'expiry-status.md')
  if (!existsSync(percorso)) {
    throw new Error(
      `Bundle di famiglia non trovato in ${percorso}. Le etichette sono dominio e ` +
        'vivono lì: clona `E-Lop/entro-family` affiancato a questo repo, oppure ' +
        'indica la cartella con ENTRO_FAMILY_DIR.'
    )
  }
  return readFileSync(percorso, 'utf8')
}

/**
 * Le righe della tabella «Le parole che l'utente legge», come coppie
 * `stato → etichetta`. L'etichetta è la stringa fra apici inversi quando lo
 * stato ha una parola propria, e `null` quando il bundle dice *conteggio*.
 */
function etichetteDelBundle(): Map<string, string | null> {
  const testo = paginaStatiDiScadenza()
  const inizio = testo.indexOf("## Le parole che l'utente legge")
  if (inizio === -1) throw new Error('Sezione «Le parole che l’utente legge» non trovata nel bundle')

  // Delimitare la sezione non è pignoleria: la stessa pagina porta più sopra
  // una tabella `ExpiryStatus | Condizione` con gli stessi stati nella prima
  // colonna, e una lettura su tutto il file prenderebbe quella.
  const fine = testo.indexOf('\n## ', inizio + 1)
  const sezione = testo.slice(inizio, fine === -1 ? undefined : fine)

  const righe = new Map<string, string | null>()
  for (const m of sezione.matchAll(/^\|\s*`([a-z_]+)`\s*\|\s*(.+?)\s*\|$/gm)) {
    const cella = m[2]
    const conParola = cella.match(/^`(.+)`$/)
    righe.set(m[1], conParola ? conParola[1] : null)
  }
  return righe
}

/** Il formato del conteggio, sempre dal bundle. */
function formeDelConteggio(): { singolare: string; plurale: string } {
  const m = paginaStatiDiScadenza().match(/`1 (\w+)` al singolare, `N (\w+)` altrimenti/)
  if (!m) throw new Error('Il bundle non dichiara più le due forme del conteggio')
  return { singolare: m[1], plurale: m[2] }
}

const TUTTI_GLI_STATI: ExpiryStatus[] = [
  'expired',
  'expires_today',
  'expires_soon',
  'expires_this_week',
  'fresh',
]

describe('le etichette dicono quello che dice il bundle', () => {
  it('la tabella del bundle copre tutti e cinque gli stati, e nessun altro', () => {
    const bundle = etichetteDelBundle()

    // Senza, il test resterebbe verde su una tabella svuotata o rinominata —
    // cioè proprio quando ha smesso di guardare qualcosa.
    expect([...bundle.keys()].sort()).toEqual([...TUTTI_GLI_STATI].sort())
  })

  it.each(TUTTI_GLI_STATI)('«%s» produce l’etichetta che il bundle dichiara', (stato) => {
    const atteso = etichetteDelBundle().get(stato)
    const giorni = 3

    if (atteso === null) {
      // Il bundle dice *conteggio*: l'etichetta è il numero, non una parola fissa.
      expect(getExpiryLabel(stato, giorni)).toBe(formatDaysLabel(giorni))
    } else {
      expect(getExpiryLabel(stato, giorni)).toBe(atteso)
    }
  })

  it('gli stati con parola propria sono esattamente quelli esportati', () => {
    const conParola = [...etichetteDelBundle()]
      .filter(([, etichetta]) => etichetta !== null)
      .map(([stato]) => stato)
      .sort()

    expect(conParola).toEqual(Object.keys(EXPIRY_LABELS).sort())
  })
})

describe('il conteggio accorda l’unità col numero', () => {
  it('usa le due forme che il bundle dichiara', () => {
    const { singolare, plurale } = formeDelConteggio()

    expect(formatDaysLabel(1)).toBe(`1 ${singolare}`)
    expect(formatDaysLabel(3)).toBe(`3 ${plurale}`)
  })

  it('il singolare vale solo per 1: zero e negativi restano al plurale', () => {
    const { plurale } = formeDelConteggio()

    expect(formatDaysLabel(0)).toBe(`0 ${plurale}`)
    expect(formatDaysLabel(2)).toBe(`2 ${plurale}`)
  })
})
