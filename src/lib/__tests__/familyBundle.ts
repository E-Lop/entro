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
const BUNDLE_FOLDER = process.env.ENTRO_FAMILY_DIR
  ? resolve(process.env.ENTRO_FAMILY_DIR)
  : join(__dirname, '..', '..', '..', '..', 'entro-family')

/**
 * Il testo di una pagina di `core/`.
 *
 * L'assenza è un **errore**, non un motivo per saltare: un test che si salta
 * quando non trova la sorgente passa esattamente nella situazione in cui non
 * sta guardando niente.
 */
export function bundlePage(name: string): string {
  const path = join(BUNDLE_FOLDER, 'core', `${name}.md`)
  if (!existsSync(path)) {
    throw new Error(
      `Bundle di famiglia non trovato in ${path}. Le etichette sono dominio e ` +
        'vivono lì: clona `E-Lop/entro-family` affiancato a questo repo, oppure ' +
        'indica la cartella con ENTRO_FAMILY_DIR.'
    )
  }
  return readFileSync(path, 'utf8')
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
export function pageLabels(name: string): Map<string, string | null> {
  const text = bundlePage(name)
  const start = text.indexOf("## Le parole che l'utente legge")
  if (start === -1) {
    throw new Error(`Sezione «Le parole che l’utente legge» non trovata in core/${name}.md`)
  }

  const fine = text.indexOf('\n## ', start + 1)
  const section = text.slice(start, fine === -1 ? undefined : fine)

  const rows = new Map<string, string | null>()
  for (const m of section.matchAll(/^\|\s*`([a-z_]+)`\s*\|\s*(.+?)\s*\|$/gm)) {
    const withWord = m[2].match(/^`(.+)`$/)
    rows.set(m[1], withWord ? withWord[1] : null)
  }
  return rows
}

/**
 * Le righe della tabella «Le forme leggibili delle unità» di una pagina, come
 * coppie `unità → { one, other }`.
 *
 * Due colonne di parole invece di una, quindi non è la tabella di
 * `pageLabels` con una colonna in più: `one` e `other` sono le
 * categorie cardinali CLDR, e la cella vuota qui non esiste — un'unità che non
 * dichiarasse entrambe le forme è un difetto del bundle, e la riga
 * semplicemente non entra nella mappa, dove il confronto col vocabolario la fa
 * mancare.
 *
 * Vale la stessa ragione di delimitare la sezione: la pagina porta più sopra
 * la tabella degli step per unità, con le stesse chiavi nella prima colonna.
 */
export function unitForms(name: string): Map<string, { one: string; other: string }> {
  const text = bundlePage(name)
  const start = text.indexOf('## Le forme leggibili delle unità')
  if (start === -1) {
    throw new Error(`Sezione «Le forme leggibili delle unità» non trovata in core/${name}.md`)
  }

  const fine = text.indexOf('\n## ', start + 1)
  const section = text.slice(start, fine === -1 ? undefined : fine)

  const rows = new Map<string, { one: string; other: string }>()
  for (const m of section.matchAll(/^\|\s*`([a-z]+)`\s*\|\s*`(.+?)`\s*\|\s*`(.+?)`\s*\|$/gm)) {
    rows.set(m[1], { one: m[2], other: m[3] })
  }
  return rows
}
