/**
 * Legge `npm audit --json` da stdin e dice se **è cambiato qualcosa** (#221).
 *
 *     npm audit --json --audit-level none | node scripts/weekly-audit.mjs --advisories advisories.json
 *     node scripts/weekly-audit.mjs --accepted
 *
 * Nasce perché le segnalazioni si scoprivano solo aprendo la scheda Security o
 * leggendo l'output di `git push`, e la scheda da sola non le mostrava tutte:
 * l'8 ott 2026 `npm audit` ne dava due che Dependabot non aveva aperto.
 *
 * ## Perché non fallisce su «ci sono vulnerabilità»
 *
 * Sarebbe rosso sempre. Le advisory qui sotto sono state valutate e accettate,
 * ciascuna nella issue che nomina: un controllo rosso per cose su cui è già
 * stato deciso insegna a ignorare il rosso.
 *
 * ## Perché non si fida di `fixAvailable`
 *
 * Sembra il segnale giusto e non lo è. Su questo albero, il 12 ott 2026, per
 * `braces` riporta come correzione `tailwindcss` 4.3.3 (`isSemVerMajor: true`),
 * cioè un cambio di framework, mentre una versione corretta di `braces` non
 * esiste. Se una correzione esiste lo dice l'advisory stessa, e si legge
 * dall'API di GitHub (`first_patched_version`): è il file di `--advisories`.
 *
 * ## Lo schema di `npm audit --json` non è documentato
 *
 * `docs.npmjs.com/cli/v11/commands/npm-audit` dice che `--json` esiste e non
 * descrive `vulnerabilities` né `via`. Questo parser dipende da una forma
 * osservata: se il rapporto ha voci ma non se ne ricava nessun GHSA, non si
 * conclude «nessuna segnalazione», si dice che la forma è cambiata.
 *
 * ## Il contratto
 *
 * **Rosso = qualcuno ha qualcosa da fare.**
 *
 * 1. compare una segnalazione **non ancora valutata**: va guardata;
 * 2. una accettata **non compare più**: si toglie dall'elenco. È una buona
 *    notizia ed è comunque lavoro: senza farla fallire l'elenco non si
 *    accorcerebbe mai, e diventerebbe il modo di ignorare le cose;
 * 3. una accettata **ha versioni corrette diverse** da quelle di quando è
 *    stata valutata, in una qualunque serie: la valutazione va riletta. Si
 *    confronta l'insieme di tutte le serie (#254): fino al 2 nov 2026 si
 *    leggeva solo la prima, e la 6.1.5 di `postcss-selector-parser` è passata
 *    inosservata perché stava nella seconda;
 * 4. l'input non si capisce: si fallisce invece di tacere.
 *
 * Lo stesso controllo vive in entro-mobile, con un elenco suo. La logica in
 * comune è una sessantina di righe: non abbastanza per un pacchetto condiviso.
 */
import { readFileSync } from 'node:fs'

/**
 * Le segnalazioni già valutate, con **dove** sta la valutazione.
 *
 * La issue è di questo repo, che è pubblico: chi legge un verde deve poter
 * risalire al ragionamento. `patched` è l'**insieme** delle versioni corrette
 * che l'advisory dichiarava per il pacchetto il giorno della valutazione, una
 * per serie (un elemento di `vulnerabilities` ciascuna), con `null` per una
 * serie che non ne aveva. L'ordine non conta.
 */
export const ACCEPTED = {
  'GHSA-3g3m-2fjr-6pw4': {
    issue: 253,
    package: 'glob',
    patched: ['14.0.2'],
    why: 'workbox-build chiede la serie 11 e la chiama senza `signal`, che il difetto richiede',
  },
  'GHSA-g3hv-75wg-m249': {
    issue: 253,
    package: 'minimatch',
    patched: ['11.0.1'],
    why: 'eslint e glob 11 non accettano la 11, e forzarla svuota la precache; i pattern sono del repo',
  },
  'GHSA-gcqx-w48m-w2h4': {
    issue: 253,
    package: 'deepmerge',
    patched: [null],
    why: 'nessuna versione corretta; il plugin di Rollup lo chiama solo su una costante propria',
  },
}

/** Sollevata quando un input non ha la forma che questo script sa leggere. */
export class UnreadableInput extends Error {}

/** Gli identificatori GHSA presenti in un rapporto di `npm audit --json`. */
export function reportGhsa(report) {
  const entries = Object.values(report?.vulnerabilities ?? {})
  const found = new Set()
  for (const entry of entries) {
    for (const via of entry?.via ?? []) {
      // Le voci stringa sono anelli della catena: solo gli oggetti portano un
      // `url`, ed è da lì che si ricava il GHSA.
      const id = typeof via === 'object' ? via?.url?.split('/').pop() : null
      if (id?.startsWith('GHSA-')) found.add(id)
    }
  }

  if (entries.length > 0 && found.size === 0) {
    throw new UnreadableInput(
      `Il rapporto contiene ${entries.length} voci ma non se ne ricava nessun GHSA: ` +
        "la forma dell'uscita di `npm audit --json` è cambiata, e va riletta sul campo."
    )
  }

  return found
}

/**
 * Le versioni corrette di ogni accettata, una per serie, dalle advisory di
 * GitHub: tutti gli elementi di `vulnerabilities` che nominano il pacchetto,
 * non il primo (#254).
 *
 * Un'accettata che nel file non c'è è un errore, non un «nessuna correzione»:
 * sono due risposte diverse e solo una è stata data.
 */
