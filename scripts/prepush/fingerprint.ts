/**
 * L'impronta di un database, e il confronto fra due impronte (#188).
 *
 * Una riga per oggetto: `kind` e `name` lo identificano, `value` lo descrive
 * (corpo, `search_path`, ACL, …). Il confronto nomina gli oggetti e mai i
 * loro valori, perché l'output del pre-push finisce nel terminale.
 *
 * Gira con `node` senza build, grazie allo strip dei tipi (Node ≥ 22.18): qui
 * solo sintassi cancellabile, `import type` e import con l'estensione `.ts`.
 */
export interface FingerprintRow {
  kind: string
  name: string
  value: string
}

/**
 * Le righe di `supabase db query --agent no --output-format json`.
 *
 * Accetta anche la busta `{ rows }` della modalità agente: la CLI la sceglie da
 * sola quando crede di parlare con un agente. Un errore della CLI arriva su
 * stdout come `{ _tag: 'Error' }`: se ne riporta il codice, non il messaggio,
 * che può contenere l'utente del database.
 */
export function parseQueryRows(stdout: string): Record<string, unknown>[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(stdout)
  } catch {
    throw new Error('db query: output non JSON')
  }
  if (Array.isArray(parsed)) return parsed as Record<string, unknown>[]
  if (parsed && typeof parsed === 'object') {
    const envelope = parsed as { _tag?: string; error?: { code?: string }; rows?: unknown }
    if (envelope._tag === 'Error') throw new Error(`db query: ${envelope.error?.code ?? 'errore'}`)
    if (Array.isArray(envelope.rows)) return envelope.rows as Record<string, unknown>[]
  }
  throw new Error('db query: forma dell\'output sconosciuta')
}

function byKey(rows: readonly FingerprintRow[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const row of rows) {
    const key = `${row.kind} ${row.name}`
    if (map.has(key)) throw new Error(`impronta: oggetto ripetuto, la query va corretta: ${key}`)
    map.set(key, row.value)
  }
  return map
}

/** Gli oggetti che differiscono fra la sorgente e lo stack ombra: vuoto se la copia è fedele. */
export function compareFingerprints(source: readonly FingerprintRow[], shadow: readonly FingerprintRow[]): string[] {
  const expected = byKey(source)
  const actual = byKey(shadow)
  const differences: string[] = []
  for (const [key, value] of expected) {
    if (!actual.has(key)) differences.push(`mancante nello stack ombra: ${key}`)
    else if (actual.get(key) !== value) differences.push(`diverso: ${key}`)
  }
  for (const key of actual.keys()) {
    if (!expected.has(key)) differences.push(`in più nello stack ombra: ${key}`)
  }
  return differences
}
