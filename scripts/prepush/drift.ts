/**
 * Il diff fra le migrazioni di main e la sorgente, al netto delle derive
 * dichiarate (#182).
 *
 * `supabase db diff --use-pg-delta` stampa gli statement che porterebbero lo
 * schema delle migrazioni a quello della sorgente. Ciò che è proprio
 * dell'ambiente (estensioni accese dalla dashboard, il job di pg_cron con
 * l'URL del progetto) sta in `declared-drift.json`, una voce per oggetto con
 * la sua ragione; qualunque altro statement ferma il pre-push.
 */

export interface DeclaredDrift {
  name: string
  reason: string
  /** Espressioni regolari: uno statement del diff è di questa voce se una lo riconosce. */
  statements: string[]
}

export interface DriftResult {
  /** La prima riga di ogni statement che nessuna voce dichiara. */
  undeclared: string[]
  /** Le voci dichiarate che il diff contiene, nell'ordine del file. */
  matched: string[]
  /** Le voci dichiarate che il diff non contiene più. */
  stale: string[]
}

const DOLLAR_TAG = /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/

/**
 * Divide un testo SQL negli statement che lo compongono. Un punto e virgola
 * chiude uno statement solo fuori da stringhe, identificatori fra virgolette,
 * stringhe fra dollari e commenti. I commenti di riga si scartano.
 */
export function splitStatements(sql: string): string[] {
  const statements: string[] = []
  let current = ''
  let i = 0
  const push = () => {
    const statement = current.trim()
    if (statement) statements.push(statement)
    current = ''
  }
  while (i < sql.length) {
    const rest = sql.slice(i)
    if (rest.startsWith('--')) {
      const end = sql.indexOf('\n', i)
      i = end === -1 ? sql.length : end
      continue
    }
    if (rest.startsWith('/*')) {
      const end = sql.indexOf('*/', i + 2)
      const stop = end === -1 ? sql.length : end + 2
      current += sql.slice(i, stop)
      i = stop
      continue
    }
    const char = sql[i]
    if (char === "'" || char === '"') {
      // Dentro una stringa la virgoletta raddoppiata è un carattere, non la fine.
      let j = i + 1
      while (j < sql.length) {
        if (sql[j] === char) {
          if (sql[j + 1] === char) j += 2
          else break
        } else j += 1
      }
      current += sql.slice(i, j + 1)
      i = j + 1
      continue
    }
    if (char === '$') {
      const tag = DOLLAR_TAG.exec(rest)
      if (tag) {
        const end = sql.indexOf(tag[0], i + tag[0].length)
        const stop = end === -1 ? sql.length : end + tag[0].length
        current += sql.slice(i, stop)
        i = stop
        continue
      }
    }
    current += char
    i += 1
    if (char === ';') push()
  }
  push()
  return statements
}

// pg-delta apre le unità transazionali con `SET LOCAL …`: non sono differenze.
const PREAMBLE = /^SET\s+local\s/i

export function checkDrift(statements: string[], declared: DeclaredDrift[]): DriftResult {
  const patterns = declared.map((entry) => ({ name: entry.name, regexes: entry.statements.map((source) => new RegExp(source)) }))
  const matchedNames = new Set<string>()
  const undeclared: string[] = []
  for (const statement of statements) {
    if (PREAMBLE.test(statement)) continue
    const owner = patterns.find((entry) => entry.regexes.some((regex) => regex.test(statement)))
    if (owner) matchedNames.add(owner.name)
    else undeclared.push(statement.split('\n')[0].trimEnd())
  }
  return {
    undeclared,
    matched: declared.filter((entry) => matchedNames.has(entry.name)).map((entry) => entry.name),
    stale: declared.filter((entry) => !matchedNames.has(entry.name)).map((entry) => entry.name),
  }
}

/** Legge `declared-drift.json` e si ferma su una voce che non sa spiegarsi. */
export function parseDeclaredDrift(json: string): DeclaredDrift[] {
  const parsed = JSON.parse(json) as { entries?: unknown }
  if (!Array.isArray(parsed.entries)) throw new Error('declared-drift.json: manca l’elenco «entries»')
  const names = new Set<string>()
  return parsed.entries.map((raw: unknown, index: number) => {
    const entry = raw as Partial<DeclaredDrift>
    const where = `declared-drift.json, voce ${index + 1}`
    if (typeof entry.name !== 'string' || entry.name.trim() === '') throw new Error(`${where}: manca il nome`)
    if (names.has(entry.name)) throw new Error(`${where}: nome ripetuto, ${entry.name}`)
    names.add(entry.name)
    if (typeof entry.reason !== 'string' || entry.reason.trim() === '') throw new Error(`${where} (${entry.name}): manca la ragione`)
    if (!Array.isArray(entry.statements) || entry.statements.length === 0) {
      throw new Error(`${where} (${entry.name}): nessuno statement da riconoscere`)
    }
    for (const source of entry.statements) {
      try {
        new RegExp(source)
      } catch {
        throw new Error(`${where} (${entry.name}): espressione non valida, ${source}`)
      }
    }
    return { name: entry.name, reason: entry.reason, statements: entry.statements }
  })
}