export function patchedVersions(advisories, accepted = ACCEPTED) {
  const byId = new Map((Array.isArray(advisories) ? advisories : []).map((a) => [a?.ghsa_id, a]))
  const versions = {}
  for (const [id, { package: name }] of Object.entries(accepted)) {
    const advisory = byId.get(id)
    const affected = (advisory?.vulnerabilities ?? []).filter((v) => v?.package?.name === name)
    if (affected.length === 0) {
      throw new UnreadableInput(`${id} manca nel file delle advisory, o non nomina \`${name}\`.`)
    }
    versions[id] = affected.map((v) => v.first_patched_version ?? null)
  }
  return versions
}

/** Cosa c'è in `now` e non in `before`, come insiemi: l'ordine delle serie non conta. */
function missingFrom(before, now) {
  const known = new Set(before)
  return [...new Set(now)].filter((v) => !known.has(v))
}

/** Le versioni corrette comparse e sparite rispetto alla valutazione. */
function patchedChange(registered, now) {
  return { added: missingFrom(registered, now), removed: missingFrom(now, registered) }
}

const shown = (versions) => (versions.length === 0 ? '—' : versions.map((v) => v ?? 'nessuna').join(', '))

/** Confronta ciò che `npm audit` e le advisory dicono con ciò che è già stato valutato. */
export function compare(present, versions, accepted = ACCEPTED) {
  const known = new Set(Object.keys(accepted))
  const confirmed = [...present].filter((id) => known.has(id)).sort()
  return {
    newOnes: [...present].filter((id) => !known.has(id)).sort(),
    gone: [...known].filter((id) => !present.has(id)).sort(),
    patched: confirmed.filter((id) => {
      const { added, removed } = patchedChange(accepted[id].patched, versions[id])
      return added.length > 0 || removed.length > 0
    }),
    confirmed,
  }
}

/** Le righe da stampare e il codice di uscita, come funzione pura. */
export function report(outcome, versions, accepted = ACCEPTED) {
  const rows = []
  let exit = 0

  for (const id of outcome.confirmed) {
    const { issue, why } = accepted[id]
    rows.push(`  già valutata  ${id}  → #${issue}: ${accepted[id].package}, ${why}`)
  }

  for (const id of outcome.newOnes) {
    rows.push(
      `::error::Segnalazione non ancora valutata: ${id} (https://github.com/advisories/${id}). ` +
        'Va guardata: si corregge, oppure si scrive la valutazione in una issue e si aggiunge ad ACCEPTED in scripts/weekly-audit.mjs.'
    )
    exit = 1
  }

  for (const id of outcome.gone) {
    rows.push(
      `::error::${id} non compare più nell'audit: va tolta da ACCEPTED in scripts/weekly-audit.mjs e dalla #${accepted[id].issue}. ` +
        "È una buona notizia, ed è comunque lavoro: senza farla fallire l'elenco non si accorcerebbe mai."
    )
    exit = 1
  }

  for (const id of outcome.patched) {
    const { issue, patched } = accepted[id]
    const { added, removed } = patchedChange(patched, versions[id])
    const change = [
      added.length > 0 ? `nuove: ${shown(added)}` : null,
      removed.length > 0 ? `sparite: ${shown(removed)}` : null,
    ]
      .filter(Boolean)
      .join('; ')
    rows.push(
      `::error::${id} ha versioni corrette diverse da quelle della valutazione (${change}; ` +
        `alla valutazione: ${shown(patched)}; oggi: ${shown(versions[id])}). ` +
        `La #${issue} va riletta: si aggiorna il pacchetto, o si aggiorna \`patched\` in ACCEPTED con l'insieme di oggi.`
    )
    exit = 1
  }

  if (exit === 0) {
    rows.push(`::notice::Nessun cambiamento: ${outcome.confirmed.length} segnalazioni, tutte già valutate.`)
  }

  return { rows, exit }
}

function fail(message) {
  console.log(`::error::${message}`)
  process.exit(1)
}

// Da qui in giù solo la CLI: la logica sopra è pura, e i test la esercitano
// eseguendo questo file come sottoprocesso.
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2)

  if (args.includes('--accepted')) {
    console.log(Object.keys(ACCEPTED).join('\n'))
    process.exit(0)
  }

  const at = args.indexOf('--advisories')
  const advisoriesPath = at === -1 ? null : args[at + 1]

  let raw = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', (chunk) => (raw += chunk))
  process.stdin.on('end', () => {
    let audit
    try {
      audit = JSON.parse(raw)
    } catch {
      fail("Non ho saputo leggere l'uscita di `npm audit --json`. Non si passa in silenzio.")
    }

    if (!advisoriesPath) {
      fail('Manca `--advisories <file>`: senza le advisory di GitHub non si sa se una accettata ha ora una correzione.')
    }
    let advisories
    try {
      advisories = JSON.parse(readFileSync(advisoriesPath, 'utf8'))
    } catch {
      fail(`Non ho saputo leggere il file delle advisory (${advisoriesPath}).`)
    }

    try {
      const versions = patchedVersions(advisories)
      const { rows, exit } = report(compare(reportGhsa(audit), versions), versions)
      for (const row of rows) console.log(row)
      process.exit(exit)
    } catch (error) {
      if (error instanceof UnreadableInput) fail(error.message)
      throw error
    }
  })
}
