/**
 * Leggere il bundle di famiglia da un test, una volta sola.
 *
 * Nasce col secondo consumatore: `expiryLabels.test.ts` aveva questa
 * risoluzione scritta dentro, e `storageLabels.test.ts` avrebbe dovuto
 * ricopiarla — cioè la duplicazione che entrambe le issue esistono per
 * togliere, riprodotta nei test che la sorvegliano.
 *
 * Non finisce fra le suite perché vitest raccoglie solo i `*.test.ts`.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

/**
 * Il bundle vive affiancato ai repo in `~/Documents/`. In CI quel percorso non
 * esiste: il workflow lo clona e punta qui con `ENTRO_FAMILY_DIR`.
 */
const CARTELLA_BUNDLE = process.env.ENTRO_FAMILY_DIR
  ? resolve(process.env.ENTRO_FAMILY_DIR)
  : join(__dirname, '..', '..', '..', '..', 'entro-family')

/**
 * Il testo di una pagina di `core/`.
 *
 * L'assenza è un **errore**, non un motivo per saltare: un test che si salta
 * quando non trova la sorgente passa esattamente nella situazione in cui non
 * sta guardando niente.
 */
export function paginaDelBundle(nome: string): string {
  const percorso = join(CARTELLA_BUNDLE, 'core', `${nome}.md`)
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
 * Le righe della tabella «Le parole che l'utente legge» di una pagina, come
 * coppie `chiave → etichetta`. L'etichetta è la stringa fra apici inversi;
 * `null` quando la cella non ne ha (in `expiry-status.md` significa
 * *conteggio*, cioè un'etichetta calcolata invece che fissa).
 *
 * La sezione va **delimitata**, e non è pignoleria: le stesse pagine portano
 * più sopra altre tabelle con le stesse chiavi nella prima colonna, e una
 * lettura su tutto il file prenderebbe quelle.
 */
export function etichetteDellaPagina(nome: string): Map<string, string | null> {
  const testo = paginaDelBundle(nome)
  const inizio = testo.indexOf("## Le parole che l'utente legge")
  if (inizio === -1) {
    throw new Error(`Sezione «Le parole che l’utente legge» non trovata in core/${nome}.md`)
  }

  const fine = testo.indexOf('\n## ', inizio + 1)
  const sezione = testo.slice(inizio, fine === -1 ? undefined : fine)

  const righe = new Map<string, string | null>()
  for (const m of sezione.matchAll(/^\|\s*`([a-z_]+)`\s*\|\s*(.+?)\s*\|$/gm)) {
    const conParola = m[2].match(/^`(.+)`$/)
    righe.set(m[1], conParola ? conParola[1] : null)
  }
  return righe
}
